const { db } = require('../config/db');
const supabase = require('../config/supabase');

// Map a role to its physical table (TRUE separation of clients / staff / admins)
const TABLE_BY_ROLE = { client: 'clients', staff: 'staff', admin: 'admins' };

const normalizeRole = (role) => (String(role || '').toLowerCase() === 'user' ? 'client' : String(role || '').toLowerCase());

// Attach the role to a raw DB row (each table no longer stores a `role` column)
const withRole = (row, role) => {
  if (!row) return null;
  return { ...row, role };
};

// Locate a record across all three tables by its globally-unique numeric id.
// (clients use 1,000,000+, staff 2,000,000+, admins 3,000,000+, so ids never collide)
async function findRowById(id) {
  const [cl, st, ad] = await Promise.all([
    db.clients.findById(id),
    db.staff.findById(id),
    db.admins.findById(id)
  ]);
  if (cl) return { row: cl, role: 'client', table: 'clients' };
  if (st) return { row: st, role: 'staff', table: 'staff' };
  if (ad) return { row: ad, role: 'admin', table: 'admins' };
  return null;
}

const UserModel = {
  // Find by email across all three tables (prevents cross-table duplicates)
  async findByEmail(email) {
    const [cl, st, ad] = await Promise.all([
      db.clients.findOne({ email }),
      db.staff.findOne({ email }),
      db.admins.findOne({ email })
    ]);
    if (cl) return withRole(cl, 'client');
    if (st) return withRole(st, 'staff');
    if (ad) return withRole(ad, 'admin');
    return null;
  },

  async findByAuthUserId(authUserId) {
    const matches = await Promise.all(
      Object.entries(TABLE_BY_ROLE).map(async ([role, table]) => {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        if (error) throw error;
        return data ? withRole(data, role) : null;
      })
    );
    const users = matches.filter(Boolean);
    if (users.length > 1) throw new Error('Supabase Auth identity is linked to multiple application accounts.');
    if (!users.length) return null;
    const { password, ...profile } = users[0];
    return profile;
  },

  async findBySupabaseToken(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      if (error.status === 401) return null;
      throw Object.assign(new Error('Unable to verify Supabase Auth session.'), { status: 503 });
    }
    if (!data.user) return null;
    const user = await this.findByAuthUserId(data.user.id);
    if (!user || user.email.toLowerCase() !== String(data.user.email || '').toLowerCase()) return null;
    return user;
  },

  // identifier may be an email OR a formatted user_id (C100001 / S100001 / A100001)
  async findByIdentifier(identifier) {
    if (!identifier) return null;
    const idStr = String(identifier);
    if (/^[CSA]\d+$/i.test(idStr)) {
      const prefix = idStr[0].toUpperCase();
      if (prefix === 'C') return withRole(await db.clients.findOne({ user_id: idStr }), 'client');
      if (prefix === 'S') return withRole(await db.staff.findOne({ user_id: idStr }), 'staff');
      return withRole(await db.admins.findOne({ user_id: idStr }), 'admin');
    }
    return await this.findByEmail(idStr);
  },

  // Return the user WITH the raw password (for the auth controller)
  async findByIdWithPassword(id) {
    const found = await findRowById(id);
    return found ? { ...found.row, role: found.role } : null;
  },

  // Return the user WITHOUT the password (public profile)
  async findById(id) {
    const found = await findRowById(id);
    if (!found) return null;
    const { password, ...userWithoutPassword } = found.row;
    return { ...userWithoutPassword, role: found.role };
  },

  async create({ name, email, password, role = 'staff', status = 'pending', created_by, first_name, middle_name, last_name, birthdate, gender, address, contract_details, phone, must_change_password }) {
    const normalizedRole = normalizeRole(role);
    const table = TABLE_BY_ROLE[normalizedRole];
    if (!table) throw new Error(`Unknown role: ${role}`);

    const record = { name, email, password, status };
    // Profile fields live on the client & staff tables
    if (normalizedRole === 'client' || normalizedRole === 'staff') {
      if (first_name !== undefined) record.first_name = first_name;
      if (middle_name !== undefined) record.middle_name = middle_name;
      if (last_name !== undefined) record.last_name = last_name;
      if (birthdate !== undefined) record.birthdate = birthdate;
      if (gender !== undefined) record.gender = gender;
      if (address !== undefined) record.address = address;
      if (contract_details !== undefined) record.contract_details = contract_details;
      if (phone !== undefined) record.phone = phone;
      // Additive: forced first-login password change flag
      record.must_change_password = must_change_password === undefined ? false : Boolean(must_change_password);
    }
    if (created_by !== undefined) record.created_by = created_by;

    const user = await db[table].insert(record);
    return withRole(user, normalizedRole);
  },

  async getAll() {
    const [clients, staff, admins] = await Promise.all([
      db.clients.getAll(),
      db.staff.getAll(),
      db.admins.getAll()
    ]);
    return [
      ...clients.map((r) => withRole(r, 'client')),
      ...staff.map((r) => withRole(r, 'staff')),
      ...admins.map((r) => withRole(r, 'admin'))
    ];
  },

  async getByRole(role) {
    const normalizedRole = normalizeRole(role);
    const table = TABLE_BY_ROLE[normalizedRole];
    if (!table) return [];
    const rows = await db[table].getAll();
    return rows.map((r) => withRole(r, normalizedRole));
  },

  async getPendingStaff() {
    const rows = await db.staff.find({ status: 'pending' });
    return rows.map((r) => withRole(r, 'staff'));
  },

  async getPendingClients() {
    const rows = await db.clients.find({ status: 'pending' });
    return rows.map((r) => withRole(r, 'client'));
  },

  // For a staff's "my created accounts" view (clients + staff the staff encoded)
  async getByCreatedBy(createdBy) {
    const [clients, staff] = await Promise.all([
      db.clients.find({ created_by: createdBy }),
      db.staff.find({ created_by: createdBy })
    ]);
    return [
      ...clients.map((r) => withRole(r, 'client')),
      ...staff.map((r) => withRole(r, 'staff'))
    ];
  },

  async updateStatus(id, status) {
    const found = await findRowById(id);
    if (!found) return null;
    return await db[found.table].update(id, { status });
  },

  async updatePassword(id, hashedPassword, mustChangePassword = null) {
    const found = await findRowById(id);
    if (!found) return null;
    const updates = { password: hashedPassword };
    if (mustChangePassword !== null && found.table !== 'admins') {
      updates.must_change_password = Boolean(mustChangePassword);
    }
    return await db[found.table].update(id, updates);
  },

  async update(id, { name, email, status, first_name, middle_name, last_name, birthdate, gender, address, contract_details, phone }) {
    const found = await findRowById(id);
    if (!found) return null;
    // `role` is intentionally ignored: it is determined by which table the
    // record lives in. Changing roles would require moving rows between tables.
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (status !== undefined) updates.status = status;
    if (found.table !== 'admins') {
      if (first_name !== undefined) updates.first_name = first_name;
      if (middle_name !== undefined) updates.middle_name = middle_name;
      if (last_name !== undefined) updates.last_name = last_name;
      if (birthdate !== undefined) updates.birthdate = birthdate;
      if (gender !== undefined) updates.gender = gender;
      if (address !== undefined) updates.address = address;
      if (contract_details !== undefined) updates.contract_details = contract_details;
      if (phone !== undefined) updates.phone = phone;
    }
    return await db[found.table].update(id, updates);
  },

  async delete(id) {
    const found = await findRowById(id);
    if (!found) return false;
    return await db[found.table].delete(id);
  },

  async getCount() {
    const [clients, staff, admins] = await Promise.all([
      db.clients.count(),
      db.staff.count(),
      db.admins.count()
    ]);
    return (clients || 0) + (staff || 0) + (admins || 0);
  }
};

module.exports = UserModel;
