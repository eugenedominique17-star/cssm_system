const { randomBytes } = require('node:crypto');

// 144 random bits; fixed characters satisfy existing password checks.
const generateTempPassword = () => `Aa1!${randomBytes(18).toString('base64url')}`;

module.exports = { generateTempPassword };
