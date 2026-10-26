import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

const tableByPrefix = { C: "clients", S: "staff", A: "admins" } as const;
type AccountRole = "client" | "staff" | "admin";
type Account = {
  id: number;
  user_id: string;
  email: string;
  password: string;
  name: string;
  role: AccountRole;
  status: string;
  auth_user_id: string | null;
  must_change_password?: boolean;
};

const response = (origin: string, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getAllowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  const configuredOrigin = Deno.env.get("APP_ORIGIN");
  const allowedOrigins = new Set([
    "https://storehub.bscs4a.com",
    "http://localhost:3000",
    ...(configuredOrigin ? [configuredOrigin] : []),
  ]);
  return origin && allowedOrigins.has(origin) ? origin : null;
};

const keyHash = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
};

const findAccount = async (identifier: string): Promise<Account | null> => {
  const accountId = /^([CSA])(\d+)$/i.exec(identifier);
  if (accountId) {
    const rolePrefix = accountId[1].toUpperCase() as keyof typeof tableByPrefix;
    const table = tableByPrefix[rolePrefix];
    const role = ({ C: "client", S: "staff", A: "admin" } as const)[rolePrefix];
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq("user_id", `${rolePrefix}${accountId[2]}`)
      .maybeSingle();
    if (error) throw error;
    return data ? { ...data, role } as Account : null;
  }

  const email = identifier.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const matches = await Promise.all(
    Object.entries(tableByPrefix).map(async ([prefix, table]) => {
      const { data, error } = await admin.from(table).select("*").eq("email", email).maybeSingle();
      if (error) throw error;
      const role = ({ C: "client", S: "staff", A: "admin" } as const)[prefix as keyof typeof tableByPrefix];
      return data ? { ...data, role } as Account : null;
    }),
  );
  const accounts = matches.filter((account): account is Account => account !== null);
  if (accounts.length > 1) throw new Error("Legacy email is not unique across account tables.");
  return accounts[0] ?? null;
};

const getProfileForAuthId = async (authUserId: string) => {
  const matches = await Promise.all(
    Object.entries(tableByPrefix).map(async ([prefix, table]) => {
      const { data, error } = await admin.from(table).select("id").eq("auth_user_id", authUserId).maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, role: ({ C: "client", S: "staff", A: "admin" } as const)[prefix as keyof typeof tableByPrefix] } : null;
    }),
  );
  const linked = matches.filter(Boolean);
  if (linked.length > 1) throw new Error("Supabase identity is linked to multiple application accounts.");
  return linked[0] ?? null;
};

const linkAccount = async (account: Account, authUserId: string) => {
  const existingLink = await getProfileForAuthId(authUserId);
  if (existingLink && (existingLink.id !== account.id || existingLink.role !== account.role)) {
    throw new Error("Supabase identity is already linked to another application account.");
  }
  if (account.auth_user_id && account.auth_user_id !== authUserId) {
    throw new Error("Application account is already linked to another Supabase identity.");
  }
  if (account.auth_user_id === authUserId) return;

  const table = account.role === "client" ? "clients" : account.role === "staff" ? "staff" : "admins";
  const { data, error } = await admin
    .from(table)
    .update({ auth_user_id: authUserId })
    .eq("id", account.id)
    .is("auth_user_id", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (data) return;

  const { data: current, error: reloadError } = await admin
    .from(table)
    .select("auth_user_id")
    .eq("id", account.id)
    .maybeSingle();
  if (reloadError) throw reloadError;
  if (current?.auth_user_id !== authUserId) {
    throw new Error("Application account linkage changed during sign-in.");
  }
};

const signIn = async (email: string, password: string) => {
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) return null;
  return data;
};

