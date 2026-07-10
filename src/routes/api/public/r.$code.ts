import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomUUID } from "node:crypto";

/**
 * GET /r/:code  →  registra clique e redireciona para /auth?ref=CODE
 *
 * • Insere linha em referral_clicks (com hash de IP, UTM, user agent, tid).
 * • Grava cookie `helix_tid` (7 dias) para casar clique ↔ cadastro depois.
 * • Grava cookie `helix_ref` como fallback (7 dias).
 * • Sempre redireciona — nunca bloqueia a jornada do visitante.
 */

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.REFERRAL_IP_SALT || "helix-ref-salt";
  return createHash("sha256").update(salt + "|" + ip).digest("hex").slice(0, 32);
}

function pickIp(request: Request): string | null {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip");
}

export const Route = createFileRoute("/api/public/r/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const rawCode = (params.code || "").trim().toUpperCase().slice(0, 24);
        const url = new URL(request.url);
        const origin = url.origin;
        const redirectTo = `${origin}/auth?ref=${encodeURIComponent(rawCode)}`;

        const cookieHeader = request.headers.get("cookie") || "";
        const existingTid = /(?:^|;\s*)helix_tid=([^;]+)/.exec(cookieHeader)?.[1];
        const tid = existingTid || randomUUID();

        // fire-and-forget: nunca segurar o redirect por falha de log
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const admin = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );

          // resolve dono do link
          const { data: owner } = await admin
            .from("profiles")
            .select("id")
            .eq("affiliate_code", rawCode)
            .maybeSingle();

          let ownerType: "gerente" | "afiliado" | "usuario" | "unknown" = "unknown";
          if (owner?.id) {
            const { data: roles } = await admin
              .from("user_roles")
              .select("role")
              .eq("user_id", owner.id);
            const set = new Set((roles ?? []).map((r) => r.role));
            if (set.has("gerente") || set.has("admin") || set.has("super_admin")) ownerType = "gerente";
            else if (set.has("afiliado")) ownerType = "afiliado";
            else ownerType = "usuario";
          }

          await admin.from("referral_clicks").insert({
            code: rawCode,
            owner_user_id: owner?.id ?? null,
            owner_type: ownerType,
            tracking_id: tid,
            ip_hash: hashIp(pickIp(request)),
            user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
            landing_page: url.pathname + url.search,
            utm_source: url.searchParams.get("utm_source"),
            utm_medium: url.searchParams.get("utm_medium"),
            utm_campaign: url.searchParams.get("utm_campaign"),
            utm_content: url.searchParams.get("utm_content"),
            utm_term: url.searchParams.get("utm_term"),
          });
        } catch (err) {
          console.error("[referral-click] log failed", err);
        }

        const cookieOpts = "Path=/; Max-Age=604800; SameSite=Lax";
        return new Response(null, {
          status: 302,
          headers: {
            Location: redirectTo,
            "Set-Cookie": [
              `helix_tid=${tid}; ${cookieOpts}`,
              `helix_ref=${encodeURIComponent(rawCode)}; ${cookieOpts}`,
            ].join(", "),
          },
        });
      },
    },
  },
});
