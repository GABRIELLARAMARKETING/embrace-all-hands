import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAdmin(context: any): Promise<void> {
  const { data: isAdmin, error } = await context.supabase.rpc("is_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Acesso negado.");
}

const ALLOWED_STATUS = ["active", "pending", "blocked", "inactive"] as const;
type Status = (typeof ALLOWED_STATUS)[number];
const ALLOWED_ROLES = ["super_admin", "admin", "gerente", "afiliado", "user"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export type AdminUserRow = {
  id: string;
  name: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
  status: Status;
  affiliate_code: string | null;
  referred_by_id: string | null;
  referred_by_name: string | null;
  created_at: string;
  last_login_at: string | null;
};

export type AdminUsersStats = {
  totalUsers: number;
  newUsersToday: number;
  newUsersLast7Days: number;
  activeUsers: number;
  pendingUsers: number;
  blockedUsers: number;
  usersWithCpf: number;
  usersWithoutPhone: number;
};

export const getAdminUsersStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUsersStats> => {
    await ensureAdmin(context);
    const { supabase } = context;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();

    const head = (q: ReturnType<typeof supabase.from>) => q;
    void head;

    const [total, today, week, active, pending, blocked, withCpf, withoutPhone] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "blocked"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).not("cpf", "is", null),
      supabase.from("profiles").select("id", { count: "exact", head: true }).is("phone", null),
    ]);

    return {
      totalUsers: total.count ?? 0,
      newUsersToday: today.count ?? 0,
      newUsersLast7Days: week.count ?? 0,
      activeUsers: active.count ?? 0,
      pendingUsers: pending.count ?? 0,
      blockedUsers: blocked.count ?? 0,
      usersWithCpf: withCpf.count ?? 0,
      usersWithoutPhone: withoutPhone.count ?? 0,
    };
  });

const listInput = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    cpf: z.string().trim().max(20).optional(),
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().max(255).optional(),
    status: z.enum(ALLOWED_STATUS).optional(),
    role: z.enum(ALLOWED_ROLES).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .partial({ search: true, cpf: true, phone: true, email: true, status: true, role: true, startDate: true, endDate: true });

