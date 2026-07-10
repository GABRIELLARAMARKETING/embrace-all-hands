import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminNotification = {
  id: string;
  type: string;
  severity: "info" | "success" | "warning" | "error" | "critical";
  title: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  audit_event_id: string | null;
  read_at: string | null;
  created_at: string;
};

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const { data: a } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const { data: s } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (!a && !s) throw new Error("Forbidden");
}

export const listAdminNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("admin_notifications")
      .select("id, type, severity, title, message, payload, audit_event_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminNotification[];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
