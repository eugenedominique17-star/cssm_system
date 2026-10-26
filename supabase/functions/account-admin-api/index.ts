import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import bcrypt from "npm:bcryptjs@2.4.3";

const headers = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const response = (origin: string, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Access-Control-Allow-Origin": origin },
  });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const manilaToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  const configured = Deno.env.get("APP_ORIGIN");
  const allowed = new Set([
    "https://storehub.bscs4a.com",
    "http://localhost:3000",
    ...(configured ? [configured] : []),
  ]);
  return origin && allowed.has(origin) ? origin : null;
};

const url = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const admin = url && serviceRoleKey
  ? createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const authVerifier = url && anonKey
  ? createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const auditSecretKey = Deno.env.get("AUDIT_SECRET_KEY");
const auditRetentionDays = Number(Deno.env.get("AUDIT_SECRET_RETENTION_DAYS") || 90);
const cryptoKey = async () => {
  if (!auditSecretKey) throw new Error("Audit secret key is not configured.");
  const raw = /^[0-9a-f]{64}$/i.test(auditSecretKey) ? auditSecretKey.match(/.{2}/g)!.map((value: string) => parseInt(value, 16)) : [...atob(auditSecretKey)].map((value: string) => value.charCodeAt(0));
  if (raw.length !== 32) throw new Error("Audit secret key must be 32 bytes.");
  return crypto.subtle.importKey("raw", new Uint8Array(raw), "AES-GCM", false, ["encrypt"]);
};
const encryptPreviousPassword = async (value: string) => {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, await cryptoKey(), new TextEncoder().encode(value)));
  const authTag = encrypted.slice(-16);
  const ciphertext = encrypted.slice(0, -16);
  const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  const days = Number.isInteger(auditRetentionDays) && auditRetentionDays > 0 && auditRetentionDays <= 3650 ? auditRetentionDays : 90;
  return { nonce: encode(nonce), ciphertext: encode(ciphertext), auth_tag: encode(authTag), retention_expires_at: new Date(Date.now() + days * 86400000).toISOString() };
};

type Role = "client" | "staff" | "admin";
type Profile = {
  id: number;
  user_id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  auth_user_id: string | null;
  must_change_password: boolean;
  [key: string]: unknown;
};
const tableForRole: Record<Role, "clients" | "staff" | "admins"> = {
  client: "clients",
  staff: "staff",
  admin: "admins",
};
const userIdFor = (role: Role, id: number) => {
  const prefix = role === "client" ? "C" : role === "staff" ? "S" : "A";
  const base = role === "client" ? 1_000_000 : role === "staff" ? 2_000_000 : 3_000_000;
  return `${prefix}${String(id - base).padStart(6, "0")}`;
};

const resolveProfile = async (request: Request, allowPasswordChange = false): Promise<Profile | null> => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!admin || !token) return null;
  const { data: authResult, error: authError } = await admin.auth.getUser(token);
  if (authError || !authResult.user?.email) return null;
  const records = await Promise.all(
    ([
      ["clients", "client"],
      ["staff", "staff"],
      ["admins", "admin"],
    ] as const).map(async ([table, role]) => {
      const { data, error } = await admin.from(table).select("*")
        .eq("auth_user_id", authResult.user.id).maybeSingle();
      if (error) throw error;
      return data ? { ...data, role } as Profile : null;
    }),
  );
  const matches = records.filter((record): record is Profile => record !== null);
  if (matches.length !== 1) return null;
  const profile = matches[0];
  if (
    profile.status !== "active"
    || profile.email.toLowerCase() !== authResult.user.email.toLowerCase()
    || (Boolean(profile.must_change_password) && !allowPasswordChange)
  ) return null;
  return profile;
};

