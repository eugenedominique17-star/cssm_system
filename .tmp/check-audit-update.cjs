const s = require('../backend/config/supabase');
(async () => {
  const snapshot = await s.rpc('inventory_audit_product_state', { p_product: -1 });
  console.log('Audit snapshot function:', snapshot.error ? snapshot.error.message : 'Installed');
  // The invalid action exits before any database write or lock is attempted.
  const command = await s.rpc('inventory_audited_command', {
    p_audit_id: '00000000-0000-4000-8000-000000000001',
    p_id: '00000000-0000-4000-8000-000000000002',
    p_kind: '__readiness_check__', p_payload: {}, p_actor: 0, p_role: 'none',
  });
  console.log('Audited command:', command.error?.code === 'PT400' && command.error?.message === 'Invalid audited inventory action.' ? 'Installed; invalid test request safely rejected' : command.error?.message || 'Unexpected response');
  const logs = await s.from('audit_logs').select('id', { count: 'exact', head: true }).contains('details', { snapshot_version: 1 });
  console.log('Detailed activity records:', logs.error ? logs.error.message : logs.count);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
