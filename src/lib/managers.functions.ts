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
    entity_type: "profile",
    entity_id: params.entityId,
    old_value: params.oldValue as never,
    new_value: params.newValue as never,
    reason: params.reason ?? null,
  });
}

export type ManagerRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: "active" | "inactive" | "blocked";
  created_at: string;
  affiliate_count: number;
  total_received: number;
};

export const listManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagerRow[]> => {
    await ensureAdmin(context);
    const { supabase } = context;

    const { data: roleRows, error: roleErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "gerente");
    if (roleErr) throw new Error(roleErr.message);

    const managerIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    if (!managerIds.length) return [];

    const { data: profs, error: profErr } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, display_name, status, created_at, total_received" as any)
      .in("id", managerIds);
    if (profErr) throw new Error(profErr.message);

    // Count affiliates linked to each manager
    const { data: linked, error: linkedErr } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("manager_id" as any)
      .in("manager_id", managerIds);
    if (linkedErr) throw new Error(linkedErr.message);
    const counts = new Map<string, number>();
    for (const row of (linked ?? []) as unknown as Array<{ manager_id: string | null }>) {
      if (!row.manager_id) continue;
      counts.set(row.manager_id, (counts.get(row.manager_id) ?? 0) + 1);
    }

    // Fetch emails via admin
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emails = new Map<string, string | null>();
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) break;
      for (const u of data.users) {
        if (managerIds.includes(u.id)) emails.set(u.id, u.email ?? null);
      }
      if (data.users.length < 200) break;
      page++;
      if (page > 20) break;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((profs ?? []) as any[]).map((p) => ({
      id: p.id,
      display_name: p.display_name ?? null,
      email: emails.get(p.id) ?? null,
      status: (p.status ?? "active") as ManagerRow["status"],
      created_at: p.created_at,
      total_received: p.total_received ?? 0,
      affiliate_count: counts.get(p.id) ?? 0,
    }));
  });

const statusInput = z.object({
  managerId: z.string().uuid(),
  status: z.enum(["active", "inactive", "blocked"]),
  reason: z.string().trim().max(500).optional(),
});

export const setManagerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => statusInput.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabase, userId } = context;

    const { data: current, error: readErr } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, status" as any)
      .eq("id", data.managerId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Gerente não encontrado.");

    const { error: updErr } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: data.status } as any)
      .eq("id", data.managerId);
    if (updErr) throw new Error(updErr.message);

    await writeAudit({
      actorId: userId,
      action: `manager.status.${data.status}`,
      entityId: data.managerId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oldValue: { status: (current as any).status },
      newValue: { status: data.status },
      reason: data.reason,
    });

    return { ok: true, status: data.status };
  });

export type AffiliateRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: "active" | "inactive" | "blocked";
  total_received: number;
  affiliate_balance: number;
  created_at: string;
};

export const listAffiliatesForManager = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ managerId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<AffiliateRow[]> => {
    await ensureAdmin(context);
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("profiles")
      .select(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "id, display_name, status, total_received, affiliate_balance, created_at" as any,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq("manager_id" as any, data.managerId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (rows ?? []) as any[];
    if (!list.length) return [];

    const ids = list.map((r) => r.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emails = new Map<string, string | null>();
    let page = 1;
    while (true) {
      const { data: p, error: e } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (e) break;
      for (const u of p.users) if (ids.includes(u.id)) emails.set(u.id, u.email ?? null);
      if (p.users.length < 200) break;
      page++;
      if (page > 20) break;
    }

    return list.map((r) => ({
      id: r.id,
      display_name: r.display_name ?? null,
      email: emails.get(r.id) ?? null,
      status: (r.status ?? "active") as AffiliateRow["status"],
      total_received: r.total_received ?? 0,
      affiliate_balance: r.affiliate_balance ?? 0,
      created_at: r.created_at,
    }));
  });