const cleanProfile = (record: Record<string, unknown>, role: Role) => {
  const { password: _password, ...safe } = record;
  return { ...safe, role };
};
const pagedRows = async (table: string, filters: Array<[string, unknown]> = []) => {
  if (!admin) throw new Error("Account service is not configured.");
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = admin.from(table).select("*").order("id").range(offset, offset + 999);
    for (const [column, value] of filters) query = query.eq(column, value);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
};
const loadAccount = async (id: unknown) => {
  if (!admin || !Number.isSafeInteger(id) || Number(id) < 1) return null;
  const matches = await Promise.all(
    ([
      ["clients", "client"],
      ["staff", "staff"],
      ["admins", "admin"],
    ] as const).map(async ([table, role]) => {
      const { data, error } = await admin.from(table).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? { ...data, role, table } : null;
    }),
  );
  const rows = matches.filter(Boolean);
  if (rows.length > 1) throw new Error("Account ID is not unique across role tables.");
  return rows[0] || null;
};
const startAudit = async (profile: Profile, action: string, entityId: number | null) => {
  if (!admin) throw new Error("Account service is not configured.");
  const { data, error } = await admin.from("audit_logs").insert({
    actor_id: String(profile.id),
    actor_name: profile.name || "User",
    actor_role: profile.role,
    action,
    entity_type: "Account",
    entity_id: entityId === null ? null : String(entityId),
    details: { requested: {} },
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
};
const finishAudit = async (id: string, outcome: "succeeded" | "failed", entityId: number | null, details: Record<string, unknown> = {}) => {
  if (!admin) throw new Error("Account service is not configured.");
  const { error } = await admin.from("audit_logs").update({
    outcome,
    entity_id: entityId === null ? null : String(entityId),
    finished_at: new Date().toISOString(),
    details: { requested: {}, ...details },
  }).eq("id", id).eq("outcome", "pending");
  if (error) throw error;
};
const allAccounts = async (role?: unknown) => {
  if (role !== undefined && !["admin", "staff", "client"].includes(String(role))) {
    throw Object.assign(new Error("Invalid account role."), { status: 400 });
  }
  const roles: Role[] = role ? [role as Role] : ["client", "staff", "admin"];
  const rows = await Promise.all(roles.map(async currentRole =>
    (await pagedRows(tableForRole[currentRole])).map(row => cleanProfile(row, currentRole)),
  ));
  return rows.flat();
};

const pendingAccounts = async (role: "client" | "staff") =>
  (await pagedRows(tableForRole[role], [["status", "pending"]])).map(row => cleanProfile(row, role));

const validateText = (value: unknown, min: number, max: number) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const createAccount = async (profile: Profile, body: Record<string, unknown>, role: "client" | "staff") => {
  if (!admin) throw new Error("Account service is not configured.");
  if (!["admin", "staff"].includes(profile.role)) throw Object.assign(new Error("Staff or admin access is required."), { status: 403 });
  const data = isRecord(body.data) ? body.data : {};
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (!validateText(name, 2, 100) || !emailPattern.test(email) || password.length < 6 || password.length > 1024) {
    throw Object.assign(new Error("Enter a valid name, email, and password."), { status: 400 });
  }
  const duplicates = await Promise.all((["clients", "staff", "admins"] as const).map(async table => {
    const { data: match, error } = await admin.from(table).select("id").eq("email", email).maybeSingle();
    if (error) throw error;
    return match;
  }));
  if (duplicates.some(Boolean)) throw Object.assign(new Error("Email already registered."), { status: 400 });

  const auditId = await startAudit(profile, `Create ${role} account`, null);
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    await finishAudit(auditId, "failed", null, { http_status: 503 });
    if (authError?.code === "email_exists" || authError?.code === "user_already_exists") {
      throw Object.assign(new Error("Email already registered."), { status: 400 });
    }
    console.error("Account Auth creation failed:", authError?.status || "unavailable");
    throw Object.assign(new Error("Account could not be created."), { status: 503 });
  }

  const { data: existingProfile, error: profileError } = await admin.from(tableForRole[role])
    .select("id").eq("auth_user_id", authData.user.id).maybeSingle();
  if (profileError || existingProfile) {
    await admin.auth.admin.deleteUser(authData.user.id);
    await finishAudit(auditId, "failed", null, { http_status: 503 });
    throw Object.assign(new Error("Account could not be linked."), { status: 503 });
  }
  const hashed = await bcrypt.hash(password, 10);
  const record: Record<string, unknown> = {
    name,
    email,
    password: hashed,
    status: role === "staff" ? "pending" : "active",
    created_by: profile.id,
    must_change_password: true,
    auth_user_id: authData.user.id,
  };
  for (const field of [
    "first_name", "middle_name", "last_name", "birthdate", "gender",
    "address", "phone", "contract_details",
  ]) {
    if (data[field] !== undefined) record[field] = data[field];
  }
  const { data: created, error: insertError } = await admin.from(tableForRole[role])
    .insert(record).select("id,user_id").single();
  if (insertError) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(authData.user.id);
    if (deleteError) console.error("Orphan Auth user cleanup failed:", deleteError.status || "unavailable");
    if (["23505", "23514"].includes(insertError.code || "")) {
      await finishAudit(auditId, "failed", null, { http_status: 400 });
      throw Object.assign(new Error("Email already registered or account details are invalid."), { status: 400 });
    }
    await finishAudit(auditId, "failed", null, { http_status: 503 });
    console.error("Account profile creation failed:", insertError.code || "unavailable");
    throw Object.assign(new Error("Account could not be created."), { status: 503 });
  }
  const userId = created.user_id || userIdFor(role, Number(created.id));
  if (!created.user_id) {
    const { data: linked, error: identityError } = await admin.from(tableForRole[role])
      .update({ user_id: userId }).eq("id", created.id).select("id").maybeSingle();
    if (identityError || !linked) {
      const { error: profileDeleteError } = await admin.from(tableForRole[role]).delete().eq("id", created.id);
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(authData.user.id);
      if (profileDeleteError) console.error("Incomplete account profile cleanup failed:", profileDeleteError.code || "unavailable");
      if (authDeleteError) console.error("Incomplete account Auth cleanup failed:", authDeleteError.status || "unavailable");
      await finishAudit(auditId, "failed", Number(created.id), { http_status: 503 });
      throw Object.assign(new Error("Account could not be assigned its account ID."), { status: 503 });
    }
  }
  const label = role === "staff" ? "Staff account created successfully. It is pending admin approval." : "Client account created successfully.";
  await finishAudit(auditId, "succeeded", created.id, {
    snapshot_version: 1,
    result: label,
    account: { id: created.id, user_id: userId, name, role },
    http_status: 201,
  });
  return {
    message: label,
    userId: created.id,
    user_id: userId,
    credentials: { email, password },
  };
};

