import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import API from '../api/inventory';
import { philippineDate, daysRemaining, matchesExpiry } from '../utils/expiry.mjs';

export default function ExpiryMonitor({ products, batches, admin, onSaved }) {
  const [today, setToday] = useState(philippineDate);
  const [filter, setFilter] = useState('30');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('all');
  const [selected, setSelected] = useState(null);
  const [expiry, setExpiry] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pending = useRef(null);
  const busy = useRef(false);
  useEffect(() => { const timer = setInterval(() => setToday(philippineDate()), 60000); return () => clearInterval(timer); }, []);
  const names = new Map(products.map(product => [product.id, product.name]));
  const matches = batch => {
    if (batch.warehouse_qty + batch.store_qty === 0) return false;
    if (location === 'warehouse' && batch.warehouse_qty === 0) return false;
    if (location === 'store' && batch.store_qty === 0) return false;
    if (!`${names.get(batch.product_id)} ${batch.batch_code}`.toLowerCase().includes(search.toLowerCase())) return false;
    return matchesExpiry(batch.expiry_date, today, filter);
  };
  const visible = batches.filter(matches).sort((a, b) => (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999'));
  const edit = batch => { setSelected(batch); setExpiry(batch.expiry_date || ''); setReason(''); setConfirmed(false); setError(''); pending.current = null; };
  const reactivating = selected?.expiry_date && selected.expiry_date < today && expiry >= today;
  const save = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    if (!pending.current) pending.current = { id: crypto.randomUUID(), payload: { batch_id: selected.id, expiry_date: expiry, expected_expiry: selected.expiry_date, reason, confirm_reactivation: confirmed } };
    try {
      await API.post('/inventory/expiry', pending.current);
      setSelected(null); setSuccess('Expiry updated. The old/new dates and reason are saved in Admin → Audit Log.'); pending.current = null;
      await onSaved();
    } catch (err) { setError(err.response?.data?.message || 'Could not confirm the update. Retry the same details safely.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <Box sx={{ pt: 2 }}>
    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
    <Alert severity="info" sx={{ mb: 2 }}>Monitor stocked batches in bodega and store. Expiry today remains sellable today; expired batches are blocked from transfer and sale. Missing dates are not proof that a product has no expiry.</Alert>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
      <TextField fullWidth size="small" label="Search product or batch" value={search} onChange={e => setSearch(e.target.value)} />
      <TextField fullWidth select size="small" label="Expiry status" value={filter} onChange={e => setFilter(e.target.value)} sx={{ minWidth: { xs: 0, sm: 190 } }}>{[['30','Within 30 days'],['15','Within 15 days'],['7','Within 7 days'],['today','Expires today'],['expired','Already expired'],['missing','Missing expiry'],['all','All stocked batches']].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <TextField fullWidth select size="small" label="Location" value={location} onChange={e => setLocation(e.target.value)} sx={{ minWidth: { xs: 0, sm: 150 } }}><MenuItem value="all">Both locations</MenuItem><MenuItem value="warehouse">Bodega</MenuItem><MenuItem value="store">Store</MenuItem></TextField>
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{visible.length} matching batches · Philippine date: {today}</Typography>
    <TableContainer><Table sx={{ minWidth: 750 }} aria-label="Batch expiry monitor"><TableHead><TableRow>{['Product / batch','Expiry','Status','Bodega','Store', ...(admin ? ['Action'] : [])].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
      {visible.map(batch => { const days = daysRemaining(batch.expiry_date, today); const label = days === null ? 'Missing date' : days < 0 ? `${Math.abs(days)} days expired` : days === 0 ? 'Expires today' : `${days} days left`; return <TableRow key={batch.id}><TableCell><Typography fontWeight={700}>{names.get(batch.product_id)}</Typography><Typography variant="caption">{batch.batch_code}</Typography></TableCell><TableCell>{batch.expiry_date || 'Not entered'}</TableCell><TableCell><Chip size="small" color={days === null || days <= 7 ? days !== null && days < 0 ? 'error' : 'warning' : 'default'} label={label} /></TableCell><TableCell>{batch.warehouse_qty}</TableCell><TableCell>{batch.store_qty}</TableCell>{admin && <TableCell><Button onClick={() => edit(batch)}>Edit expiry</Button></TableCell>}</TableRow>; })}
      {!visible.length && <TableRow><TableCell colSpan={admin ? 6 : 5} align="center" sx={{ py: 5 }}>No stocked batches match these filters.</TableCell></TableRow>}
    </TableBody></Table></TableContainer>
    <Dialog open={Boolean(selected)} onClose={() => { if (!saving) setSelected(null); }} fullWidth maxWidth="sm"><DialogTitle>Edit batch expiry</DialogTitle><DialogContent dividers><Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography>{names.get(selected?.product_id)} · {selected?.batch_code}</Typography>
      <Typography variant="body2">Previous expiry: {selected?.expiry_date || 'Not entered'}</Typography>
      <Alert severity="warning">Use the expiry printed on the actual batch or verified supplier documentation. Do not extend dates simply to sell expired stock.</Alert>
      <TextField label="Correct expiry date" type="date" required value={expiry} disabled={saving} InputLabelProps={{ shrink: true }} onChange={e => { setExpiry(e.target.value); setConfirmed(false); pending.current = null; }} />
      <TextField label="Correction reason / verification source" required multiline minRows={2} value={reason} disabled={saving} inputProps={{ maxLength: 500 }} helperText="At least 8 characters. Explain why the stored date was missing or incorrect." onChange={e => { setReason(e.target.value); pending.current = null; }} />
      {reactivating && <FormControlLabel control={<Checkbox checked={confirmed} disabled={saving} onChange={e => { setConfirmed(e.target.checked); pending.current = null; }} />} label="I verified the printed batch expiry. The old date was entered incorrectly; this correction will make the batch eligible for sale again." />}
    </Stack></DialogContent><DialogActions><Button disabled={saving} onClick={() => setSelected(null)}>Cancel</Button><Button variant="contained" disabled={saving || !expiry || expiry === selected?.expiry_date || reason.trim().length < 8 || (reactivating && !confirmed)} onClick={save}>{saving ? 'Saving…' : 'Save correction'}</Button></DialogActions></Dialog>
  </Box>;
}
