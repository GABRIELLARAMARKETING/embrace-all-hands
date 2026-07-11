import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* =============================================================
 * Impersonação Administrativa Segura
 * =============================================================
 * NÃO fazemos swap de sessão Supabase — o super admin permanece com
 * o próprio token. A "impersonação" é uma sessão server-side com TTL
 * curto, auditada, que:
 *   1) marca o super admin em modo suporte;
 *   2) libera visualização read-only do alvo;
 *   3) bloqueia ações sensíveis via assertNotImpersonating().
 * ============================================================= */

async function ensureSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "super_admin" as never,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin required");
}

function getClientMeta() {
  try {
    const req = getRequest();
    const h = req?.headers;
    if (!h) return { ip: null, ua: null };
    const ip =
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    const ua = h.get("user-agent") ?? null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

export type ImpersonationTarget = {
  id: string;
  display_name: string | null;
  role: string;
  is_demo: boolean;
  status: string | null;
  manager_id: string | null;
  affiliate_code: string | null;
  created_at: string;
};

export const searchImpersonationTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        query: z.string().trim().max(120).optional(),
        role: z.enum(["all", "user", "gerente", "admin"]).optional().default("all"),
        limit: z.number().int().min(1).max(50).optional().default(20),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<ImpersonationTarget[]> => {
    await ensureSuperAdmin(context);
    const { supabase } = context;

    let q = supabase
      .from("profiles")
      .select("id, display_name, is_demo, status, manager_id, affiliate_code, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.query) {
      const like = `%${data.query}%`;
      // busca por id parcial ou display_name
      q = q.or(
        `display_name.ilike.${like},affiliate_code.ilike.${like},id.eq.${
          /^[0-9a-f-]{36}$/i.test(data.query) ? data.query : "00000000-0000-0000-0000-000000000000"
        }`,
      );
    }

    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p: any) => p.id);
    const rolesMap = new Map<string, string>();
    if (ids.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
        // prioriza role mais forte
        const rank: Record<string, number> = {
          super_admin: 0,
          admin: 1,
          gerente: 2,
          user: 3,
        };
        const prev = rolesMap.get(r.user_id);
        if (!prev || (rank[r.role] ?? 9) < (rank[prev] ?? 9)) {
          rolesMap.set(r.user_id, r.role);
        }
      }
    }

    let out: ImpersonationTarget[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name,
      role: rolesMap.get(p.id) ?? "user",
      is_demo: !!p.is_demo,
      status: p.status ?? null,
      manager_id: p.manager_id,
      affiliate_code: p.affiliate_code,
      created_at: p.created_at,
    }));

    // proíbe listar super admins como alvo
    out = out.filter((x) => x.role !== "super_admin");
    if (data.role !== "all") out = out.filter((x) => x.role === data.role);
    return out;
  });

export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        reason: z.string().trim().min(5).max(500),
        confirmationText: z.string().trim().min(1).max(50),
        mode: z.enum(["read_only", "support_limited"]).optional().default("read_only"),
        ttlMinutes: z.number().int().min(1).max(60).optional().default(15),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const meta = getClientMeta();
    const { data: res, error } = await context.supabase.rpc("impersonation_start", {
      _target_user_id: data.targetUserId,
      _reason: data.reason,
      _confirmation: data.confirmationText,
      _mode: data.mode,
      _ip: meta.ip,
      _user_agent: meta.ua,
      _ttl_minutes: data.ttlMinutes,
    } as never);
    if (error) throw new Error(error.message);
    const r = res as { ok: boolean; reason?: string; impersonation_session_id?: string; expires_at?: string; mode?: string; target_role?: string };
    if (!r?.ok) throw new Error(`IMPERSONATION_FAILED:${r?.reason ?? "unknown"}`);
    return r;
  });

export const stopImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("impersonation_stop", {
      _session_id: data.sessionId,
      _reason: data.reason ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return res as { ok: boolean; reason?: string };
  });

export type ActiveImpersonation = {
  id: string;
  target_user_id: string;
  target_display_name: string | null;
  target_role: string | null;
  reason: string;
  mode: string;
  started_at: string;
  expires_at: string;
};

export const getActiveImpersonation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActiveImpersonation | null> => {
    await ensureSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("impersonation_sessions")
      .select("id, target_user_id, target_role, reason, mode, started_at, expires_at, status")
      .eq("admin_user_id", context.userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const { data: prof } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", data.target_user_id)
      .maybeSingle();

    return {
      id: data.id,
      target_user_id: data.target_user_id,
      target_display_name: prof?.display_name ?? null,
      target_role: data.target_role,
      reason: data.reason,
      mode: data.mode,
      started_at: data.started_at,
      expires_at: data.expires_at,
    };
  });

export type ImpersonationHistoryRow = {
  id: string;
  target_user_id: string;
  target_display_name: string | null;
  target_role: string | null;
  reason: string;
  mode: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
};

export const listImpersonationHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).optional().default(30),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<ImpersonationHistoryRow[]> => {
    await ensureSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("impersonation_sessions")
      .select(
        "id, target_user_id, target_role, reason, mode, status, started_at, ended_at, expires_at",
      )
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const targetIds = Array.from(new Set((rows ?? []).map((r: any) => r.target_user_id)));
    const names = new Map<string, string | null>();
    if (targetIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", targetIds);
      for (const p of (profs ?? []) as any[]) names.set(p.id, p.display_name);
    }
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      target_user_id: r.target_user_id,
      target_display_name: names.get(r.target_user_id) ?? null,
      target_role: r.target_role,
      reason: r.reason,
      mode: r.mode,
      status: r.status,
      started_at: r.started_at,
      ended_at: r.ended_at,
      expires_at: r.expires_at,
    }));
  });

/* =============================================================
 * Guarda para ações sensíveis. Server functions financeiras/
 * administrativas devem chamar assertNotImpersonating(context)
 * antes de executar a ação. Se houver sessão ativa, gera log
 * IMPERSONATION_SENSITIVE_ACTION_DENIED e falha.
 * ============================================================= */
export async function assertNotImpersonating(
  context: { supabase: any; userId: string },
  action: string,
): Promise<void> {
  const { data, error } = await context.supabase
    .from("impersonation_sessions")
    .select("id, target_user_id")
    .eq("admin_user_id", context.userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) return; // não bloqueia por erro de leitura
  if (!data) return;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("impersonation_audit_logs").insert({
      impersonation_session_id: data.id,
      admin_user_id: context.userId,
      target_user_id: data.target_user_id,
      action: "IMPERSONATION_SENSITIVE_ACTION_DENIED",
      blocked: true,
      block_reason: action,
      metadata: { attempted_action: action },
    });
  } catch (e) {
    console.error("[impersonation] failed to log denied action", e);
  }
  throw new Error(
    `IMPERSONATION_BLOCKED: ação "${action}" indisponível durante impersonação ativa. Encerre a sessão de suporte primeiro.`,
  );
}
