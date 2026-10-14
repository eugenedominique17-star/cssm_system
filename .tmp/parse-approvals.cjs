const fs = require('node:fs');
const parser = require('../frontend/node_modules/@babel/parser');
for (const file of ['frontend/src/components/AccountApprovalCards.jsx', 'frontend/src/pages/admin/StaffApprovals.jsx', 'frontend/src/pages/admin/ClientApprovals.jsx']) {
 parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
 console.log('JSX syntax passed: ' + file);
}
