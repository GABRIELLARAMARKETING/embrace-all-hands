import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditLog } from "./audit.functions";
import { assertNotImpersonating } from "./impersonation.functions";



const withdrawInput = z.object({
  amount: z.number().int().positive(),
  pixKey: z.string().trim().min(3).max(120).optional(),
});

export const requestAffiliateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => withdrawInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertNotImpersonating(context, "withdrawal.request");
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("affiliate_balance, total_received, is_demo")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Perfil não encontrado.");
    if ((profile as any).is_demo) {
      throw new Error("DEMO_BALANCE_NOT_WITHDRAWABLE: Contas demo não podem sacar.");
    }

    const balance = profile.affiliate_balance ?? 0;
    if (data.amount > balance) {
      throw new Error("Saldo de afiliado insuficiente.");
    }

    const { data: withdrawal, error: insertError } = await supabase
      .from("affiliate_withdrawals")
      .insert({
        user_id: userId,
        amount: data.amount,
        pix_key: data.pixKey ?? null,
      })
      .select("id, amount, status, created_at")
      .single();
    if (insertError) throw new Error(insertError.message);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: notifyError } = await supabaseAdmin
        .from("admin_notifications")
        .insert({
          type: "WITHDRAWAL_REQUESTED",
          severity: "warning",
          title: `Novo saque solicitado: R$ ${data.amount}`,
          message: `Usuário ${userId} solicitou saque de R$ ${data.amount}.`,
          payload: {
            withdrawal_id: withdrawal.id,
            user_id: userId,
            amount: data.amount,
            pix_key: data.pixKey ?? null,
          },
        });
      if (notifyError) {
        console.error("[withdrawals] failed to insert admin_notification", notifyError);
      }
    } catch (e) {
      console.error("[withdrawals] admin_notification insert threw", e);
    }

    const newBalance = balance - data.amount;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ affiliate_balance: newBalance })
      .eq("id", userId);
    if (updateError) throw new Error(updateError.message);

    await auditLog(supabase, {
      eventType: "WITHDRAWAL_REQUESTED",
      module: "withdrawals",
      severity: "info",
      title: "Saque de afiliado solicitado",
      userId,
      entityType: "affiliate_withdrawal",
      entityId: withdrawal.id,
      metadata: { amount: data.amount, balance_after: newBalance },
    });

    return {
      withdrawal,
      affiliateBalance: newBalance,
      totalReceived: profile.total_received ?? 0,
    };
  });


export type WithdrawalHistoryItem = {
  id: string;
  amount: number;
  status: string;
  pix_key: string | null;
  created_at: string;
};

export const listAffiliateWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WithdrawalHistoryItem[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("affiliate_withdrawals")
      .select("id, amount, status, pix_key, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ============================================================
 * ADMIN — precisa de papel admin/super_admin
 * ============================================================ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAdmin(context: any): Promise<void> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = new Set((data ?? []).map((r: { role: string }) => r.role));
  if (!roles.has("admin") && !roles.has("super_admin")) {
    throw new Error("Sem permissão.");
  }
}


export type AdminWithdrawalRow = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  pix_key: string | null;
  note: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  user_email: string | null;
  user_display_name: string | null;
};

export const listAllWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const p = z
      .object({ status: z.string().optional() })
      .partial()
      .parse(raw ?? {});
    return p;
  })
  .handler(async ({ data, context }): Promise<AdminWithdrawalRow[]> => {
    await ensureAdmin(context);
    const { supabase } = context;

    let query = supabase
      .from("affiliate_withdrawals")
      .select(
        "id, user_id, amount, status, pix_key, note, admin_notes, rejection_reason, reviewed_by, reviewed_at, paid_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) query = query.eq("status", data.status as never);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    let profiles: Record<string, { display_name: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, { display_name: p.display_name }]));
    }

    return (rows ?? []).map((r) => ({
      ...r,
      user_email: null,
      user_display_name: profiles[r.user_id]?.display_name ?? null,
    })) as AdminWithdrawalRow[];
  });

const actionInput = z.object({
  withdrawalId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

async function writeAudit(params: {
  actorId: string;
  action: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  reason?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: "affiliate_withdrawal",
    entity_id: params.entityId,
    old_value: params.oldValue as never,
    new_value: params.newValue as never,
    reason: params.reason ?? null,
  });
}

export const approveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => actionInput.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    await assertNotImpersonating(context, "withdrawal.approve");
    const { supabase, userId } = context;

    const { data: current, error: readErr } = await supabase
      .from("affiliate_withdrawals")
      .select("id, status, amount, user_id")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Saque não encontrado.");
    if (!["pending", "in_review"].includes(current.status)) {
      throw new Error("Este saque não pode ser aprovado neste estado.");
    }

    const { error } = await supabase
      .from("affiliate_withdrawals")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        admin_notes: data.note ?? null,
      })
      .eq("id", data.withdrawalId);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: userId,
      action: "withdrawal.approve",
      entityId: data.withdrawalId,
      oldValue: { status: current.status },
      newValue: { status: "approved" },
      reason: data.note,
    });
    await auditLog(supabase, {
      eventType: "WITHDRAWAL_APPROVED",
      module: "withdrawals",
      severity: "success",
      title: "Saque aprovado",
      userId,
      entityType: "affiliate_withdrawal",
      entityId: data.withdrawalId,
      metadata: { amount: current.amount, target_user: current.user_id },
    });
    return { ok: true };
  });

