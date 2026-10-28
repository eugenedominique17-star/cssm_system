const Joi = require('joi');
const supabase = require('../config/supabase');

const integer = Joi.number().integer().min(1).max(1000000);
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null);
const item = Joi.object({ product_id: integer.required(), quantity: integer.required(), batch_code: Joi.string().trim().max(100).required(), expiry_date: date.required() });
const schemas = {
  approve_restock: Joi.object({}),
  reject_restock: Joi.object({ reason: Joi.string().trim().min(3).max(500).required() }),
  restock: Joi.object({ product_id: integer.required(), quantity: integer.required(), expiry_date: date.required() }),
  correct: Joi.object({ batch_id: Joi.string().uuid().required(), actual_quantity: Joi.number().integer().min(0).max(1000000).required(), expected_quantity: Joi.number().integer().min(0).required(), reason: Joi.string().trim().min(3).max(500).required() }),
  remove_expired: Joi.object({ batch_id: Joi.string().uuid().required(), expected_quantity: Joi.number().integer().min(1).required(), reason: Joi.string().trim().min(3).max(500).required() }),
  create_product: Joi.object({ name: Joi.string().trim().min(2).max(200).required(), category: Joi.string().trim().min(2).max(100).required(), barcode: Joi.string().trim().max(100).allow('',null).default(null), price: Joi.number().positive().max(99999999).precision(2).required(), minimum_stock: Joi.number().integer().min(0).max(1000000).required(), quantity: Joi.number().integer().min(0).max(1000000).required(), expiry_date: date.required() }),
  edit_product: Joi.object({ product_id: integer.required(), name: Joi.string().trim().min(2).max(200).required(), category: Joi.string().trim().min(2).max(100).required(), barcode: Joi.string().trim().max(100).allow('',null).default(null), price: Joi.number().positive().max(99999999).precision(2).required(), minimum_stock: Joi.number().integer().min(0).max(1000000).required() }),
  expiry: Joi.object({ batch_id: Joi.string().uuid().required(), expiry_date: date.invalid(null).required(), expected_expiry: date.required(), reason: Joi.string().trim().min(8).max(500).required(), confirm_reactivation: Joi.boolean().default(false) }),
  delivery: Joi.object({ supplier: Joi.string().trim().max(150).required(), receipt_number: Joi.string().trim().max(100).required(), reason: Joi.string().trim().max(500).allow('').default(''), items: Joi.array().items(item).min(1).max(100).required() }),
  transfer: Joi.object({ batch_id: Joi.string().uuid().required(), quantity: integer.required(), reason: Joi.string().trim().max(500).allow('').default('') }),
  adjustment: Joi.object({ batch_id: Joi.string().uuid().allow(null).required(), product_id: integer, batch_code: Joi.string().trim().max(100), expiry_date: date, quantity: Joi.number().integer().min(-1000000).max(1000000).invalid(0).required(), expected_quantity: Joi.number().integer().min(0).required(), location: Joi.string().valid('warehouse','store').required(), reason: Joi.string().trim().min(3).max(500).required() }),
  reversal: Joi.object({ original_id: Joi.string().uuid().required(), reason: Joi.string().trim().min(3).max(500).required() }),
  approve: Joi.object({}), reject: Joi.object({}),
};
exports.schemas = schemas;
function failure(res, error) {
  const code = error.code || '';
  const status = /^PT(400|403|404|409)$/.test(code) ? Number(code.slice(2)) : ['23505','23503','23514'].includes(code) ? 409 : ['22P02','22007','22008','22003'].includes(code) ? 400 : 503;
  const message = code.startsWith('PT') ? error.message : status===409 ? 'This product, barcode or reference already exists, or the stock change conflicts with current records.' : status===400 ? 'Invalid quantity, date or reference.' : 'Inventory is unavailable. Check the inventory setup and try again.';
  res.status(status).json({ message });
}
exports.command = async (req,res) => {
  const kind = req.params.kind;
  if (!schemas[kind]) return res.status(400).json({ message: 'Invalid inventory action.' });
  if (['approve_restock','reject_restock','adjustment','reversal','approve','reject','expiry','correct','remove_expired','create_product','edit_product'].includes(kind) && req.user.role!=='admin') return res.status(403).json({ message: 'Admin access required.' });
  const input = Joi.object({ id: Joi.string().uuid().required(), payload: schemas[kind].required() }).validate(req.body);
  if (input.error) return res.status(400).json({ message: input.error.details[0].message });
  try {
    const auditedKinds=['restock','correct','remove_expired','create_product','edit_product','approve_restock','reject_restock'];
    if(req.auditId && auditedKinds.includes(kind)) {
      const result=await supabase.rpc('inventory_audited_command',{p_audit_id:req.auditId,p_id:input.value.id,p_kind:kind,p_payload:input.value.payload,p_actor:req.user.id,p_role:req.user.role});
      if(!result.error) return res.json({inventoryId:result.data,message:({restock:req.user.role==='staff'?'Restock submitted for admin approval. Available stock is unchanged.':'Stock added successfully.',correct:'Stock count corrected.',remove_expired:'Expired stock removed.',create_product:'Product created successfully.',edit_product:'Product details updated.',approve_restock:'Stock request approved. Stock has been added.',reject_restock:'Stock request rejected. Stock is unchanged.'})[kind]});
      // Only a missing function permits the pre-migration path. Never retry a
      // failed stock mutation through a different function.
      if(result.error.code!=='PGRST202') throw result.error;
    }
    if (['approve_restock','reject_restock'].includes(kind)) {
      const {data,error}=await supabase.rpc('inventory_review_restock',{p_id:input.value.id,p_approve:kind==='approve_restock',p_reason:input.value.payload.reason || '',p_actor:req.user.id});
      if(error) throw error;
      return res.json({message:kind==='approve_restock'?'Stock request approved. Stock has been added.':'Stock request rejected. Stock is unchanged.',inventoryId:data});
    }
    if (['restock','correct','remove_expired','create_product','edit_product'].includes(kind)) {
      const {data,error}=await supabase.rpc(kind==='restock'?'inventory_submit_restock':'inventory_simple_command', {p_id:input.value.id,p_kind:kind,p_payload:input.value.payload,p_actor:req.user.id,p_role:req.user.role});
      if(error) throw error;
      return res.json({message:({restock:req.user.role==='staff'?'Restock submitted for admin approval. Available stock is unchanged.':'Stock added successfully.',correct:'Stock count corrected.',remove_expired:'Expired stock removed.',create_product:'Product created successfully.',edit_product:'Product details updated.'})[kind],inventoryId:data});
    }
    if (kind === 'expiry') {
      const payload = input.value.payload;
      const { data, error } = await supabase.rpc('inventory_edit_expiry', { p_id: input.value.id, p_batch_id: payload.batch_id, p_expiry: payload.expiry_date, p_expected: payload.expected_expiry, p_reason: payload.reason, p_actor: req.user.id, p_confirm_reactivation: payload.confirm_reactivation });
      if (error) throw error;
      return res.json({ message: 'Batch expiry updated. Previous and new dates are recorded in the audit log.', inventoryId: data });
    }
    const { data,error } = await supabase.rpc('inventory_command', { p_id: input.value.id, p_kind: kind, p_payload: input.value.payload, p_actor: req.user.id, p_role: req.user.role });
    if (error) throw error;
    res.json({ message: kind==='delivery' ? 'Delivery submitted for admin approval.' : 'Inventory action completed.', inventoryId: data });
  } catch (error) { failure(res,error); }
};
exports.overview = async (_req,res) => {
  try {
    // Explicit paging avoids Supabase's default row cap silently hiding stock.
    const all = async (table, columns, order) => {
      const rows=[];
      for(let offset=0;;offset+=1000) {
        const {data,error}=await supabase.from(table).select(columns).order(order).range(offset,offset+999);
        if(error) throw error;
        rows.push(...data);
        if(data.length<1000) return rows;
      }
    };
    const batchColumns = req.user.role === 'admin' ? '*' : 'id,product_id,batch_code,expiry_date,warehouse_qty,store_qty,created_at';
    const [products,batches,capability,approval]=await Promise.all([all('products','*','id'), all('inventory_batches',batchColumns,'id'),supabase.rpc('inventory_simple_ready'),supabase.rpc('inventory_restock_approval_ready')]);
    res.json({products,batches,simpleReady:capability.data===true,approvalReady:approval.data===true});
  } catch(error) { failure(res,error); }
};
exports.history = async (req,res) => {
  const page=Number(req.query.page || 0);
  if(!Number.isInteger(page)||page<0||page>100000) return res.status(400).json({message:'Invalid page.'});
  const type=req.query.type || 'documents';
  if(!['documents','movements'].includes(type)) return res.status(400).json({message:'Invalid history type.'});
  try {
    const table=type==='documents'?'inventory_documents':'inventory_movements';
    const columns=type==='documents'?'*, inventory_document_items(*)':'*, inventory_batches!inner(product_id,batch_code), inventory_documents(actor_name,actor_role,reason)';
    let query=supabase.from(table).select(columns,{count:'exact'});
    if(type==='documents' && req.user.role==='staff') query=query.eq('actor_role','staff').eq('actor_id',req.user.id);
    if(req.query.product_id && type==='movements') {
      const productId=Number(req.query.product_id);
      if(!Number.isInteger(productId)||productId<1) return res.status(400).json({message:'Invalid product.'});
      query=query.eq('inventory_batches.product_id',productId);
    }
    const {data,count,error}=await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*25,page*25+24);
    if(error) throw error;
    res.json({entries:data,total:count});
  } catch(error) { failure(res,error); }
};

