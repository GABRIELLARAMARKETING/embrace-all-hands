import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditLog } from "./audit.functions";


/* eslint-disable @typescript-eslint/no-explicit-any */
async function ensureManagerOrAdmin(ctx: any) {
  const { data: roles, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (error) throw new Error(error.message);
  const set = new Set((roles ?? []).map((r: any) => r.role));
  if (!set.has("gerente") && !set.has("admin") && !set.has("super_admin")) {
    throw new Error("Sem permissão.");
  }
}

async function audit(ctx: any, action: string, entity: string, entityId?: string, details?: any) {
  await ctx.supabase.from("audit_logs").insert({
    actor_id: ctx.userId,
    action,
    entity,
    entity_id: entityId ?? null,
    new_values: details ?? null,
  });
}

function maskPix(v?: string | null): string {
  if (!v) return "";
  const s = String(v);
  if (s.length <= 4) return "***";
  return `***${s.slice(-4)}`;
}

/* ============ DASHBOARD ============ */
export const getManagerDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;

    const { data: refs } = await supabase
      .from("referrals")
      .select("referred_id, level")
      .eq("manager_id", userId);
    const rows = refs ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.referred_id)));
    const levels = { level1: 0, level2: 0, level3: 0 };
    rows.forEach((r: any) => {
      if (r.level === 1) levels.level1++;
      else if (r.level === 2) levels.level2++;
      else if (r.level === 3) levels.level3++;
    });

    let pendingDeposits = 0, received24h = 0, totalReceived = 0;
    let pendingWithdrawals = 0, withdrawn24h = 0;
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    if (userIds.length) {
      const { count: pd } = await supabase
        .from("deposits").select("id", { count: "exact", head: true })
        .in("user_id", userIds as any).eq("status", "pending").neq("provider", "admin_manual");
      pendingDeposits = pd ?? 0;

      const { data: paidRecent } = await supabase
        .from("deposits").select("amount")
        .in("user_id", userIds as any).in("status", ["approved", "paid"])
        .neq("provider", "admin_manual")
        .gte("confirmed_at", since24h);
      received24h = (paidRecent ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

      const { data: allPaid } = await supabase
        .from("deposits").select("amount")
        .in("user_id", userIds as any).in("status", ["approved", "paid"])
        .neq("provider", "admin_manual");
      totalReceived = (allPaid ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);


      const { count: pw } = await supabase
        .from("affiliate_withdrawals").select("id", { count: "exact", head: true })
        .in("user_id", userIds as any).eq("status", "pending");
      pendingWithdrawals = pw ?? 0;

      const { data: paidW } = await supabase
        .from("affiliate_withdrawals").select("amount")
        .in("user_id", userIds as any).eq("status", "paid")
        .gte("paid_at", since24h);
      withdrawn24h = (paidW ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    }

    return {
      pendingDeposits,
      pendingWithdrawals,
      totalReferrals: userIds.length,
      received24h,
      withdrawn24h,
      totalReceived,
      levels,
    };
  });

/* ============ REFERRAL LINK ============ */
export const getManagerReferralLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles").select("affiliate_code, is_influencer").eq("id", userId).maybeSingle();

    const { data: setting } = await supabase
      .from("platform_settings").select("value").eq("key", "app_public_url").maybeSingle();
    const base = (setting?.value as any) ?? "https://helixfast.lovable.app";
    const code = (prof?.affiliate_code as string | undefined) ?? "";
    const link = code ? `${base}/?ref=${code}` : "";

    const { count: totalReferred } = await supabase
      .from("referrals").select("id", { count: "exact", head: true })
      .eq("referrer_id", userId).eq("level", 1);

    let withDeposit = 0;
    const { data: level1 } = await supabase
      .from("referrals").select("referred_id").eq("referrer_id", userId).eq("level", 1);
    const ids = (level1 ?? []).map((r: any) => r.referred_id);
    if (ids.length) {
      const { data: dep } = await supabase
        .from("deposits").select("user_id")
        .in("user_id", ids as any).in("status", ["approved", "paid"])
        .neq("provider", "admin_manual");
      withDeposit = new Set((dep ?? []).map((d: any) => d.user_id)).size;

    }

    return {
      affiliateCode: code,
      affiliateLink: link,
      totalReferred: totalReferred ?? 0,
      withDeposit,
      isInfluencer: !!prof?.is_influencer,
    };
  });

