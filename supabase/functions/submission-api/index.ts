import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import bcrypt from "npm:bcryptjs@2.4.3";

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
  auth_user_id: string | null;
  must_change_password: boolean;
};

type Submission = {
  id: number;
  type: string;
  data: Record<string, unknown>;
  submitted_by: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const response = (
  origin: string,
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin, ...headers },
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

const resolveProfile = async (request: Request): Promise<Profile | null> => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!admin || !token) return null;
  const { data: authResult, error: authError } = await admin.auth.getUser(token);
  if (authError || !authResult.user?.email) return null;

  const matches = await Promise.all(
    ([
      ["clients", "client"],
      ["staff", "staff"],
      ["admins", "admin"],
    ] as const).map(async ([table, role]) => {
      const columns = role === "admin"
        ? "id,name,email,status,auth_user_id"
        : "id,name,email,status,auth_user_id,must_change_password";
      const { data, error } = await admin.from(table).select(columns)
        .eq("auth_user_id", authResult.user.id).maybeSingle();
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
    || typeof profile.email !== "string"
    || profile.email.toLowerCase() !== authResult.user.email.toLowerCase()
  ) return null;
  return profile as Profile;
};

const getSubmissions = async (profile: Profile, scope: "pending" | "mine") => {
  if (!admin) throw new Error("Submission service is not configured.");
  if (scope === "pending" && profile.role !== "admin") {
    throw Object.assign(new Error("Admin access is required."), { status: 403 });
  }
  if (scope === "mine" && profile.role !== "staff") {
    throw Object.assign(new Error("Staff access is required."), { status: 403 });
  }

  const submissions: Submission[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = admin.from("pending_submissions")
      .select("id,type,data,submitted_by,status,admin_notes,created_at,reviewed_at");
    if (scope === "pending") query = query.eq("status", "pending");
    else query = query.eq("submitted_by", profile.id);
    const { data, error } = await query.order("created_at", { ascending: false })
      .range(offset, offset + 999);
    if (error) throw error;
    submissions.push(...data);
    if (data.length < 1000) break;
  }
  if (!submissions.length) return [];

  const submitterIds = [...new Set(submissions.map(item => item.submitted_by))];
  const [staffResult, clientResult] = await Promise.all([
    admin.from("staff").select("id,name").in("id", submitterIds),
    admin.from("clients").select("id,name").in("id", submitterIds),
  ]);
  if (staffResult.error) throw staffResult.error;
  if (clientResult.error) throw clientResult.error;
  const names = new Map([
    ...(staffResult.data || []).map(user => [user.id, user.name] as const),
    ...(clientResult.data || []).map(user => [user.id, user.name] as const),
  ]);
  return submissions.map(item => ({
    ...item,
    submitted_by_name: names.get(item.submitted_by) || "Unknown",
  }));
};

const generateTemporaryPassword = () =>
  `Aa1!${crypto.randomUUID().replaceAll("-", "")}`;

const loadResetTarget = async (id: unknown) => {
  if (!admin || !Number.isSafeInteger(id) || Number(id) < 1) return null;
  const [clientResult, staffResult, adminResult] = await Promise.all([
    admin.from("clients")
      .select("id,user_id,email,password,must_change_password,auth_user_id")
      .eq("id", id).maybeSingle(),
    admin.from("staff")
      .select("id,user_id,email,password,must_change_password,auth_user_id")
      .eq("id", id).maybeSingle(),
    admin.from("admins").select("id").eq("id", id).maybeSingle(),
  ]);
  if (clientResult.error) throw clientResult.error;
  if (staffResult.error) throw staffResult.error;
  if (adminResult.error) throw adminResult.error;
  if (adminResult.data || Boolean(clientResult.data) === Boolean(staffResult.data)) return null;
  const row = clientResult.data || staffResult.data;
  return {
    ...row,
    role: clientResult.data ? "client" : "staff",
    table: clientResult.data ? "clients" : "staff",
  };
};

const beginAudit = async (profile: Profile, action: string, submission: Submission) => {
  if (!admin) throw new Error("Submission service is not configured.");
  const { data, error } = await admin.from("audit_logs").insert({
    actor_id: String(profile.id),
    actor_name: profile.name || "User",
    actor_role: profile.role,
    action,
    entity_type: "Approval",
    entity_id: String(submission.id),
    details: { requested: {} },
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
};

const finishAudit = async (
  id: string,
  outcome: "succeeded" | "failed",
  details: Record<string, unknown>,
) => {
  if (!admin) throw new Error("Submission service is not configured.");
  const { error } = await admin.from("audit_logs").update({
    outcome,
    finished_at: new Date().toISOString(),
    details,
  }).eq("id", id).eq("outcome", "pending");
  if (error) throw error;
};

const reviewSubmission = async (profile: Profile, body: Record<string, unknown>) => {
  if (!admin) throw new Error("Submission service is not configured.");
  if (profile.role !== "admin") {
    throw Object.assign(new Error("Admin access is required."), { status: 403 });
  }
  const id = Number(body.id);
  const status = body.status;
  const notes = body.admin_notes;
  if (
    !Number.isSafeInteger(id) || id < 1
    || !["approved", "rejected"].includes(String(status))
    || (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 2000))
  ) {
    throw Object.assign(new Error("Invalid submission review."), { status: 400 });
  }
  const { data: submission, error: submissionError } = await admin
    .from("pending_submissions")
    .select("id,type,data,submitted_by,status,admin_notes,created_at,reviewed_at")
    .eq("id", id)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission) throw Object.assign(new Error("Submission not found."), { status: 404 });
  if (submission.status !== "pending") {
    throw Object.assign(new Error("This submission has already been reviewed."), { status: 409 });
  }

  let resetTarget: Awaited<ReturnType<typeof loadResetTarget>> = null;
  let temporaryPassword: string | null = null;
  let passwordHash: string | null = null;
  if (status === "approved" && submission.type === "password_reset") {
    resetTarget = await loadResetTarget(submission.data?.target_user_id);
    if (!resetTarget) {
      throw Object.assign(new Error("Invalid password reset target."), { status: 400 });
    }
    temporaryPassword = generateTemporaryPassword();
    passwordHash = await bcrypt.hash(temporaryPassword, 10);
  }

  const action = status === "rejected" ? "Reject submission" : "Approve submission";
  let auditId: string;
  try {
    auditId = await beginAudit(profile, action, submission as Submission);
  } catch (error) {
    console.error("Submission audit start failed:", error instanceof Error ? error.name : "unknown");
    throw Object.assign(new Error("Activity logging is unavailable. No changes were made."), {
      status: 503,
      expose: true,
    });
  }

  const { data: review, error: reviewError } = await admin.rpc("review_submission_atomic", {
    p_id: id,
    p_status: status,
    p_notes: notes ?? null,
    p_actor_id: profile.id,
    p_password_hash: passwordHash,
  });
  if (reviewError) {
    const match = /^PT(400|403|404|409)$/.exec(reviewError.code || "");
    const code = match ? Number(match[1]) : 503;
    try {
      await finishAudit(auditId, "failed", { requested: {}, http_status: code });
    } catch (error) {
      console.error("Submission audit finalization failed:", error instanceof Error ? error.name : "unknown");
    }
    throw Object.assign(
      new Error(match ? reviewError.message : "Submission review unavailable. Check its status before retrying."),
      { status: code },
    );
  }
  if (!review?.before || !review?.after) {
    throw new Error("Submission review did not return its saved state.");
  }

  if (resetTarget && temporaryPassword && resetTarget.auth_user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(
      resetTarget.auth_user_id,
      { password: temporaryPassword },
    );
    if (authError) {
      const restore: Record<string, unknown> = { password: resetTarget.password };
      if (resetTarget.table !== "admins") {
        restore.must_change_password = Boolean(resetTarget.must_change_password);
      }
      const { error: restoreError } = await admin.from(resetTarget.table)
        .update(restore).eq("id", resetTarget.id);
      try {
        await finishAudit(auditId, "failed", {
          requested: {},
          snapshot_version: 1,
          result: "Submission review completed, but password synchronization failed.",
          http_status: 503,
        });
      } catch (error) {
        console.error("Submission audit finalization failed:", error instanceof Error ? error.name : "unknown");
      }
      if (restoreError) {
        console.error("Password reset rollback failed:", restoreError.code || "unavailable");
        throw Object.assign(new Error(
          "Submission review completed, but password synchronization failed and the prior password could not be restored. Reset the account through Account Management immediately.",
        ), { status: 503, expose: true });
      }
      console.error("Supabase Auth password reset failed; previous legacy password was restored:", authError.status || "unavailable");
      throw Object.assign(new Error(
        "Submission review completed, but Supabase Auth password reset failed. The prior account password was restored; issue a new reset through Account Management.",
      ), { status: 503, expose: true });
    }
  }

  const changes = [
    {
      field: "status",
      label: "Submission status",
      before: review.before.status,
      after: review.after.status,
    },
    {
      field: "admin_notes",
      label: "Review notes",
      before: review.before.admin_notes ?? null,
      after: review.after.admin_notes ?? null,
    },
  ];
  const details = {
    requested: {},
    snapshot_version: 1,
    result: status === "rejected"
      ? "Submission rejected. The requested changes were not applied."
      : "Submission approved successfully.",
    submission: { id, type: submission.type },
    requested_by: {
      id: review.before.submitted_by,
      name: review.before.submitted_by_name,
    },
    changes,
    http_status: 200,
  };
  try {
    await finishAudit(auditId, "succeeded", details);
  } catch (error) {
    console.error("Submission audit completion failed:", error instanceof Error ? error.name : "unknown");
  }

  const credentials = resetTarget && temporaryPassword
    ? { user_id: resetTarget.user_id, email: resetTarget.email, password: temporaryPassword }
    : null;
  return {
    message: `Submission ${status} successfully.`,
    ...(credentials ? { credentials } : {}),
  };
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
  if (!admin) return response(origin, 503, { message: "Submission service is not configured." });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return response(origin, 400, { message: "Invalid submission request." });
    body = parsed;
  } catch {
    return response(origin, 400, { message: "Invalid submission request." });
  }

  let profile: Profile | null;
  try {
    profile = await resolveProfile(request);
  } catch (error) {
    console.error("Submission account lookup failed:", error instanceof Error ? error.name : "unknown");
    return response(origin, 503, { message: "Account verification is temporarily unavailable." });
  }
  if (!profile) return response(origin, 401, { message: "An active signed-in account is required." });

  try {
    if (body.action === "pending") {
      return response(origin, 200, { data: await getSubmissions(profile, "pending") });
    }
    if (body.action === "mine") {
      return response(origin, 200, { data: await getSubmissions(profile, "mine") });
    }
    if (body.action === "review") {
      const result = await reviewSubmission(profile, body);
      return response(origin, 200, result, result.credentials ? { "Cache-Control": "no-store" } : {});
    }
    return response(origin, 400, { message: "Unsupported submission request." });
  } catch (error) {
    const status = error instanceof Error && "status" in error
      ? Number(error.status)
      : 503;
    if (status >= 500) {
      console.error("Submission request failed:", error instanceof Error ? error.name : "unknown");
    }
    return response(origin, status, {
      message: error instanceof Error && (
        status < 500 || ("expose" in error && error.expose === true)
      )
        ? error.message
        : "Submission service is temporarily unavailable.",
    }, body.action === "review" ? { "Cache-Control": "no-store" } : {});
  }
});
