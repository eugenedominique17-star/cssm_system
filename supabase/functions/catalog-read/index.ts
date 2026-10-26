import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

const response = (origin: string, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin },
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

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const resolveActiveProfile = async (request: Request) => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const matches = await Promise.all(
    ([
      ["clients", "client"],
      ["staff", "staff"],
      ["admins", "admin"],
    ] as const).map(async ([table, role]) => {
      const { data, error } = await admin
        .from(table)
        .select(role === "admin"
          ? "id, email, status, auth_user_id"
          : "id, email, status, auth_user_id, must_change_password")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, role, must_change_password: data.must_change_password ?? false } : null;
    }),
  );
  const profiles = matches.filter(profile => profile !== null);
  const profile = profiles[0];
  if (
    profiles.length !== 1
    || profile.status !== "active"
    || profile.must_change_password
    || profile.email?.toLowerCase() !== authData.user.email?.toLowerCase()
  ) return null;
  return profile;
};

const selectAll = async (table: "products" | "promos") => {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
};

const getProducts = async (activeOnly: boolean) => {
  let products = await selectAll("products");
  const { data: availability, error } = await admin.rpc("inventory_available_stock");
  if (!error) {
    const available = new Map(
      availability.map((row: { product_id: number; available_stock: number | null }) => [
        row.product_id,
        Number(row.available_stock || 0),
      ]),
    );
    products = products.map(product => ({
      ...product,
      physical_store_stock: product.stock,
      stock: available.get(product.id) || 0,
    }));
  } else {
    console.warn("Inventory availability is unavailable; using product stock.", error.code);
  }
  if (activeOnly) products = products.filter(product => product.status === "active");
  return products;
};

const getPromos = async (activeOnly: boolean) => {
  let promos = await selectAll("promos");
  if (activeOnly) {
    const now = Date.now();
    promos = promos.filter(promo =>
      promo.status === "active"
      && typeof promo.start_date === "string"
      && typeof promo.end_date === "string"
      && Number.isFinite(Date.parse(promo.start_date))
      && Number.isFinite(Date.parse(promo.end_date))
      && now >= Date.parse(promo.start_date)
      && now <= Date.parse(promo.end_date),
    );
  }
  return promos.sort((a, b) =>
    Date.parse(String(a.start_date)) - Date.parse(String(b.start_date)),
  );
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
  if (request.method !== "POST") {
    return response(origin, 405, { message: "Method not allowed." });
  }

  let body: { action?: unknown; active?: unknown; id?: unknown; threshold?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) {
      return response(origin, 400, { message: "Invalid catalog request." });
    }
    body = parsed;
  } catch {
    return response(origin, 400, { message: "Invalid catalog request." });
  }

  const action = body.action;
  if (!["homepage", "products", "promos", "product", "promo", "low-stock"].includes(String(action))) {
    return response(origin, 400, { message: "Unsupported catalog request." });
  }

  try {
    if (action === "homepage") {
      const [products, promos] = await Promise.all([getProducts(true), getPromos(true)]);
      return response(origin, 200, { products, promos });
    }

    const profile = await resolveActiveProfile(request);
    if (!profile) return response(origin, 401, { message: "An active signed-in account is required." });

    if (action === "products") {
      return response(origin, 200, {
        data: await getProducts(body.active === true),
      });
    }
    if (action === "product" || action === "promo") {
      if (!Number.isSafeInteger(body.id) || Number(body.id) < 1) {
        return response(origin, 400, { message: "A valid catalog item ID is required." });
      }
      const table = action === "product" ? "products" : "promos";
      const { data: item, error } = await admin.from(table).select("*")
        .eq("id", body.id).maybeSingle();
      if (error) throw error;
      if (!item) return response(origin, 404, { message: `${action === "product" ? "Product" : "Promo"} not found.` });
      return response(origin, 200, { data: item });
    }
    if (action === "low-stock") {
      if (!["admin", "staff"].includes(profile.role)) {
        return response(origin, 403, { message: "Staff or admin access is required." });
      }
      const threshold = Number.isSafeInteger(body.threshold) && Number(body.threshold) !== 0
        ? Number(body.threshold)
        : 10;
      const products = await getProducts(true);
      return response(origin, 200, { data: products.filter(product => Number(product.stock) <= threshold) });
    }
    return response(origin, 200, {
      data: await getPromos(body.active === true),
    });
  } catch (error) {
    console.error("Catalog read failed:", error instanceof Error ? error.name : "unknown error");
    return response(origin, 503, { message: "Store catalog is temporarily unavailable." });
  }
});
