import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .order("role", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const rolesQuery = queryOptions({
  queryKey: ["admin", "roles"],
  queryFn: () => listRoles(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Perfis · Admin Helix" }] }),
  component: Page,
});

function Page() {
  const { data: rows = [] } = useQuery(rolesQuery);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Perfis & Permissões</h1>
        <p className="text-sm text-white/50">Papéis atribuídos a usuários do sistema.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase text-white/50">
            <tr>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Papel</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-10 text-center text-white/40">Sem papéis atribuídos.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-4 py-3 font-mono text-xs">{r.user_id.slice(0, 12)}…</td>
                <td className="px-4 py-3 text-cyan-200">{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
