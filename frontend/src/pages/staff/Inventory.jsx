import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { AddRounded, Inventory2Rounded, MoreVertRounded, RefreshRounded, HistoryRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import API from '../../api/inventory';
import StockRequests from '../../components/StockRequests';
import ReorderOrders from '../../components/ReorderOrders';
import { useAuth } from '../../contexts/AuthContext';
import { philippineDate } from '../../utils/expiry.mjs';
import { inventoryRows, stockLabels, movementLabels } from '../../utils/inventory.mjs';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
const dateTime = value => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const colors = { in: 'success', low: 'warning', out: 'error' };
const titles = { create_product: 'Add Product', edit_product: 'Edit Product', restock: 'Restock Product', correct: 'Correct Stock', remove_expired: 'Remove Expired Stock', expiry: 'Set / Edit Expiration Date' };
export default function Inventory() {
  const { user } = useAuth(); const admin = user?.role === 'admin'; const navigate = useNavigate();
  const [data, setData] = useState({ products: [], batches: [], simpleReady: false });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0); const [pageSize, setPageSize] = useState(10); const [today, setToday] = useState(philippineDate);
  const [form, setForm] = useState(null); const [formError, setFormError] = useState(''); const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState(null); const [menu, setMenu] = useState(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [reordersOpen, setReordersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); const [historyPage, setHistoryPage] = useState(0);
  const [history, setHistory] = useState({ entries: [], total: 0 }); const [historyError, setHistoryError] = useState(''); const [historyLoading, setHistoryLoading] = useState(false);
  const busy = useRef(false); const pending = useRef(null); const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current; setLoading(true); setError('');
    try { const result = await API.get('/inventory'); if (current === version.current) setData(result.data); }
    catch (err) { if (current === version.current) setError(err.response?.data?.message || 'Unable to load inventory. Try Refresh.'); }
    finally { if (current === version.current) setLoading(false); }
  }, []);
  useEffect(() => { load(); const refresh = () => { if (!document.hidden && !busy.current) load(); }; const timer = setInterval(() => { setToday(philippineDate()); refresh(); }, 60000); window.addEventListener('focus', refresh); return () => { clearInterval(timer); window.removeEventListener('focus', refresh); }; }, [load]);
  useEffect(() => {
    if (!historyOpen) return undefined;
    let active = true; setHistoryLoading(true); setHistoryError('');
    API.get('/inventory/history', { params: { type: 'movements', page: historyPage, ...(detailId ? { product_id: detailId } : {}) } })
      .then(({ data: result }) => { if (active) setHistory(result); })
      .catch(err => { if (active) setHistoryError(err.response?.data?.message || 'Unable to load history.'); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [historyOpen, historyPage, detailId]);
  const rows = useMemo(() => inventoryRows(data.products, data.batches, today, data.simpleReady), [data, today]);
  const detail = rows.find(p => p.id === detailId);
  const visible = useMemo(() => rows.filter(p => `${p.name} ${p.category} ${p.barcode || ''}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'expired' ? p.expired > 0 : filter === 'soon' ? p.soon > 0 : p.stockStatus === filter)))
    .sort((a, b) => sort === 'quantity' ? a.available - b.available || a.name.localeCompare(b.name) : sort === 'price' ? Number(a.price) - Number(b.price) : a.name.localeCompare(b.name)), [rows, search, filter, sort]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / pageSize) - 1));
  const open = (kind, product = null, batch = null) => {
    setMenu(null); pending.current = null; setFormError('');
    setForm({ kind, product, batch, name: product?.name || '', category: product?.category || '', barcode: product?.barcode || '', price: product?.price ?? '', minimum_stock: product?.minimum_stock ?? 10, quantity: kind === 'create_product' ? '0' : '', expiry_date: kind === 'expiry' ? batch?.expiry_date || '' : '', reason: '', confirm_reactivation: false, actual_quantity: batch?.store_qty ?? '' });
  };
  const change = (key, value) => { pending.current = null; setFormError(''); setForm(f => ({ ...f, [key]: value })); };
  const save = async event => {
    event.preventDefault(); if (busy.current) return;
    const f = form; let payload;
    if (f.kind === 'create_product' || f.kind === 'edit_product') payload = { name: f.name.trim(), category: f.category.trim(), barcode: f.barcode.trim() || null, price: Number(f.price), minimum_stock: Number(f.minimum_stock), ...(f.kind === 'create_product' ? { quantity: Number(f.quantity), expiry_date: f.expiry_date || null } : { product_id: f.product.id }) };
    else if (f.kind === 'restock') payload = { product_id: f.product.id, quantity: Number(f.quantity), expiry_date: f.expiry_date || null };
    else if (f.kind === 'expiry') payload = { batch_id: f.batch.id, expiry_date: f.expiry_date, expected_expiry: f.batch.expiry_date, reason: f.reason.trim(), confirm_reactivation: f.confirm_reactivation };
    else payload = { batch_id: f.batch.id, expected_quantity: f.batch.store_qty, reason: f.reason.trim(), ...(f.kind === 'correct' ? { actual_quantity: Number(f.actual_quantity) } : {}) };
    if (!pending.current) pending.current = { id: crypto.randomUUID(), payload };
    busy.current = true; setSaving(true); setFormError('');
    try { const result = await API.post(`/inventory/${f.kind}`, pending.current); setSuccess(result.data.message); setForm(null); pending.current = null; await load(); }
    catch (err) { setFormError(err.response?.data?.message || 'Could not confirm the result. Retry the same details safely.'); }
    finally { busy.current = false; setSaving(false); }
  };
  const field = (key, label, type = 'text', extra = {}) => <TextField fullWidth required label={label} type={type} value={form[key]} onChange={e => change(key, e.target.value)} disabled={saving} {...extra} />;
  const writable = data.simpleReady && !loading && !error;
  const summary = [['all', 'Total Products', rows.length], ['in', 'In Stock', rows.filter(p => p.stockStatus === 'in').length], ['low', 'Low Stock', rows.filter(p => p.stockStatus === 'low').length], ['out', 'Out of Stock', rows.filter(p => p.stockStatus === 'out').length], ['expired', 'Expired Products', rows.filter(p => p.expired > 0).length]];
  return <Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <Box><Typography variant="h5" fontWeight={800}><Inventory2Rounded sx={{ verticalAlign: 'middle', mr: 1 }} />Inventory</Typography><Typography color="text.secondary">Keep your shelves stocked. Find a product, then restock.</Typography></Box>
      <Stack direction="row" spacing={0} sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, max-content)' }, gap: 1, alignItems: 'center' }}>
        <IconButton aria-label="Refresh inventory" disabled={loading || saving} onClick={load} sx={{ width: { xs: '100%', sm: 40 }, height: 40, border: { xs: '1px solid', sm: 0 }, borderColor: 'divider', borderRadius: 2 }}><RefreshRounded /></IconButton>
        <Button onClick={() => setRequestsOpen(true)} sx={{ minWidth: 0, minHeight: 40, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: 'inherit' }, lineHeight: 1.2 }}>{admin ? 'Stock Requests' : 'My Requests'}</Button>
        <Button onClick={() => setReordersOpen(true)} sx={{ minWidth: 0, minHeight: 40, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: 'inherit' }, lineHeight: 1.2 }}>Auto Reorders</Button>
        <Button startIcon={<HistoryRounded />} onClick={() => { setDetailId(null); setHistoryPage(0); setHistoryOpen(true); }} sx={{ minWidth: 0, minHeight: 40, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: 'inherit' }, lineHeight: 1.2 }}>History</Button>
        <Button variant="contained" startIcon={<AddRounded />} disabled={!writable} onClick={() => admin ? open('create_product') : navigate('/staff/products')} sx={{ minWidth: 0, minHeight: 40, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: 'inherit' }, lineHeight: 1.2 }}>Add Product</Button>
      </Stack>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}
    {!loading && !data.simpleReady && <Alert severity="info" sx={{ mb: 2 }}>Your current stock is shown below. Restock and simplified stock tools will be available after the administrator completes the inventory update.</Alert>}
    {!loading && data.simpleReady && !data.approvalReady && <Alert severity="info" sx={{ mb: 2 }}>Restock is temporarily unavailable while the stock approval update is being completed.</Alert>}
    {!admin && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Your restock requests need admin approval. Available stock changes only after approval. Track your requests in My Requests.</Typography>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(5,1fr)' }, gap: 1.5, mb: 3 }}>{summary.map(([key, label, count]) => <Paper key={key} component="button" onClick={() => { setFilter(key); setPage(0); }} aria-pressed={filter === key} sx={{ p: 2.5, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'text.primary', border: '1px solid', borderColor: filter === key ? 'primary.main' : 'divider', borderRadius: 3, bgcolor: 'background.paper', '&:hover': { borderColor: 'primary.main' } }}><Typography color="text.secondary" variant="body2">{label}</Typography><Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>{loading ? '—' : count}</Typography></Paper>)}</Box>
    {rows.some(p => p.soon > 0) && <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => { setFilter('soon'); setPage(0); }}>View</Button>}>Stock is expiring within 7 days. Check the dates before selling.</Alert>}
    <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2.5 }}>
        <TextField fullWidth size="small" label="Search product, category or barcode" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ flex: 1 }} />
        <TextField fullWidth select size="small" label="Status" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} sx={{ minWidth: { xs: 0, sm: 165 } }}>{[['all', 'All products'], ...Object.entries(stockLabels), ['expired', 'Has expired stock'], ['soon', 'Expiring soon']].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
        <TextField fullWidth select size="small" label="Sort by" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }} sx={{ minWidth: { xs: 0, sm: 150 } }}>{[['name', 'Product name'], ['quantity', 'Lowest stock'], ['price', 'Lowest price']].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      </Stack>
      <TableContainer><Table sx={{ minWidth: 800 }} aria-label="Inventory products"><TableHead><TableRow>{['Product', 'Category', 'Price', 'Available', 'Status', 'Expiration', 'Actions'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
        {loading ? <TableRow><TableCell colSpan={7} align="center" role="status">Loading inventory…</TableCell></TableRow> : error ? <TableRow><TableCell colSpan={7}>Inventory could not be refreshed. Please try again.</TableCell></TableRow> : visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(p => <TableRow key={p.id} hover>
          <TableCell><Button color="inherit" onClick={() => setDetailId(p.id)} sx={{ fontWeight: 700, textAlign: 'left' }}>{p.name}</Button><Typography variant="caption" color="text.secondary" display="block">{p.barcode || `Product #${p.id}`}{p.status !== 'active' ? ` · ${p.status}` : ''}</Typography></TableCell>
          <TableCell>{p.category}</TableCell><TableCell>{money(p.price)}</TableCell><TableCell><Typography fontWeight={800}>{p.available} <Typography component="span" variant="caption">{p.inventory_unit || 'pcs'}</Typography></Typography><Typography variant="caption" color="text.secondary">Minimum: {p.minimum_stock ?? 10}</Typography></TableCell>
          <TableCell><Chip size="small" label={stockLabels[p.stockStatus]} color={colors[p.stockStatus]} /></TableCell><TableCell>{p.expired > 0 && <Typography variant="caption" display="block" color="error.main">{p.expired} expired units</Typography>}{p.soon > 0 && <Typography variant="caption" display="block" color="warning.main">{p.soon} units expire within 7 days</Typography>}{!p.expired && !p.soon && <Typography variant="caption" color="text.secondary">{p.nextExpiry || 'No upcoming expiry'}</Typography>}</TableCell>
          <TableCell><Stack direction="row"><Button size="small" variant="outlined" disabled={!writable || !data.approvalReady || p.status !== 'active'} onClick={() => open('restock', p)}>Restock</Button><IconButton aria-label={`More actions for ${p.name}`} onClick={e => setMenu({ anchor: e.currentTarget, product: p })}><MoreVertRounded /></IconButton></Stack></TableCell>
        </TableRow>)}
        {!loading && !error && !visible.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography fontWeight={700}>No products found</Typography><Typography color="text.secondary">{rows.length ? 'Try another search or status filter.' : 'Add your first product to start tracking stock.'}</Typography></TableCell></TableRow>}
      </TableBody></Table></TableContainer><TablePagination component="div" count={visible.length} page={currentPage} rowsPerPage={pageSize} rowsPerPageOptions={[10, 25, 50]} onPageChange={(_, value) => setPage(value)} onRowsPerPageChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} />
    </Paper>
    <StockRequests open={requestsOpen} onClose={() => setRequestsOpen(false)} onSaved={load} admin={admin} ready={data.approvalReady} />
    <ReorderOrders open={reordersOpen} onClose={() => setReordersOpen(false)} admin={admin} onSaved={async message => { setSuccess(message); await load(); }} />
    <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}><MenuItem onClick={() => { setDetailId(menu.product.id); setMenu(null); }}>View details</MenuItem><MenuItem disabled={!writable} onClick={() => { const p = menu.product; setMenu(null); admin ? open('edit_product', p) : navigate('/staff/products'); }}>Edit product</MenuItem><MenuItem onClick={() => { setDetailId(menu.product.id); setHistoryPage(0); setHistoryOpen(true); setMenu(null); }}>Stock history</MenuItem></Menu>
    <Dialog open={!!detail && !historyOpen && !form} onClose={() => setDetailId(null)} fullWidth maxWidth="md"><DialogTitle>{detail?.name}</DialogTitle><DialogContent dividers>{detail && <Stack spacing={2}>
      <Typography>{detail.available} available · {detail.physical} total units · {detail.expired} expired</Typography><Typography variant="body2" color="text.secondary">Each restock keeps its own expiration date. Use Set expiry for a missing date, or Edit expiry to correct the date printed on the packaging. Expired units cannot be sold.</Typography>
      <TableContainer><Table size="small" aria-label="Product stock batches"><TableHead><TableRow>{['Batch', 'Expiration', 'Quantity', 'Actions'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{detail.batches.map(b => <TableRow key={b.id}><TableCell>{b.batch_code.startsWith('STOCK-') ? `Added ${dateTime(b.created_at)}` : b.batch_code}</TableCell><TableCell>{b.expiry_date || 'Not set'}{b.expired && <Chip label="Expired" size="small" color="error" sx={{ ml: 1 }} />}</TableCell><TableCell>{b.store_qty + b.warehouse_qty}</TableCell><TableCell>{admin && <><Button disabled={loading || !!error} onClick={() => open('expiry', detail, b)}>{b.expiry_date ? 'Edit expiry' : 'Set expiry'}</Button><Button disabled={!writable} onClick={() => open('correct', detail, b)}>Correct count</Button>{b.expired && b.store_qty > 0 && <Button color="error" disabled={!writable} onClick={() => open('remove_expired', detail, b)}>Remove expired</Button>}</>}</TableCell></TableRow>)}{!detail.batches.length && <TableRow><TableCell colSpan={4}>No stock added yet. Use Restock to add the first quantity.</TableCell></TableRow>}</TableBody></Table></TableContainer>
    </Stack>}</DialogContent><DialogActions><Button onClick={() => { setHistoryPage(0); setHistoryOpen(true); }}>View history</Button><Button onClick={() => setDetailId(null)}>Close</Button></DialogActions></Dialog>
    <Dialog open={!!form} onClose={() => { if (!saving) setForm(null); }} fullWidth maxWidth="sm"><Box component="form" onSubmit={save}><DialogTitle>{titles[form?.kind]}</DialogTitle><DialogContent dividers>{form && <Stack spacing={2.5}>
      {formError && <Alert severity="error">{formError}</Alert>}
      {form.kind === 'expiry' && <>
        <Alert severity="info">Enter the expiration date printed on this batch's packaging. You may enter a past date to correctly mark existing stock as expired. The change is recorded in the Admin Audit Log.</Alert>
        {field('expiry_date', 'Expiration date', 'date', { InputLabelProps: { shrink: true } })}
        {field('reason', 'Reason for setting / correcting the date', 'text', { helperText: 'Example: Verified date printed on packaging.', inputProps: { minLength: 8, maxLength: 500 } })}
        {form.batch.expired && form.expiry_date >= today && <FormControlLabel control={<Checkbox required checked={form.confirm_reactivation} onChange={e => change('confirm_reactivation', e.target.checked)} disabled={saving} />} label="I verified the printed date and confirm this correction may make the batch sellable again." />}
      </>}
      {['create_product', 'edit_product'].includes(form.kind) ? <>{field('name', 'Product name', 'text', { inputProps: { minLength: 2, maxLength: 200 } })}{field('category', 'Category', 'text', { inputProps: { minLength: 2, maxLength: 100 } })}{field('barcode', 'Barcode / SKU (optional)', 'text', { required: false, inputProps: { maxLength: 100 } })}{field('price', 'Selling price (PHP)', 'number', { inputProps: { min: 0.01, step: 0.01, max: 99999999 } })}{field('minimum_stock', 'Minimum stock level', 'number', { helperText: 'Show Low Stock when available quantity reaches this number.', inputProps: { min: 0, max: 1000000, step: 1 } })}</> : <TextField label="Product" value={form.product.name} InputProps={{ readOnly: true }} />}
      {['create_product', 'restock'].includes(form.kind) && <>{form.kind === 'restock' && <Typography>Current available stock: <b>{form.product.available}</b></Typography>}{field('quantity', form.kind === 'restock' ? 'Quantity to add' : 'Initial stock quantity', 'number', { inputProps: { min: form.kind === 'restock' ? 1 : 0, max: 1000000, step: 1 }, helperText: 'Enter individual units, not boxes.' })}{field('expiry_date', 'Expiration date (optional)', 'date', { required: false, InputLabelProps: { shrink: true }, inputProps: { min: new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) }, helperText: 'Leave blank only for products without an expiration date.' })}<Alert severity="info">{!admin && form.kind === 'restock' ? 'Available stock after approval: ' : 'New available stock: '}<b>{(form.product?.available || 0) + Number(form.quantity || 0)}</b> units. {!admin && form.kind === 'restock' ? 'Submitting this request will not change stock yet.' : 'Add only stock you physically have.'}</Alert></>}
      {['correct', 'remove_expired'].includes(form.kind) && <><Typography>Selected batch: {form.batch.expiry_date || 'No expiration date'} · Recorded count: <b>{form.batch.store_qty}</b></Typography>{form.kind === 'correct' ? <>{field('actual_quantity', 'Actual quantity counted', 'number', { inputProps: { min: 0, max: 1000000, step: 1 } })}<Alert severity="info">This batch: {form.batch.store_qty} → {Number(form.actual_quantity || 0)} units. Other batches are unchanged.</Alert></> : <Alert severity="warning">Remove all {form.batch.store_qty} expired units from this batch? Unexpired stock will remain available. Confirm after physically removing these goods.</Alert>}{field('reason', 'Reason', 'text', { multiline: true, minRows: 2, inputProps: { minLength: 3, maxLength: 500 } })}</>}
    </Stack>}</DialogContent><DialogActions sx={{ p: 2 }}><Button disabled={saving} onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="contained" color={form?.kind === 'remove_expired' ? 'error' : 'primary'} disabled={saving}>{saving ? 'Saving…' : form?.kind === 'restock' ? (admin ? 'Confirm Restock' : 'Submit for Approval') : form?.kind === 'remove_expired' ? 'Confirm Removal' : 'Save'}</Button></DialogActions></Box></Dialog>
    <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="md"><DialogTitle>Stock History{detail ? ` · ${detail.name}` : ''}</DialogTitle><DialogContent dividers>{historyError && <Alert severity="error">{historyError}</Alert>}<TableContainer><Table aria-label="Stock history"><TableHead><TableRow>{['Product', 'Action', 'Change', 'Date / time', 'Responsible user'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{historyLoading ? <TableRow><TableCell colSpan={5}>Loading history…</TableCell></TableRow> : !historyError && history.entries.map(e => <TableRow key={e.id}><TableCell>{data.products.find(p => p.id === e.inventory_batches?.product_id)?.name || 'Product'}</TableCell><TableCell>{movementLabels[e.kind] || e.kind}{e.inventory_documents?.reason && <Typography variant="caption" display="block" color="text.secondary">{e.inventory_documents.reason}</Typography>}</TableCell><TableCell>{e.store_delta + e.warehouse_delta > 0 ? '+' : ''}{e.store_delta + e.warehouse_delta}</TableCell><TableCell>{dateTime(e.created_at)}</TableCell><TableCell>{e.inventory_documents?.actor_name || (e.actor_id ? `Staff #${e.actor_id}` : 'System')}{e.transaction_id && <Typography variant="caption" display="block">Sale #{e.transaction_id}</Typography>}</TableCell></TableRow>)}{!historyLoading && !historyError && !history.entries.length && <TableRow><TableCell colSpan={5}>No stock movements yet.</TableCell></TableRow>}</TableBody></Table></TableContainer><TablePagination component="div" count={history.total} page={historyPage} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, value) => setHistoryPage(value)} /></DialogContent><DialogActions><Button onClick={() => setHistoryOpen(false)}>Close</Button></DialogActions></Dialog>
  </Box>;
}