export const setInfluencerMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles").update({ is_influencer: data.enabled }).eq("id", userId);
    if (error) throw new Error(error.message);
    await audit(context, data.enabled ? "influencer_enabled" : "influencer_disabled", "profiles", userId);
    return { ok: true };
  });

/* ============ REFERRALS BY LEVEL ============ */
export const listManagerReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ level: z.number().int().min(1).max(3).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;

    let q = supabase.from("referrals").select("referred_id, level, created_at")
      .eq("manager_id", userId);
    if (data.level) q = q.eq("level", data.level);
    const { data: refs } = await q;
    const rows = refs ?? [];
    if (!rows.length) return { level1: [], level2: [], level3: [], summary: emptySummary() };

    const ids = Array.from(new Set(rows.map((r: any) => r.referred_id)));
    const { data: profs } = await supabase
      .from("profiles").select("id, display_name, status, created_at").in("id", ids as any);
    const profById = new Map((profs ?? []).map((p: any) => [p.id, p]));

    const { data: deps } = await supabase
      .from("deposits").select("user_id, amount, status, confirmed_at")
      .in("user_id", ids as any).neq("provider", "admin_manual");

    const depsByUser = new Map<string, any[]>();
    (deps ?? []).forEach((d: any) => {
      const arr = depsByUser.get(d.user_id) ?? [];
      arr.push(d); depsByUser.set(d.user_id, arr);
    });

    const { data: coms } = await supabase
      .from("commissions").select("source_user_id, level, amount, status")
      .eq("manager_id", userId);
    const comsByUserLevel = new Map<string, number>();
    let totalCommission = 0;
    const perLevel: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    (coms ?? []).forEach((c: any) => {
      const amt = Number(c.amount || 0);
      totalCommission += amt;
      perLevel[c.level ?? 0] = (perLevel[c.level ?? 0] ?? 0) + amt;
      const key = `${c.source_user_id}|${c.level ?? 0}`;
      comsByUserLevel.set(key, (comsByUserLevel.get(key) ?? 0) + amt);
    });

    const buckets: Record<1 | 2 | 3, any[]> = { 1: [], 2: [], 3: [] };
    rows.forEach((r: any) => {
      const p: any = profById.get(r.referred_id) ?? {};
      const userDeps = depsByUser.get(r.referred_id) ?? [];
      const totalDeposited = userDeps
        .filter((d) => ["approved", "paid"].includes(d.status))
        .reduce((s, d) => s + Number(d.amount || 0), 0);
      const firstDep = userDeps
        .filter((d) => d.confirmed_at)
        .sort((a, b) => a.confirmed_at.localeCompare(b.confirmed_at))[0];
      buckets[r.level as 1 | 2 | 3].push({
        id: r.referred_id,
        name: p.display_name ?? "—",
        status: p.status ?? "active",
        level: r.level,
        totalDeposited,
        totalCommissionGenerated: comsByUserLevel.get(`${r.referred_id}|${r.level}`) ?? 0,
        firstDepositAt: firstDep?.confirmed_at ?? null,
        createdAt: r.created_at,
      });
    });

    return {
      level1: buckets[1], level2: buckets[2], level3: buckets[3],
      summary: {
        totalCommissionReceived: totalCommission,
        level1Commission: perLevel[1] ?? 0,
        level2Commission: perLevel[2] ?? 0,
        level3Commission: perLevel[3] ?? 0,
        managerRemainder: perLevel[0] ?? 0,
      },
    };
  });

