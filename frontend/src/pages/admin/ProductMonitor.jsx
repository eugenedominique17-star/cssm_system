import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, FormControl, InputLabel, Select,
  MenuItem, CircularProgress, Alert, Button, Checkbox, Tooltip, Snackbar,

} from '@mui/material';
import { Inventory, Search, Download, RestartAlt, AddCircleOutline } from '@mui/icons-material';
import API from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import { colors } from '../../theme';

// Additive: Admin Product Monitor — read-only stock overview + bulk status + CSV export
// Uses existing endpoints only: GET /products, PUT /products/:id — no backend changes.

const getStockStatus = (stock) => {
  if (stock <= 0) return { label: 'Out of Stock', color: '#B91C1C', bg: '#FEF2F2' };
  if (stock < 10) return { label: 'Low Stock', color: '#92400E', bg: '#FFFBEB' };
  return { label: 'In Stock', color: '#066649', bg: '#EFF9F1' };
};

const ProductMonitor = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const response = await API.get('/products');
      setProducts(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      showToast('Failed to load products.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
    setTimeout(() => setToast({ open: false, message: '', severity: 'success' }), 3000);
  };

  // __FILTERS_SECTION__
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products]
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const st = getStockStatus(p.stock ?? 0).label;
      const matchStatus = statusFilter === 'all' || st === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const summary = useMemo(() => {
    let inStock = 0, low = 0, out = 0;
    filtered.forEach((p) => {
      const s = p.stock ?? 0;
      if (s <= 0) out++;
      else if (s < 10) low++;
      else inStock++;
    });
    return { inStock, low, out };
  }, [filtered]);


  // __ACTIONS_SECTION__
  const handleToggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkStatus = async (newStatus) => {
    if (!selected.length) return;
    try {
      // Reuse the existing PUT /products/:id endpoint per selected product
      await Promise.all(selected.map((id) => API.put(`/products/${id}`, { status: newStatus })));
      showToast(`${selected.length} product(s) marked ${newStatus}.`);
      setSelected([]);
      fetchProducts();
    } catch (error) {
      showToast('Bulk update failed.', 'error');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Category', 'Price', 'Stock', 'Status', 'Expiry Date'];
    const rows = filtered.map((p) => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.category || ''}"`,
      p.price ?? '',
      p.stock ?? '',
      getStockStatus(p.stock ?? 0).label,
      p.expiry_date ? String(p.expiry_date).split('T')[0] : ''
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-monitor-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Product list exported to CSV.');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  }

  // __RETURN_SECTION__
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'var(--sh-page-tint)', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} color="#183D32">📦 Product Monitor</Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time stock overview across all products
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleExportCSV}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          Export CSV
        </Button>
      </Box>

      {/* Stock Health Summary Bar */}
      <Paper elevation={0} sx={{
        display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center',
        p: 2.5, mb: 3, borderRadius: 3, border: '1px solid rgba(24,61,50,0.06)', bgcolor: 'white'
      }}>
        <Chip icon={<Inventory />} label={`${filtered.length} Products`} sx={{ fontWeight: 700, bgcolor: '#EDF3E8' }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#066649' }}>🟢 {summary.inStock} In Stock</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#92400E' }}>🟡 {summary.low} Low Stock</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#B91C1C' }}>🔴 {summary.out} Out of Stock</Typography>
      </Paper>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid rgba(24,61,50,0.06)' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }}
            sx={{ minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <FormControl size="small" sx={{ minWidth: 170, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)}>
              <MenuItem value="all">All Categories</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Stock Status</InputLabel>
            <Select value={statusFilter} label="Stock Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="In Stock">In Stock</MenuItem>
              <MenuItem value="Low Stock">Low Stock</MenuItem>
              <MenuItem value="Out of Stock">Out of Stock</MenuItem>
            </Select>
          </FormControl>
          {selected.length > 0 && (
            <>
              <Button
                size="small"
                variant="contained"
                startIcon={<RestartAlt />}
                onClick={() => handleBulkStatus('active')}
                sx={{ textTransform: 'none', borderRadius: 2, textWrap: 'nowrap' }}
              >
                Set Active ({selected.length})
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleBulkStatus('inactive')}
                sx={{ textTransform: 'none', borderRadius: 2, textWrap: 'nowrap' }}
              >
                Set Inactive ({selected.length})
              </Button>
            </>
          )}
        </Box>
      </Paper>

      {/* Product Table */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid rgba(24,61,50,0.06)', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 820 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'var(--sh-page-tint)' }}>
              <TableCell padding="checkbox" />
              <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Price</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Stock</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Stock Status</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Product Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No products found matching your filters.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const st = getStockStatus(p.stock ?? 0);
                return (
                  <TableRow key={p.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.includes(p.id)}
                        onChange={() => handleToggleSelect(p.id)}
                        sx={{ color: colors.primary }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#183D32' }}>{p.name}</TableCell>
                    <TableCell>{p.category || '—'}</TableCell>
                    <TableCell align="right">₱{Number(p.price || 0).toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{p.stock ?? 0}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={`Stock level: ${p.stock ?? 0}`}>
                        <Chip
                          label={st.label}
                          size="small"
                          sx={{ bgcolor: st.bg, color: st.color, fontWeight: 700, fontSize: '0.75rem' }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Chip
                          label={p.status === 'inactive' ? 'Inactive' : 'Active'}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', borderColor: 'rgba(24,61,50,0.15)' }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<AddCircleOutline />}
                          onClick={() => navigate('/admin/inventory')}
                          sx={{ minWidth: 'auto', px: 1.25, textTransform: 'none', fontWeight: 700 }}
                        >
                          Transfer Stock
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} sx={{ borderRadius: 2 }}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ProductMonitor;
