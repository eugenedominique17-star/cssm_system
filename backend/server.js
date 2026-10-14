const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const productRoutes = require('./routes/products.routes');
const promoRoutes = require('./routes/promos.routes');
const transactionRoutes = require('./routes/transactions.routes');
const userRoutes = require('./routes/users.routes');
const adminRoutes = require('./routes/admin.routes');
const sseRoutes = require('./routes/sse.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/products', productRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/sse', sseRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Convenience Store API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