const registerClient = async (body: Record<string, unknown>, origin: string) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (
    name.length < 2 || name.length > 100
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || password.length < 6 || password.length > 1024
  ) {
    return response(origin, 400, { message: "Enter a valid name, email, and password." });
  }

  const existing = await findAccount(email);
  if (existing) return response(origin, 400, { message: "Email already registered." });

  const { data: authResult, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authResult.user) {
    if (authError?.code === "email_exists" || authError?.code === "user_already_exists") {
      return response(origin, 400, { message: "Email already registered." });
    }
    console.error("Could not create pending client Auth identity:", authError?.code ?? "unknown");
    return response(origin, 503, { message: "Registration is temporarily unavailable. Please try again." });
  }

  let clientId: number | null = null;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const clientFields = {
      first_name: 100,
      middle_name: 100,
      last_name: 100,
      birthdate: 20,
      gender: 20,
      address: 500,
      phone: 50,
    } as const;
    const profile: Record<string, unknown> = {
      name,
      email,
      password: passwordHash,
      status: "pending",
      must_change_password: false,
      auth_user_id: authResult.user.id,
    };

    const registerStaff = async (body: Record<string, unknown>, origin: string) => {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (
        name.length < 2 || name.length > 100
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        || password.length < 6 || password.length > 1024
      ) {
        return response(origin, 400, { message: "Enter a valid name, email, and password." });
      }

      const staffFields = {
        first_name: 100,
        middle_name: 100,
        last_name: 100,
        birthdate: 20,
        gender: 20,
        address: 500,
        contract_details: 2000,
        phone: 50,
      } as const;
      for (const [field, maxLength] of Object.entries(staffFields)) {
        const value = body[field];
        if (value !== undefined && (typeof value !== "string" || value.length > maxLength)) {
          return response(origin, 400, { message: `Invalid ${field} field.` });
        }
      }
      if (await findAccount(email)) {
        return response(origin, 400, { message: "Email already registered." });
      }

      const { data: authResult, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError || !authResult.user) {
        if (authError?.code === "email_exists" || authError?.code === "user_already_exists") {
          return response(origin, 400, { message: "Email already registered." });
        }
        console.error("Could not create pending staff Auth identity:", authError?.code ?? "unknown");
        return response(origin, 503, { message: "Registration is temporarily unavailable. Please try again." });
      }

      let staffId: number | null = null;
      try {
        const profile: Record<string, unknown> = {
          name,
          email,
          password: await bcrypt.hash(password, 10),
          status: "pending",
          must_change_password: false,
          auth_user_id: authResult.user.id,
        };
        for (const field of Object.keys(staffFields)) {
          if (body[field] !== undefined) profile[field] = body[field];
        }
        const { data: staff, error } = await admin.from("staff")
          .insert(profile).select("id").single();
        if (error) {
          if (error.code === "23505" || error.code === "P0001") {
            throw Object.assign(new Error("Email already registered."), { code: "email_exists" });
          }
          throw error;
        }
        staffId = staff.id;
        const userId = `S${String(staff.id - 2_000_000).padStart(6, "0")}`;
        const { error: idError } = await admin.from("staff").update({ user_id: userId }).eq("id", staff.id);
        if (idError) throw idError;
        return response(origin, 201, {
          message: "Registration successful! Your account is pending admin approval.",
          userId: staff.id,
          user_id: userId,
        });
      } catch (error) {
        if (staffId !== null) {
          const { error: profileDeleteError } = await admin.from("staff").delete().eq("id", staffId);
          if (profileDeleteError) console.error("Could not clean up incomplete staff profile:", profileDeleteError.code ?? "unknown");
        }
        const { error: deleteError } = await admin.auth.admin.deleteUser(authResult.user.id);
        if (deleteError) console.error("Could not clean up incomplete staff Auth identity:", deleteError.code ?? "unknown");
        if (error instanceof Error && "code" in error && error.code === "email_exists") {
          return response(origin, 400, { message: "Email already registered." });
        }
        console.error("Could not create pending staff profile:", error instanceof Error ? error.name : "unknown error");
        return response(origin, 503, { message: "Registration is temporarily unavailable. Please try again." });
      }
    };
    for (const [field, maxLength] of Object.entries(clientFields)) {
      const value = body[field];
      if (value === undefined) continue;
      if (typeof value !== "string" || value.length > maxLength) {
        throw new Error(`Invalid ${field} field.`);
      }
      profile[field] = value;
    }

    const { data: account, error } = await admin
      .from("clients")
      .insert(profile)
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505" || error.code === "P0001") {
        throw Object.assign(new Error("Email already registered."), { code: "email_exists" });
      }
      throw error;
    }
    clientId = account.id;
    const userId = `C${String(account.id - 1_000_000).padStart(6, "0")}`;
    const { error: idError } = await admin.from("clients").update({ user_id: userId }).eq("id", account.id);
    if (idError) throw idError;
    return response(origin, 201, {
      message: "Registration successful! Please wait for Admin approval.",
      userId: account.id,
      user_id: userId,
    });
  } catch (error) {
    if (clientId !== null) {
      const { error: profileDeleteError } = await admin.from("clients").delete().eq("id", clientId);
      if (profileDeleteError) {
        console.error("Could not clean up incomplete client profile:", profileDeleteError.code ?? "unknown");
      }
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(authResult.user.id);
    if (deleteError) console.error("Could not clean up incomplete client Auth identity:", deleteError.code ?? "unknown");
    if (error instanceof Error && "code" in error && error.code === "email_exists") {
      return response(origin, 400, { message: "Email already registered." });
    }
    if (error instanceof Error && error.message.startsWith("Invalid ")) {
      return response(origin, 400, { message: error.message });
    }
    console.error("Could not create pending client profile:", error instanceof Error ? error.name : "unknown error");
    return response(origin, 503, { message: "Registration is temporarily unavailable. Please try again." });
  }
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rateLimitSecret = Deno.env.get("AUTH_MIGRATION_RATE_SECRET");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async request => {
  const origin = getAllowedOrigin(request);
  if (request.method === "OPTIONS") {
    if (!origin) return new Response("Origin not allowed.", { status: 403 });
    return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin } });
  }
  if (!origin) return response("null", 403, { message: "Origin not allowed." });
  if (request.method !== "POST") return response(origin, 405, { message: "Method not allowed." });
  const path = new URL(request.url).pathname.replace(/\/+$/, "").split("/").pop();
  if (path !== "legacy-auth-migrate") {
    return response(origin, 404, { message: "Route not found." });
  }
  if (!rateLimitSecret || rateLimitSecret.length < 32) {
    console.error("AUTH_MIGRATION_RATE_SECRET is missing or too short.");
    return response(origin, 503, { message: "Authentication is temporarily unavailable." });
  }

  let body: { action?: unknown; identifier?: unknown; email?: unknown; password?: unknown; [key: string]: unknown };
  try {
    const parsedBody: unknown = await request.json();
    if (!isRecord(parsedBody)) {
      return response(origin, 400, { message: "Invalid authentication request." });
    }
    body = parsedBody;
  } catch {
    return response(origin, 400, { message: "Invalid authentication request." });
  }

  const action = body.action === "register-client" || body.action === "register-staff"
    ? body.action
    : "login";
  if (body.action !== undefined && body.action !== "login" && body.action !== "register-client" && body.action !== "register-staff") {
    return response(origin, 400, { message: "Unsupported authentication action." });
  }
  const registration = action === "register-client" || action === "register-staff";
  const identifier = typeof (registration ? body.email : body.identifier) === "string"
    ? String(registration ? body.email : body.identifier).trim()
    : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || identifier.length > 254 || !password || password.length > 1024) {
    return response(origin, 400, { message: "Enter a valid account identifier and password." });
  }

  try {
    const ip = request.headers.get("cf-connecting-ip")
      ?? request.headers.get("x-real-ip")
      ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";
    const limits = [await keyHash(`identifier:${identifier.toLowerCase()}`, rateLimitSecret)];
    if (ip !== "unknown") limits.push(await keyHash(`ip:${ip}`, rateLimitSecret));
    for (const key of limits) {
      const { data, error } = await admin.rpc("consume_auth_migration_login", {
        p_key_hash: key,
        p_limit: 20,
        p_window_seconds: 900,
      });
      if (error) throw error;
      if (data !== true) return response(origin, 429, { message: "Too many login attempts. Please try again in 15 minutes." });
    }

    if (action === "register-client") return await registerClient(body, origin);
    if (action === "register-staff") return await registerStaff(body, origin);

    const account = await findAccount(identifier);
    if (!account) return response(origin, 401, { message: "Invalid identifier or password." });
    if (account.status !== "active") {
      const message = account.status === "pending"
        ? "Account is pending approval. Please wait for admin to activate your account."
        : "Account has been rejected or deactivated.";
      return response(origin, 403, { message });
    }

    let signedIn: Awaited<ReturnType<typeof signIn>> = null;
    if (account.auth_user_id) {
      signedIn = await signIn(account.email, password);
      if (!signedIn || signedIn.user.id !== account.auth_user_id) {
        return response(origin, 401, { message: "Invalid identifier or password." });
      }
    } else {
      if (!await bcrypt.compare(password, account.password)) {
        return response(origin, 401, { message: "Invalid identifier or password." });
      }
      signedIn = await signIn(account.email, password);
      if (!signedIn) {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: account.email,
          password,
          email_confirm: true,
        });
        if (createError || !created.user) {
          console.error("Could not create Supabase Auth identity:", createError?.code ?? "unknown");
          return response(origin, 503, { message: "Account migration is temporarily unavailable. Please try again." });
        }
        await linkAccount(account, created.user.id);
        signedIn = await signIn(account.email, password);
      } else {
        await linkAccount(account, signedIn.user.id);
      }
      if (!signedIn) return response(origin, 503, { message: "Sign-in could not be completed. Please try again." });
    }

    const { password: passwordHash, ...profile } = account;
    return response(origin, 200, {
      user: { ...profile, must_change_password: Boolean(account.must_change_password) },
      session: {
        access_token: signedIn.session.access_token,
        refresh_token: signedIn.session.refresh_token,
      },
    });
  } catch (error) {
    console.error("Legacy account authentication failed:", error instanceof Error ? error.name : "unknown error");
    const message = action === "register-client"
      ? "Registration is temporarily unavailable. Please try again."
      : "Authentication is temporarily unavailable. Please try again.";
    return response(origin, 503, { message });
  }
});
