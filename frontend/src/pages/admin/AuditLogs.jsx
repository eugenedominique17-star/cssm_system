import React, { useEffect, useState } from 'react';
import { Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { HistoryRounded, RefreshRounded } from '@mui/icons-material';
import API from '../../api/axios';
import AuditActivityDetails from '../../components/AuditActivityDetails';
import { auditTitle } from '../../utils/auditDetails.mjs';

const initialFilters = { search: '', role: '', entity: '', outcome: '', from: '', to: '' };
const timestamp = value => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not confirmed';
const outcomeColor = { succeeded: 'success', failed: 'error', pending: 'warning' };
const outcomeLabel = { succeeded: 'Succeeded', failed: 'Failed', pending: 'Unconfirmed' };

export default function AuditLogs() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ entries: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    API.get('/admin/audit-logs', { params: { ...filters, page }, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setData(response.data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Unable to load activity history. Please retry.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, page, refresh]);

  const field = key => ({ value: draft[key], onChange: e => setDraft(current => ({ ...current, [key]: e.target.value })), size: 'small' });
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: '#D8F3E5', color: '#087F5B' }}><HistoryRounded /></Avatar>
          <Box><Typography fontWeight={800}>Activity history</Typography><Typography variant="body2" color="text.secondary">Who did what, and when. Times shown in Philippine time.</Typography></Box>
        </Stack>
        <Button startIcon={<RefreshRounded />} onClick={() => setRefresh(value => value + 1)} disabled={loading}>Refresh</Button>
      </Stack>
      <Paper component="form" onSubmit={e => { e.preventDefault(); setPage(0); setFilters({ ...draft }); }} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          <TextField label="Search person" inputProps={{ maxLength: 100 }} {...field('search')} />
          <TextField select label="Role" {...field('role')}><MenuItem value="">All roles</MenuItem>{['admin', 'staff', 'client'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
          <TextField select label="Activity" {...field('entity')}><MenuItem value="">All activities</MenuItem>{['Account', 'Product', 'Promo', 'Order', 'Approval', 'Inventory'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
          <TextField select label="Result" {...field('outcome')}><MenuItem value="">All results</MenuItem>{Object.entries(outcomeLabel).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
          <TextField type="date" label="From" InputLabelProps={{ shrink: true }} {...field('from')} />
          <TextField type="date" label="To" InputLabelProps={{ shrink: true }} inputProps={{ min: draft.from || undefined }} {...field('to')} />
          <Button type="submit" variant="contained">Apply filters</Button>
          <Button onClick={() => { setDraft(initialFilters); setFilters(initialFilters); setPage(0); }}>Clear filters</Button>
        </Box>
      </Paper>
      {error ? <Alert severity="error" action={<Button color="inherit" onClick={() => setRefresh(value => value + 1)}>Retry</Button>}>{error}</Alert> : loading ? <Box role="status"><span className="sr-only">Loading audit history</span>{[1, 2, 3, 4].map(key => <Skeleton key={key} variant="rounded" height={64} sx={{ mb: 1 }} />)}</Box> : <>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 720 }} aria-label="Audit history">
            <TableHead><TableRow>{['Person', 'Action', 'Reference', 'Result', 'Time', 'Details'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {data.entries.map(entry => <TableRow key={entry.id} hover>
                <TableCell><Typography variant="body2" fontWeight={700}>{entry.actor_name}</Typography><Typography variant="caption" color="text.secondary">{entry.actor_role} · #{entry.actor_id}</Typography></TableCell>
                <TableCell>{auditTitle(entry)}</TableCell>
                <TableCell>{entry.details?.reference_type || entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ''}</TableCell>
                <TableCell><Chip size="small" color={outcomeColor[entry.outcome]} label={outcomeLabel[entry.outcome]} /></TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{timestamp(entry.created_at)}</TableCell>
                <TableCell><Button size="small" onClick={() => setSelected(entry)} aria-label={`View ${auditTitle(entry)} by ${entry.actor_name}`}>View</Button></TableCell>
              </TableRow>)}
              {!data.entries.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 7 }}><HistoryRounded sx={{ fontSize: 44, color: '#087F5B', mb: 1 }} /><Typography fontWeight={700}>No activity found</Typography><Typography variant="body2" color="text.secondary">New activity appears here after audit logging is enabled. Try clearing your filters.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
          <TablePagination component="div" count={data.total} page={page} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, value) => setPage(value)} />
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Records authenticated API requests from activation onward. Unconfirmed means the final result was not recorded; it does not mean the action failed.</Typography>
      </>}
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Activity details</DialogTitle>
        <DialogContent dividers>{selected && <Stack spacing={2}>
          <Typography fontWeight={800}>{auditTitle(selected)}</Typography>
          <Typography>{selected.actor_name} · {selected.actor_role}</Typography>
          <Typography variant="body2">Started: {timestamp(selected.created_at)}<br />Finished: {timestamp(selected.finished_at)}</Typography>
          <AuditActivityDetails entry={selected} />
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>Audit ID: {selected.id}</Typography>
        </Stack>}</DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