export type ListUsersResult = {
  users: AdminUserRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function attachRolesAndReferrers(supabase: any, rows: any[]): Promise<AdminUserRow[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const refIds = Array.from(new Set(rows.map((r) => r.referred_by_id).filter(Boolean))) as string[];

  const [rolesRes, refsRes, loginsRes] = await Promise.all([
    supabase.from("user_roles").select("user_id, role").in("user_id", ids),
    refIds.length
      ? supabase.from("profiles").select("id, display_name, full_name").in("id", refIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("login_logs")
      .select("user_id, created_at")
      .in("user_id", ids)
      .eq("success", true)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const rolesMap = new Map<string, Role>();
  for (const r of (rolesRes.data ?? []) as Array<{ user_id: string; role: Role }>) {
    const prev = rolesMap.get(r.user_id);
    // priority: super_admin > admin > gerente > afiliado
    const priority: Record<string, number> = { super_admin: 4, admin: 3, gerente: 2, afiliado: 1 };
    if (!prev || (priority[r.role] ?? 0) > (priority[prev] ?? 0)) rolesMap.set(r.user_id, r.role);
  }
  const refMap = new Map<string, string>();
  for (const r of (refsRes.data ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null }>) {
    refMap.set(r.id, r.full_name ?? r.display_name ?? "");
  }
  const lastLoginMap = new Map<string, string>();
  for (const l of (loginsRes.data ?? []) as Array<{ user_id: string; created_at: string }>) {
    if (!lastLoginMap.has(l.user_id)) lastLoginMap.set(l.user_id, l.created_at);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.full_name ?? r.display_name ?? null,
    cpf: r.cpf ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    role: rolesMap.get(r.id) ?? "user",
    status: (ALLOWED_STATUS.includes(r.status) ? r.status : "active") as Status,
    affiliate_code: r.affiliate_code ?? null,
    referred_by_id: r.referred_by_id ?? null,
    referred_by_name: r.referred_by_id ? refMap.get(r.referred_by_id) ?? null : null,
    created_at: r.created_at,
    last_login_at: lastLoginMap.get(r.id) ?? null,
  }));
}

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => listInput.parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<ListUsersResult> => {
    await ensureAdmin(context);
    const { supabase } = context;

    // If filtering by role, resolve target user_ids first
    let filterIds: string[] | null = null;
    if (data.role && data.role !== "user") {
      const { data: rr } = await supabase.from("user_roles").select("user_id").eq("role", data.role);
      filterIds = Array.from(new Set((rr ?? []).map((r: { user_id: string }) => r.user_id)));
      if (!filterIds.length) {
        return { users: [], pagination: { page: data.page, limit: data.limit, total: 0, totalPages: 0 } };
      }
    } else if (data.role === "user") {
      // users without any role row
      const { data: rr } = await supabase.from("user_roles").select("user_id");
      const excluded = new Set((rr ?? []).map((r: { user_id: string }) => r.user_id));
      // Fetch all profile ids (bounded) and exclude — pragmatic approach
      const { data: allP } = await supabase.from("profiles").select("id").limit(5000);
      filterIds = ((allP ?? []) as Array<{ id: string }>).map((p) => p.id).filter((id) => !excluded.has(id));
      if (!filterIds.length) {
        return { users: [], pagination: { page: data.page, limit: data.limit, total: 0, totalPages: 0 } };
      }
    }

    let q = supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, display_name, full_name, cpf, phone, email, status, affiliate_code, referred_by_id, created_at" as any, { count: "exact" })
      .order("created_at", { ascending: data.sortOrder === "asc" });

    if (filterIds) q = q.in("id", filterIds);
    if (data.status) q = q.eq("status", data.status);
    if (data.startDate) q = q.gte("created_at", data.startDate);
    if (data.endDate) q = q.lte("created_at", data.endDate);
    if (data.cpf) q = q.ilike("cpf", `%${data.cpf}%`);
    if (data.phone) q = q.ilike("phone", `%${data.phone}%`);
    if (data.email) q = q.ilike("email", `%${data.email}%`);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      q = q.or(`full_name.ilike.%${s}%,display_name.ilike.%${s}%,email.ilike.%${s}%`);
    }

    const from = (data.page - 1) * data.limit;
    q = q.range(from, from + data.limit - 1);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = await attachRolesAndReferrers(supabase, (rows ?? []) as any[]);
    const total = count ?? users.length;
    return {
      users,
      pagination: {
        page: data.page,
        limit: data.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / data.limit)),
      },
    };
  });

export type AdminUserDetails = AdminUserRow & {
  balance: number;
  referrals: Array<{ id: string; name: string | null; created_at: string }>;
  logs: Array<{ id: string; action: string; reason: string | null; created_at: string; actor_email: string | null }>;
  loginHistory: Array<{ created_at: string; ip: string | null; success: boolean }>;
};

