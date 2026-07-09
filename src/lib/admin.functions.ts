import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAdmin(context: any): Promise<void> {
  const { data: isAdmin, error } = await context.supabase.rpc("is_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Sem permissão.");
}

export type AdminDashboardSummary = {
  totalUsers: number;
  activeManagers: number;
  activeAffiliates: number;
  pendingWithdrawals: number;
  paidWithdrawalsMonth: number;
  openRiskAlerts: number;
  blockedAccounts: number;
  totalCommissionsPending: number;
};

export const getAdminDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDashboardSummary> => {
    await ensureAdmin(context);
    const { supabase } = context;

    // Total users
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Active managers = user_roles(gerente) & profiles.status='active'
    const { data: managerRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "gerente");
    const managerIds = Array.from(new Set((managerRoles ?? []).map((r) => r.user_id)));
    let activeManagers = 0;
    if (managerIds.length) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .in("id", managerIds as any)
        .eq("status", "active");
      activeManagers = count ?? 0;
    }

    // Active affiliates = user_roles(afiliado) & active
    const { data: affRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "afiliado");
    const affIds = Array.from(new Set((affRoles ?? []).map((r) => r.user_id)));
    let activeAffiliates = 0;
    if (affIds.length) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .in("id", affIds as any)
        .eq("status", "active");
      activeAffiliates = count ?? 0;
    }

    // Pending withdrawals
    const { count: pendingWithdrawals } = await supabase
      .from("affiliate_withdrawals")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_review"]);

    // Paid this month (sum amount)
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: paid } = await supabase
      .from("affiliate_withdrawals")
      .select("amount")
      .eq("status", "paid")
      .gte("paid_at", monthStart.toISOString());
    const paidWithdrawalsMonth = (paid ?? []).reduce(
      (s: number, r: { amount: number }) => s + Number(r.amount ?? 0),
      0,
    );

    // Open risk alerts
    const { count: openRiskAlerts } = await supabase
      .from("risk_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");

    // Blocked accounts
    const { count: blockedAccounts } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "blocked");

    // Commissions pending sum
    const { data: pend } = await supabase
      .from("commissions")
      .select("amount")
      .eq("status", "pending");
    const totalCommissionsPending = (pend ?? []).reduce(
      (s: number, r: { amount: number }) => s + Number(r.amount ?? 0),
      0,
    );

    return {
      totalUsers: totalUsers ?? 0,
      activeManagers,
      activeAffiliates,
      pendingWithdrawals: pendingWithdrawals ?? 0,
      paidWithdrawalsMonth,
      openRiskAlerts: openRiskAlerts ?? 0,
      blockedAccounts: blockedAccounts ?? 0,
      totalCommissionsPending,
    };
  });

export type AdminAffiliateRow = {
  id: string;
  display_name: string | null;
  status: "active" | "inactive" | "blocked";
  manager_id: string | null;
  manager_name: string | null;
  affiliate_balance: number;
  total_received: number;
  created_at: string;
};

export const listAllAffiliates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        status: z.enum(["active", "inactive", "blocked"]).optional(),
      })
      .partial()
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminAffiliateRow[]> => {
    await ensureAdmin(context);
    const { supabase } = context;

    const { data: affRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "afiliado");
    const affIds = Array.from(new Set((affRoles ?? []).map((r) => r.user_id)));
    if (!affIds.length) return [];

    let q = supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, display_name, status, manager_id, affiliate_balance, total_received, created_at" as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .in("id", affIds as any)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) q = q.ilike("display_name", `%${data.search}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (rows ?? []) as any[];

    const managerIds = Array.from(
      new Set(list.map((r) => r.manager_id).filter(Boolean)),
    ) as string[];
    const managerNames = new Map<string, string | null>();
    if (managerIds.length) {
      const { data: mgs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", managerIds);
      for (const m of (mgs ?? []) as Array<{ id: string; display_name: string | null }>) {
        managerNames.set(m.id, m.display_name);
      }
    }

    return list.map((r) => ({
      id: r.id,
      display_name: r.display_name ?? null,
      status: (r.status ?? "active") as AdminAffiliateRow["status"],
      manager_id: r.manager_id ?? null,
      manager_name: r.manager_id ? managerNames.get(r.manager_id) ?? null : null,
      affiliate_balance: Number(r.affiliate_balance ?? 0),
      total_received: Number(r.total_received ?? 0),
      created_at: r.created_at,
    }));
  });

const affiliateActionInput = z.object({
  affiliateId: z.string().uuid(),
  status: z.enum(["active", "inactive", "blocked"]).optional(),
  managerId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(500).optional(),
});

export const updateAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => affiliateActionInput.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: readErr } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, status, manager_id" as any)
      .eq("id", data.affiliateId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Afiliado não encontrado.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.managerId !== undefined) patch.manager_id = data.managerId;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.affiliateId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: data.status
        ? `affiliate.status.${data.status}`
        : "affiliate.manager.reassign",
      entity_type: "profile",
      entity_id: data.affiliateId,
      old_value: current as never,
      new_value: patch as never,
      reason: data.reason ?? null,
    });

    return { ok: true };
  });

// ============================================================
// Rede de Indicações (multinível)
// ============================================================

