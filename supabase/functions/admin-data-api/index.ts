import { createClient } from "npm:@supabase/supabase-js@2.111.0";

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
const auditSecretKey = Deno.env.get("AUDIT_SECRET_KEY");
const admin = url && serviceRoleKey
  ? createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const authVerifier = url && anonKey
  ? createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const roleTables = ["clients", "staff", "admins"] as const;
const resolveAdmin = async (request: Request) => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!admin || !token) return false;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) return false;
  const matches = await Promise.all(roleTables.map(async table => {
    const { data: profile, error: profileError } = await admin.from(table).select("id,email,status,must_change_password")
      .eq("auth_user_id", data.user!.id).maybeSingle();
    if (profileError) throw profileError;
    return profile ? { ...profile, role: table === "admins" ? "admin" : table === "staff" ? "staff" : "client" } : null;
  }));
  const profiles = matches.filter(Boolean);
  return profiles.length === 1
    && profiles[0].role === "admin"
    && profiles[0].status === "active"
    && !profiles[0].must_change_password
    && profiles[0].email?.toLowerCase() === data.user.email.toLowerCase();
};

const validDate = (value: unknown): value is string =>
  typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const dateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(date);
const dayMs = 24 * 60 * 60 * 1000;

const rowsForRange = async <T extends Record<string, unknown>>(
  table: string,
  columns: string,
  timestampColumn: string,
  start: string,
  end: string,
): Promise<T[]> => {
  if (!admin) throw new Error("Admin data service is not configured.");
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from(table).select(columns)
      .gte(timestampColumn, start).lt(timestampColumn, end)
      .order(timestampColumn, { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
};

const reportTransactions = async (period: string, month: string | null) => {
  const now = Date.now();
  if (period === "monthly" && month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const start = `${month}-01T00:00:00+08:00`;
    const end = new Date(Date.UTC(year, monthNumber, 1) - 8 * 60 * 60 * 1000);
    return rowsForRange<Record<string, unknown>>(
      "transactions",
      "id,total_amount,created_at",
      "created_at",
      start,
      end.toISOString(),
    );
  }
  const cutoff = new Date(now - (period === "weekly" ? 7 : 30) * dayMs).toISOString();
  return rowsForRange<Record<string, unknown>>(
    "transactions",
    "id,total_amount,created_at",
    "created_at",
    cutoff,
    new Date(now + 1000).toISOString(),
  );
};

const getReport = async (params: Record<string, unknown>) => {
  const period = params.period === undefined ? "monthly" : params.period;
  const chart = params.chart === undefined ? "sales_category" : params.chart;
  const month = params.month;
  if (!["weekly", "monthly"].includes(String(period))) {
    throw Object.assign(new Error('Invalid period. Use "weekly" or "monthly".'), { status: 400 });
  }
  if (!["sales_category", "top_products", "sales_trend"].includes(String(chart))) {
    throw Object.assign(new Error("Invalid chart type."), { status: 400 });
  }
  if (month !== undefined && (period !== "monthly" || typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
    throw Object.assign(new Error("Use a valid month in YYYY-MM format with the monthly period."), { status: 400 });
  }

  if (chart === "sales_trend") {
    const startDate = params.start_date;
    const endDate = params.end_date;
    if (!validDate(startDate) || !validDate(endDate)) {
      throw Object.assign(new Error("Provide valid start_date and end_date values in YYYY-MM-DD format."), { status: 400 });
    }
    const rangeStart = Date.parse(`${startDate}T00:00:00+08:00`);
    const rangeEnd = Date.parse(`${endDate}T00:00:00+08:00`) + dayMs;
    const dayCount = (rangeEnd - rangeStart) / dayMs;
    if (dayCount < 1) throw Object.assign(new Error("end_date must be on or after start_date."), { status: 400 });
    if (dayCount > 366) throw Object.assign(new Error("The selected date range cannot exceed 366 days."), { status: 400 });
    const previousStart = rangeStart - (rangeEnd - rangeStart);
    const transactions = await rowsForRange<Record<string, unknown>>(
      "transactions",
      "id,total_amount,created_at",
      "created_at",
      new Date(previousStart).toISOString(),
      new Date(rangeEnd).toISOString(),
    );
    const daily = new Map<string, { date: string; total_sales: number; transaction_count: number }>();
    for (let timestamp = rangeStart; timestamp < rangeEnd; timestamp += dayMs) {
      const date = dateKey(new Date(timestamp));
      daily.set(date, { date, total_sales: 0, transaction_count: 0 });
    }
    const current: Record<string, unknown>[] = [];
    const previous: Record<string, unknown>[] = [];
    for (const transaction of transactions) {
      const createdAt = Date.parse(String(transaction.created_at));
      if (createdAt >= rangeStart && createdAt < rangeEnd) {
        current.push(transaction);
        const day = daily.get(dateKey(new Date(createdAt)));
        if (day) {
          day.total_sales += Number(transaction.total_amount || 0);
          day.transaction_count += 1;
        }
      } else if (createdAt >= previousStart && createdAt < rangeStart) previous.push(transaction);
    }
    const sum = (values: Record<string, unknown>[]) => values.reduce((total, item) => total + Number(item.total_amount || 0), 0);
    const totalRevenue = sum(current);
    const previousRevenue = sum(previous);
    return {
      data: [...daily.values()],
      summary: { total_transactions: current.length, total_revenue: totalRevenue },
      comparison: {
        previous_start_date: dateKey(new Date(previousStart)),
        previous_end_date: dateKey(new Date(rangeStart - dayMs)),
        total_transactions: previous.length,
        total_revenue: previousRevenue,
        revenue_change_percent: previousRevenue === 0 ? null : ((totalRevenue - previousRevenue) / previousRevenue) * 100,
      },
      period: "custom",
      chart,
      start_date: startDate,
      end_date: endDate,
    };
  }

  const transactions = await reportTransactions(String(period), typeof month === "string" ? month : null);
  const ids = transactions.map(transaction => transaction.id);
  const totalRevenue = transactions.reduce((total, transaction) => total + Number(transaction.total_amount || 0), 0);
  const summary = { total_transactions: transactions.length, total_revenue: totalRevenue };
  if (!admin) throw new Error("Admin data service is not configured.");
  let items: Record<string, unknown>[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500);
    const { data, error } = await admin.from("transaction_items")
      .select("transaction_id,product_id,quantity,subtotal")
      .in("transaction_id", batch);
    if (error) throw error;
    items.push(...data);
  }
  const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))];
  const products = new Map<number, Record<string, unknown>>();
  for (let offset = 0; offset < productIds.length; offset += 500) {
    const { data, error } = await admin.from("products").select("id,name,category")
      .in("id", productIds.slice(offset, offset + 500));
    if (error) throw error;
    for (const product of data) products.set(Number(product.id), product);
  }
  const grouped = new Map<string | number, Record<string, unknown>>();
  for (const item of items) {
    const product = products.get(Number(item.product_id));
    if (!product) continue;
    if (chart === "sales_category") {
      const category = String(product.category);
      const entry = grouped.get(category) || { category, total_sales: 0, transaction_count: new Set<number>() };
      (entry.transaction_count as Set<number>).add(Number(item.transaction_id));
      entry.total_sales = Number(entry.total_sales) + Number(item.subtotal || 0);
      grouped.set(category, entry);
    } else {
      const id = Number(product.id);
      const entry = grouped.get(id) || {
        name: product.name,
        category: product.category,
        total_quantity: 0,
        total_sales: 0,
      };
      entry.total_quantity = Number(entry.total_quantity) + Number(item.quantity || 0);
      entry.total_sales = Number(entry.total_sales) + Number(item.subtotal || 0);
      grouped.set(id, entry);
    }
  }
  const data = chart === "sales_category"
    ? [...grouped.values()].map(entry => ({
      ...entry,
      transaction_count: (entry.transaction_count as Set<number>).size,
    })).sort((a, b) => Number(b.total_sales) - Number(a.total_sales))
    : [...grouped.values()].sort((a, b) => Number(b.total_quantity) - Number(a.total_quantity)).slice(0, 10);
  return { data, summary, period, chart, month: month || null };
};

