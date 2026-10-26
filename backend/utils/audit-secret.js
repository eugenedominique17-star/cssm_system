const crypto = require('crypto');

const key = () => {
  const value = process.env.AUDIT_SECRET_KEY;
  if (!value) throw Object.assign(new Error('Audit secret key is not configured.'), { code: 'AUDIT_SECRET_KEY_MISSING' });
  const decoded = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (decoded.length !== 32) throw Object.assign(new Error('Audit secret key must be 32 bytes.'), { code: 'AUDIT_SECRET_KEY_INVALID' });
  return decoded;
};

const validateKey = () => { key(); };

const retentionDate = () => {
  const days = Number(process.env.AUDIT_SECRET_RETENTION_DAYS || 90);
  const safeDays = Number.isInteger(days) && days > 0 && days <= 3650 ? days : 90;
  return new Date(Date.now() + safeDays * 86400000).toISOString();
};

function encrypt(value) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), nonce);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
    retention_expires_at: retentionDate(),
  };
}

function decrypt(record) {
  if (!record || (record.retention_expires_at && new Date(record.retention_expires_at) <= new Date())) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(record.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(record.auth_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, retentionDate, validateKey };