const supabase = require('../config/supabase');
const TransactionModel = require('./transaction.model');
const { attachInventoryContext, attachOrderContext } = require('../utils/audit-context');
const Secret = require('./audit-secret.model');

module.exports = {
  async start(entry) {
    const { data, error } = await supabase.from('audit_logs').insert(entry).select('id').single();
    if (error) throw error;
    return data.id;
  },
  async finish(id, fields) {
    const { error } = await supabase.from('audit_logs').update(fields).eq('id', id).eq('outcome', 'pending');
    if (error) throw error;
  },
  async list({ page, role, outcome, entity, search, from, to }) {
    const size = 25;
    let query = supabase.from('audit_logs').select('*', { count: 'exact' });
    if (role) query = query.eq('actor_role', role);
    if (outcome) query = query.eq('outcome', outcome);
    if (entity) query = query.eq('entity_type', entity);
    if (search) query = query.ilike('actor_name', `%${search}%`);
    if (from) query = query.gte('created_at', `${from}T00:00:00+08:00`);
    if (to) {
      const end = new Date(`${to}T00:00:00+08:00`);
      end.setUTCDate(end.getUTCDate() + 1);
      query = query.lt('created_at', end.toISOString());
    }
    const { data, count, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * size, (page + 1) * size - 1);
    if (error) throw error;
    const ids=[...new Set(data.filter(entry=>entry.outcome==='succeeded' && entry.entity_type==='Inventory' && entry.action.startsWith('Inventory ') && entry.details?.snapshot_version!==1 && /^[0-9a-f-]{36}$/i.test(entry.entity_id || '')).map(entry=>entry.entity_id))];
    let entries=data;
    const passwordIds = data.filter(entry => entry.outcome === 'succeeded' && entry.action === 'Change password').map(entry => entry.id);
    if (passwordIds.length) {
      const metadata = await Secret.metadata(passwordIds);
      entries = entries.map(entry => metadata.has(entry.id) ? { ...entry, details: { ...entry.details, previous_password: metadata.get(entry.id) } } : entry);
    }
    if(ids.length) {
      const linked=await supabase.from('inventory_documents').select('id,actor_id,actor_name,actor_role,status,reviewed_by,reason,inventory_document_items(product_id,quantity,expiry_date,products(name))').in('id',ids);
      // Older entries remain readable when their optional linked record is unavailable.
      if(!linked.error) entries=attachInventoryContext(data,linked.data || []);
    }
    const orderIds = [...new Set(data
      .filter(entry => entry.outcome === 'succeeded' && entry.entity_type === 'Order' && entry.action === 'Create order' && /^\d+$/.test(entry.entity_id || ''))
      .map(entry => entry.entity_id))];
    if (orderIds.length) {
      try {
        const orders = await TransactionModel.getAuditDetails(orderIds);
        entries = attachOrderContext(entries, orders);
      } catch (error) {
        console.error('Order audit enrichment failed:', error.code || 'unavailable');
      }
    }
    return { entries, total: count, page, pageSize: size };
  },
  async latestPasswordChangeForUser(userId) {
    const { data, error } = await supabase.from('audit_logs')
      .select('id,created_at,details')
      .eq('action', 'Change password')
      .eq('outcome', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data || []).find(entry => String(entry.details?.account?.id) === String(userId)) || null;
  },
};
