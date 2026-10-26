const supabase = require('../config/supabase');
const { encrypt, decrypt } = require('../utils/audit-secret');

module.exports = {
  async save(auditEventId, previousPassword) {
    const encrypted = encrypt(previousPassword);
    const { error } = await supabase.from('audit_previous_passwords').upsert({
      audit_event_id: auditEventId,
      ...encrypted,
    }, { onConflict: 'audit_event_id' });
    if (error) throw error;
  },
  async metadata(ids) {
    if (!ids.length) return new Map();
    const { data, error } = await supabase.from('audit_previous_passwords')
      .select('audit_event_id,retention_expires_at').in('audit_event_id', ids);
    if (error) throw error;
    return new Map((data || []).map(row => [row.audit_event_id, {
      available: !row.retention_expires_at || new Date(row.retention_expires_at) > new Date(),
      masked: '********',
    }]));
  },
  async reveal(auditEventId) {
    const { data: audit, error: auditError } = await supabase.from('audit_logs')
      .select('action,outcome').eq('id', auditEventId).maybeSingle();
    if (auditError) throw auditError;
    if (!audit || audit.action !== 'Change password' || audit.outcome !== 'succeeded') return null;
    const { data, error } = await supabase.from('audit_previous_passwords')
      .select('nonce,ciphertext,auth_tag,retention_expires_at').eq('audit_event_id', auditEventId).maybeSingle();
    if (error) throw error;
    return decrypt(data);
  },
};