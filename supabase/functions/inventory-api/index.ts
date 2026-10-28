import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

const response = (origin: string, status: number, body: Record<string, unknown>, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin, ...extraHeaders },
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

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null;

type Actor = {
  id: number;
  name: string;
  role: "admin" | "staff";
  status: string;
  must_change_password: boolean;
  email: string;
};

const resolveActor = async (request: Request): Promise<Actor | null> => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!admin || !token) return null;

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const matches = await Promise.all(
    ([
      ["admins", "admin"],
      ["staff", "staff"],
    ] as const).map(async ([table, role]) => {
      const { data, error } = await admin
        .from(table)
        .select(role === "admin"
          ? "id, name, email, status, auth_user_id"
          : "id, name, email, status, auth_user_id, must_change_password")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? {
        ...data,
        role,
        must_change_password: data.must_change_password ?? false,
      } : null;
    }),
  );
  const profiles = matches.filter(profile => profile !== null);
  const actor = profiles[0];
  if (
    profiles.length !== 1
    || actor.status !== "active"
    || actor.must_change_password
    || typeof actor.email !== "string"
    || typeof authData.user.email !== "string"
    || actor.email?.toLowerCase() !== authData.user.email?.toLowerCase()
  ) return null;
  return actor;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && uuidPattern.test(value);
