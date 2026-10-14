import React, { useState } from 'react';
import { Avatar, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Close from '@mui/icons-material/Close';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';

const registeredDate = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not provided';
};

function Details({ account, role, expanded = false }) {
  const fields = [
    ...(expanded ? [['Name', account.name], ['User ID', account.user_id || `#${account.id}`], ['Account type', role === 'staff' ? 'Staff' : 'Client']] : []),
    ['Email', account.email],
    ['Phone', account.phone],
    ['Registered', registeredDate(account.created_at)],
    ...(role === 'staff' ? [['Source', account.created_by ? `Created by staff #${account.created_by}` : 'Self-registered']] : []),
  ];
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: expanded ? '1fr' : { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {fields.map(([label, value]) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>{value || 'Not provided'}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function AccountApprovalCards({ accounts, role, onApprove, onReject }) {
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const runAction = async (action, id) => {
    if (busyId !== null) return;
    setBusyId(id);
    try { await action(id); } finally { setBusyId(null); }
  };
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 2, minWidth: 0 }}>
        {accounts.map(account => (
          <Card key={account.id} component="article" variant="outlined" sx={{ minWidth: 0, borderRadius: '18px', boxShadow: '0 6px 20px rgba(24,61,50,.04)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: { xs: 2, sm: 3 }, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.5 }}>
                <Avatar sx={{ bgcolor: '#D8F3E5', color: '#066649', fontWeight: 800, width: 44, height: 44 }}>{account.name?.trim().charAt(0).toUpperCase() || '?'}</Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{account.name || 'Unnamed applicant'}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>User ID: {account.user_id || `#${account.id}`}</Typography>
                  <Chip label="Pending approval" size="small" variant="outlined" sx={{ mt: 1, fontSize: '0.7rem' }} />
                </Box>
              </Box>
              <Details account={account} role={role} />
            </Box>
            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, '& .MuiButton-root': { flex: '1 1 auto', minHeight: 42, textTransform: 'none', whiteSpace: 'nowrap' } }}>
              <Button variant="outlined" startIcon={<VisibilityOutlined />} onClick={() => setSelected(account)}>View Details</Button>
              <Button variant="outlined" color="error" startIcon={<Close />} disabled={busyId !== null} onClick={() => runAction(onReject, account.id)}>Reject</Button>
              <Button variant="contained" startIcon={<CheckCircle />} disabled={busyId !== null} onClick={() => runAction(onApprove, account.id)}>{busyId === account.id ? 'Processing…' : 'Approve'}</Button>
            </Box>
          </Card>
        ))}
      </Box>
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm" aria-labelledby="account-details-title">
        <DialogTitle id="account-details-title">Registration details</DialogTitle>
        <DialogContent dividers>{selected && <Details account={selected} role={role} expanded />}</DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>
    </>
  );
}
