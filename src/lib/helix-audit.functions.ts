import { createServerFn } from "@tanstack/react-start";
import { noInput } from "@/lib/validation";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type HelixRuleCheck = {
  amount: number;
  amountCents: number;
  expectedPayoutCents: number;
  actualPayoutCents: number | null;
  ok: boolean;
};

export type HelixAuditResult = {
  rules: HelixRuleCheck[];
  rulesAllOk: boolean;
  invalidDeposits: Array<{
    id: string;
    user_id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  sessionMismatches: Array<{
    id: string;
    deposit_id: string | null;
    deposit_amount: number | null;
    payout_per_platform_cents: number;
    expected_payout_cents: number | null;
    status: string;
    created_at: string;
  }>;
  checkedAt: string;
};

export const auditHelixPayoutRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(noInput)
  .handler(async ({ context }): Promise<HelixAuditResult> => {
    const { data: adm } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (!adm) throw new Error("Sem permissão");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runHelixAudit } = await import("./helix-audit-core");
    return runHelixAudit(supabaseAdmin);
  });
