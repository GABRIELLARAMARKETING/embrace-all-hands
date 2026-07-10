import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Kind = "referral" | "affiliate" | "manager" | "invite";
type Status = "active" | "inactive" | "expired";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function logAudit(
  supabase: any,
  codeId: string,
  code: string,
  action: string,
  actorId: string,
  detail: Record<string, unknown> = {},
) {
  await supabase.from("invite_code_audit").insert({
    code_id: codeId,
    code,
    action,
    actor_id: actorId,
    detail,
  });
}

export const listInviteCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind?: Kind | "all"; status?: Status | "all"; search?: string }) => i ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // auto-expire vencidos
    await supabase.rpc("expire_invite_codes");

    let q = supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.search?.trim()) q = q.ilike("code", `%${data.search.trim()}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listInviteCodeAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { codeId?: string }) => i ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let q = supabase
      .from("invite_code_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.codeId) q = q.eq("code_id", data.codeId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    code?: string;
    kind: Kind;
    maxUses?: number | null;
    expiresAt?: string | null;
    notes?: string | null;
  }) =>
    z
      .object({
        code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
        kind: z.enum(["referral", "affiliate", "manager", "invite"]),
        maxUses: z.number().int().positive().max(1_000_000).nullable().optional(),
        expiresAt: z.string().datetime().nullable().optional(),
        notes: z.string().max(300).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const code = (data.code?.trim() || randomCode(8)).toUpperCase();
    const { data: row, error } = await supabase
      .from("invite_codes")
      .insert({
        code,
        kind: data.kind,
        max_uses: data.maxUses ?? null,
        expires_at: data.expiresAt ?? null,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, row.id, row.code, "created", userId, {
      kind: row.kind,
      max_uses: row.max_uses,
      expires_at: row.expires_at,
    });
    return row;
  });

export const setInviteCodeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: Status }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "inactive", "expired"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: row, error } = await supabase
      .from("invite_codes")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const action =
      data.status === "active"
        ? "activated"
        : data.status === "inactive"
          ? "deactivated"
          : "expired";
    await logAudit(supabase, row.id, row.code, action, userId, { status: row.status });
    return row;
  });

export const deleteInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row } = await supabase
      .from("invite_codes")
      .select("id, code")
      .eq("id", data.id)
      .single();
    const { error } = await supabase.from("invite_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row) await logAudit(supabase, row.id, row.code, "deleted", userId);
    return { ok: true };
  });
