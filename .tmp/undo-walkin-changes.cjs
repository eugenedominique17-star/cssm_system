const fs=require('fs'),path=require('path'),cp=require('child_process');
const norm=s=>s.replace(/\r\n/g,'\n');
const backup=path.resolve('.tmp/before-walkin-undo');
fs.mkdirSync(backup,{recursive:true});
const touched=[];
function edit(file,fn){
 const old=fs.readFileSync(file,'utf8'); const next=fn(norm(old));
 const dest=path.join(backup,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,old);
 fs.writeFileSync(file,old.includes('\r\n')?next.replace(/\n/g,'\r\n'):next);touched.push(file);
}
function r(s,a,b){if(!s.includes(a))throw new Error('Undo target missing: '+a.slice(0,90));return s.replace(a,b);}
const original=name=>norm(fs.readFileSync('.tmp/undo-build-expiry-check-'+name,'utf8'));
edit('frontend/src/pages/public/Homepage.jsx',()=>original('Homepage.jsx'));
edit('frontend/src/pages/admin/Reports.jsx',()=>norm(fs.readFileSync('.tmp/recovered-0-2.txt','utf8')));
edit('frontend/src/pages/staff/OrderManagement.jsx',()=>original('OrderManagement.jsx'));
edit('frontend/src/pages/staff/ReceiptManagement.jsx',()=>{
 let s=original('ReceiptManagement.jsx');
 s=r(s,'const ReceiptManagement = () => {','const ReceiptManagement = () => {\n  const checkoutRequest = useRef(null);\n  const checkoutBusy = useRef(false);');
 s=r(s,'  const resetForm = () => {','  const resetForm = () => {\n    checkoutRequest.current = null;');
 s=r(s,'  const handleCreateReceipt = async () => {','  const handleCreateReceipt = async () => {\n    if (checkoutBusy.current) return;');
 s=r(s,'    setCreating(true);','    checkoutBusy.current = true;\n    setCreating(true);');
 s=r(s,'      const response = walkInRequestId','      const signature = JSON.stringify(payload);\n      if (!checkoutRequest.current || checkoutRequest.current.signature !== signature) {\n        checkoutRequest.current = { signature, id: crypto.randomUUID() };\n      }\n      payload.request_id = checkoutRequest.current.id;\n\n      const response = walkInRequestId');
 s=r(s,'      setDialogOpen(false);\n      resetForm();','      setDialogOpen(false);\n      checkoutRequest.current = null;\n      resetForm();');
 s=r(s,'    } finally {\n      setCreating(false);','    } finally {\n      checkoutBusy.current = false;\n      setCreating(false);');
 return s;
});
edit('frontend/src/App.js',s=>{
 s=s.replace('Routes, Route, Navigate, useLocation','Routes, Route, useLocation');
 if(!s.includes("import OrderManagement from"))s=s.replace("import ReceiptManagement from './pages/staff/ReceiptManagement';", "import ReceiptManagement from './pages/staff/ReceiptManagement';\nimport OrderManagement from './pages/staff/OrderManagement';");
 return s.replace('<Navigate to="/staff/receipts" replace />','<OrderManagement />');
});
edit('frontend/src/components/DashboardLayout.jsx',s=>{
 s=s.replace("label: 'Cashier & Receipts'","label: 'Receipts'").replace("label: 'New Order'","label: 'Orders'");
 if(!s.includes("href: '/staff/order-management'"))s=s.replace("    { label: 'Receipts'", "    { label: 'Orders', href: '/staff/order-management', icon: ShoppingBagRounded },\n    { label: 'Receipts'");
 return s;
});
edit('frontend/src/components/Navbar.jsx',s=>s.replace('label: "Cashier & Receipts"','label: "Receipts"'));
edit('frontend/src/components/Footer.jsx',s=>s.replace('09515200688','+63 912 345 6789'));
edit('frontend/src/pages/user/Dashboard.jsx',s=>s.replace('import { useOrderStatusSSE } from "../../hooks/useOrderStatusSSE";\n','').replace('  useOrderStatusSSE({ onUpdate: () => fetchData(true), onReconnect: () => fetchData(true) });\n\n',''));
edit('frontend/src/pages/user/Favorites.jsx',s=>{
 s=r(s,'import { useFavorites } from "../../hooks/useFavorites";', 'import { useFavorites } from "../../hooks/useFavorites";\nimport { useCart } from "../../contexts/CartContext";');
 s=r(s,'  const navigate = useNavigate();','  const navigate = useNavigate();\n  const { addToCart } = useCart();');
 return r(s,'              onFavoriteToggle={toggleFavorite}', '              onFavoriteToggle={toggleFavorite}\n              onAddToCart={addToCart}');
});
edit('frontend/src/hooks/useOrderStatusSSE.js',s=>s.replace('onUpdate, onReconnect, enabled','onUpdate, enabled')
 .replace('  const onReconnectRef = useRef(onReconnect);\n','').replace('    onReconnectRef.current = onReconnect;\n','')
 .replace('      // Reload authoritative data on first connection and after missed events.\n      onReconnectRef.current?.();','      // Connection confirmed — nothing needed here but can be used for logging'));
