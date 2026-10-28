import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import API from '../api/inventory';

const dateTime = value => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function ReorderOrders({ open, onClose, onSaved, admin }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receive, setReceive] = useState(null);
  const [expiry, setExpiry] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data } = await API.get('/inventory/reorders'); setEntries(data.entries || []); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load automatic reorders.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);
  const confirmReceive = async event => {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const { data } = await API.post(`/inventory/reorders/${receive.id}/receive`, { expiry_date: expiry || null, purchase_price: Number(purchasePrice) });
      setReceive(null); setExpiry(''); await load(); await onSaved(data.message);
    } catch (err) { setError(err.response?.data?.message || 'Unable to receive this reorder.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <>
    <Dialog open={open && !receive} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Automatic Reorders</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>A reorder is created when stock reaches exactly 10 units. Each reorder contains 50 units and does not increase stock until received.</Alert>
        <TableContainer><Table aria-label="Automatic reorder orders"><TableHead><TableRow>{['Product', 'Quantity', 'Triggered at', 'Created', 'Status', 'Action'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
          {loading ? <TableRow><TableCell colSpan={6}>Loading reorders…</TableCell></TableRow> : entries.map(entry => <TableRow key={entry.id}>
            <TableCell><Typography fontWeight={700}>{entry.product_name}</Typography><Typography variant="caption">Stock trigger: {entry.triggered_stock}</Typography></TableCell>
            <TableCell>+{entry.quantity} units</TableCell><TableCell>{entry.triggered_stock}</TableCell><TableCell>{dateTime(entry.created_at)}</TableCell>
            <TableCell><Chip size="small" color={entry.status === 'received' ? 'success' : entry.status === 'ordered' ? 'warning' : 'default'} label={entry.status === 'ordered' ? 'Ordered' : entry.status === 'received' ? 'Received' : 'Cancelled'} /></TableCell>
            <TableCell>{admin && entry.status === 'ordered' && <Button onClick={() => { setReceive(entry); setExpiry(''); setPurchasePrice(''); setError(''); }}>Mark Received</Button>}</TableCell>
          </TableRow>)}
          {!loading && !entries.length && <TableRow><TableCell colSpan={6} align="center">No automatic reorders.</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      </DialogContent><DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
    <Dialog open={open && !!receive} onClose={() => !saving && setReceive(null)} fullWidth maxWidth="sm">
      <form onSubmit={confirmReceive}><DialogTitle>Receive Automatic Reorder</DialogTitle><DialogContent dividers><Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography>{receive?.product_name} · +{receive?.quantity} units</Typography>
        <Alert severity="warning">Enter the actual supplier invoice price. Stock will increase by 50 units only after the delivery and price are confirmed.</Alert>
        <TextField required label="Actual purchase price per unit" type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} disabled={saving} inputProps={{ min: 0.01, step: 0.01 }} InputLabelProps={{ shrink: true }} />
        <TextField label="Expiry date (optional)" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} disabled={saving} InputLabelProps={{ shrink: true }} />
      </Stack></DialogContent><DialogActions><Button disabled={saving} onClick={() => setReceive(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Confirm Received'}</Button></DialogActions></form>
    </Dialog>
  </>;
}