export const rejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => actionInput.extend({ reason: z.string().trim().min(3).max(500) }).parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabase, userId } = context;

    const { data: current, error: readErr } = await supabase
      .from("affiliate_withdrawals")
      .select("id, status, amount, user_id")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Saque não encontrado.");
    if (["paid", "rejected", "cancelled"].includes(current.status)) {
      throw new Error("Este saque já foi finalizado.");
    }

    // Devolve saldo ao afiliado
    const { data: profile } = await supabase
      .from("profiles")
      .select("affiliate_balance")
      .eq("id", current.user_id)
      .maybeSingle();
    const newBalance = (profile?.affiliate_balance ?? 0) + current.amount;
    await supabase.from("profiles").update({ affiliate_balance: newBalance }).eq("id", current.user_id);

    const { error } = await supabase
      .from("affiliate_withdrawals")
      .update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: data.reason,
      })
      .eq("id", data.withdrawalId);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: userId,
      action: "withdrawal.reject",
      entityId: data.withdrawalId,
      oldValue: { status: current.status, balance_before: profile?.affiliate_balance ?? 0 },
      newValue: { status: "rejected", balance_after: newBalance },
      reason: data.reason,
    });
    await auditLog(supabase, {
      eventType: "WITHDRAWAL_REJECTED",
      module: "withdrawals",
      severity: "warning",
      title: "Saque rejeitado (saldo devolvido)",
      message: data.reason,
      userId,
      entityType: "affiliate_withdrawal",
      entityId: data.withdrawalId,
      metadata: { amount: current.amount, target_user: current.user_id, refunded_to: newBalance },
    });
    return { ok: true };
  });

export const markWithdrawalPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => actionInput.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabase, userId } = context;

    const { data: current, error: readErr } = await supabase
      .from("affiliate_withdrawals")
      .select("id, status")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Saque não encontrado.");
    if (current.status !== "approved") {
      throw new Error("Só saques aprovados podem ser marcados como pagos.");
    }

    const { error } = await supabase
      .from("affiliate_withdrawals")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        admin_notes: data.note ?? null,
      })
      .eq("id", data.withdrawalId);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: userId,
      action: "withdrawal.pay",
      entityId: data.withdrawalId,
      oldValue: { status: current.status },
      newValue: { status: "paid" },
      reason: data.note,
    });
    await auditLog(supabase, {
      eventType: "WITHDRAWAL_PAID",
      module: "withdrawals",
      severity: "success",
      title: "Saque marcado como pago",
      userId,
      entityType: "affiliate_withdrawal",
      entityId: data.withdrawalId,
    });
    return { ok: true };
  });

export type WithdrawalAuditEntry = {
  id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  reason: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type WithdrawalDetail = {
  withdrawal: AdminWithdrawalRow & {
    request_ip: string | null;
    request_user_agent: string | null;
    reviewer_name: string | null;
    user_email: string | null;
    user_affiliate_balance: number;
    user_total_received: number;
  };
  audit: WithdrawalAuditEntry[];
  userHistory: AdminWithdrawalRow[];
};

export const getWithdrawalDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ withdrawalId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<WithdrawalDetail> => {
    await ensureAdmin(context);
    const { supabase } = context;

    const { data: w, error } = await supabase
      .from("affiliate_withdrawals")
      .select(
        "id, user_id, amount, status, pix_key, note, admin_notes, rejection_reason, reviewed_by, reviewed_at, paid_at, created_at, request_ip, request_user_agent",
      )
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!w) throw new Error("Saque não encontrado.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, affiliate_balance, total_received")
      .eq("id", w.user_id)
      .maybeSingle();

    let reviewerName: string | null = null;
    if (w.reviewed_by) {
      const { data: rp } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", w.reviewed_by)
        .maybeSingle();
      reviewerName = rp?.display_name ?? null;
    }

    const { data: auditRows } = await supabase
      .from("audit_logs")
      .select("id, action, actor_id, reason, old_value, new_value, created_at")
      .eq("entity_type", "affiliate_withdrawal")
      .eq("entity_id", data.withdrawalId)
      .order("created_at", { ascending: false })
      .limit(50);

    const actorIds = Array.from(
      new Set((auditRows ?? []).map((a) => a.actor_id).filter((x): x is string => !!x)),
    );
    let actorNames: Record<string, string | null> = {};
    if (actorIds.length) {
      const { data: ap } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", actorIds);
      actorNames = Object.fromEntries((ap ?? []).map((p) => [p.id, p.display_name]));
    }

    const { data: history } = await supabase
      .from("affiliate_withdrawals")
      .select(
        "id, user_id, amount, status, pix_key, note, admin_notes, rejection_reason, reviewed_by, reviewed_at, paid_at, created_at",
      )
      .eq("user_id", w.user_id)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      withdrawal: {
        ...w,
        user_email: null,
        user_display_name: profile?.display_name ?? null,
        user_affiliate_balance: profile?.affiliate_balance ?? 0,
        user_total_received: profile?.total_received ?? 0,
        reviewer_name: reviewerName,
      } as WithdrawalDetail["withdrawal"],
      audit: (auditRows ?? []).map((a) => ({
        id: a.id,
        action: a.action,
        actor_id: a.actor_id,
        actor_name: a.actor_id ? actorNames[a.actor_id] ?? null : null,
        reason: a.reason,
        old_value: a.old_value == null ? null : JSON.stringify(a.old_value),
        new_value: a.new_value == null ? null : JSON.stringify(a.new_value),
        created_at: a.created_at,
      })),
      userHistory: (history ?? []).map((r) => ({
        ...r,
        user_email: null,
        user_display_name: profile?.display_name ?? null,
      })) as AdminWithdrawalRow[],
    };
  });
