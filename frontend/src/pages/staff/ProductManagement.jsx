import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress, Alert, Chip, IconButton, Stack } from '@mui/material';
import { Add, Edit, Delete, Inventory, Search } from '@mui/icons-material';
import API from '../../api/catalogMutations';
import { getCatalog } from '../../api/catalog';
import { colors } from '../../theme';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', stock: '', category: '', expiry_date: '' });
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'success' });
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all | low | out

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const response = await getCatalog('products');
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        stock: product.stock.toString(),
        category: product.category,
        expiry_date: product.expiry_date ? product.expiry_date.slice(0, 10) : ''
      });
    } else {
      setEditProduct(null);
      setFormData({ name: '', description: '', price: '', stock: '', category: '', expiry_date: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        ...(!editProduct ? { stock: 0 } : {}),
        category: formData.category,
      };

      if (editProduct) {
        await API.put(`/products/${editProduct.id}`, payload);
        showAlert('Product update submitted for admin approval.');
      } else {
        await API.post('/products', payload);
        showAlert('Product submitted for admin approval.');
      }
      setDialogOpen(false);
      fetchProducts();
    } catch (error) {
      showAlert(error.response?.data?.message || 'Failed to save product.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await API.delete(`/products/${id}`);
      showAlert('Product deleted successfully!');
      fetchProducts();
    } catch (error) {
      showAlert('Failed to delete product.', 'error');
    }
  };

  const showAlert = (message, severity = 'success') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'success' }), 3000);
  };

  const formatPrice = (price) => `₱${parseFloat(price).toFixed(2)}`;

  // Additive: expiry status helper (safe, purely display logic)
  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Expired', color: 'error', daysLeft };
    if (daysLeft <= 7) return { label: `Expires in ${daysLeft}d`, color: 'warning', daysLeft };
    return { label: `Good ${daysLeft}d`, color: 'success', daysLeft };
  };

  // Additive: client-side quick search + stock filter (safe, no backend change)
  const filteredProducts = products.filter((product) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (product.name || '').toLowerCase().includes(q) ||
      (product.category || '').toLowerCase().includes(q);
    const stock = Number(product.stock ?? 0);
    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = stock > 0 && stock <= 10;
    else if (stockFilter === 'out') matchesStock = stock <= 0;
    return matchesSearch && matchesStock;
  });

  const getStatusChip = (status) => {
    const statusColors = { active: 'success', pending: 'warning', inactive: 'default' };
    return (
      <Chip
        label={status}
        color={statusColors[status] || 'default'}
        size="small"
        sx={{ fontWeight: 600, textTransform: 'capitalize' }}
      />
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
        <CircularProgress size={48} sx={{ color: colors.primary }} />
      </Box>
    );
  }

  return (
    <Box className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" className="page-title" sx={{ mb: 1 }}>
            Product Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your store's product inventory.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => handleOpenDialog()} startIcon={<Add />}>
          Add Product
        </Button>
      </Box>

      {alert.show && (
        <Alert
          severity={alert.severity}
          sx={{
            mb: 2,
            borderRadius: 2,
            animation: 'fadeInUp 0.3s ease',
          }}
        >
          {alert.message}
        </Alert>
      )}

      {/* Quick Search & Stock Filter (additive) */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          flexWrap: 'wrap',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <TextField
          size="small"
          placeholder="Search by name or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <Search sx={{ fontSize: 20, mr: 0.5, color: 'text.secondary' }} />
            ),
          }}
        />
        <Stack direction="row" spacing={1}>
          <Chip
            label="All Stock"
            color={stockFilter === 'all' ? 'primary' : 'default'}
            onClick={() => setStockFilter('all')}
            size="small"
          />
          <Chip
            label="Low Stock"
            color={stockFilter === 'low' ? 'warning' : 'default'}
            onClick={() => setStockFilter('low')}
            size="small"
          />
          <Chip
            label="Out of Stock"
            color={stockFilter === 'out' ? 'error' : 'default'}
            onClick={() => setStockFilter('out')}
            size="small"
          />
        </Stack>
      </Paper>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2 }}
      >
        Showing {filteredProducts.length} of {products.length} products
      </Typography>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 820 }}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
                    No products found.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Try adjusting the search or filter.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        bgcolor: 'rgba(0,168,150,0.1)',
                        borderRadius: 1.5,
                        p: 0.5,
                        display: 'flex',
                        color: colors.primary,
                      }}
                    >
                      <Inventory fontSize="small" />
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {product.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={product.category}
                    size="small"
                    sx={{ bgcolor: 'rgba(0,168,150,0.08)', color: colors.primary, fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700} sx={{ color: colors.primary }}>
                    {formatPrice(product.price)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${product.stock} ${product.stock === 1 ? 'unit' : 'units'}`}
                    color={product.stock <= 0 ? 'error' : product.stock <= 10 ? 'warning' : 'success'}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell>
                  {(() => {
                    const exp = getExpiryStatus(product.expiry_date);
                    if (!exp) return <Typography variant="body2" sx={{ color: '#839B8C' }}>—</Typography>;
                    return <Chip label={exp.label} color={exp.color} size="small" sx={{ fontWeight: 600 }} />;
                  })()}
                </TableCell>
                <TableCell>{getStatusChip(product.status)}</TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(product)}
                      sx={{
                        color: colors.primary,
                        bgcolor: 'rgba(0,168,150,0.08)',
                        '&:hover': { bgcolor: 'rgba(0,168,150,0.15)' },
                        '&:active': { transform: 'scale(0.9)' },
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(product.id)}
                      sx={{
                        color: colors.red,
                        bgcolor: 'rgba(255,107,107,0.08)',
                        '&:hover': { bgcolor: 'rgba(255,107,107,0.15)' },
                        '&:active': { transform: 'scale(0.9)' },
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editProduct ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Product Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} sx={{ mt: 2, mb: 2 }} required />
          <TextField fullWidth label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} sx={{ mb: 2 }} multiline rows={2} />
          <TextField fullWidth label="Price" type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} sx={{ mb: 2 }} required />
          <Alert severity="info" sx={{ mb: 2 }}>New products start at zero stock. Use Inventory to restock products and set expiration dates in View Details.</Alert>
          <TextField fullWidth label="Category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} sx={{ mb: 2 }} required />
          <TextField
            fullWidth
            label="Expiry is managed per batch in Inventory"
            disabled
            type="date"
            value={formData.expiry_date}
            onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
            helperText="For perishable items like bread, milk, snacks"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained">
            {editProduct ? 'Submit Update' : 'Submit for Approval'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductManagement;
