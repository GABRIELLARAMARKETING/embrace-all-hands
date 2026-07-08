import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Home,
  LogOut,
  Settings2,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";


interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const items: NavItem[] = [
  { to: "/gerente/painel", label: "Painel", icon: <Home size={18} /> },
  { to: "/gerente/saques", label: "Saques (admin)", icon: <ShieldCheck size={18} /> },
  { to: "/gerente/gerentes", label: "Gerentes", icon: <Users size={18} /> },
  { to: "/gerente/criar-demo", label: "Criar Demo", icon: <Sparkles size={18} /> },
  { to: "/gerente/indicar", label: "Indicar", icon: <UserPlus size={18} /> },
  { to: "/gerente/indicados", label: "Indicados", icon: <Users size={18} /> },
  { to: "/gerente/meus-saques", label: "Meus Saques", icon: <Wallet size={18} /> },
  {
    to: "/gerente/ajustes-indicados",
    label: "Ajustes indicados",
    icon: <Settings2 size={18} />,
  },
  { to: "/gerente/notificacoes", label: "Notificações", icon: <Bell size={18} /> },
];


interface Props {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: Props) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate?.();
    navigate({ to: "/gerente/login" });
  };


  return (
    <aside className="flex h-full w-full flex-col border-r border-[color:var(--admin-line)] bg-[color:var(--admin-sidebar)]">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight leading-none">
            <span className="text-white">Gerente</span>{" "}
            <span className="text-[color:var(--admin-neon)]">Helix</span>
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[color:var(--admin-text-3)]">
            Painel Gerente
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[color:var(--admin-green)]/12 text-[color:var(--admin-neon)]"
                  : "text-[color:var(--admin-text-2)] hover:bg-white/[0.04] hover:text-white",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[color:var(--admin-neon)]" />
              )}
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-md",
                  active
                    ? "bg-[color:var(--admin-green)]/15"
                    : "bg-white/[0.03] group-hover:bg-white/[0.06]",
                )}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[color:var(--admin-line)] p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[color:var(--admin-text-2)] transition-colors hover:bg-[color:var(--admin-red)]/10 hover:text-[color:var(--admin-red)]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-white/[0.03]">
            <LogOut size={18} />
          </span>
          Sair
        </button>
      </div>

    </aside>
  );
}