const isInteger = (value: unknown, min = 0, max = 1_000_000) =>
  Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const isDate = (value: unknown, nullable = false) => {
  if (nullable && value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const isText = (value: unknown, min: number, max: number) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
const hasValidProductPricing = (payload: Record<string, unknown>) => {
  const purchasePrice = payload.purchase_price;
  const markupPercent = payload.selling_markup_percent;
  if (
    typeof purchasePrice !== "number" || !Number.isFinite(purchasePrice) || purchasePrice <= 0 || purchasePrice > 99_999_999
    || typeof markupPercent !== "number" || !Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 10_000
  ) return false;
  const calculatedPrice = Math.round((purchasePrice * (1 + markupPercent / 100) + Number.EPSILON) * 100) / 100;
  return calculatedPrice > 0 && calculatedPrice <= 99_999_999 && payload.price === calculatedPrice;
};

const validatePayload = (kind: string, payload: Record<string, unknown>) => {
  switch (kind) {
    case "approve_restock":
    case "approve":
    case "reject":
      return Object.keys(payload).length === 0;
    case "reject_restock":
      return isText(payload.reason, 3, 500);
    case "restock":
      return isInteger(payload.product_id, 1) && isInteger(payload.quantity, 1)
        && isDate(payload.expiry_date, true);
    case "correct":
      return isUuid(payload.batch_id) && isInteger(payload.actual_quantity)
        && isInteger(payload.expected_quantity) && isText(payload.reason, 3, 500);
    case "remove_expired":
      return isUuid(payload.batch_id) && isInteger(payload.expected_quantity, 1)
        && isText(payload.reason, 3, 500);
    case "damage":
      return isUuid(payload.batch_id) && isInteger(payload.quantity, 1)
        && isPositiveMoney(payload.unit_cost) && isText(payload.reason, 3, 500);
    case "supplier_return":
      return isUuid(payload.batch_id) && isInteger(payload.quantity, 1)
        && isPositiveMoney(payload.unit_cost) && isText(payload.reason, 3, 500)
        && (payload.supplier_reference === undefined || (typeof payload.supplier_reference === "string" && payload.supplier_reference.length <= 150));
    case "create_product":
      return isText(payload.name, 2, 200) && isText(payload.category, 2, 100)
        && (payload.barcode == null || (typeof payload.barcode === "string" && payload.barcode.length <= 100))
        && hasValidProductPricing(payload) && isInteger(payload.minimum_stock)
        && isInteger(payload.quantity) && isDate(payload.expiry_date, true);
    case "edit_product":
      return isInteger(payload.product_id, 1) && isText(payload.name, 2, 200)
        && isText(payload.category, 2, 100)
        && (payload.barcode == null || (typeof payload.barcode === "string" && payload.barcode.length <= 100))
        && hasValidProductPricing(payload) && isInteger(payload.minimum_stock);
    case "expiry":
      return isUuid(payload.batch_id) && isDate(payload.expiry_date)
        && isDate(payload.expected_expiry, true) && isText(payload.reason, 8, 500)
        && typeof payload.confirm_reactivation === "boolean";
    case "delivery":
      return isText(payload.supplier, 1, 150) && isText(payload.receipt_number, 1, 100)
        && (payload.reason === "" || isText(payload.reason, 0, 500))
        && Array.isArray(payload.items) && payload.items.length >= 1 && payload.items.length <= 100
        && payload.items.every(item => isRecord(item)
          && isInteger(item.product_id, 1) && isInteger(item.quantity, 1)
          && isText(item.batch_code, 1, 100) && isDate(item.expiry_date, true));
    case "transfer":
      return isUuid(payload.batch_id) && isInteger(payload.quantity, 1)
        && (payload.reason === "" || isText(payload.reason, 0, 500));
    case "adjustment":
      return (payload.batch_id === null || isUuid(payload.batch_id))
        && (payload.product_id === undefined || isInteger(payload.product_id, 1))
        && (payload.batch_code === undefined || (typeof payload.batch_code === "string" && payload.batch_code.length <= 100))
        && (payload.expiry_date === undefined || isDate(payload.expiry_date, true))
        && typeof payload.quantity === "number" && Number.isInteger(payload.quantity)
        && payload.quantity !== 0 && Math.abs(payload.quantity) <= 1_000_000
        && isInteger(payload.expected_quantity) && ["warehouse", "store"].includes(String(payload.location))
        && isText(payload.reason, 3, 500);
    case "reversal":
      return isUuid(payload.original_id) && isText(payload.reason, 3, 500);
    default:
      return false;
  }
};

const allRows = async (table: "products" | "inventory_batches", includePurchasePrice = false) => {
  if (!admin) throw new Error("Supabase service is not configured.");
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const columns = table === "inventory_batches" && !includePurchasePrice
      ? "id,product_id,batch_code,expiry_date,warehouse_qty,store_qty,created_at"
      : "*";
    const { data, error } = await admin.from(table).select(columns).order("id").range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
};

const readHistory = async (actor: Actor, body: Record<string, unknown>) => {
  if (!admin) throw new Error("Supabase service is not configured.");
  const page = body.page === undefined ? 0 : Number(body.page);
  const type = body.type === undefined ? "documents" : body.type;
  if (!Number.isInteger(page) || page < 0 || page > 100_000 || !["documents", "movements"].includes(String(type))) {
    return { status: 400, body: { message: "Invalid history filter." } };
  }
  const movements = type === "movements";
  let query = admin.from(movements ? "inventory_movements" : "inventory_documents")
    .select(
      movements
        ? "*, inventory_batches!inner(product_id,batch_code), inventory_documents(actor_name,actor_role,reason)"
        : "*, inventory_document_items(*)",
      { count: "exact" },
    );
  if (!movements && actor.role === "staff") {
    query = query.eq("actor_role", "staff").eq("actor_id", actor.id);
  }
  if (body.product_id !== undefined && movements) {
    const productId = Number(body.product_id);
    if (!Number.isInteger(productId) || productId < 1) {
      return { status: 400, body: { message: "Invalid product." } };
    }
    query = query.eq("inventory_batches.product_id", productId);
  }
  const { data, count, error } = await query.order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(page * 25, page * 25 + 24);
  if (error) throw error;
  return { status: 200, body: { entries: data, total: count } };
};

const readReorders = async () => {
  const { data, error } = await admin!.rpc("inventory_reorder_orders");
  if (error) throw error;
  return { entries: data || [] };
};

const receiveReorder = async (actor: Actor, body: Record<string, unknown>, origin: string) => {
  if (actor.role !== "admin") {
    return response(origin, 403, { message: "Only admins can receive reorder deliveries and record purchase prices." });
  }
  if (!isUuid(body.id)
    || (body.expiry_date !== null && body.expiry_date !== undefined && !isDate(body.expiry_date))
    || !isPositiveMoney(body.purchase_price)) {
    return response(origin, 400, { message: "Invalid reorder reference or expiry date." });
  }
  const { data, error } = await admin!.rpc("inventory_receive_reorder", {
    p_id: body.id,
    p_expiry_date: body.expiry_date || null,
    p_purchase_price: body.purchase_price,
    p_actor: actor.id,
    p_role: actor.role,
  });
  if (error) {
    const code = error.code || "";
    const status = /^PT(400|403|404|409)$/.test(code) ? Number(code.slice(2)) : 503;
    return response(origin, status, { message: error.message || "Unable to receive reorder." });
  }
  return response(origin, 200, { reorderId: data, message: "Reorder received. 50 units were added to stock." });
};

const readRequests = async (actor: Actor, body: Record<string, unknown>) => {
  if (!admin) throw new Error("Supabase service is not configured.");
  const page = body.page === undefined ? 0 : Number(body.page);
  const status = body.status === undefined ? "all" : body.status;
  if (
    !Number.isInteger(page) || page < 0 || page > 100_000
    || !["all", "pending", "completed", "rejected"].includes(String(status))
  ) return { status: 400, body: { message: "Invalid request filter." } };

  let query = admin.from("inventory_documents")
    .select(
      "id,status,actor_name,actor_id,actor_role,created_at,reviewed_at,reviewed_by,reason,inventory_document_items(quantity,expiry_date,products(name))",
      { count: "exact" },
    )
    .eq("kind", "restock")
    .eq("actor_role", "staff")
    .or("status.eq.pending,reviewed_by.not.is.null");
  if (actor.role === "staff") query = query.eq("actor_id", actor.id);
  if (status !== "all") query = query.eq("status", status);
  const { data, count, error } = await query.order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(page * 25, page * 25 + 24);
  if (error) throw error;
  return { status: 200, body: { entries: data, total: count } };
};

const auditedKinds = new Set([
  "restock",
  "correct",
  "remove_expired",
  "damage",
  "supplier_return",
  "create_product",
  "edit_product",
  "approve_restock",
  "reject_restock",
]);
const adminOnlyKinds = new Set([
  "approve_restock",
  "reject_restock",
  "adjustment",
  "reversal",
  "approve",
  "reject",
  "expiry",
  "correct",
  "remove_expired",
  "create_product",
  "edit_product",
]);

const runCommand = async (actor: Actor, body: Record<string, unknown>, origin: string) => {
  if (!admin) return response(origin, 503, { message: "Inventory service is not configured." });
  const kind = body.kind;
  const id = body.id;
  const payload = body.payload;
  if (typeof kind !== "string" || !isUuid(id) || !isRecord(payload) || !validatePayload(kind, payload)) {
    return response(origin, 400, { message: "Invalid inventory action or details." });
  }
  if (adminOnlyKinds.has(kind) && actor.role !== "admin") {
    return response(origin, 403, { message: "Admin access required." });
  }

  const messages: Record<string, string> = {
    restock: actor.role === "staff" ? "Restock submitted for admin approval. Available stock is unchanged." : "Stock added successfully.",
    correct: "Stock count corrected.",
    remove_expired: "Expired stock removed.",
    damage: "Damage recorded and stock removed.",
    supplier_return: "Supplier return recorded and stock removed.",
    create_product: "Product created successfully.",
    edit_product: "Product details updated.",
    approve_restock: "Stock request approved. Stock has been added.",
    reject_restock: "Stock request rejected. Stock is unchanged.",
    expiry: "Batch expiry updated. Previous and new dates are recorded in the audit log.",
    delivery: "Delivery submitted for admin approval.",
  };

  let auditId: string | null = null;
  if (!auditedKinds.has(kind) && kind !== "expiry") {
    const { data: audit, error: auditError } = await admin.from("audit_logs").insert({
      actor_id: String(actor.id),
      actor_name: actor.name || "User",
      actor_role: actor.role,
      action: `Inventory ${kind}`,
      entity_type: "Inventory",
      details: { requested: {} },
    }).select("id").single();
    if (auditError) throw auditError;
    auditId = audit.id;
  }

  let result: { data: unknown; error: { code?: string; message?: string } | null };
  if (auditedKinds.has(kind)) {
    const { data: audit, error: auditError } = await admin.from("audit_logs").insert({
      actor_id: String(actor.id),
      actor_name: actor.name || "User",
      actor_role: actor.role,
      action: `Inventory ${kind}`,
      entity_type: "Inventory",
      details: { requested: {} },
    }).select("id").single();
    if (auditError) throw auditError;
    auditId = audit.id;
    result = await admin.rpc("inventory_audited_command", {
      p_audit_id: auditId,
      p_id: id,
      p_kind: kind,
      p_payload: payload,
      p_actor: actor.id,
      p_role: actor.role,
    });
  } else if (kind === "expiry") {
    result = await admin.rpc("inventory_edit_expiry", {
      p_id: id,
      p_batch_id: payload.batch_id,
      p_expiry: payload.expiry_date,
      p_expected: payload.expected_expiry,
      p_reason: payload.reason,
      p_actor: actor.id,
      p_confirm_reactivation: payload.confirm_reactivation,
    });
  } else if (kind === "approve_restock" || kind === "reject_restock") {
    result = await admin.rpc("inventory_review_restock", {
      p_id: id,
      p_approve: kind === "approve_restock",
      p_reason: payload.reason || "",
      p_actor: actor.id,
    });
  } else if (["restock", "correct", "remove_expired", "create_product", "edit_product"].includes(kind)) {
    result = await admin.rpc(kind === "restock" ? "inventory_submit_restock" : "inventory_simple_command", {
      p_id: id,
      p_kind: kind,
      p_payload: payload,
      p_actor: actor.id,
      p_role: actor.role,
    });
  } else if (kind === "damage" || kind === "supplier_return") {
    result = await admin.rpc("inventory_record_loss", {
      p_id: id,
      p_kind: kind,
      p_payload: payload,
      p_actor: actor.id,
      p_role: actor.role,
    });
  } else {
    result = await admin.rpc("inventory_command", {
      p_id: id,
      p_kind: kind,
      p_payload: payload,
      p_actor: actor.id,
      p_role: actor.role,
    });
  }

  if (result.error) {
    if (auditId && !auditedKinds.has(kind)) {
      const { error: finishError } = await admin.from("audit_logs")
        .update({ outcome: "failed", finished_at: new Date().toISOString() })
        .eq("id", auditId).eq("outcome", "pending");
      if (finishError) console.error("Inventory audit finalization failed:", finishError.code || "unavailable");
    }
    const code = result.error.code || "";
    const status = /^PT(400|403|404|409)$/.test(code)
      ? Number(code.slice(2))
      : ["23505", "23503", "23514"].includes(code)
      ? 409
      : ["22P02", "22007", "22008", "22003"].includes(code)
      ? 400
      : 503;
    const message = code.startsWith("PT")
      ? result.error.message || "Inventory request was rejected."
      : status === 409
      ? "This product, barcode or reference already exists, or the stock change conflicts with current records."
      : status === 400
      ? "Invalid quantity, date or reference."
      : "Inventory is unavailable. Check the inventory setup and try again.";
    return response(origin, status, { message });
  }

  if (auditId && !auditedKinds.has(kind)) {
    const { error: finishError } = await admin.from("audit_logs")
      .update({
        outcome: "succeeded",
        entity_id: String(id),
        finished_at: new Date().toISOString(),
        details: { requested: {}, http_status: 200 },
      })
      .eq("id", auditId).eq("outcome", "pending");
    if (finishError) {
      console.error("Inventory audit finalization failed:", finishError.code || "unavailable");
      return response(origin, 200, {
        inventoryId: result.data,
        message: messages[kind] || "Inventory action completed.",
      }, { "X-Audit-Status": "pending" });
    }
  }
  return response(origin, 200, {
    inventoryId: result.data,
    message: messages[kind] || "Inventory action completed.",
  });
};

Deno.serve(async request => {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") {
    if (!origin) return new Response("Origin not allowed.", { status: 403 });
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin },
    });
  }
  if (!origin) return response("null", 403, { message: "Origin not allowed." });
  if (request.method !== "POST") return response(origin, 405, { message: "Method not allowed." });
  if (!admin) return response(origin, 503, { message: "Inventory service is not configured." });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return response(origin, 400, { message: "Invalid inventory request." });
    body = parsed;
  } catch {
    return response(origin, 400, { message: "Invalid inventory request." });
  }

  try {
    const actor = await resolveActor(request);
    if (!actor) return response(origin, 401, { message: "An active signed-in staff or admin account is required." });
    if (body.action === "overview") {
      const [products, batches, simpleReady, approvalReady] = await Promise.all([
        allRows("products"),
        allRows("inventory_batches", actor.role === "admin"),
        admin.rpc("inventory_simple_ready"),
        admin.rpc("inventory_restock_approval_ready"),
      ]);
      if (simpleReady.error) throw simpleReady.error;
      if (approvalReady.error && approvalReady.error.code !== "PGRST202") throw approvalReady.error;
      return response(origin, 200, {
        products,
        batches,
        simpleReady: simpleReady.data === true,
        approvalReady: approvalReady.data === true,
      });
    }
    if (body.action === "history") {
      const result = await readHistory(actor, body);
      return response(origin, result.status, result.body);
    }
    if (body.action === "requests") {
      const result = await readRequests(actor, body);
      return response(origin, result.status, result.body);
    }
    if (body.action === "reorders") return response(origin, 200, await readReorders());
    if (body.action === "receive_reorder") return await receiveReorder(actor, body, origin);
    if (body.action === "command") return await runCommand(actor, body, origin);
    return response(origin, 400, { message: "Unsupported inventory request." });
  } catch (error) {
    console.error("Inventory request failed:", error instanceof Error ? error.message : "unknown error");
    return response(origin, 503, { message: "Inventory is temporarily unavailable." });
  }
});