function emptySummary() {
  return {
    totalCommissionReceived: 0,
    level1Commission: 0,
    level2Commission: 0,
    level3Commission: 0,
    managerRemainder: 0,
  };
}

/* ============ MY COMMISSION / WITHDRAWALS ============ */
export const getMyCommissionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;
    const { data: coms } = await supabase
      .from("commissions").select("amount, status").eq("affiliate_id", userId);
    let available = 0, pending = 0;
    (coms ?? []).forEach((c: any) => {
      const a = Number(c.amount || 0);
      if (c.status === "available") available += a;
      else if (c.status === "pending" || c.status === "approved") pending += a;
    });
    const { data: paid } = await supabase
      .from("affiliate_withdrawals").select("amount").eq("user_id", userId).eq("status", "paid");
    const totalWithdrawn = (paid ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    // reservado: valor em saques pendentes/aprovados
    const { data: reserved } = await supabase
      .from("affiliate_withdrawals").select("amount").eq("user_id", userId)
      .in("status", ["pending", "approved"]);
    const reservedAmt = (reserved ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    return {
      availableBalance: Math.max(0, available - reservedAmt),
      pendingBalance: pending,
      totalWithdrawn,
    };
  });

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("affiliate_withdrawals")
      .select("id, amount, pix_key, status, created_at, paid_at, rejection_reason")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      amount: Number(r.amount || 0),
      pixKey: maskPix(r.pix_key),
      status: r.status,
      createdAt: r.created_at,
      paidAt: r.paid_at,
      rejectionReason: r.rejection_reason,
    }));
  });

export const requestMyWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().positive(),
      pixKey: z.string().trim().min(3).max(120),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;

    // Recalcular saldo no server (nunca confiar no cliente)
    const { data: coms } = await supabase
      .from("commissions").select("amount, status").eq("affiliate_id", userId);
    let available = 0;
    (coms ?? []).forEach((c: any) => {
      if (c.status === "available") available += Number(c.amount || 0);
    });
    const { data: reserved } = await supabase
      .from("affiliate_withdrawals").select("amount").eq("user_id", userId)
      .in("status", ["pending", "approved"]);
    const reservedAmt = (reserved ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const balance = Math.max(0, available - reservedAmt);
    if (data.amount > balance) throw new Error("Valor acima do saldo disponível.");

    const { data: ins, error } = await supabase
      .from("affiliate_withdrawals")
      .insert({
        user_id: userId,
        amount: Math.round(data.amount * 100) / 100,
        pix_key: data.pixKey,
        status: "pending",
      })
      .select("id").maybeSingle();
    if (error) throw new Error(error.message);
    await audit(context, "withdrawal_requested", "affiliate_withdrawals", ins?.id, { amount: data.amount });
    return { ok: true, id: ins?.id };
  });

/* ============ COMMISSION SETTINGS ============ */
export const getCommissionSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;
    let { data } = await supabase
      .from("manager_profiles")
      .select("total_budget_percent, level1_percent, level2_percent, level3_percent")
      .eq("user_id", userId).maybeSingle();
    if (!data) {
      const ins = await supabase.from("manager_profiles").insert({ user_id: userId }).select("*").maybeSingle();
      data = ins.data as any;
    }
    const budget = Number(data?.total_budget_percent ?? 70);
    const l1 = Number(data?.level1_percent ?? 50);
    const l2 = Number(data?.level2_percent ?? 5);
    const l3 = Number(data?.level3_percent ?? 1);
    const used = l1 + l2 + l3;
    return {
      totalBudgetPercent: budget,
      level1Percent: l1, level2Percent: l2, level3Percent: l3,
      usedPercent: used,
      remainingPercent: Math.max(0, budget - used),
      defaults: { level1Percent: 50, level2Percent: 5, level3Percent: 1 },
    };
  });