export type ReferralNetworkRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: "active" | "inactive" | "blocked";
  created_at: string;
  level: 1 | 2 | 3;
};

export type ReferralNetworkResult = {
  user: {
    id: string;
    display_name: string | null;
    status: string;
    affiliate_code: string | null;
    role: "admin" | "gerente" | "afiliado" | "jogador";
  };
  directReferrals: ReferralNetworkRow[];
  totalReferrals: number;
  pendingCommissions: number;
  paidCommissions: number;
  totalWithdrawals: number;
};

export const getReferralNetwork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<ReferralNetworkResult> => {
    await ensureAdmin(context);
    const { supabase } = context;

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, display_name, status, affiliate_code" as any)
      .eq("id", data.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof) throw new Error("Usuário não encontrado.");

    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const rset = new Set((rolesRows ?? []).map((r) => r.role));
    const role: ReferralNetworkResult["user"]["role"] = rset.has("admin")
      ? "admin"
      : rset.has("gerente")
        ? "gerente"
        : rset.has("afiliado")
          ? "afiliado"
          : "jogador";

    // Todos os referrals onde este usuário é referrer (níveis 1/2/3)
    const { data: refs } = await supabase
      .from("referrals")
      .select("referred_id, level, created_at")
      .eq("referrer_id", data.userId);
    const referralRows = (refs ?? []) as Array<{
      referred_id: string;
      level: number;
      created_at: string;
    }>;

    // Perfis dos indicados diretos (level 1)
    const level1Ids = referralRows.filter((r) => r.level === 1).map((r) => r.referred_id);
    let directReferrals: ReferralNetworkRow[] = [];
    if (level1Ids.length) {
      const { data: peers } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("id, display_name, email, status, created_at" as any)
        .in("id", level1Ids)
        .order("created_at", { ascending: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      directReferrals = ((peers ?? []) as any[]).map((p) => ({
        id: p.id,
        display_name: p.display_name ?? null,
        email: p.email ?? null,
        status: (p.status ?? "active") as ReferralNetworkRow["status"],
        created_at: p.created_at,
        level: 1 as const,
      }));
    }

    // Comissões agregadas (como afiliado OU manager)
    const { data: comms } = await supabase
      .from("commissions")
      .select("amount, status, affiliate_id, manager_id")
      .or(`affiliate_id.eq.${data.userId},manager_id.eq.${data.userId}`);
    let pendingCommissions = 0;
    let paidCommissions = 0;
    for (const c of (comms ?? []) as Array<{ amount: number; status: string }>) {
      const amt = Number(c.amount ?? 0);
      if (c.status === "paid") paidCommissions += amt;
      else if (c.status === "pending" || c.status === "available") pendingCommissions += amt;
    }

    // Saques pagos
    const { data: wds } = await supabase
      .from("affiliate_withdrawals")
      .select("amount, status")
      .eq("user_id", data.userId)
      .eq("status", "paid");
    const totalWithdrawals = ((wds ?? []) as Array<{ amount: number }>).reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prof as any;
    return {
      user: {
        id: p.id,
        display_name: p.display_name ?? null,
        status: p.status ?? "active",
        affiliate_code: p.affiliate_code ?? null,
        role,
      },
      directReferrals,
      totalReferrals: referralRows.length,
      pendingCommissions,
      paidCommissions,
      totalWithdrawals,
    };
  });

export type ReferralOverviewNode = {
  id: string;
  display_name: string | null;
  status: "active" | "inactive" | "blocked";
  affiliate_code: string | null;
  role: "gerente" | "afiliado";
  directReferralsCount: number;
};

export const listReferralOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralOverviewNode[]> => {
    await ensureAdmin(context);
    const { supabase } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["gerente", "afiliado"]);
    const roleMap = new Map<string, "gerente" | "afiliado">();
    for (const r of (roles ?? []) as Array<{ user_id: string; role: string }>) {
      const prev = roleMap.get(r.user_id);
      // gerente prevalece
      if (prev === "gerente") continue;
      roleMap.set(r.user_id, r.role as "gerente" | "afiliado");
    }
    const ids = Array.from(roleMap.keys());
    if (!ids.length) return [];

    const { data: profs } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, display_name, status, affiliate_code" as any)
      .in("id", ids);

    // Contagem de indicados diretos por referrer
    const { data: refs } = await supabase
      .from("referrals")
      .select("referrer_id")
      .eq("level", 1)
      .in("referrer_id", ids);
    const counts = new Map<string, number>();
    for (const r of (refs ?? []) as Array<{ referrer_id: string }>) {
      counts.set(r.referrer_id, (counts.get(r.referrer_id) ?? 0) + 1);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((profs ?? []) as any[])
      .map((p) => ({
        id: p.id,
        display_name: p.display_name ?? null,
        status: (p.status ?? "active") as ReferralOverviewNode["status"],
        affiliate_code: p.affiliate_code ?? null,
        role: roleMap.get(p.id) ?? "afiliado",
        directReferralsCount: counts.get(p.id) ?? 0,
      }))
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === "gerente" ? -1 : 1;
        return b.directReferralsCount - a.directReferralsCount;
      });
  });