edit('frontend/src/pages/user/OrderHistory.jsx',s=>{
 s=r(s,'  // Real-time notification state (from SSE)','  const [reorderingOrderId, setReorderingOrderId] = useState(null);\n  // Real-time notification state (from SSE)');
 s=s.replace('onUpdate: handleOrderStatusUpdate, onReconnect: refreshRequests','onUpdate: handleOrderStatusUpdate')
 .replaceAll("['completed', 'approved'].includes(liveNotification.status)",'liveNotification.status === "approved"')
 .replace('"Purchase completed!" : "Purchase history updated"','"✅ Order Completed!" : "❌ Order Cancelled"')
 .replace('                  <TableCell>Status</TableCell>\n                  <TableCell>Cashier</TableCell>\n','')
 .replace('colSpan={8}','colSpan={6}');
 s=r(s,'                      <Chip label="Paid / Completed" size="small" color="success" />\n                    </TableCell>\n                    <TableCell>{order.staff_name || "Not recorded"}</TableCell>\n                    <TableCell>\n                      {new Date(order.created_at).toLocaleString(\'en-PH\', { timeZone: \'Asia/Manila\' })}', '                      {new Date(order.created_at).toLocaleString()}');
 return s;
});
edit('backend/controllers/transaction.controller.js',s=>r(s,'    sendToUser(user_id, "order_status_update", {\n      transactionId,\n      status: "completed",\n      receipt_number,\n      total_amount,\n      staff_id: req.user.id,\n      message: "Your in-store purchase is complete. Your receipt is ready.",\n    });\n\n',''));
edit('backend/routes/transactions.routes.js',s=>{
 s=s.replace(/const walkInOnly = [\s\S]*?\n\}\);\n/,'');
 s=s.replace("authorize('client'), walkInOnly", "authorize('client'), transactionController.createWalkInRequest")
 .replace("router.post('/walk-in-request/staff', authenticate, authorize('staff'), walkInOnly);", "router.post('/walk-in-request/staff', authenticate, authorize('staff'), transactionController.createStaffWalkInRequest);")
 .replace("router.post('/walk-in-requests/:id/complete', authenticate, authorize('staff'), walkInOnly);", "router.post('/walk-in-requests/:id/complete', authenticate, authorize('staff'), transactionController.completeWalkInRequest);");return s;
});
edit('backend/models/submission.model.js',s=>s.replace("return submissions.filter(submission => submission.type !== 'walk_in_order').length;",'return submissions.length;'));
edit('backend/controllers/admin.controller.js',s=>{
 s=s.replace("res.json(submissions.filter(submission => submission.type !== 'walk_in_order'));",'res.json(submissions);')
 .replace("    if (submission.type === 'walk_in_order') {\n      return res.status(410).json({ message: 'Legacy order requests cannot be approved as sales. Use the cashier for direct in-store purchases.' });\n    }\n",'')
 .replace("if (chart === 'sales_trend' || req.query.start_date !== undefined || req.query.end_date !== undefined)","if (chart === 'sales_trend')");
 s=r(s,`      if (chart === 'sales_trend') {
        const report = await TransactionModel.getSalesTrend(start_date, end_date);
        return res.json({ ...report, period: 'custom', chart, start_date, end_date });
      }
      const data = chart === 'sales_category'
        ? await TransactionModel.getSalesByCategory(period, month, start_date, end_date)
        : await TransactionModel.getTopProducts(period, month, start_date, end_date);
      const summary = await TransactionModel.getSalesSummary(period, month, start_date, end_date);
      return res.json({ data, summary, period: 'custom', chart, start_date, end_date });`, `      const report = await TransactionModel.getSalesTrend(start_date, end_date);
      return res.json({ ...report, period: 'custom', chart, start_date, end_date });`);
 return s;
});
edit('backend/models/transaction.model.js',s=>{
 s=s.replace("const { salesProjection } = require('../utils/sales-projection');\n",'')
 .replace('      projection: salesProjection(allTransactions),\n','')
 .replaceAll('period, month, startDate, endDate','period, month').replaceAll("period = 'monthly', month, startDate, endDate", "period = 'monthly', month");
 s=s.replace(/  if \(startDate && endDate\) \{[\s\S]*?\n  \}\n/,'');return s;
});
edit('backend/tests/reports.test.js',s=>s.slice(0,s.indexOf("\ntest('custom ranges use identical"))+'\n');
edit('backend/tests/sales-auth.test.js',s=>{
 const start=s.indexOf("test('direct cashier sale notifies"); const end=s.indexOf("test('authentication reloads",start);
 if(start<0||end<0)throw new Error('Test range missing');return s.slice(0,start)+s.slice(end);
});
fs.writeFileSync(path.join(backup,'restored-files.json'),JSON.stringify(touched,null,2));
console.log('Restored '+touched.length+' files; preserved checkout idempotency from before this task.');
