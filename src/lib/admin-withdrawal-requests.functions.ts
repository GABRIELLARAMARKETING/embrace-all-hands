import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(context: { supabase: any; userId: string }) {
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

export type WithdrawalRequestEvent = {
  id: string;
  event_type: string;
  severity: string;
  title: string | null;
  message: string | null;
  created_at: string;
  admin_user_id: string | null;
};

export type WithdrawalRequestNotification = {
  id: string;
  type: string;
  severity: string;
  title: string;
  read_at: string | null;
  created_at: string;
};

export type WithdrawalRequestRow = {
  id: string;
  user_id: string;
  user_display_name: string | null;
  amount: number;
  status: string;
  pix_key: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  events: WithdrawalRequestEvent[];
  notifications: WithdrawalRequestNotification[];
  unread_notifications: number;
};

const STATUSES = [
  "pending",
  "in_review",
  "approved",
  "paid",
  "rejected",
  "cancelled",
  "failed",
] as const;

const input = z
  .object({
    status: z.enum(STATUSES).optional(),
    search: z.string().trim().max(120).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    notifications: z.enum(["all", "unread", "read", "none"]).optional().default("all"),
    page: z.number().int().min(0).max(10_000).optional().default(0),
    pageSize: z.number().int().min(5).max(100).optional().default(20),
  })
  .default({});

export const listWithdrawalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabase } = context;

    const page = data.page ?? 0;
    const pageSize = data.pageSize ?? 20;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Resolve search to matching user_ids (por display_name)
    let userIdFilter: string[] | null = null;
    const search = data.search?.trim();
    if (search) {
      const looksUuid = /^[0-9a-f-]{6,}$/i.test(search);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id")
        .ilike("display_name", `%${search}%`)
        .limit(200);
      const ids = new Set<string>((profs ?? []).map((p: { id: string }) => p.id));
      if (looksUuid) ids.add(search);
      userIdFilter = Array.from(ids);
      if (userIdFilter.length === 0) {
        return { rows: [] as WithdrawalRequestRow[], total: 0, page, pageSize };
      }
    }

    let query = supabase
      .from("affiliate_withdrawals")
      .select(
        "id, user_id, amount, status, pix_key, admin_notes, rejection_reason, reviewed_at, paid_at, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.status) query = query.eq("status", data.status as never);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);
    if (userIdFilter) query = query.in("user_id", userIdFilter);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const ids = list.map((r) => r.id);
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));

    const [profilesRes, eventsRes, notificationsRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
      ids.length
        ? supabase
            .from("audit_events")
            .select("id, event_type, severity, title, message, created_at, admin_user_id, entity_id")
            .eq("entity_type", "affiliate_withdrawal")
            .in("entity_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase
            .from("admin_notifications")
            .select("id, type, severity, title, read_at, created_at, payload")
            .in("payload->>withdrawal_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map<string, string | null>(
      (profilesRes.data ?? []).map((p: any) => [p.id, p.display_name]),
    );
    const eventsByWithdrawal = new Map<string, WithdrawalRequestEvent[]>();
    for (const e of (eventsRes.data ?? []) as any[]) {
      const arr = eventsByWithdrawal.get(e.entity_id) ?? [];
      arr.push({
        id: e.id,
        event_type: e.event_type,
        severity: e.severity,
        title: e.title,
        message: e.message,
        created_at: e.created_at,
        admin_user_id: e.admin_user_id,
      });
      eventsByWithdrawal.set(e.entity_id, arr);
    }
    const notifsByWithdrawal = new Map<string, WithdrawalRequestNotification[]>();
    for (const n of (notificationsRes.data ?? []) as any[]) {
      const wid = n.payload?.withdrawal_id as string | undefined;
      if (!wid) continue;
      const arr = notifsByWithdrawal.get(wid) ?? [];
      arr.push({
        id: n.id,
        type: n.type,
        severity: n.severity,
        title: n.title,
        read_at: n.read_at,
        created_at: n.created_at,
      });
      notifsByWithdrawal.set(wid, arr);
    }

    let result: WithdrawalRequestRow[] = list.map((r) => {
      const notifs = notifsByWithdrawal.get(r.id) ?? [];
      const unread = notifs.filter((n) => !n.read_at).length;
      return {
        id: r.id,
        user_id: r.user_id,
        user_display_name: profileMap.get(r.user_id) ?? null,
        amount: r.amount,
        status: r.status as string,
        pix_key: r.pix_key,
        admin_notes: r.admin_notes,
        rejection_reason: r.rejection_reason,
        reviewed_at: r.reviewed_at,
        paid_at: r.paid_at,
        created_at: r.created_at,
        events: eventsByWithdrawal.get(r.id) ?? [],
        notifications: notifs,
        unread_notifications: unread,
      };
    });

    // Filtro de notificação aplicado no lado do servidor (após agregação).
    if (data.notifications === "unread") {
      result = result.filter((r) => r.unread_notifications > 0);
    } else if (data.notifications === "read") {
      result = result.filter(
        (r) => r.notifications.length > 0 && r.unread_notifications === 0,
      );
    } else if (data.notifications === "none") {
      result = result.filter((r) => r.notifications.length === 0);
    }

    return {
      rows: result,
      total: count ?? result.length,
      page,
      pageSize,
    };
  });