export const updateCommissionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      level1Percent: z.number().min(0).max(100),
      level2Percent: z.number().min(0).max(100),
      level3Percent: z.number().min(0).max(100),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;
    const { data: mp } = await supabase
      .from("manager_profiles").select("total_budget_percent")
      .eq("user_id", userId).maybeSingle();
    const budget = Number(mp?.total_budget_percent ?? 70);
    const sum = data.level1Percent + data.level2Percent + data.level3Percent;
    if (sum > budget) throw new Error(`Soma (${sum}%) ultrapassa o orçamento (${budget}%).`);
    const { error } = await supabase
      .from("manager_profiles")
      .update({
        level1_percent: data.level1Percent,
        level2_percent: data.level2Percent,
        level3_percent: data.level3Percent,
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await audit(context, "commission_settings_updated", "manager_profiles", userId, data);
    await auditLog(supabase, {
      eventType: "COMMISSION_SETTINGS_UPDATED",
      module: "commissions",
      severity: "warning",
      title: "Percentuais de comissão atualizados",
      userId,
      entityType: "manager_profiles",
      entityId: userId,
      metadata: { ...data, total_budget: budget, sum },
    });
    return { ok: true };
  });

export const resetCommissionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("manager_profiles")
      .update({ level1_percent: 50, level2_percent: 5, level3_percent: 1 })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await audit(context, "commission_settings_reset", "manager_profiles", userId);
    await auditLog(supabase, {
      eventType: "COMMISSION_SETTINGS_RESET",
      module: "commissions",
      severity: "info",
      title: "Percentuais de comissão restaurados ao padrão",
      userId,
      entityType: "manager_profiles",
      entityId: userId,
    });
    return { ok: true };
  });

/* ============ DEMO ACCOUNTS ============
 * Contas demo agora são usuários reais em auth.users com profiles.is_demo=true.
 * Saldo creditado pelo gerente vai para profiles.demo_balance (NÃO sacável).
 * A tabela `demo_accounts` fica como espelho auxiliar (compat/painel).
 */
export const listDemoAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, phone, affiliate_code, demo_balance, created_at")
      .eq("manager_id", userId)
      .eq("is_demo", true)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((a: any) => ({
      id: a.id,
      name: a.display_name,
      phone: a.phone ?? "",
      affiliateCode: a.affiliate_code,
      balance: Number(a.demo_balance || 0),
      createdAt: a.created_at,
      withdrawable: false as const,
    }));
  });