const listAudit = async (params: Record<string, unknown>) => {
  if (!admin) throw new Error("Admin data service is not configured.");
  const { role = "", outcome = "", entity = "", search = "", from = "", to = "", page = "0" } = params;
  if (![role, outcome, entity, search, from, to, page].every(value => typeof value === "string")
    || !/^\d{1,6}$/.test(String(page))
    || String(search).length > 100
    || !["", "admin", "staff", "client"].includes(String(role))
    || !["", "pending", "succeeded", "failed"].includes(String(outcome))
    || !["", "Product", "Promo", "Account", "Order", "Approval", "Inventory"].includes(String(entity))
    || (from && !validDate(from))
    || (to && !validDate(to))
    || (from && to && String(from) > String(to))) {
    throw Object.assign(new Error("Invalid audit filters or date range."), { status: 400 });
  }
  const pageNumber = Number(page);
  const size = 25;
  let query = admin.from("audit_logs").select("*", { count: "exact" });
  if (role) query = query.eq("actor_role", role);
  if (outcome) query = query.eq("outcome", outcome);
  if (entity) query = query.eq("entity_type", entity);
  const escapedSearch = String(search).replace(/[%_\\]/g, "");
  if (escapedSearch) query = query.ilike("actor_name", `%${escapedSearch}%`);
  if (from) query = query.gte("created_at", `${from}T00:00:00+08:00`);
  if (to) {
    const end = new Date(`${to}T00:00:00+08:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  const { data, count, error } = await query.order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(pageNumber * size, (pageNumber + 1) * size - 1);
  if (error) throw error;
  let entries = data || [];
  const passwordIds = entries.filter(entry => entry.outcome === "succeeded" && entry.action === "Change password").map(entry => entry.id);
  if (passwordIds.length) {
    const { data: secrets, error: secretError } = await admin.from("audit_previous_passwords")
      .select("audit_event_id,retention_expires_at").in("audit_event_id", passwordIds);
    if (secretError) throw secretError;
    const available = new Map((secrets || []).map(secret => [secret.audit_event_id, !secret.retention_expires_at || new Date(secret.retention_expires_at) > new Date()]));
    entries = entries.map(entry => available.has(entry.id) ? { ...entry, details: { ...entry.details, previous_password: { available: available.get(entry.id), masked: "********" } } } : entry);
  }
  const inventoryIds = [...new Set(entries
    .filter(entry => entry.outcome === "succeeded"
      && entry.entity_type === "Inventory"
      && entry.action.startsWith("Inventory ")
      && entry.details?.snapshot_version !== 1
      && /^[0-9a-f-]{36}$/i.test(entry.entity_id || ""))
    .map(entry => entry.entity_id))];
  if (inventoryIds.length) {
    const { data: documents, error: inventoryError } = await admin.from("inventory_documents")
      .select("id,actor_id,actor_name,actor_role,status,reviewed_by,reason,inventory_document_items(product_id,quantity,expiry_date,products(name))")
      .in("id", inventoryIds);
    if (inventoryError) console.error("Audit inventory enrichment unavailable:", inventoryError.code || "unavailable");
    else {
      const linkedById = new Map((documents || []).map(document => [document.id, document]));
      entries = entries.map(entry => {
        const document = linkedById.get(entry.entity_id);
        if (!document || entry.outcome !== "succeeded" || entry.details?.snapshot_version === 1) return entry;
        const line = document.inventory_document_items?.[0];
        const review = ["Inventory approve_restock", "Inventory reject_restock"].includes(entry.action);
        return {
          ...entry,
          details: {
            ...entry.details,
            linked_request: {
              requires_approval: document.actor_role === "staff" && (document.status === "pending" || document.reviewed_by != null),
              product: line ? { id: line.product_id, name: line.products?.name } : undefined,
              quantity_requested: line?.quantity,
              expiry_date: line?.expiry_date,
              requested_by: { id: document.actor_id, name: document.actor_name, role: document.actor_role },
              reviewed_by: review ? { id: entry.actor_id, name: entry.actor_name, role: entry.actor_role } : undefined,
              reason: entry.action === "Inventory reject_restock" ? document.reason : undefined,
            },
          },
        };
      });
    }
  }
  const orderIds = [...new Set(entries
    .filter(entry => entry.outcome === "succeeded" && entry.entity_type === "Order"
      && entry.action === "Create order" && /^\d+$/.test(entry.entity_id || ""))
    .map(entry => Number(entry.entity_id)))];
  if (orderIds.length) {
    try {
      const [transactions, items] = await Promise.all([
        admin.from("transactions").select("id,receipt_number,user_id,total_amount,payment_method,tendered_amount,change_amount").in("id", orderIds),
        admin.from("transaction_items").select("transaction_id,product_id,quantity,unit_price,subtotal").in("transaction_id", orderIds),
      ]);
      if (transactions.error) throw transactions.error;
      if (items.error) throw items.error;
      const customerIds = [...new Set((transactions.data || []).map(row => row.user_id).filter(Boolean))];
      const productIds = [...new Set((items.data || []).map(row => row.product_id))];
      const [customers, products] = await Promise.all([
        customerIds.length ? admin.from("clients").select("id,name").in("id", customerIds) : Promise.resolve({ data: [], error: null }),
        productIds.length ? admin.from("products").select("id,name").in("id", productIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (customers.error) throw customers.error;
      if (products.error) throw products.error;
      const customerNames = new Map((customers.data || []).map(row => [row.id, row.name]));
      const productNames = new Map((products.data || []).map(row => [row.id, row.name]));
      const itemsByTransaction = new Map<number, Record<string, unknown>[]>();
      for (const item of items.data || []) {
        const grouped = itemsByTransaction.get(item.transaction_id) || [];
        grouped.push({ ...item, product_name: productNames.get(item.product_id) || "Unknown" });
        itemsByTransaction.set(item.transaction_id, grouped);
      }
      const orders = new Map((transactions.data || []).map(order => [String(order.id), {
        ...order,
        user_name: customerNames.get(order.user_id) || null,
        items: itemsByTransaction.get(order.id) || [],
      }]));
      entries = entries.map(entry => {
        const order = orders.get(String(entry.entity_id));
        if (!order || entry.outcome !== "succeeded" || entry.entity_type !== "Order"
          || entry.action !== "Create order" || entry.details?.linked_order) return entry;
        return {
          ...entry,
          details: {
            ...entry.details,
            linked_order: {
              receipt_number: order.receipt_number,
              customer_name: order.user_name,
              total_amount: order.total_amount,
              payment_method: order.payment_method,
              tendered_amount: order.tendered_amount,
              change_amount: order.change_amount,
              items: order.items.map((item: Record<string, unknown>) => ({
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal,
              })),
            },
          },
        };
      });
    } catch (error) {
      console.error("Audit order enrichment unavailable:", error instanceof Error ? error.name : "unknown");
    }
  }
  return { entries, total: count, page: pageNumber, pageSize: size };
};

const revealPreviousPassword = async (request: Request, params: Record<string, unknown>) => {
  if (!admin || !authVerifier) throw Object.assign(new Error("Admin data service is not configured."), { status: 503 });
  const auditEventId = typeof params.id === "string" ? params.id : "";
  const adminPassword = typeof params.adminPassword === "string" ? params.adminPassword : "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: authData } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const matches = await Promise.all(roleTables.map(async table => {
    const { data, error } = await admin.from(table).select("id,name,email,auth_user_id").eq("auth_user_id", authData.user?.id || "").maybeSingle();
    if (error) throw error;
    return data ? { ...data, role: table === "admins" ? "admin" : table === "staff" ? "staff" : "client" } : null;
  }));
  const actor = matches.find(Boolean);
  if (!actor || actor.role !== "admin") throw Object.assign(new Error("Active admin access is required."), { status: 403 });
  const revealAudit = await startRevealAudit(actor, auditEventId);
  try {
    if (!adminPassword) throw Object.assign(new Error("Current admin password is required."), { status: 401 });
    const { data: verified, error: verifyError } = await authVerifier.auth.signInWithPassword({ email: actor.email, password: adminPassword });
    if (verifyError || !verified.user || verified.user.id !== actor.auth_user_id) throw Object.assign(new Error("Current admin password is incorrect."), { status: 401 });
    const { data: audit, error: auditError } = await admin.from("audit_logs").select("action,outcome").eq("id", auditEventId).maybeSingle();
    if (auditError) throw auditError;
    if (!audit || audit.action !== "Change password" || audit.outcome !== "succeeded") throw Object.assign(new Error("Previous password is unavailable."), { status: 404 });
    const { data: secret, error: secretError } = await admin.from("audit_previous_passwords").select("nonce,ciphertext,auth_tag,retention_expires_at").eq("audit_event_id", auditEventId).maybeSingle();
    if (secretError) throw secretError;
    if (!secret || new Date(secret.retention_expires_at) <= new Date()) throw Object.assign(new Error("Previous password is unavailable."), { status: 404 });
    if (!auditSecretKey) throw new Error("Audit secret key is not configured.");
    const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
    const raw = /^[0-9a-f]{64}$/i.test(auditSecretKey) ? auditSecretKey.match(/.{2}/g)!.map((value: string) => parseInt(value, 16)) : [...atob(auditSecretKey)].map((value: string) => value.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", new Uint8Array(raw), "AES-GCM", false, ["decrypt"]);
    const combined = new Uint8Array([...decode(secret.ciphertext), ...decode(secret.auth_tag)]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(secret.nonce) }, key, combined);
    await finishRevealAudit(revealAudit, "succeeded");
    return { previousPassword: new TextDecoder().decode(plain) };
  } catch (error) {
    await finishRevealAudit(revealAudit, "failed");
    throw error;
  }
};
const startRevealAudit = async (actor: Record<string, unknown>, entityId: string) => {
  const { data, error } = await admin.from("audit_logs").insert({ actor_id: String(actor.id), actor_name: String(actor.name || "Admin"), actor_role: "admin", action: "Reveal previous password", entity_type: "Account", entity_id: entityId, details: { requested: {} } }).select("id").single();
  if (error) throw error;
  return data.id as string;
};
const finishRevealAudit = async (id: string, outcome: "succeeded" | "failed") => {
  await admin.from("audit_logs").update({ outcome, finished_at: new Date().toISOString(), details: { result: outcome === "succeeded" ? "Previous password revealed." : "Previous password reveal was denied.", http_status: outcome === "succeeded" ? 200 : 403 } }).eq("id", id).eq("outcome", "pending");
};

Deno.serve(async request => {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") {
    if (!origin) return new Response("Origin not allowed.", { status: 403 });
    return new Response("ok", { headers: { ...headers, "Access-Control-Allow-Origin": origin } });
  }
  if (!origin) return response("null", 403, { message: "Origin not allowed." });
  if (request.method !== "POST") return response(origin, 405, { message: "Method not allowed." });
  if (!admin) return response(origin, 503, { message: "Admin data service is not configured." });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed) || !isRecord(parsed.params)) return response(origin, 400, { message: "Invalid admin data request." });
    body = parsed;
  } catch {
    return response(origin, 400, { message: "Invalid admin data request." });
  }
  try {
    if (!await resolveAdmin(request)) return response(origin, 403, { message: "Active admin access is required." });
    const data = body.action === "reports"
      ? await getReport(body.params)
      : body.action === "audit-logs"
      ? await listAudit(body.params)
      : body.action === "reveal-previous-password"
      ? await revealPreviousPassword(request, body.params)
      : (() => { throw Object.assign(new Error("Unsupported admin data request."), { status: 400 }); })();
    return response(origin, 200, { data });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 503;
    if (status >= 500) console.error("Admin data request failed:", error instanceof Error ? error.name : "unknown");
    return response(origin, status, {
      message: error instanceof Error && status < 500
        ? error.message
        : "Admin data service is temporarily unavailable.",
    });
  }
});