const updateAccount = async (profile: Profile, body: Record<string, unknown>, operation: string) => {
  if (!admin) throw new Error("Account service is not configured.");
  if (profile.role !== "admin") throw Object.assign(new Error("Admin access is required."), { status: 403 });
  const id = Number(body.id);
  const account = await loadAccount(id);
  if (!account) throw Object.assign(new Error("User not found."), { status: 404 });
  if (operation === "approve" || operation === "reject" || operation === "deactivate" || operation === "approve-staff") {
    if (account.role === "admin" && operation !== "approve-staff") {
      throw Object.assign(new Error("Admin accounts cannot be modified this way."), { status: 400 });
    }
    if (operation === "approve-staff" && !["active", "rejected"].includes(String(body.status))) {
      throw Object.assign(new Error('Invalid status. Must be "active" or "rejected".'), { status: 400 });
    }
    const status = operation === "approve-staff"
      ? body.status
      : operation === "approve" ? "active"
      : operation === "reject" ? "rejected"
      : "inactive";
    const action = status === "active" ? "Approve account" : status === "rejected" ? "Reject account" : "Deactivate account";
    const auditId = await startAudit(profile, action, id);
    const { data: saved, error } = await admin.from(account.table).update({ status })
      .eq("id", id).select("*").maybeSingle();
    if (error || !saved) {
      await finishAudit(auditId, "failed", id, { http_status: error ? 503 : 404 });
      if (error) throw error;
      throw Object.assign(new Error("User not found."), { status: 404 });
    }
    await finishAudit(auditId, "succeeded", id, {
      snapshot_version: 1,
      result: `Account ${status} successfully.`,
      account: { id, user_id: account.user_id, name: account.name, role: account.role },
      changes: [{ field: "status", label: "Account status", before: account.status, after: status }],
      http_status: 200,
    });
    return { message: operation === "approve-staff"
      ? `Staff account ${status === "active" ? "approved" : "rejected"} successfully.`
      : `User ${status === "active" ? "approved" : status === "rejected" ? "rejected" : "deactivated"} successfully.` };
  }
  if (operation === "update") {
    const data = isRecord(body.data) ? body.data : {};
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) {
      if (!validateText(data.name, 2, 100)) throw Object.assign(new Error("Name must be 2 to 100 characters."), { status: 400 });
      updates.name = data.name.trim();
    }
    if (data.email !== undefined) {
      if (typeof data.email !== "string" || !emailPattern.test(data.email.trim())) {
        throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
      }
      updates.email = data.email.trim().toLowerCase();
    }
    if (data.status !== undefined) {
      if (!["active", "pending", "rejected", "inactive"].includes(String(data.status))) {
        throw Object.assign(new Error("Invalid account status."), { status: 400 });
      }
      updates.status = data.status;
    }
    for (const field of ["first_name", "middle_name", "last_name", "birthdate", "gender", "address", "contract_details", "phone"]) {
      if (data[field] !== undefined && account.role !== "admin") updates[field] = data[field];
    }
    if (data.role !== undefined && data.role !== account.role) {
      throw Object.assign(new Error("Changing account roles is not supported."), { status: 400 });
    }
    if (!Object.keys(updates).length) throw Object.assign(new Error("No account changes were provided."), { status: 400 });
    const changedEmail = updates.email && updates.email !== account.email;
    if (changedEmail) {
      const duplicateTables = (["clients", "staff", "admins"] as const).filter(table => table !== account.table);
      const checks = await Promise.all(duplicateTables.map(table => admin.from(table).select("id").eq("email", updates.email).maybeSingle()));
      if (checks.some(check => check.error)) throw checks.find(check => check.error)?.error;
      if (checks.some(check => check.data)) throw Object.assign(new Error("Email already registered."), { status: 400 });
    }
    const auditId = await startAudit(profile, "Update account", id);
    const { data: saved, error } = await admin.from(account.table).update(updates).eq("id", id).select("*").maybeSingle();
    if (error || !saved) {
      await finishAudit(auditId, "failed", id, { http_status: 503 });
      if (error) throw error;
      throw Object.assign(new Error("Account update could not be saved."), { status: 503 });
    }
    if (changedEmail && account.auth_user_id) {
      const { error: authError } = await admin.auth.admin.updateUserById(
        account.auth_user_id,
        { email: String(updates.email), email_confirm: true },
      );
      if (authError) {
        const restoreValues = Object.fromEntries(Object.keys(updates).map(field => [
          field,
          account[field] === undefined ? null : account[field],
        ]));
        const { error: restoreError } = await admin.from(account.table)
          .update(restoreValues).eq("id", id);
        await finishAudit(auditId, "failed", id, { http_status: 503 });
        if (restoreError) console.error("Account email rollback failed:", restoreError.code || "unavailable");
        throw Object.assign(new Error("Account email could not be synchronized with Supabase Auth."), { status: 503 });
      }
    }
    await finishAudit(auditId, "succeeded", id, {
      snapshot_version: 1,
      result: "Account updated successfully.",
      account: { id, user_id: account.user_id, name: saved.name, role: account.role },
      changes: Object.keys(updates).map(field => ({
        field,
        label: field.replaceAll("_", " "),
        before: account[field] ?? null,
        after: saved[field] ?? null,
      })),
      http_status: 200,
    });
    return { message: "User updated successfully." };
  }
  if (operation === "reset-password") {
    if (account.role === "admin") throw Object.assign(new Error("Cannot reset another admin password."), { status: 400 });
    const temporary = `Aa1!${crypto.randomUUID().replaceAll("-", "")}`;
    const previousHash = account.password;
    const previousFlag = Boolean(account.must_change_password);
    const hash = await bcrypt.hash(temporary, 10);
    const auditId = await startAudit(profile, "Reset account password", id);
    const { data: saved, error } = await admin.from(account.table)
      .update({ password: hash, must_change_password: true }).eq("id", id).select("id").maybeSingle();
    if (error || !saved) {
      await finishAudit(auditId, "failed", id, { http_status: 503 });
      throw Object.assign(new Error("Password reset could not be saved."), { status: 503 });
    }
    if (account.auth_user_id) {
      const { error: authError } = await admin.auth.admin.updateUserById(account.auth_user_id, { password: temporary });
      if (authError) {
        const { error: rollbackError } = await admin.from(account.table)
          .update({ password: previousHash, must_change_password: previousFlag }).eq("id", id);
        await finishAudit(auditId, "failed", id, { http_status: 503 });
        if (rollbackError) console.error("Legacy password rollback failed:", rollbackError.code || "unavailable");
        throw Object.assign(new Error(rollbackError
          ? "Password reset failed and the previous password could not be restored. Contact an administrator."
          : "Password reset synchronization failed."), { status: 503 });
      }
    }
    await finishAudit(auditId, "succeeded", id, {
      snapshot_version: 1,
      result: "Password reset successfully. User must change it on next login.",
      account: { id, user_id: account.user_id, name: account.name, role: account.role },
      http_status: 200,
    });
    return {
      message: "Password reset successfully. User must change it on next login.",
      credentials: { email: account.email, user_id: account.user_id, password: temporary },
    };
  }
  if (operation === "request-password-reset") {
    if (profile.role !== "staff") throw Object.assign(new Error("Staff access is required."), { status: 403 });
    if (account.role === "admin") throw Object.assign(new Error("Cannot request a reset for an admin account."), { status: 400 });
    const auditId = await startAudit(profile, "Request account password reset", id);
    const { data: submission, error } = await admin.from("pending_submissions").insert({
      type: "password_reset",
      data: {
        target_user_id: account.id,
        target_user_id_formatted: account.user_id,
        target_name: account.name,
        target_email: account.email,
        target_role: account.role,
      },
      submitted_by: profile.id,
      status: "pending",
    }).select("id").single();
    if (error) throw error;
    return { message: "Password reset request submitted for admin approval.", submissionId: submission.id };
  }
  if (operation === "delete") {
    if (account.role === "admin") throw Object.assign(new Error("Admin accounts cannot be deleted."), { status: 400 });
    const auditId = await startAudit(profile, "Delete account", id);
    const { data: deleted, error } = await admin.from(account.table).delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      await finishAudit(auditId, "failed", id, { http_status: 409 });
      throw Object.assign(new Error("Account could not be deleted. It may have related records."), { status: 409 });
    }
    if (!deleted) {
      await finishAudit(auditId, "failed", id, { http_status: 503 });
      throw Object.assign(new Error("Account deletion could not be saved."), { status: 503 });
    }
    if (account.auth_user_id) {
      const { error: authError } = await admin.auth.admin.deleteUser(account.auth_user_id);
      if (authError) console.error("Deleted account Auth identity cleanup failed:", authError.status || "unavailable");
    }
    await finishAudit(auditId, "succeeded", id, { snapshot_version: 1, result: "Account deleted successfully.", http_status: 200 });
    return { message: "User deleted successfully." };
  }
  throw Object.assign(new Error("Unsupported account operation."), { status: 400 });
};

