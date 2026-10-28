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
    || actor.email.toLowerCase() !== authData.user.email.toLowerCase()
  ) return null;
  return actor;
};

const isIntegerId = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;
const isText = (value: unknown, min: number, max: number) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
const optionalText = (value: unknown, max: number) =>
  value === undefined || value === null || (typeof value === "string" && value.length <= max);
const isPositiveMoney = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 99_999_999;
const isDateTime = (value: unknown) =>
  (typeof value === "string" || value instanceof Date)
  && Number.isFinite(Date.parse(String(value)));
const isStatus = (value: unknown, values: string[]) =>
  value === undefined || values.includes(String(value));

const validateProduct = (data: Record<string, unknown>, create: boolean, role: Actor["role"]) => {
  if (create && (
    !isText(data.name, 2, 200)
    || !isText(data.category, 2, 100)
    || !isPositiveMoney(data.price)
  )) return "Product name, category, and positive price are required.";
  if (!create && Object.keys(data).length === 0) return "Product changes are required.";
  if (data.name !== undefined && !isText(data.name, 2, 200)) return "Product name must be 2 to 200 characters.";
  if (data.category !== undefined && !isText(data.category, 2, 100)) return "Category must be 2 to 100 characters.";
  if (data.price !== undefined && !isPositiveMoney(data.price)) return "Enter a valid positive product price.";
  if (data.description !== undefined && !optionalText(data.description, 100_000)) return "Product description is too long.";
  if (data.image_url !== undefined && !optionalText(data.image_url, 2_000)) return "Product image URL is too long.";
  if (data.stock !== undefined && (data.stock !== 0 || !create)) {
    return "Use Inventory for stock changes.";
  }
  if (data.expiry_date !== undefined && data.expiry_date !== null && data.expiry_date !== "") {
    if (!create) return "Use Inventory for batch expiry changes.";
    if (!isDateTime(data.expiry_date)) return "Enter a valid expiry date.";
  }
  if (data.status !== undefined && (role !== "admin" || !isStatus(data.status, ["active", "inactive", "pending"]))) {
    return "Only admins can set a valid product status.";
  }
  return null;
};

const validatePromo = (data: Record<string, unknown>, create: boolean, role: Actor["role"]) => {
  const required = ["title", "discount_type", "discount_value", "start_date", "end_date"];
  if (create && required.some(key => data[key] === undefined)) return "Complete all required promotion fields.";
  if (!create && Object.keys(data).length === 0) return "Promotion changes are required.";
  if (data.title !== undefined && !isText(data.title, 2, 200)) return "Promotion title must be 2 to 200 characters.";
  if (data.description !== undefined && !optionalText(data.description, 100_000)) return "Promotion description is too long.";
  if (
    data.discount_type !== undefined
    && !["percentage", "fixed", "bundle"].includes(String(data.discount_type))
  ) return "Invalid promotion discount type.";
  if (data.discount_value !== undefined && !isPositiveMoney(data.discount_value)) {
    return "Enter a valid positive promotion value.";
  }
  if (data.start_date !== undefined && !isDateTime(data.start_date)) return "Enter a valid promotion start date.";
  if (data.end_date !== undefined && !isDateTime(data.end_date)) return "Enter a valid promotion end date.";
  if (data.start_date !== undefined && data.end_date !== undefined
    && Date.parse(String(data.end_date)) <= Date.parse(String(data.start_date))) {
    return "Promotion end date must be later than its start date.";
  }
  if (data.status !== undefined && (role !== "admin" || !isStatus(data.status, ["active", "expired", "pending"]))) {
    return "Only admins can set a valid promotion status.";
  }
  return null;
};

const fieldsForSubmission = (resource: "products" | "promos", data: Record<string, unknown>) => {
  if (resource === "products") {
    const fields = ["name", "description", "price", "stock", "category", "image_url", "expiry_date"];
    return Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
  }
  const fields = ["title", "description", "discount_type", "discount_value", "start_date", "end_date"];
  return Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
};