export const getAdminUserDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<AdminUserDetails> => {
    await ensureAdmin(context);
    const { supabase, userId } = context;

    const { data: p, error } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, display_name, full_name, cpf, phone, email, status, affiliate_code, referred_by_id, created_at, balance" as any)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Usuário não encontrado.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [base] = await attachRolesAndReferrers(supabase, [p as any]);

    const [refsRes, logsRes, loginsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, full_name, created_at")
        .eq("referred_by_id", data.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("audit_logs")
        .select("id, action, reason, created_at, actor_email")
        .eq("entity_id", data.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("login_logs")
        .select("created_at, ip, success")
        .eq("user_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // Log admin view of sensitive data
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "user.view_details",
      entity_type: "profile",
      entity_id: data.id,
    });

    return {
      ...base,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      balance: Number((p as any).balance ?? 0),
      referrals: ((refsRes.data ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null; created_at: string }>).map((r) => ({
        id: r.id,
        name: r.full_name ?? r.display_name ?? null,
        created_at: r.created_at,
      })),
      logs: (logsRes.data ?? []) as AdminUserDetails["logs"],
      loginHistory: (loginsRes.data ?? []) as AdminUserDetails["loginHistory"],
    };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(200).optional(),
  cpf: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  status: z.enum(ALLOWED_STATUS).optional(),
  role: z.enum(ALLOWED_ROLES).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateInput.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { userId } = context;
    if (data.id === userId && (data.status === "blocked" || data.status === "inactive")) {
      throw new Error("Admin não pode bloquear a própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: readErr } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, full_name, cpf, phone, status" as any)
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Usuário não encontrado.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.cpf !== undefined) patch.cpf = data.cpf;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.status !== undefined) patch.status = data.status;

    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    // Handle role change
    if (data.role !== undefined) {
      if (data.id === userId && data.role !== "admin" && data.role !== "super_admin") {
        throw new Error("Admin não pode remover o próprio acesso admin.");
      }
      // Clear existing role rows and insert new (except 'user' which is no row)
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.id);
      if (delErr) throw new Error(`Falha ao limpar papel anterior: ${delErr.message}`);
      if (data.role !== "user") {
        const { error: insErr } = await supabaseAdmin
          .from("user_roles")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert({ user_id: data.id, role: data.role } as any);
        if (insErr) throw new Error(`Falha ao atribuir papel '${data.role}': ${insErr.message}`);

        // Verificação pós-insert: confirma que a linha realmente existe.
        const { data: verify, error: verifyErr } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", data.id)
          .eq("role", data.role)
          .maybeSingle();
        if (verifyErr) {
          throw new Error(`Falha ao verificar papel '${data.role}': ${verifyErr.message}`);
        }
        if (!verify) {
          throw new Error(
            `Papel '${data.role}' não foi persistido em user_roles (verificação pós-insert vazia). Possível bloqueio de RLS/trigger.`,
          );
        }
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "user.update",
      entity_type: "profile",
      entity_id: data.id,
      old_value: current as never,
      new_value: { ...patch, role: data.role } as never,
      reason: data.reason ?? null,
    });

    return { ok: true };
  });

const blockInput = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export const blockAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => blockInput.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { userId } = context;
    if (data.id === userId) throw new Error("Admin não pode bloquear a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: "blocked" } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "user.block",
      entity_type: "profile",
      entity_id: data.id,
      new_value: { status: "blocked" } as never,
      reason: data.reason,
    });
    return { ok: true };
  });

export const unblockAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => blockInput.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: "active" } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "user.unblock",
      entity_type: "profile",
      entity_id: data.id,
      new_value: { status: "active" } as never,
      reason: data.reason,
    });
    return { ok: true };
  });

const deleteInput = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  confirm: z.literal("EXCLUIR"),
});

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => deleteInput.parse(raw))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { userId } = context;
    if (data.id === userId) throw new Error("Admin não pode excluir a própria conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Snapshot para o log de auditoria
    const { data: snapshot } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, full_name, display_name, email, cpf, phone, status, balance" as any)
      .eq("id", data.id)
      .maybeSingle();
    if (!snapshot) throw new Error("Usuário não encontrado.");

    // Impede exclusão de super_admin/admin (proteção adicional)
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.id);
    if ((roles ?? []).some((r: { role: string }) => r.role === "super_admin" || r.role === "admin")) {
      throw new Error("Contas com papel admin/super_admin não podem ser excluídas por esta ação.");
    }

    // Registra auditoria ANTES de excluir (o registro sobrevive à exclusão do usuário)
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "user.delete",
      entity_type: "profile",
      entity_id: data.id,
      old_value: snapshot as never,
      reason: data.reason,
    });

    // Exclui o usuário no Auth. As FKs em profiles/user_roles/etc. usam
    // ON DELETE CASCADE, então os dados relacionados também são removidos.
    // Exclui o usuário no Auth. As FKs em user_roles/transactions/etc. usam
    // ON DELETE CASCADE, então esses dados relacionados são removidos.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (delErr) throw new Error(`Falha ao excluir usuário: ${delErr.message}`);

    // profiles não tem FK para auth.users — remover explicitamente.
    await supabaseAdmin.from("profiles").delete().eq("id", data.id);

    return { ok: true };
  });
