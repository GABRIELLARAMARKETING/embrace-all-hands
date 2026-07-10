import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AuditSeverity = "info" | "success" | "warning" | "error" | "critical";

export type AuditEventRow = {
  id: string;
  event_type: string;
  module: string;
  severity: AuditSeverity;
  status: string | null;
  title: string;
  message: string | null;
  technical_message: string | null;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  correlation_id: string | null;
  metadata: Record<string, any>;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

export type AuditSummary = {
  total: number;
  errors: number;
  critical: number;
  warnings: number;
  byModule: Record<string, number>;
  bySeverity: Record<string, number>;
  systemStatus: "ok" | "degraded" | "down";
};

/** Server-side helper: chamado dentro de qualquer server fn para gravar auditoria. */
export async function auditLog(
  supabase: any,
  input: {
    eventType: string;
    module: string;
    severity: AuditSeverity;
    title: string;
    message?: string;
    metadata?: Record<string, unknown>;
    entityType?: string;
    entityId?: string;
    correlationId?: string;
    userId?: string;
    status?: string;
    technicalMessage?: string;
  },
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("log_audit_event", {
      _event_type: input.eventType,
      _module: input.module,
      _severity: input.severity,
      _title: input.title,
      _message: input.message ?? null,
      _metadata: input.metadata ?? {},
      _entity_type: input.entityType ?? null,
      _entity_id: input.entityId ?? null,
      _correlation_id: input.correlationId ?? null,
      _user_id: input.userId ?? null,
      _status: input.status ?? null,
      _technical_message: input.technicalMessage ?? null,
    });
    if (error) {
      console.error("[audit] log_audit_event failed:", error.message);
      return null;
    }
    return data as string;
  } catch (err) {
    console.error("[audit] unexpected:", err);
    return null;
  }
}

/** Endpoint público autenticado: qualquer usuário logado pode reportar um evento
 *  de auditoria (usado pelo frontend para capturar erros críticos do client). */
export const reportClientAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      eventType: string;
      module: string;
      severity: AuditSeverity;
      title: string;
      message?: string;
      metadata?: Record<string, unknown>;
      correlationId?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const id = await auditLog(context.supabase, {
      ...data,
      userId: context.userId,
      metadata: { ...(data.metadata ?? {}), source: "client" },
    });
    return { ok: true, id };
  });

/** Lista eventos com filtros — admin only. */
export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      severity?: AuditSeverity | "all";
      module?: string | "all";
      search?: string;
      onlyErrors?: boolean;
      limit?: number;
    } = {}) => input,
  )
  .handler(async ({ data, context }): Promise<{ events: AuditEventRow[]; summary: AuditSummary }> => {
    const { data: adm } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!adm) throw new Error("Sem permissão");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));

    if (data.severity && data.severity !== "all") q = q.eq("severity", data.severity);
    if (data.module && data.module !== "all") q = q.eq("module", data.module);
    if (data.onlyErrors) q = q.in("severity", ["warning", "error", "critical"]);
    if (data.search && data.search.trim()) {
      const s = data.search.trim().replace(/[%_]/g, "");
      q = q.or(`title.ilike.%${s}%,message.ilike.%${s}%,event_type.ilike.%${s}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Summary das últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("audit_events")
      .select("severity,module")
      .gte("created_at", since);

    const summary: AuditSummary = {
      total: recent?.length ?? 0,
      errors: 0,
      critical: 0,
      warnings: 0,
      byModule: {},
      bySeverity: {},
      systemStatus: "ok",
    };
    for (const r of recent ?? []) {
      const sev = (r as any).severity as string;
      const mod = (r as any).module as string;
      summary.bySeverity[sev] = (summary.bySeverity[sev] ?? 0) + 1;
      summary.byModule[mod] = (summary.byModule[mod] ?? 0) + 1;
      if (sev === "error") summary.errors++;
      if (sev === "critical") summary.critical++;
      if (sev === "warning") summary.warnings++;
    }
    summary.systemStatus =
      summary.critical > 0 ? "down" : summary.errors > 5 ? "degraded" : "ok";

    return { events: (rows ?? []) as AuditEventRow[], summary };
  });

/** Marca evento como resolvido. */
export const resolveAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: adm } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!adm) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("audit_events")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: context.userId,
        resolution_note: data.note ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
