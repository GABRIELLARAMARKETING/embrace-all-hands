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

export type TrackingOverview = {
  totalClicks: number;
  clicks24h: number;
  totalConversions: number;
  conversions24h: number;
  conversionRate: number; // 0..1
  commissionsPending: number;
  commissionsAvailable: number;
  commissionsPaid: number;
  commissionsCanceled: number;
  topReferrer: { userId: string; name: string; conversions: number } | null;
};

export const getTrackingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrackingOverview> => {
    await ensureAdmin(context);
    const { supabase } = context;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [{ count: totalClicks }, { count: clicks24h }, convAll, conv24, comms, topOwners] =
      await Promise.all([
        supabase.from("referral_clicks").select("id", { count: "exact", head: true }),
        supabase
          .from("referral_clicks")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
        supabase
          .from("referral_clicks")
          .select("id", { count: "exact", head: true })
          .not("converted_user_id", "is", null),
        supabase
          .from("referral_clicks")
          .select("id", { count: "exact", head: true })
          .not("converted_user_id", "is", null)
          .gte("converted_at", since),
        supabase.from("commissions").select("status, amount"),
        supabase
          .from("referral_clicks")
          .select("owner_user_id")
          .not("converted_user_id", "is", null)
          .not("owner_user_id", "is", null)
          .limit(1000),
      ]);

    const totalConversions = convAll.count ?? 0;
    const totalC = totalClicks ?? 0;

    const sums = { pending: 0, available: 0, paid: 0, canceled: 0 };
    for (const c of ((comms.data ?? []) as Array<{ status: string; amount: number }>)) {
      const s = c.status as keyof typeof sums;
      if (s in sums) sums[s] += Number(c.amount ?? 0);
    }

    // top referrer
    const counts = new Map<string, number>();
    for (const row of (topOwners.data ?? []) as Array<{ owner_user_id: string }>) {
      counts.set(row.owner_user_id, (counts.get(row.owner_user_id) ?? 0) + 1);
    }
    let topId: string | null = null;
    let topCount = 0;
    for (const [id, n] of counts) if (n > topCount) [topId, topCount] = [id, n];
    let topReferrer: TrackingOverview["topReferrer"] = null;
    if (topId) {
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", topId)
        .maybeSingle();
      topReferrer = { userId: topId, name: p?.display_name ?? "—", conversions: topCount };
    }

    return {
      totalClicks: totalC,
      clicks24h: clicks24h ?? 0,
      totalConversions,
      conversions24h: conv24.count ?? 0,
      conversionRate: totalC > 0 ? totalConversions / totalC : 0,
      commissionsPending: sums.pending,
      commissionsAvailable: sums.available,
      commissionsPaid: sums.paid,
      commissionsCanceled: sums.canceled,
      topReferrer,
    };
  });

export type TrackingEvent = {
  id: string;
  createdAt: string;
  code: string;
  ownerType: string;
  ownerUserId: string | null;
  ownerName: string | null;
  convertedUserId: string | null;
  convertedName: string | null;
  convertedAt: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  ipHash: string | null;
  landingPage: string | null;
};

export const listTrackingEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z.enum(["all", "converted", "pending"]).default("all"),
        code: z.string().max(24).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<TrackingEvent[]> => {
    await ensureAdmin(context);
    const { supabase } = context;

    let q = supabase
      .from("referral_clicks")
      .select(
        "id, created_at, code, owner_type, owner_user_id, converted_user_id, converted_at, utm_source, utm_campaign, ip_hash, landing_page",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status === "converted") q = q.not("converted_user_id", "is", null);
    if (data.status === "pending") q = q.is("converted_user_id", null);
    if (data.code) q = q.eq("code", data.code.trim().toUpperCase());

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    for (const r of rows ?? []) {
      if (r.owner_user_id) ids.add(r.owner_user_id);
      if (r.converted_user_id) ids.add(r.converted_user_id);
    }
    const nameMap = new Map<string, string>();
    if (ids.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(ids));
      for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null }>) {
        nameMap.set(p.id, p.display_name ?? "—");
      }
    }

    return (rows ?? []).map((r) => ({
      id: r.id as string,
      createdAt: r.created_at as string,
      code: r.code as string,
      ownerType: (r.owner_type as string) ?? "unknown",
      ownerUserId: (r.owner_user_id as string) ?? null,
      ownerName: r.owner_user_id ? nameMap.get(r.owner_user_id as string) ?? null : null,
      convertedUserId: (r.converted_user_id as string) ?? null,
      convertedName: r.converted_user_id
        ? nameMap.get(r.converted_user_id as string) ?? null
        : null,
      convertedAt: (r.converted_at as string) ?? null,
      utmSource: (r.utm_source as string) ?? null,
      utmCampaign: (r.utm_campaign as string) ?? null,
      ipHash: (r.ip_hash as string) ?? null,
      landingPage: (r.landing_page as string) ?? null,
    }));
  });

/**
 * Chamado imediatamente após o signup para casar o novo user com o clique
 * original (usa o tracking id armazenado no cookie helix_tid).
 */
export const convertReferralClick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ trackingId: z.string().min(6).max(64) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    // A política de UPDATE restringe a admin — usamos service role aqui.
    // A operação é segura: só marca cliques do próprio tid do cookie que
    // ainda não foram convertidos, e amarra ao userId autenticado.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("referral_clicks")
      .update({ converted_user_id: userId, converted_at: new Date().toISOString() })
      .eq("tracking_id", data.trackingId)
      .is("converted_user_id", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
