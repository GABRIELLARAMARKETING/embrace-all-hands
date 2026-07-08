import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const withdrawInput = z.object({
  amount: z.number().int().positive(),
  pixKey: z.string().trim().min(3).max(120).optional(),
});

export const requestAffiliateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => withdrawInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("affiliate_balance, total_received")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Perfil não encontrado.");

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

    const newBalance = balance - data.amount;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ affiliate_balance: newBalance })
      .eq("id", userId);
    if (updateError) throw new Error(updateError.message);

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
    if (data.status) query = query.eq("status", data.status);

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
    return { ok: true };
  });
