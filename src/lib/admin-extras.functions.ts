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

// ===================== FINANCE =====================
export type TransactionRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  type: string;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  description: string | null;
  reference_id: string | null;
  created_at: string;
};

export type FinanceSummary = {
  totalIn: number;
  totalOut: number;
  netFlow: number;
  txCount: number;
};

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        type: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .partial()
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: TransactionRow[]; summary: FinanceSummary }> => {
    await ensureAdmin(context);
    const { supabase } = context;
    let q = supabase
      .from("transactions")
      .select("id, user_id, type, amount, balance_before, balance_after, description, reference_id, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data.type) q = q.eq("type", data.type as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (rows ?? []) as any[];

    const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
    const names = new Map<string, string | null>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null }>) {
        names.set(p.id, p.display_name);
      }
    }

    let totalIn = 0;
    let totalOut = 0;
    for (const r of list) {
      const amt = Number(r.amount ?? 0);
      if (amt >= 0) totalIn += amt;
      else totalOut += Math.abs(amt);
    }

    return {
      rows: list.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        user_name: names.get(r.user_id) ?? null,
        type: r.type,
        amount: Number(r.amount ?? 0),
        balance_before: r.balance_before == null ? null : Number(r.balance_before),
        balance_after: r.balance_after == null ? null : Number(r.balance_after),
        description: r.description ?? null,
        reference_id: r.reference_id ?? null,
        created_at: r.created_at,
      })),
      summary: { totalIn, totalOut, netFlow: totalIn - totalOut, txCount: list.length },
    };
  });

// ===================== COMMISSIONS =====================
export type CommissionRow = {
  id: string;
  affiliate_id: string;
  affiliate_name: string | null;
  manager_id: string | null;
  manager_name: string | null;
  base_amount: number;
  percentage: number;
  amount: number;
  status: string;
  available_at: string | null;
  created_at: string;
};

export const listCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z.enum(["pending","available","approved","canceled","disputed"]).optional(),
      })
      .partial()
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<CommissionRow[]> => {
    await ensureAdmin(context);
    const { supabase } = context;
    let q = supabase
      .from("commissions")
      .select("id, affiliate_id, manager_id, base_amount, percentage, amount, status, available_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (rows ?? []) as any[];

    const ids = Array.from(
      new Set(list.flatMap((r) => [r.affiliate_id, r.manager_id]).filter(Boolean)),
    ) as string[];
    const names = new Map<string, string | null>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null }>) {
        names.set(p.id, p.display_name);
      }
    }

    return list.map((r) => ({
      id: r.id,
      affiliate_id: r.affiliate_id,
      affiliate_name: names.get(r.affiliate_id) ?? null,
      manager_id: r.manager_id ?? null,
      manager_name: r.manager_id ? names.get(r.manager_id) ?? null : null,
      base_amount: Number(r.base_amount ?? 0),
      percentage: Number(r.percentage ?? 0),
      amount: Number(r.amount ?? 0),
      status: r.status,
      available_at: r.available_at ?? null,
      created_at: r.created_at,
    }));
  });

export const updateCommissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        commissionId: z.string().uuid(),
        status: z.enum(["pending","available","approved","canceled","disputed"]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("commissions")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.commissionId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: `commission.status.${data.status}`,
      entity_type: "commission",
      entity_id: data.commissionId,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

// ===================== RISK ALERTS =====================
export type RiskAlertRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  user_id: string | null;
  user_name: string | null;
  withdrawal_id: string | null;
  created_at: string;
};

export const listRiskAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z.enum(["open","reviewing","resolved","ignored"]).optional(),
      })
      .partial()
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<RiskAlertRow[]> => {
    await ensureAdmin(context);
    const { supabase } = context;
    let q = supabase
      .from("risk_alerts")
      .select("id, type, title, description, severity, status, user_id, withdrawal_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (rows ?? []) as any[];

    const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
    const names = new Map<string, string | null>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null }>) {
        names.set(p.id, p.display_name);
      }
    }
    return list.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description ?? null,
      severity: r.severity,
      status: r.status,
      user_id: r.user_id ?? null,
      user_name: r.user_id ? names.get(r.user_id) ?? null : null,
      withdrawal_id: r.withdrawal_id ?? null,
      created_at: r.created_at,
    }));
  });

export const updateRiskAlertStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        alertId: z.string().uuid(),
        status: z.enum(["open","reviewing","resolved","ignored"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("risk_alerts")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: `risk_alert.status.${data.status}`,
      entity_type: "risk_alert",
      entity_id: data.alertId,
    });
    return { ok: true };
  });

// ===================== AUDIT LOGS =====================
export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  ip: string | null;
  created_at: string;
};

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ search: z.string().trim().max(120).optional() })
      .partial()
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<AuditLogRow[]> => {
    await ensureAdmin(context);
    const { supabase } = context;
    let q = supabase
      .from("audit_logs")
      .select("id, actor_id, actor_email, action, entity_type, entity_id, reason, ip, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.search) q = q.ilike("action", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (rows ?? []) as any[];

    const ids = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean))) as string[];
    const names = new Map<string, string | null>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null }>) {
        names.set(p.id, p.display_name);
      }
    }
    return list.map((r) => ({
      id: r.id,
      actor_id: r.actor_id ?? null,
      actor_name: r.actor_id ? names.get(r.actor_id) ?? null : null,
      actor_email: r.actor_email ?? null,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id ?? null,
      reason: r.reason ?? null,
      ip: r.ip ?? null,
      created_at: r.created_at,
    }));
  });

// ===================== SETTINGS =====================
export type PlatformSettingRow = {
  id: string;
  key: string;
  value: any;
  type: string;
  description: string | null;
  is_critical: boolean;
  updated_at: string;
};

export const listPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformSettingRow[]> => {
    await ensureAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("platform_settings")
      .select("id, key, value, type, description, is_critical, updated_at")
      .order("key");
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows ?? []) as any[];
  });

export const upsertPlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        key: z.string().min(1).max(120),
        value: z.unknown(),
        type: z.string().max(40).optional(),
        description: z.string().max(500).optional(),
        is_critical: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_settings").upsert(
      {
        key: data.key,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: data.value as any,
        type: data.type ?? "string",
        description: data.description ?? null,
        is_critical: data.is_critical ?? false,
        updated_by_id: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "platform_setting.upsert",
      entity_type: "platform_setting",
      entity_id: data.key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new_value: { value: data.value } as any,
    });
    return { ok: true };
  });

// ===================== REPORTS =====================
export type ReportExportRow = {
  id: string;
  type: string;
  status: string;
  file_url: string | null;
  filters: any;
  created_at: string;
};

export const listReportExports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReportExportRow[]> => {
    await ensureAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("report_exports")
      .select("id, type, status, file_url, filters, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows ?? []) as any[];
  });

export const requestReportExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        type: z.enum(["withdrawals", "commissions", "transactions", "affiliates", "managers"]),
        filters: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("report_exports")
      .insert({
        type: data.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filters: (data.filters ?? {}) as any,
        status: "pending",
        requested_by_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: `report.request.${data.type}`,
      entity_type: "report_export",
      entity_id: row.id,
    });
    return { ok: true, id: row.id };
  });
