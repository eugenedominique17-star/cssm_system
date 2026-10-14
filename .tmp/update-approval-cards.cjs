const fs = require('node:fs');
for (const role of ['Client', 'Staff']) {
 const file = `frontend/src/pages/admin/${role}Approvals.jsx`;
 let text = fs.readFileSync(file, 'utf8');
 text = text.replace(/import \{[\s\S]*?\} from ['"]@mui\/material['"];\r?\n/, "import { Box, Typography, Paper, CircularProgress, Alert, Card, Grid } from '@mui/material';\n");
 text = text.replace(/import \{ CheckCircle, Cancel, PersonAdd \} from (['"])@mui\/icons-material\1;/, "import { PersonAdd } from '@mui/icons-material';\nimport AccountApprovalCards from '../../components/AccountApprovalCards';");
 const start = text.indexOf('        <TableContainer');
 const end = text.indexOf('</TableContainer>', start) + '</TableContainer>'.length;
 if (start < 0 || end < start) throw Error('Table not found');
 text = text.slice(0, start) + `        <AccountApprovalCards accounts={pending${role === 'Client' ? 'Clients' : 'Staff'}} role="${role.toLowerCase()}" onApprove={handleApprove} onReject={handleReject} />` + text.slice(end);
 if (role === 'Staff') {
  const a = text.indexOf('  const getCreatedByLabel');
  const b = text.indexOf('  if (loading)', a);
  text = text.slice(0, a) + text.slice(b);
 }
 text = text.replaceAll('      fetchPending();', '      await fetchPending();');
 fs.writeFileSync(file, text);
}
