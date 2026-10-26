import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

type Profile = {
  id: number;
  role: "client" | "staff" | "admin";
  name: string;
  email: string;
  status: string;
  auth_user_id: string;
  must_change_password: boolean;
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
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const resolveProfile = async (request: Request): Promise<Profile | null> => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: authResult, error: authError } = await admin.auth.getUser(token);
  if (authError || !authResult.user?.email) return null;

  const matches = await Promise.all(
    ([
      ["clients", "client"],
      ["staff", "staff"],
      ["admins", "admin"],
    ] as const).map(async ([table, role]) => {
      const columns = role === "admin"
        ? "id, name, email, status, auth_user_id"
        : "id, name, email, status, auth_user_id, must_change_password";
      const { data, error } = await admin
        .from(table)
        .select(columns)
        .eq("auth_user_id", authResult.user.id)
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
  if (profiles.length !== 1) return null;
  const profile = profiles[0];
  if (
    profile.status !== "active"
    || profile.must_change_password
    || profile.email.toLowerCase() !== authResult.user.email.toLowerCase()
  ) return null;
  return profile as Profile;
};

const normalizeItems = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const counts = new Map<number, number>();
  for (const item of value) {
    if (!isRecord(item)) return null;
    const productId = item.product_id;
    const quantity = item.quantity;
    if (
      !Number.isSafeInteger(productId) || Number(productId) < 1
      || !Number.isSafeInteger(quantity) || Number(quantity) < 1
    ) return null;
    const total = (counts.get(Number(productId)) ?? 0) + Number(quantity);
    if (total > 2147483647) return null;
    counts.set(Number(productId), total);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([product_id, quantity]) => ({ product_id, quantity }));
};

const normalizeForReplay = (items: Array<{ product_id: number; quantity: number }>) =>
  JSON.stringify([...items]
    .reduce((counts, item) => {
      counts.set(item.product_id, (counts.get(item.product_id) ?? 0) + item.quantity);
      return counts;
    }, new Map<number, number>())
    .entries()
    .toArray?.() ?? []);

const getReplay = async (
  receipt: string,
  profile: Profile,
  clientId: number,
  paymentMethod: string,
  tenderedAmount: number | null,
  items: Array<{ product_id: number; quantity: number }>,
) => {
  const { data, error } = await admin
    .from("transactions")
    .select("id, receipt_number, user_id, staff_id, payment_method, tendered_amount, transaction_items(product_id, quantity)")
    .eq("receipt_number", receipt)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const savedItems = normalizeItems(data.transaction_items);
  const sameRequest = data.staff_id === profile.id
    && data.user_id === clientId
    && data.payment_method === paymentMethod
    && Number(data.tendered_amount ?? null) === Number(tenderedAmount)
    && savedItems !== null
    && JSON.stringify(savedItems) === JSON.stringify(items);
  if (!sameRequest) {
    throw Object.assign(new Error("This checkout reference was already used. Start a new sale."), {
      status: 409,
    });
  }
  return data;
};

const makeReceipt = (requestId?: string) => {
  if (requestId) return `REC-${requestId}`;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `REC-${date.year}${date.month}${date.day}-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
};

const publishOrderStatus = async (authUserId: string | null, payload: Record<string, unknown>) => {
  if (!authUserId) return;
  const channel = admin.channel(`order-status:${authUserId}`, { config: { private: true } });
  try {
    const status = await channel.send({
      type: "broadcast",
      event: "order_status_update",
      payload,
    });
    if (status !== "ok") console.error("Order notification was not delivered:", status);
  } catch (error) {
    console.error("Order notification failed:", error instanceof Error ? error.name : "unknown");
  } finally {
    try {
      await admin.removeChannel(channel);
    } catch (error) {
      console.error("Could not close order notification channel:", error instanceof Error ? error.name : "unknown");
    }
  }
};

const createSale = async (profile: Profile, body: Record<string, unknown>) => {
  if (profile.role !== "staff") {
    throw Object.assign(new Error("An active staff account is required to record a sale."), { status: 403 });
  }
  const clientId = body.user_id;
  const items = normalizeItems(body.items);
  const paymentMethod = body.payment_method;
  const requestId = body.request_id;
  const tenderedAmount = paymentMethod === "cash" && body.tendered_amount !== undefined
    ? body.tendered_amount
    : null;
  if (
    !Number.isSafeInteger(clientId) || Number(clientId) < 1
    || !items
    || !["cash", "pos"].includes(String(paymentMethod))
    || (requestId !== undefined && (
      typeof requestId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ))
    || (tenderedAmount !== null && (
      typeof tenderedAmount !== "number"
      || !Number.isFinite(tenderedAmount)
      || tenderedAmount < 0
      || Math.round(tenderedAmount * 100) !== tenderedAmount * 100
    ))
  ) {
    throw Object.assign(new Error("Enter a valid client, products, and payment details."), { status: 400 });
  }
  if (paymentMethod === "cash" && tenderedAmount === null) {
    throw Object.assign(new Error("Cash payment is required."), { status: 400 });
  }

  const receiptNumber = makeReceipt(requestId as string | undefined);
  const prior = await getReplay(
    receiptNumber,
    profile,
    Number(clientId),
    String(paymentMethod),
    tenderedAmount as number | null,
    items,
  );
  if (prior) {
    return {
      status: 200,
      body: {
        message: "Transaction already recorded.",
        transactionId: prior.id,
        receipt_number: receiptNumber,
      },
    };
  }

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, status, auth_user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!client || client.status !== "active") {
    throw Object.assign(new Error("An active registered client account is required."), { status: 400 });
  }

  const productIds = items.map(item => item.product_id);
  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, name, price, status")
    .in("id", productIds);
  if (productsError) throw productsError;
  const productById = new Map(products.map(product => [product.id, product]));
  let expectedTotal = 0;
  for (const item of items) {
    const product = productById.get(item.product_id);
    if (!product) {
      throw Object.assign(new Error(`Product ID ${item.product_id} not found.`), { status: 404 });
    }
    if (product.status !== "active") {
      throw Object.assign(new Error(`Product "${product.name}" is not available.`), { status: 400 });
    }
    expectedTotal += Math.round(Number(product.price) * 100) * item.quantity / 100;
  }
  expectedTotal = Math.round(expectedTotal * 100) / 100;
  if (tenderedAmount !== null && tenderedAmount < expectedTotal) {
    throw Object.assign(new Error(`Payment must be at least ${expectedTotal.toFixed(2)}.`), { status: 400 });
  }

  const { data: transactionId, error: saleError } = await admin.rpc("create_sale_atomic", {
    p_receipt_number: receiptNumber,
    p_user_id: clientId,
    p_staff_id: profile.id,
    p_payment_method: paymentMethod,
    p_tendered_amount: tenderedAmount,
    p_expected_total: expectedTotal,
    p_items: items,
    p_submission_id: null,
  });
  if (saleError) {
    if (requestId && ["23505", "PT409"].includes(saleError.code ?? "")) {
      const racedReplay = await getReplay(
        receiptNumber,
        profile,
        Number(clientId),
        String(paymentMethod),
        tenderedAmount as number | null,
        items,
      );
      if (racedReplay) {
        return {
          status: 200,
          body: {
            message: "Transaction already recorded.",
            transactionId: racedReplay.id,
            receipt_number: receiptNumber,
          },
        };
      }
    }
    const status = /^PT(400|403|404|409)$/.exec(saleError.code ?? "");
    throw Object.assign(
      new Error(status ? saleError.message : "Unable to record sale."),
      { status: status ? Number(status[1]) : 503 },
    );
  }
  if (!Number.isInteger(transactionId)) {
    throw new Error("Sale did not return a transaction ID.");
  }

  if (client.auth_user_id) {
    await publishOrderStatus(client.auth_user_id, {
      status: "completed",
      receipt_number: receiptNumber,
      total_amount: expectedTotal,
      cashier_name: profile.name || "Staff",
      completed_at: new Date().toISOString(),
      message: "Your purchase has been completed.",
    });
  }

  return {
    status: 201,
    body: { message: "Transaction created successfully.", transactionId, receipt_number: receiptNumber },
  };
};

const completeWalkInSale = async (profile: Profile, body: Record<string, unknown>) => {
  if (profile.role !== "staff") {
    throw Object.assign(new Error("An active staff account is required to complete an order."), { status: 403 });
  }
  const submissionId = body.id;
  const paymentMethod = body.payment_method;
  const tenderedAmount = body.tendered_amount;
  if (
    !Number.isSafeInteger(submissionId) || Number(submissionId) < 1
    || !["cash", "pos"].includes(String(paymentMethod))
    || typeof tenderedAmount !== "number"
    || !Number.isFinite(tenderedAmount)
    || tenderedAmount < 0
    || Math.round(tenderedAmount * 100) !== tenderedAmount * 100
  ) {
    throw Object.assign(new Error("Enter a valid order and payment amount."), { status: 400 });
  }

  const { data: submission, error: submissionError } = await admin
    .from("pending_submissions")
    .select("id, type, status, submitted_by, data")
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission || submission.type !== "walk_in_order" || submission.status !== "pending") {
    throw Object.assign(new Error("Pending walk-in request not found."), { status: 404 });
  }
  const items = normalizeItems(submission.data?.items);
  if (!items) {
    throw Object.assign(new Error("This walk-in request has no valid items."), { status: 400 });
  }

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, status, auth_user_id")
    .eq("id", submission.submitted_by)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!client || client.status !== "active") {
    throw Object.assign(new Error("An active registered client account is required."), { status: 400 });
  }

  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, name, price, status")
    .in("id", items.map(item => item.product_id));
  if (productsError) throw productsError;
  const productById = new Map(products.map(product => [product.id, product]));
  let expectedTotal = 0;
  for (const item of items) {
    const product = productById.get(item.product_id);
    if (!product || product.status !== "active") {
      throw Object.assign(new Error(`Product ID ${item.product_id} is no longer available.`), { status: 400 });
    }
    expectedTotal += Math.round(Number(product.price) * 100) * item.quantity / 100;
  }
  expectedTotal = Math.round(expectedTotal * 100) / 100;
  if (tenderedAmount < expectedTotal) {
    throw Object.assign(new Error(`Payment must be at least ${expectedTotal.toFixed(2)}.`), { status: 400 });
  }

  const receiptNumber = makeReceipt();
  const { data: transactionId, error: saleError } = await admin.rpc("create_sale_atomic", {
    p_receipt_number: receiptNumber,
    p_user_id: submission.submitted_by,
    p_staff_id: profile.id,
    p_payment_method: paymentMethod,
    p_tendered_amount: tenderedAmount,
    p_expected_total: expectedTotal,
    p_items: items,
    p_submission_id: submission.id,
  });
  if (saleError) {
    const status = /^PT(400|403|404|409)$/.exec(saleError.code ?? "");
    throw Object.assign(
      new Error(status ? saleError.message : "Unable to complete walk-in sale."),
      { status: status ? Number(status[1]) : 503 },
    );
  }
  if (!Number.isInteger(transactionId)) {
    throw new Error("Sale did not return a transaction ID.");
  }

  await publishOrderStatus(client.auth_user_id, {
    submissionId: submission.id,
    status: "approved",
    receipt_number: receiptNumber,
    total_amount: expectedTotal,
    message: "Your order has been completed! Please check your purchase history.",
  });
  return {
    status: 201,
    body: {
      message: "Walk-in sale completed successfully.",
      transactionId,
      receipt_number: receiptNumber,
      total_amount: expectedTotal,
      change: Math.round((tenderedAmount - expectedTotal) * 100) / 100,
    },
  };
};

const fetchTransactionItems = async (transactionId: number) => {
  const { data: items, error } = await admin
    .from("transaction_items")
    .select("id, transaction_id, product_id, quantity, unit_price, subtotal")
    .eq("transaction_id", transactionId);
  if (error) throw error;
  if (!items.length) return [];
  const ids = [...new Set(items.map(item => item.product_id))];
  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, name, price")
    .in("id", ids);
  if (productsError) throw productsError;
  const productById = new Map(products.map(product => [product.id, product]));
  return items.map(item => {
    const product = productById.get(item.product_id);
    return {
      ...item,
      product_name: product?.name ?? "Unknown",
      product_price: Number(product?.price ?? item.unit_price ?? 0),
    };
  });
};

const fetchMyTransactions = async (clientId: number) => {
  const { data: transactions, error } = await admin
    .from("transactions")
    .select("*")
    .eq("user_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!transactions.length) return [];

  const staffIds = [...new Set(transactions.map(transaction => transaction.staff_id))];
  const transactionIds = transactions.map(transaction => transaction.id);
  const [staffResult, itemsResult] = await Promise.all([
    admin.from("staff").select("id, name").in("id", staffIds),
    admin.from("transaction_items")
      .select("id, transaction_id, product_id, quantity, unit_price, subtotal")
      .in("transaction_id", transactionIds),
  ]);
  if (staffResult.error) throw staffResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const productIds = [...new Set(itemsResult.data.map(item => item.product_id))];
  const { data: products, error: productsError } = productIds.length
    ? await admin.from("products").select("id, name, price").in("id", productIds)
    : { data: [], error: null };
  if (productsError) throw productsError;

  const staffById = new Map(staffResult.data.map(staff => [staff.id, staff]));
  const productById = new Map(products.map(product => [product.id, product]));
  const itemsByTransaction = new Map<number, Record<string, unknown>[]>();
  for (const item of itemsResult.data) {
    const product = productById.get(item.product_id);
    const row = {
      ...item,
      product_name: product?.name ?? "Unknown",
      product_price: Number(product?.price ?? item.unit_price ?? 0),
    };
    const group = itemsByTransaction.get(item.transaction_id) ?? [];
    group.push(row);
    itemsByTransaction.set(item.transaction_id, group);
  }

  return transactions.map(transaction => {
    const items = itemsByTransaction.get(transaction.id) ?? [];
    return {
      ...transaction,
      staff_name: staffById.get(transaction.staff_id)?.name ?? null,
      items,
      product_summary: items
        .map(item => `${item.product_name || "Unknown"} x${Number(item.quantity || 0)}`)
        .join(", "),
    };
  });
};

const fetchTransactions = async (profile: Profile) => {
  if (!["admin", "staff"].includes(profile.role)) {
    throw Object.assign(new Error("Staff or admin access is required."), { status: 403 });
  }
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("transactions").select("*")
      .order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  if (!rows.length) return [];

  const clientIds = [...new Set(rows.map(row => row.user_id).filter(Number.isInteger))];
  const staffIds = [...new Set(rows.map(row => row.staff_id).filter(Number.isInteger))];
  const [clientsResult, staffResult] = await Promise.all([
    clientIds.length
      ? admin.from("clients").select("id,name").in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    staffIds.length
      ? admin.from("staff").select("id,name").in("id", staffIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clientsResult.error) throw clientsResult.error;
  if (staffResult.error) throw staffResult.error;
  const clientNames = new Map((clientsResult.data || []).map(client => [client.id, client.name]));
  const staffNames = new Map((staffResult.data || []).map(staff => [staff.id, staff.name]));
  return rows.map(row => ({
    ...row,
    user_name: clientNames.get(row.user_id) ?? null,
    staff_name: staffNames.get(row.staff_id) ?? null,
  }));
};

const fetchStaffTransactions = async (profile: Profile) => {
  if (profile.role !== "staff") {
    throw Object.assign(new Error("Staff access is required."), { status: 403 });
  }
  const { data: transactions, error } = await admin.from("transactions").select("*")
    .eq("staff_id", profile.id).order("created_at", { ascending: false });
  if (error) throw error;
  const clientIds = [...new Set(transactions.map(transaction => transaction.user_id).filter(Number.isInteger))];
  const { data: clients, error: clientsError } = clientIds.length
    ? await admin.from("clients").select("id,name").in("id", clientIds)
    : { data: [], error: null };
  if (clientsError) throw clientsError;
  const names = new Map((clients || []).map(client => [client.id, client.name]));
  return transactions.map(transaction => ({
    ...transaction,
    user_name: names.get(transaction.user_id) ?? null,
  }));
};

const fetchTransactionDetail = async (profile: Profile, id: unknown) => {
  if (!Number.isSafeInteger(id) || Number(id) < 1) {
    throw Object.assign(new Error("Transaction not found."), { status: 404 });
  }
  const { data: transaction, error } = await admin
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!transaction) throw Object.assign(new Error("Transaction not found."), { status: 404 });
  if (profile.role === "client" && transaction.user_id !== profile.id) {
    throw Object.assign(new Error("You are not allowed to view this transaction."), { status: 403 });
  }

  const items = await fetchTransactionItems(transaction.id);
  const [clientResult, staffResult] = await Promise.all([
    transaction.user_id
      ? admin.from("clients").select("name").eq("id", transaction.user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.from("staff").select("name").eq("id", transaction.staff_id).maybeSingle(),
  ]);
  if (clientResult.error) throw clientResult.error;
  if (staffResult.error) throw staffResult.error;
  return {
    ...transaction,
    user_name: clientResult.data?.name ?? null,
    staff_name: staffResult.data?.name ?? null,
    items,
  };
};

const fetchWalkInRequests = async (
  profile: Profile,
  scope: "my" | "pending" | "cancelled",
) => {
  if (scope === "my" && profile.role !== "client") {
    throw Object.assign(new Error("Client access is required."), { status: 403 });
  }
  if (scope !== "my" && profile.role !== "staff") {
    throw Object.assign(new Error("Staff access is required."), { status: 403 });
  }

  let query = admin.from("pending_submissions")
    .select("id,type,data,submitted_by,status,admin_notes,created_at,reviewed_at")
    .eq("type", "walk_in_order");
  if (scope === "my") query = query.eq("submitted_by", profile.id).in("status", ["pending", "cancelled"]);
  else query = query.eq("status", scope);
  const { data: submissions, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  if (scope === "my" || !submissions.length) return submissions;

  const clientIds = [...new Set(submissions.map(submission => submission.submitted_by))];
  const { data: clients, error: clientsError } = await admin
    .from("clients").select("id,name").in("id", clientIds);
  if (clientsError) throw clientsError;
  const names = new Map(clients.map(client => [client.id, client.name]));
  return submissions.map(submission => ({
    ...submission,
    submitted_by_name: names.get(submission.submitted_by) || "Unknown",
  }));
};

const createWalkInRequest = async (profile: Profile, body: Record<string, unknown>) => {
  const staffGuided = profile.role === "staff";
  if (!staffGuided && profile.role !== "client") {
    throw Object.assign(new Error("Only clients or staff can create walk-in requests."), { status: 403 });
  }
  const clientId = staffGuided ? body.user_id : profile.id;
  if (!Number.isSafeInteger(clientId) || Number(clientId) < 1) {
    throw Object.assign(new Error(staffGuided ? "Select an active registered client." : "Invalid order request."), { status: 400 });
  }
  const items = normalizeItems(body.items);
  if (!items) {
    throw Object.assign(new Error("Add valid products and quantities to the order."), { status: 400 });
  }
  const { data: client, error: clientError } = await admin
    .from("clients").select("id,status").eq("id", clientId).maybeSingle();
  if (clientError) throw clientError;
  if (!client || client.status !== "active") {
    throw Object.assign(new Error(staffGuided
      ? "Select an active registered client."
      : "An active registered client account is required."), { status: 400 });
  }

  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id,name,price,status,image_url,expiry_date,stock")
    .in("id", items.map(item => item.product_id));
  if (productsError) throw productsError;
  const { data: availability, error: availabilityError } = await admin.rpc("inventory_available_stock");
  if (availabilityError) throw availabilityError;
  const availableById = new Map(
    availability.map((row: { product_id: number; available_stock: number | null }) => [
      row.product_id,
      Number(row.available_stock || 0),
    ]),
  );
  const productsById = new Map(products.map(product => [product.id, product]));
  const requestItems: Record<string, unknown>[] = [];
  for (const item of items) {
    const product = productsById.get(item.product_id);
    if (!product) {
      throw Object.assign(new Error(`Product ID ${item.product_id} not found.`), { status: 404 });
    }
    if (product.status !== "active") {
      throw Object.assign(new Error(`Product "${product.name}" is not available.`), { status: 400 });
    }
    const expiryDate = typeof product.expiry_date === "string" ? product.expiry_date.slice(0, 10) : null;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (expiryDate && expiryDate < today) {
      throw Object.assign(new Error(`Product "${product.name}" has expired and cannot be sold.`), { status: 400 });
    }
    const available = availableById.get(product.id) ?? 0;
    if (available < item.quantity) {
      throw Object.assign(new Error(`Insufficient stock for "${product.name}". Available: ${available}`), { status: 400 });
    }
    requestItems.push({
      product_id: product.id,
      quantity: item.quantity,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
    });
  }

  const action = "Create order";
  const { data: audit, error: auditError } = await admin.from("audit_logs").insert({
    actor_id: String(profile.id),
    actor_name: profile.name || "User",
    actor_role: profile.role,
    action,
    entity_type: "Order",
    details: { requested: {} },
  }).select("id").single();
  if (auditError) throw auditError;

  const requestData = {
    items: requestItems,
    ...(staffGuided ? { guided_by_staff: profile.id } : {}),
  };
  const { data: submission, error: insertError } = await admin.from("pending_submissions")
    .insert({
      type: "walk_in_order",
      data: requestData,
      submitted_by: client.id,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) {
    const { error: finishError } = await admin.from("audit_logs")
      .update({ outcome: "failed", finished_at: new Date().toISOString() })
      .eq("id", audit.id).eq("outcome", "pending");
    if (finishError) console.error("Walk-in request audit finalization failed:", finishError.code || "unavailable");
    throw insertError;
  }
  const { error: finishError } = await admin.from("audit_logs").update({
    outcome: "succeeded",
    entity_id: String(submission.id),
    finished_at: new Date().toISOString(),
    details: { requested: {}, reference_type: "Submission", http_status: 201 },
  }).eq("id", audit.id).eq("outcome", "pending");
  if (finishError) console.error("Walk-in request audit finalization failed:", finishError.code || "unavailable");

  return {
    status: 201,
    body: {
      message: staffGuided
        ? "Pending order created for the client."
        : "Walk-in order request submitted. Please pay at the store counter.",
      submissionId: submission.id,
    },
  };
};

const cancelWalkInRequest = async (profile: Profile, body: Record<string, unknown>) => {
  const id = body.id;
  if (!Number.isSafeInteger(id) || Number(id) < 1) {
    throw Object.assign(new Error("Walk-in order request not found."), { status: 404 });
  }
  if (!["client", "staff", "admin"].includes(profile.role)) {
    throw Object.assign(new Error("You are not allowed to cancel this order."), { status: 403 });
  }
  const { data: submission, error: lookupError } = await admin.from("pending_submissions")
    .select("id,type,status,submitted_by")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!submission || submission.type !== "walk_in_order") {
    throw Object.assign(new Error("Walk-in order request not found."), { status: 404 });
  }
  const isClient = profile.role === "client";
  if (isClient && Number(submission.submitted_by) !== Number(profile.id)) {
    throw Object.assign(new Error("You are not allowed to cancel this order."), { status: 403 });
  }
  if (submission.status !== "pending") {
    throw Object.assign(new Error("This order can no longer be cancelled."), { status: 409 });
  }
  const cancellationMessage = isClient ? "Cancelled by client." : "Cancelled by staff.";
  let update = admin.from("pending_submissions")
    .update({
      status: "cancelled",
      reviewed_at: new Date().toISOString(),
      admin_notes: cancellationMessage,
    })
    .eq("id", id)
    .eq("type", "walk_in_order")
    .eq("status", "pending");
  if (isClient) update = update.eq("submitted_by", profile.id);
  const { data: cancelled, error: updateError } = await update.select("id").maybeSingle();
  if (updateError) throw updateError;
  if (!cancelled) {
    throw Object.assign(new Error("This order can no longer be cancelled."), { status: 409 });
  }

  const { data: audit, error: auditError } = await admin.from("audit_logs").insert({
    actor_id: String(profile.id),
    actor_name: profile.name || "User",
    actor_role: profile.role,
    action: "Cancel order",
    entity_type: "Order",
    entity_id: String(id),
    outcome: "succeeded",
    finished_at: new Date().toISOString(),
    details: { requested: {}, http_status: 200 },
  }).select("id").single();
  if (auditError) console.error("Walk-in cancellation audit failed:", auditError.code || "unavailable");

  const { data: client, error: clientError } = await admin.from("clients")
    .select("auth_user_id").eq("id", submission.submitted_by).maybeSingle();
  if (clientError) throw clientError;
  await publishOrderStatus(client?.auth_user_id ?? null, {
    submissionId: Number(id),
    status: "cancelled",
    message: isClient ? "Your order has been cancelled." : "Your order was cancelled by staff.",
  });
  return { status: 200, body: { message: "Order cancelled successfully." } };
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

  let profile: Profile | null;
  try {
    profile = await resolveProfile(request);
  } catch (error) {
    console.error("Account lookup failed:", error instanceof Error ? error.name : "unknown");
    return response(origin, 503, { message: "Account verification is temporarily unavailable." });
  }
  if (!profile) return response(origin, 401, { message: "An active signed-in account is required." });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return response(origin, 400, { message: "Invalid transaction request." });
    body = parsed;
  } catch {
    return response(origin, 400, { message: "Invalid transaction request." });
  }

  try {
    if (body.action === "create-sale") {
      const result = await createSale(profile, body);
      return response(origin, result.status, result.body);
    }
    if (body.action === "complete-walk-in-sale") {
      const result = await completeWalkInSale(profile, body);
      return response(origin, result.status, result.body);
    }
    if (body.action === "create-walk-in-request" || body.action === "create-staff-walk-in-request") {
      const result = await createWalkInRequest(profile, {
        ...body,
        user_id: body.action === "create-staff-walk-in-request" ? body.user_id : profile.id,
      });
      return response(origin, result.status, result.body);
    }
    if (body.action === "my-walk-in-requests") {
      return response(origin, 200, { data: await fetchWalkInRequests(profile, "my") });
    }
    if (body.action === "pending-walk-in-requests") {
      return response(origin, 200, { data: await fetchWalkInRequests(profile, "pending") });
    }
    if (body.action === "cancelled-walk-in-requests") {
      return response(origin, 200, { data: await fetchWalkInRequests(profile, "cancelled") });
    }
    if (body.action === "cancel-walk-in-request") {
      const result = await cancelWalkInRequest(profile, body);
      return response(origin, result.status, result.body);
    }
    if (body.action === "my-transactions") {
      if (profile.role !== "client") {
        return response(origin, 403, { message: "Client access is required." });
      }
      return response(origin, 200, { data: await fetchMyTransactions(profile.id) });
    }
    if (body.action === "transactions-list") {
      return response(origin, 200, { data: await fetchTransactions(profile) });
    }
    if (body.action === "staff-transactions") {
      return response(origin, 200, { data: await fetchStaffTransactions(profile) });
    }
    if (body.action === "transaction-detail") {
      return response(origin, 200, {
        data: await fetchTransactionDetail(profile, body.id),
      });
    }
    return response(origin, 400, { message: "Unsupported transaction action." });
  } catch (error) {
    const status = error instanceof Error && "status" in error
      ? Number(error.status)
      : 503;
    if (status >= 500) {
      console.error("Transaction request failed:", error instanceof Error ? error.name : "unknown");
    }
    return response(origin, status, {
      message: error instanceof Error && status < 500
        ? error.message
        : "Transaction service is temporarily unavailable.",
    });
  }
});
