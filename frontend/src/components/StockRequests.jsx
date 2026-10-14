import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import API from '../api/axios';

const statuses = { pending: 'Pending', completed: 'Approved', rejected: 'Rejected' };
const colors = { pending: 'warning', completed: 'success', rejected: 'error' };
const dateTime = value => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export default function StockRequests({ open, onClose, onSaved, admin, ready }) {
  const [status, setStatus] = useState(admin ? 'pending' : 'all');
  const [page, setPage] = useState(0); const [data, setData] = useState({ entries: [], total: 0 });
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [review, setReview] = useState(null); const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false);
  const busy = useRef(false); const generation = useRef(0);
  const load = useCallback(async () => {
    const version = ++generation.current; setLoading(true); setError('');
    try {
      const result = await API.get('/inventory/requests', { params: { page, status } });
      if (version === generation.current) { setData(result.data); if (!result.data.entries.length && page > 0) setPage(page - 1); }
    } catch (err) { if (version === generation.current) setError(err.response?.data?.message || 'Unable to load stock requests.'); }
    finally { if (version === generation.current) setLoading(false); }
  }, [page, status]);
  useEffect(() => {
    if (!open) return undefined;
    load(); const timer = setInterval(() => { if (!busy.current && !document.hidden) load(); }, 30000);
    return () => { clearInterval(timer); generation.current++; };
  }, [open, load]);
  const decide = async event => {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setSaving(true); setError(''); setSuccess('');
    try {
      const { data: result } = await API.post(`/inventory/${review.approve ? 'approve_restock' : 'reject_restock'}`, { id: review.entry.id, payload: review.approve ? {} : { reason: reason.trim() } });
      setSuccess(result.message); setReview(null); await load(); await onSaved();
    } catch (err) { setError(err.response?.data?.message || 'Could not confirm the review. Retry the same decision safely.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <>
    <Dialog open={open && !review} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{admin ? 'Stock Requests' : 'My Stock Requests'}</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField fullWidth select size="small" label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: { xs: 0, sm: 160 } }}><MenuItem value="all">All requests</MenuItem>{Object.entries(statuses).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
          <Button disabled={loading} onClick={load} sx={{ alignSelf: { xs: 'flex-end', sm: 'auto' } }}>Refresh</Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Pending and rejected requests do not change available stock.</Typography>
        <TableContainer><Table aria-label="Stock requests" sx={{ minWidth: 650 }}><TableHead><TableRow>{['Product / quantity', 'Expiration', 'Requested by', 'Status', 'Review'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
          {loading ? <TableRow><TableCell colSpan={5}>Loading requests…</TableCell></TableRow> : !error && data.entries.map(entry => <TableRow key={entry.id}>
            <TableCell>{entry.inventory_document_items?.map((item, index) => <Typography key={index} variant="body2" fontWeight={700}>{item.products?.name || 'Product'} · +{item.quantity} units</Typography>)}</TableCell>
            <TableCell>{entry.inventory_document_items?.map((item, index) => <Typography key={index} variant="body2">{item.expiry_date || 'Not set'}</Typography>)}</TableCell>
            <TableCell>{entry.actor_name}<Typography variant="caption" display="block">{dateTime(entry.created_at)}</Typography></TableCell>
            <TableCell><Chip size="small" color={colors[entry.status]} label={statuses[entry.status]} /></TableCell>
            <TableCell>{admin && entry.status === 'pending' ? <Stack direction="row" spacing={1}><Button disabled={!ready} onClick={() => { setError(''); setReview({ entry, approve: true }); }}>Approve</Button><Button color="error" disabled={!ready} onClick={() => { setError(''); setReason(''); setReview({ entry, approve: false }); }}>Reject</Button></Stack> : <><Typography variant="body2">{entry.reason || (entry.status === 'pending' ? 'Waiting for admin' : 'Reviewed')}</Typography>{entry.reviewed_at && <Typography variant="caption">Admin #{entry.reviewed_by} · {dateTime(entry.reviewed_at)}</Typography>}</>}</TableCell>
          </TableRow>)}
          {!loading && !error && !data.entries.length && <TableRow><TableCell colSpan={5} align="center">No {status === 'all' ? '' : statuses[status].toLowerCase()} stock requests.</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
        <TablePagination component="div" count={data.total} page={page} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, value) => setPage(value)} />
      </DialogContent><DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
    <Dialog open={open && !!review} onClose={() => { if (!saving) setReview(null); }} fullWidth maxWidth="sm"><form onSubmit={decide}><DialogTitle>{review?.approve ? 'Approve Stock Request' : 'Reject Stock Request'}</DialogTitle><DialogContent dividers><Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {review?.entry.inventory_document_items?.map((item, index) => <Typography key={index}>{item.products?.name} · {item.quantity} units · Expiry: {item.expiry_date || 'Not set'}</Typography>)}
      <Alert severity={review?.approve ? 'info' : 'warning'}>{review?.approve ? 'Approve only after verifying the quantity and expiration date of the actual stock. Approval adds these units once.' : 'This request will be rejected. Available stock will stay unchanged.'}</Alert>
      {!review?.approve && <TextField required label="Reason for rejection" multiline minRows={2} value={reason} onChange={e => setReason(e.target.value)} disabled={saving} inputProps={{ minLength: 3, maxLength: 500 }} />}
    </Stack></DialogContent><DialogActions><Button disabled={saving} onClick={() => setReview(null)}>Cancel</Button><Button type="submit" variant="contained" color={review?.approve ? 'primary' : 'error'} disabled={saving}>{saving ? 'Saving…' : review?.approve ? 'Confirm Approval' : 'Confirm Rejection'}</Button></DialogActions></form></Dialog>
  </>;
}
