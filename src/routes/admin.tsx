import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Wallet,
  DollarSign,
  Landmark,
  Percent,
  BadgeCheck,
  Bell,
  Plug,
  KeyRound,
  DatabaseBackup,
  Activity,
  Lock,
  FileBarChart,
  ShieldAlert,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  Gamepad2,
  Radar,

} from "lucide-react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") return;

    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      throw redirect({ to: "/admin/dashboard" });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw redirect({ to: "/admin/login" });
    }

    // Somente super_admin ou admin
    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roles = new Set((rows ?? []).map((r) => r.role));
    if (!roles.has("admin") && !roles.has("super_admin")) {
      throw redirect({ to: "/admin/login", search: { denied: "1" } as never });
    }
  },
  component: AdminPanelLayout,
});

interface AdminUICtx {
  openMobileMenu: () => void;
}
const AdminPanelUIContext = createContext<AdminUICtx>({ openMobileMenu: () => {} });
export const useAdminPanelUI = () => useContext(AdminPanelUIContext);

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/auditoria", label: "Central de Auditoria", icon: ShieldAlert },
  { to: "/admin/managers", label: "Gerentes", icon: UserCog },
  { to: "/admin/affiliates", label: "Afiliados", icon: Users },
  { to: "/admin/users", label: "Usuários / Acessos", icon: Users },
  { to: "/admin/network", label: "Rede de Indicações", icon: Users },
  { to: "/admin/tracking", label: "Rastreamento", icon: Radar },
  { to: "/admin/withdrawals", label: "Saques", icon: Wallet },
  { to: "/admin/finance", label: "Financeiro", icon: DollarSign },
  { to: "/admin/deposits", label: "Depósitos Diggion", icon: Landmark },
  { to: "/admin/webhooks", label: "Auditoria Webhooks", icon: ScrollText },
  { to: "/admin/commissions", label: "Comissões", icon: Percent },
  { to: "/admin/reports", label: "Relatórios", icon: FileBarChart },
  { to: "/admin/risk-alerts", label: "Alertas", icon: ShieldAlert },
  { to: "/admin/audit-logs", label: "Logs", icon: ScrollText },
  { to: "/admin/helix", label: "Jogo Helix", icon: Gamepad2 },
  { to: "/admin/helix-audit", label: "Auditoria Helix", icon: ShieldAlert },
  { to: "/admin/codes", label: "Códigos", icon: ScrollText },
  { to: "/admin/settings", label: "Configurações", icon: Settings },

] as const;

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/5 bg-[#0a0f1a] text-white">
      <div className="border-b border-white/5 px-4 py-5">
        <div className="text-xs uppercase tracking-widest text-white/40">Helix</div>
        <div className="mt-1 text-lg font-semibold">Admin Panel</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-cyan-500/10 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <button
        onClick={handleLogout}
        className="m-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </aside>
  );
}

function AdminPanelLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <AdminPanelUIContext.Provider value={{ openMobileMenu: () => setMobileOpen(true) }}>
      <div className="admin-theme admin-scroll min-h-screen w-full bg-[#050810] text-white">
        <div className="flex min-h-screen w-full">

          <div className="hidden w-[240px] shrink-0 lg:block">
            <div className="fixed top-0 left-0 h-screen w-[240px]">
              <AdminSidebar />
            </div>
          </div>

          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/70 lg:hidden"
                  onClick={() => setMobileOpen(false)}
                />
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "tween", duration: 0.24 }}
                  className="fixed inset-y-0 left-0 z-50 w-[260px] lg:hidden"
                >
                  <AdminSidebar onNavigate={() => setMobileOpen(false)} />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <main className="flex-1 lg:pl-[240px]">
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-[#050810]/80 px-4 py-3 backdrop-blur lg:hidden">
              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-md border border-white/10 p-2"
                aria-label="Abrir menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="text-sm font-semibold">Admin Panel</div>
            </header>
            <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AdminPanelUIContext.Provider>
  );
}
