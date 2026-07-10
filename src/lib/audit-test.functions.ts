import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditLog } from "@/lib/audit.functions";

/**
 * Admin-only: emite 3 eventos sintéticos (depósito, saque, sessão Helix)
 * para validar visualmente o pipeline de auditoria e notificações realtime.
 */
export const emitAuditTestEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");

    const correlationId = `audit-test-${Date.now()}`;
    const results: Array<{ eventType: string; id: string | null }> = [];

    results.push({
      eventType: "TEST_DEPOSIT_PAID",
      id: await auditLog(supabase, {
        eventType: "TEST_DEPOSIT_PAID",
        module: "deposits",
        severity: "success",
        title: "[TESTE] Depósito PIX confirmado — R$ 20,00",
        message: "Evento sintético gerado pelo painel admin.",
        metadata: { amount: 20, provider: "diggion", synthetic: true },
        entityType: "deposit",
        entityId: correlationId,
        correlationId,
        userId,
      }),
    });

    results.push({
      eventType: "TEST_WITHDRAWAL_REQUESTED",
      id: await auditLog(supabase, {
        eventType: "TEST_WITHDRAWAL_REQUESTED",
        module: "withdrawals",
        severity: "warning",
        title: "[TESTE] Saque solicitado — R$ 50,00",
        message: "Evento sintético para conferência do fluxo de notificação.",
        metadata: { amount: 50, pix_key: "***", synthetic: true },
        entityType: "affiliate_withdrawal",
        entityId: correlationId,
        correlationId,
        userId,
      }),
    });

    results.push({
      eventType: "TEST_HELIX_SESSION_FINISHED",
      id: await auditLog(supabase, {
        eventType: "TEST_HELIX_SESSION_FINISHED",
        module: "helix_game",
        severity: "info",
        title: "[TESTE] Sessão Helix finalizada — 8 plataformas",
        message: "Evento sintético (não afeta saldo real).",
        metadata: {
          validated_platforms_passed: 8,
          reward_cents: 1600,
          synthetic: true,
        },
        entityType: "game_session",
        entityId: correlationId,
        correlationId,
        userId,
      }),
    });

    return { ok: true, correlationId, results };
  });