const auditStart = async (actor: Actor, action: string, entityType: string) => {
  if (!admin) throw new Error("Supabase service is not configured.");
  const { data, error } = await admin.from("audit_logs").insert({
    actor_id: String(actor.id),
    actor_name: actor.name || "User",
    actor_role: actor.role,
    action,
    entity_type: entityType,
    details: { requested: {} },
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
};

const auditFinish = async (
  id: string,
  outcome: "succeeded" | "failed",
  entityId: number | null,
  details: Record<string, unknown>,
) => {
  if (!admin) throw new Error("Supabase service is not configured.");
  const { error } = await admin.from("audit_logs").update({
    outcome,
    entity_id: entityId === null ? null : String(entityId),
    finished_at: new Date().toISOString(),
    details: { requested: {}, ...details },
  }).eq("id", id).eq("outcome", "pending");
  if (error) throw error;
};

const failAudit = async (auditId: string, error: { code?: string }) => {
  try {
    await auditFinish(auditId, "failed", null, { error_code: error.code || "unavailable" });
  } catch (auditError) {
    console.error("Catalog mutation audit finalization failed:", auditError instanceof Error ? auditError.name : "unknown error");
  }
};

const execute = async (actor: Actor, body: Record<string, unknown>, origin: string) => {
  if (!admin) return response(origin, 503, { message: "Catalog service is not configured." });
  const resource = body.resource;
  const operation = body.operation;
  const data = isRecord(body.data) ? body.data : {};
  const id = body.id;
  if (!["products", "promos"].includes(String(resource)) || !["create", "update", "delete"].includes(String(operation))) {
    return response(origin, 400, { message: "Unsupported catalog mutation." });
  }
  const table = resource as "products" | "promos";
  const entity = table === "products" ? "Product" : "Promo";
  const updating = operation === "update";
  const creating = operation === "create";

  if (updating || operation === "delete") {
    if (!isIntegerId(Number(id))) return response(origin, 400, { message: "A valid record ID is required." });
  }
  if (actor.role === "staff" && table === "products" && updating && data.price !== undefined) {
    return response(origin, 403, { message: "Only admins can edit product prices." });
  }
  if (operation === "delete" && actor.role !== "admin") {
    return response(origin, 403, { message: "Admin access required." });
  }
  if (operation === "delete" && Object.keys(data).length) {
    return response(origin, 400, { message: "Delete requests cannot include changes." });
  }

  const validation = table === "products"
    ? validateProduct(data, creating, actor.role)
    : validatePromo(data, creating, actor.role);
  if (validation) return response(origin, 400, { message: validation });

  let action: string;
  if (actor.role === "staff") {
    if (operation === "delete") return response(origin, 403, { message: "Admin access required." });
    action = `Submit ${entity.toLowerCase()} for approval`;
  } else {
    action = `${creating ? "Create" : operation === "delete" ? "Delete" : "Update"} ${entity.toLowerCase()}`;
  }

  let auditId: string;
  try {
    auditId = await auditStart(actor, action, entity);
  } catch (error) {
    console.error("Catalog mutation audit start failed:", error instanceof Error ? error.name : "unknown error");
    return response(origin, 503, { message: "Activity logging is unavailable. No changes were made." });
  }

  let resultId: number;
  let message: string;
  let submissionId: number | null = null;
  try {
    if (actor.role === "staff") {
      const submission = {
        type: table === "promos" ? "promo" : creating ? "product" : "stock_update",
        data: {
          ...fieldsForSubmission(table, data),
          ...(table === "products" && updating ? { product_id: Number(id) } : {}),
          ...(table === "promos" && updating ? { promo_id: Number(id) } : {}),
        },
        submitted_by: actor.id,
        status: "pending",
      };
      const { data: saved, error } = await admin.from("pending_submissions")
        .insert(submission).select("id").single();
      if (error) throw error;
      submissionId = saved.id;
      resultId = saved.id;
      message = table === "promos"
        ? updating ? "Update submitted for admin approval." : "Promo submitted for admin approval."
        : updating ? "Product details submitted for admin approval." : "Product submitted for admin approval.";
    } else if (creating) {
      const insert = table === "products"
        ? {
          name: data.name,
          description: data.description ?? null,
          price: data.price,
          stock: 0,
          category: data.category,
          image_url: data.image_url || null,
          expiry_date: null,
          status: "active",
          created_by: actor.id,
        }
        : {
          title: data.title,
          description: data.description ?? null,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          start_date: data.start_date,
          end_date: data.end_date,
          status: "active",
          created_by: actor.id,
        };
      const { data: saved, error } = await admin.from(table).insert(insert).select("id").single();
      if (error) throw error;
      resultId = saved.id;
      message = `${entity} created successfully.`;
    } else if (updating) {
      const update: Record<string, unknown> = {};
      const allowedFields = table === "products"
        ? ["name", "description", "price", "category", "image_url", "status"]
        : ["title", "description", "discount_type", "discount_value", "start_date", "end_date", "status"];
      for (const key of allowedFields) {
        if (data[key] !== undefined) update[key] = data[key];
      }
      const { data: saved, error } = await admin.from(table).update(update)
        .eq("id", Number(id)).select("id").maybeSingle();
      if (error) throw error;
      if (!saved) {
        await auditFinish(auditId, "failed", null, { error_code: "not_found" });
        return response(origin, 404, { message: `${entity} not found.` });
      }
      resultId = saved.id;
      message = `${entity} updated successfully.`;
    } else {
      const { data: deleted, error } = await admin.from(table).delete()
        .eq("id", Number(id)).select("id").maybeSingle();
      if (error) throw error;
      if (!deleted) {
        await auditFinish(auditId, "failed", null, { error_code: "not_found" });
        return response(origin, 404, { message: `${entity} not found.` });
      }
      resultId = deleted.id;
      message = `${entity} deleted successfully.`;
    }
  } catch (error) {
    const dbError = error as { code?: string };
    await failAudit(auditId, dbError);
    const status = ["23503", "23505", "23514"].includes(dbError.code || "") ? 409 : 503;
    const message = status === 409
      ? table === "products" && operation === "delete"
        ? "Products with sales or inventory history cannot be deleted. Mark the product inactive instead."
        : "This catalog change conflicts with existing records."
      : "Catalog change could not be saved. No success was reported.";
    console.error("Catalog mutation failed:", dbError.code || "unavailable");
    return response(origin, status, { message });
  }

  try {
    await auditFinish(auditId, "succeeded", resultId, {
      ...(submissionId ? { reference_type: "Submission" } : {}),
    });
  } catch (error) {
    console.error("Catalog mutation audit completion failed:", error instanceof Error ? error.name : "unknown error");
    return response(origin, 200, {
      message,
      ...(submissionId ? { submissionId } : table === "products" ? { productId: resultId } : { promoId: resultId }),
    }, { "X-Audit-Status": "pending" });
  }

  return response(origin, creating && actor.role === "admin" ? 201 : 200, {
    message,
    ...(submissionId ? { submissionId } : table === "products" ? { productId: resultId } : { promoId: resultId }),
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
  if (!admin) return response(origin, 503, { message: "Catalog service is not configured." });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return response(origin, 400, { message: "Invalid catalog mutation." });
    body = parsed;
  } catch {
    return response(origin, 400, { message: "Invalid catalog mutation." });
  }
  try {
    const actor = await resolveActor(request);
    if (!actor) return response(origin, 401, { message: "An active signed-in staff or admin account is required." });
    return await execute(actor, body, origin);
  } catch (error) {
    console.error("Catalog request failed:", error instanceof Error ? error.name : "unknown error");
    return response(origin, 503, { message: "Catalog service is temporarily unavailable." });
  }
});