export const createDemoAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      namePattern: z.string().trim().min(1).max(30),
      passwordPattern: z.string().trim().max(30).optional(),
      quantity: z.number().int().min(1).max(100),
      initialBalance: z.number().min(0).max(1000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: batch, error: bErr } = await supabase
      .from("demo_account_batches")
      .insert({
        manager_id: userId,
        name_pattern: data.namePattern,
        password_pattern: data.passwordPattern ?? null,
        quantity: data.quantity,
        initial_balance: data.initialBalance,
      })
      .select("id").maybeSingle();
    if (bErr) throw new Error(bErr.message);

    const pwPat = data.passwordPattern?.trim() || data.namePattern;
    const nowMs = Date.now();
    const created: Array<{
      id: string; name: string; phone: string; email: string;
      password: string; affiliateCode: string; balance: number;
    }> = [];

    for (let i = 1; i <= data.quantity; i++) {
      const name = `${data.namePattern} ${i}`;
      const password = `${pwPat}@${i}`;
      const email = `demo-${nowMs}-${i}-${userId.slice(0, 8)}@helix.demo`.toLowerCase();
      const phone = `55${String(nowMs).slice(-9)}${String(i).padStart(3, "0")}`.slice(0, 13);

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name, is_demo: true },
      });
      if (authErr || !authUser?.user) throw new Error(authErr?.message ?? "Falha ao criar demo");
      const newId = authUser.user.id;

      const { data: code, error: codeErr } = await supabaseAdmin.rpc("generate_affiliate_code" as any);
      if (codeErr) throw new Error(`Falha ao gerar código: ${codeErr.message}`);
      const affiliateCode = (code as string) ?? `DM${nowMs.toString(36).slice(-4).toUpperCase()}${i}`;
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({
          display_name: name,
          phone,
          is_demo: true,
          manager_id: userId,
          affiliate_code: affiliateCode,
          demo_balance: 0,
          balance: 0,
        } as any)
        .eq("id", newId);
      if (upErr) throw new Error(upErr.message);

      if (data.initialBalance > 0) {
        const { data: creditRes, error: cErr } = await supabase.rpc(
          "manager_credit_demo_balance" as any,
          {
            _target_user_id: newId,
            _amount: data.initialBalance,
            _reason: "Saldo inicial ao criar conta demo",
          },
        );
        if (cErr) throw new Error(cErr.message);
        if ((creditRes as any)?.ok !== true) {
          throw new Error(`Falha ao creditar saldo demo: ${(creditRes as any)?.reason}`);
        }
      }

      await supabaseAdmin.from("demo_accounts").insert({
        batch_id: batch?.id,
        manager_id: userId,
        display_name: name,
        phone,
        affiliate_code: affiliateCode,
        balance: data.initialBalance,
      });

      created.push({
        id: newId, name, phone, email, password,
        affiliateCode, balance: data.initialBalance,
      });
    }

    await audit(context, "demo_accounts_created", "demo_account_batches", batch?.id, {
      quantity: data.quantity,
      initial_balance: data.initialBalance,
      withdrawable: false,
    });

    return { created: created.length, accounts: created };
  });


/* ============ NETWORK WITHDRAWALS (read-only for manager) ============ */
export const listNetworkWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z
          .enum(["pending", "in_review", "approved", "paid", "rejected", "cancelled", "failed"])
          .optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .partial()
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }) => {
    await ensureManagerOrAdmin(context);
    const { supabase, userId } = context;

    const limit = data.limit ?? 20;
    const offset = data.offset ?? 0;

    // Usuários da rede deste gerente
    const { data: netProfiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("manager_id", userId);
    if (profErr) throw new Error(profErr.message);

    const idToName: Record<string, string | null> = {};
    const ids: string[] = [];
    (netProfiles ?? []).forEach((p: any) => {
      idToName[p.id] = p.display_name;
      ids.push(p.id);
    });
    if (ids.length === 0) return { rows: [], total: 0, limit, offset };

    const search = (data.search ?? "").toLowerCase().trim();

    // Se houver busca, restringe os IDs pelo nome (a busca por ID cai no filtro final)
    let filteredIds = ids;
    if (search) {
      filteredIds = ids.filter(
        (id) =>
          (idToName[id] ?? "").toLowerCase().includes(search) ||
          id.toLowerCase().includes(search),
      );
      if (filteredIds.length === 0) return { rows: [], total: 0, limit, offset };
    }

    let countQ = supabase
      .from("affiliate_withdrawals")
      .select("id", { count: "exact", head: true })
      .in("user_id", filteredIds);
    if (data.status) countQ = countQ.eq("status", data.status);
    const { count } = await countQ;

    let q = supabase
      .from("affiliate_withdrawals")
      .select("id, user_id, amount, status, pix_key, created_at, paid_at, rejection_reason")
      .in("user_id", filteredIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (data.status) q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return {
      rows: (rows ?? []).map((r: any) => ({
        id: r.id as string,
        userId: r.user_id as string,
        userDisplayName: idToName[r.user_id] ?? null,
        amount: Number(r.amount || 0),
        status: r.status as string,
        pixKey: maskPix(r.pix_key),
        createdAt: r.created_at as string,
        paidAt: r.paid_at as string | null,
        rejectionReason: r.rejection_reason as string | null,
      })),
      total: count ?? 0,
      limit,
      offset,
    };
  });