const readRequest = async (profile: Profile, body: Record<string, unknown>) => {
  if (!admin) throw new Error("Account service is not configured.");
  const action = body.action;
  if (action === "accounts") {
    if (!["admin", "staff"].includes(profile.role)) throw Object.assign(new Error("Staff or admin access is required."), { status: 403 });
    return allAccounts(body.role);
  }
  if (action === "account") {
    if (!["admin", "staff"].includes(profile.role)) {
      throw Object.assign(new Error("Staff or admin access is required."), { status: 403 });
    }
    const account = await loadAccount(body.id);
    if (!account) throw Object.assign(new Error("User not found."), { status: 404 });
    return cleanProfile(account, account.role);
  }
  if (action === "my-created") {
    if (profile.role !== "staff") throw Object.assign(new Error("Staff access is required."), { status: 403 });
    const [clients, staff] = await Promise.all([
      pagedRows("clients", [["created_by", profile.id]]),
      pagedRows("staff", [["created_by", profile.id]]),
    ]);
    return [
      ...clients.map(row => cleanProfile(row, "client")),
      ...staff.map(row => cleanProfile(row, "staff")),
    ];
  }
  if (action === "pending-staff") {
    if (profile.role !== "admin") throw Object.assign(new Error("Admin access is required."), { status: 403 });
    return pendingAccounts("staff");
  }
  if (action === "pending-clients") {
    if (profile.role !== "admin") throw Object.assign(new Error("Admin access is required."), { status: 403 });
    return pendingAccounts("client");
  }
  if (action === "me") return cleanProfile(profile, profile.role);
  if (action === "update-profile") {
    if (!admin) throw new Error("Account service is not configured.");
    if (profile.role !== "client") {
      throw Object.assign(new Error("Only clients can edit this profile."), { status: 403 });
    }
    const data = isRecord(body.data) ? body.data : {};
    const editableFields = new Set([
      "first_name", "middle_name", "last_name", "birthdate", "gender", "address", "phone",
    ]);
    if (Object.keys(data).some(key => !editableFields.has(key))) {
      throw Object.assign(new Error("Only personal details can be changed here. Email and account settings are fixed."), { status: 400 });
    }
    const firstName = typeof data.first_name === "string" ? data.first_name.trim() : "";
    const lastName = typeof data.last_name === "string" ? data.last_name.trim() : "";
    const middleName = typeof data.middle_name === "string" ? data.middle_name.trim() : "";
    const name = [firstName, middleName, lastName].filter(Boolean).join(" ");
    if (!firstName || !lastName || name.length > 100) {
      throw Object.assign(new Error("Enter a valid first and last name (100 characters maximum)."), { status: 400 });
    }
    const birthdate = typeof data.birthdate === "string" ? data.birthdate.trim() : undefined;
    if (birthdate !== undefined && birthdate !== "") {
      const parsed = new Date(`${birthdate}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)
        || Number.isNaN(parsed.valueOf())
        || parsed.toISOString().slice(0, 10) !== birthdate
      ) {
        throw Object.assign(new Error("Enter a valid birthdate."), { status: 400 });
      }
      if (birthdate > manilaToday()) {
        throw Object.assign(new Error("Birthdate cannot be in the future."), { status: 400 });
      }
    } else if (birthdate === undefined && Object.hasOwn(data, "birthdate")) {
      throw Object.assign(new Error("Enter a valid birthdate."), { status: 400 });
    }
    const gender = typeof data.gender === "string" ? data.gender.trim() : undefined;
    if (gender !== undefined && !["", "male", "female", "other"].includes(gender)) {
      throw Object.assign(new Error("Choose a valid gender."), { status: 400 });
    }
    const address = typeof data.address === "string" ? data.address.trim() : undefined;
    if ((address !== undefined && address.length > 500) || (Object.hasOwn(data, "address") && address === undefined)) {
      throw Object.assign(new Error("Address must be 500 characters or less."), { status: 400 });
    }
    const phone = typeof data.phone === "string" ? data.phone.trim() : undefined;
    if ((phone !== undefined && phone.length > 30) || (Object.hasOwn(data, "phone") && phone === undefined)) {
      throw Object.assign(new Error("Phone number must be 30 characters or less."), { status: 400 });
    }
    if (
      (Object.hasOwn(data, "middle_name") && typeof data.middle_name !== "string")
      || (Object.hasOwn(data, "gender") && gender === undefined)
    ) {
      throw Object.assign(new Error("Enter valid personal details."), { status: 400 });
    }
    const table = tableForRole[profile.role];
    const updates: Record<string, unknown> = {
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      name,
    };
    if (birthdate !== undefined) updates.birthdate = birthdate || null;
    if (gender !== undefined) updates.gender = gender || null;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    const auditId = await startAudit(profile, "Update profile", profile.id);
    const { data: saved, error } = await admin.from(table)
      .update(updates)
      .eq("id", profile.id).select("*").maybeSingle();
    if (error || !saved) {
      await finishAudit(auditId, "failed", profile.id, { http_status: 503 });
      if (error) throw error;
      throw Object.assign(new Error("Profile update could not be saved."), { status: 503 });
    }
    await finishAudit(auditId, "succeeded", profile.id, {
      snapshot_version: 1,
      result: "Profile updated successfully.",
      account: { id: profile.id, user_id: profile.user_id, name, role: profile.role },
      changes: [
        { field: "first_name", label: "First name", before: profile.first_name ?? null, after: firstName },
        { field: "middle_name", label: "Middle name", before: profile.middle_name ?? null, after: middleName || null },
        { field: "last_name", label: "Last name", before: profile.last_name ?? null, after: lastName },
        ...(birthdate !== undefined ? [{ field: "birthdate", label: "Birthdate", before: profile.birthdate ?? null, after: birthdate || null }] : []),
        ...(gender !== undefined ? [{ field: "gender", label: "Gender", before: profile.gender ?? null, after: gender || null }] : []),
        ...(address !== undefined ? [{ field: "address", label: "Address", before: profile.address ?? null, after: address }] : []),
        ...(phone !== undefined ? [{ field: "phone", label: "Phone number", before: profile.phone ?? null, after: phone }] : []),
      ],
      http_status: 200,
    });
    return { user: cleanProfile(saved, profile.role), message: "Profile updated successfully." };
  }
  if (action === "change-password") {
    if (!admin || !authVerifier) throw Object.assign(new Error("Password service is not configured."), { status: 503 });
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword || newPassword.length < 6 || newPassword === currentPassword) {
      throw Object.assign(new Error("Enter your current password and a different new password of at least 6 characters."), { status: 400 });
    }
    const { data: verified, error: verifyError } = await authVerifier.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });
    if (verifyError || !verified.user || verified.user.id !== profile.auth_user_id) {
      throw Object.assign(new Error("Current password is incorrect."), { status: 400 });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const auditId = await startAudit(profile, "Change password", profile.id);
    const { error: authError } = await admin.auth.admin.updateUserById(profile.auth_user_id!, { password: newPassword });
    if (authError) {
      await finishAudit(auditId, "failed", profile.id, { http_status: 503 });
      throw Object.assign(new Error("Password could not be changed."), { status: 503 });
    }
    const { error: profileError } = await admin.from(tableForRole[profile.role])
      .update({ password: passwordHash, must_change_password: false })
      .eq("id", profile.id);
    if (profileError) {
      const { error: rollbackError } = await admin.auth.admin.updateUserById(
        profile.auth_user_id!,
        { password: currentPassword },
      );
      await finishAudit(auditId, "failed", profile.id, { http_status: 503 });
      if (rollbackError) {
        console.error("Supabase Auth password rollback failed:", rollbackError.status || "unavailable");
        throw Object.assign(new Error("Password update failed and the previous password could not be restored. Contact an administrator."), { status: 503 });
      }
      throw Object.assign(new Error("Password could not be saved."), { status: 503 });
    }
    const secret = await encryptPreviousPassword(currentPassword);
    const { error: secretError } = await admin.from("audit_previous_passwords").upsert({ audit_event_id: auditId, ...secret }, { onConflict: "audit_event_id" });
    if (secretError) {
      await finishAudit(auditId, "failed", profile.id, { http_status: 503 });
      throw Object.assign(new Error("Password audit record could not be saved."), { status: 503 });
    }
    await finishAudit(auditId, "succeeded", profile.id, {
      snapshot_version: 1,
      result: "Password changed successfully.",
      account: { id: profile.id, user_id: profile.user_id, name: profile.name, role: profile.role },
      previous_password: { available: true, masked: "********" },
      http_status: 200,
    });
    return { message: "Password changed successfully." };
  }
  if (action === "dashboard") {
    if (profile.role !== "admin") throw Object.assign(new Error("Admin access is required."), { status: 403 });
    const [users, products, transactions, pendingStaff, pendingClients, pendingSubmissions, recent] = await Promise.all([
      Promise.all([admin.from("clients").select("id", { count: "exact", head: true }), admin.from("staff").select("id", { count: "exact", head: true }), admin.from("admins").select("id", { count: "exact", head: true })]),
      admin.from("products").select("id", { count: "exact", head: true }),
      admin.from("transactions").select("id", { count: "exact", head: true }),
      admin.from("staff").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("clients").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("pending_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("transactions").select("*").order("created_at", { ascending: false }).limit(5),
    ]);
    const errors = [products, transactions, pendingStaff, pendingClients, pendingSubmissions, recent].filter(item => item.error);
    if (errors.length || users.some(item => item.error)) throw errors[0]?.error || users.find(item => item.error)?.error;
    type DashboardTransaction = Record<string, unknown> & {
      user_id: number | null;
      staff_id: number | null;
    };
    const recentRows = (recent.data || []) as DashboardTransaction[];
    const clientIds = [...new Set(recentRows.map(row => row.user_id).filter((id): id is number => typeof id === "number"))];
    const staffIds = [...new Set(recentRows.map(row => row.staff_id).filter((id): id is number => typeof id === "number"))];
    const [clients, staff] = await Promise.all([
      clientIds.length ? admin.from("clients").select("id,name").in("id", clientIds) : Promise.resolve({ data: [], error: null }),
      staffIds.length ? admin.from("staff").select("id,name").in("id", staffIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (clients.error) throw clients.error;
    if (staff.error) throw staff.error;
    const clientNames = new Map((clients.data || []).map((row: { id: number; name: string }) => [row.id, row.name]));
    const staffNames = new Map((staff.data || []).map((row: { id: number; name: string }) => [row.id, row.name]));
    return {
      totalUsers: users.reduce((total, item) => total + (item.count || 0), 0),
      totalProducts: products.count || 0,
      totalTransactions: transactions.count || 0,
      pendingStaff: pendingStaff.count || 0,
      pendingClients: pendingClients.count || 0,
      pendingSubmissions: pendingSubmissions.count || 0,
      recentTransactions: recentRows.map(row => ({
        ...row,
        user_name: row.user_id === null ? null : clientNames.get(row.user_id) || null,
        staff_name: row.staff_id === null ? null : staffNames.get(row.staff_id) || null,
      })),
    };
  }
  throw Object.assign(new Error("Unsupported account request."), { status: 400 });
};

Deno.serve(async request => {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") {
    if (!origin) return new Response("Origin not allowed.", { status: 403 });
    return new Response("ok", { headers: { ...headers, "Access-Control-Allow-Origin": origin } });
  }
  if (!origin) return response("null", 403, { message: "Origin not allowed." });
  if (request.method !== "POST") return response(origin, 405, { message: "Method not allowed." });
  if (!admin) return response(origin, 503, { message: "Account service is not configured." });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return response(origin, 400, { message: "Invalid account request." });
    body = parsed;
  } catch {
    return response(origin, 400, { message: "Invalid account request." });
  }
  try {
    const profile = await resolveProfile(request, body.action === "change-password");
    if (!profile) return response(origin, 401, { message: "An active signed-in account is required." });
    if (body.action === "create-client" || body.action === "create-staff") {
      const role = body.action === "create-client" ? "client" : "staff";
      if (profile.role === "admin" || (profile.role === "staff" && role === "client")) {
        const result = await createAccount(profile, body, role);
        return response(origin, 201, result);
      }
      return response(origin, 403, { message: "You are not allowed to create this account." });
    }
    if (body.action === "account-mutation") {
      const result = await updateAccount(profile, body, String(body.operation || ""));
      return response(origin, 200, result);
    }
    const result = await readRequest(profile, body);
    return response(origin, 200, { data: result });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 503;
    if (status >= 500) console.error("Account request failed:", error instanceof Error ? error.name : "unknown");
    return response(origin, status, {
      message: error instanceof Error && (status < 500 || ("expose" in error && error.expose === true))
        ? error.message
        : "Account service is temporarily unavailable.",
    });
  }
});
