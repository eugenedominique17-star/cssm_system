const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) || (process.env.JWT_SECRET || '').length < 32) {
    throw new Error('Production requires SUPABASE_URL, a backend Supabase secret key, and a JWT_SECRET of at least 32 characters.');
  }
  try {
    require('./utils/audit-secret').validateKey();
  } catch (error) {
    throw new Error(`Production requires a valid AUDIT_SECRET_KEY: ${error.message}`);
  }
  if (!require('fs').existsSync(path.join(__dirname, '../frontend/build/index.html'))) {
    throw new Error('Frontend build missing. Run npm run build before starting production.');
  }
}

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
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY.split(',').map(value => value.trim()));
app.disable('x-powered-by');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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
// Keep unknown API requests JSON; only browser routes receive the SPA.
app.use('/api', (req, res) => res.status(404).json({ message: 'Route not found' }));
if (process.env.NODE_ENV === 'production') {
  const build = path.join(__dirname, '../frontend/build');
  app.use(express.static(build));
  app.get('*', (req, res) => res.sendFile(path.join(build, 'index.html')));
}

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

if (require.main === module) app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