exports.requests = async (req,res) => {
  const page=Number(req.query.page || 0); const status=req.query.status || 'all';
  if(!Number.isInteger(page)||page<0||page>100000||!['all','pending','completed','rejected'].includes(status)) return res.status(400).json({message:'Invalid request filter.'});
  try {
    let query=supabase.from('inventory_documents').select('id,status,actor_name,actor_id,actor_role,created_at,reviewed_at,reviewed_by,reason,inventory_document_items(quantity,expiry_date,products(name))',{count:'exact'})
      .eq('kind','restock').eq('actor_role','staff').or('status.eq.pending,reviewed_by.not.is.null');
    if(req.user.role==='staff') query=query.eq('actor_id',req.user.id);
    if(status!=='all') query=query.eq('status',status);
    const {data,count,error}=await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*25,page*25+24);
    if(error) throw error;
    res.json({entries:data,total:count});
  } catch(error) {failure(res,error);}
};

exports.reorders = async (_req, res) => {
  try {
    const { data, error } = await supabase.rpc('inventory_reorder_orders');
    if (error) throw error;
    res.json({ entries: data || [] });
  } catch (error) {
    failure(res, error);
  }
};

exports.receiveReorder = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can receive reorder deliveries and record purchase prices.' });
  }
  const input = Joi.object({
    expiry_date: date,
    purchase_price: Joi.number().positive().precision(2).required(),
  }).validate(req.body || {});
  if (input.error) return res.status(400).json({ message: input.error.details[0].message });
  if (!req.params.id || !/^[0-9a-f-]{36}$/i.test(req.params.id)) {
    return res.status(400).json({ message: 'Invalid reorder reference.' });
  }
  try {
    const { data, error } = await supabase.rpc('inventory_receive_reorder', {
      p_id: req.params.id,
      p_expiry_date: input.value.expiry_date || null,
      p_purchase_price: input.value.purchase_price,
      p_actor: req.user.id,
      p_role: req.user.role,
    });
    if (error) throw error;
    res.json({ reorderId: data, message: 'Reorder received. 50 units were added to stock.' });
  } catch (error) {
    failure(res, error);
  }
};
