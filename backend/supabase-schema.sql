-- Convenience Store Stock Management System - Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor

-- Users table (Admin, Staff, User/Customer)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'client')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'rejected')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create sequence for 6-digit user IDs
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 100000;

-- Function to generate 6-digit user ID
CREATE OR REPLACE FUNCTION generate_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id = 'U' || lpad(nextval('user_id_seq')::text, 5, '0');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-generate user_id
CREATE TRIGGER generate_user_id_trigger BEFORE INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION generate_user_id();

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    purchase_price DECIMAL(10, 2) CHECK (purchase_price IS NULL OR purchase_price > 0),
    selling_markup_percent DECIMAL(7, 2) CHECK (selling_markup_percent IS NULL OR selling_markup_percent BETWEEN 0 AND 10000),
    stock INTEGER NOT NULL DEFAULT 0,
    category VARCHAR(100) NOT NULL,
    image_url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Promos table
CREATE TABLE IF NOT EXISTS promos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed', 'bundle')),
    discount_value DECIMAL(10, 2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'pending')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Transactions (Receipts) table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'pos')),
    tendered_amount DECIMAL(10, 2),
    change_amount DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Transaction Items table
CREATE TABLE IF NOT EXISTS transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL
);

-- Pending Submissions table (for staff submissions awaiting admin approval)
CREATE TABLE IF NOT EXISTS pending_submissions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('product', 'promo', 'stock_update', 'walk_in_order')),
    data JSONB NOT NULL,
    submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_promos_status ON promos(status);
CREATE INDEX IF NOT EXISTS idx_promos_dates ON promos(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_staff ON transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pending_submissions_status ON pending_submissions(status);
CREATE INDEX IF NOT EXISTS idx_pending_submissions_type ON pending_submissions(type);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Allow public read access to users" ON users
    FOR SELECT USING (true);
    
CREATE POLICY "Allow anyone to insert users" ON users
    FOR INSERT WITH CHECK (true);
    
-- Allow updates (approve/reject/edit) - the app uses the anon/service key,
-- so auth.uid() is null. We allow all updates so the admin dashboard works.
CREATE POLICY "Allow app to update users" ON users
    FOR UPDATE USING (true) WITH CHECK (true);
    
-- Allow deletes (admin can delete users from the dashboard)
CREATE POLICY "Allow app to delete users" ON users
    FOR DELETE USING (true);

-- RLS Policies for products table
CREATE POLICY "Allow public read access to active products" ON products
    FOR SELECT USING (status = 'active' OR auth.uid() IS NOT NULL);
    
CREATE POLICY "Allow anyone to insert products" ON products
    FOR INSERT WITH CHECK (true);
    
CREATE POLICY "Allow authenticated users to update products" ON products
    FOR UPDATE USING (auth.uid() IS NOT NULL);
    
CREATE POLICY "Allow authenticated users to delete products" ON products
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for promos table
CREATE POLICY "Allow public read access to active promos" ON promos
    FOR SELECT USING (status = 'active' OR auth.uid() IS NOT NULL);
    
CREATE POLICY "Allow anyone to insert promos" ON promos
    FOR INSERT WITH CHECK (true);
    
CREATE POLICY "Allow authenticated users to update promos" ON promos
    FOR UPDATE USING (auth.uid() IS NOT NULL);
    
CREATE POLICY "Allow authenticated users to delete promos" ON promos
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for transactions table
CREATE POLICY "Allow anyone to read transactions" ON transactions
    FOR SELECT USING (true);
    
CREATE POLICY "Allow anyone to insert transactions" ON transactions
    FOR INSERT WITH CHECK (true);
    
CREATE POLICY "Allow authenticated users to update transactions" ON transactions
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for transaction_items table
CREATE POLICY "Allow anyone to read transaction_items" ON transaction_items
    FOR SELECT USING (true);
    
CREATE POLICY "Allow anyone to insert transaction_items" ON transaction_items
    FOR INSERT WITH CHECK (true);

-- RLS Policies for pending_submissions table
CREATE POLICY "Allow anyone to read pending_submissions" ON pending_submissions
    FOR SELECT USING (true);
    
CREATE POLICY "Allow anyone to insert pending_submissions" ON pending_submissions
    FOR INSERT WITH CHECK (true);
    
CREATE POLICY "Allow authenticated users to update pending_submissions" ON pending_submissions
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promos_updated_at BEFORE UPDATE ON promos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();