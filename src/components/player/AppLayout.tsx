import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Wallet, ArrowUpFromLine, Users, User, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  title?: string;
  children: ReactNode;
}

const NAV: ReadonlyArray<{ to: string; label: string; icon: typeof Wallet; center?: boolean }> = [
  { to: "/app/depositar", label: "Depositar", icon: Wallet },
  { to: "/app/sacar", label: "Sacar", icon: ArrowUpFromLine },
  { to: "/app/jogar", label: "Jogar", icon: RotateCw, center: true },
  { to: "/app/indicar", label: "Indicar", icon: Users },
  { to: "/app/perfil", label: "Perfil", icon: User },
];

export function AppLayout({ title, children }: AppLayoutProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="player-scroll text-white antialiased" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {title && (
        <header className="sticky top-0 z-30 px-5 pt-5 pb-3 bg-gradient-to-b from-[#0B0416]/95 to-transparent backdrop-blur-sm">
          <h1 className="text-center text-lg font-bold tracking-tight text-white">{title}</h1>
        </header>
      )}
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto w-full max-w-[460px] px-4 pb-32"
      >
        {children}
      </motion.main>
      <BottomNav pathname={pathname} />
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[460px] -translate-x-1/2 border-t border-white/5 bg-[#0B0416]/95 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="relative grid grid-cols-5 items-end px-3 pt-2 pb-2">
        {NAV.map((item) => {
          const active = pathname === item.to || (item.to === "/app/indicar" && pathname.startsWith("/app/indicar"));
          const Icon = item.icon;
          if (item.center) {
            return (
              <li key={item.to} className="flex justify-center">
                <Link
                  to={item.to}
                  aria-label={item.label}
                  className="group -translate-y-5 flex flex-col items-center gap-1"
                >
                  <span
                    className={cn(
                      "grid h-16 w-16 place-items-center rounded-full",
                      "bg-gradient-to-br from-[#A855F7] to-[#EC5FA3]",
                      "shadow-[0_0_28px_rgba(168,85,247,0.65)] ring-4 ring-[#0B0416]",
                      "transition-transform active:scale-95",
                    )}
                  >
                    <Icon className="h-7 w-7 text-white" strokeWidth={2.5} />
                  </span>
                  <span className="text-[11px] font-medium text-white/70">{item.label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.to} className="flex justify-center">
              <Link
                to={item.to}
                aria-label={item.label}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 transition-colors",
                  active ? "bg-white/5" : "hover:bg-white/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl",
                    active
                      ? "bg-gradient-to-br from-[#A855F7]/25 to-[#EC5FA3]/25 text-[#EC5FA3]"
                      : "text-white/60",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className={cn("text-[11px]", active ? "font-semibold text-white" : "text-white/60")}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PlayerCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/5 bg-[#1a0a30]/70 backdrop-blur-md shadow-[0_10px_40px_-15px_rgba(168,85,247,0.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GradientButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "w-full rounded-full py-4 text-base font-bold text-white",
        "bg-gradient-to-r from-[#A855F7] via-[#C93FBE] to-[#EC5FA3]",
        "shadow-[0_10px_30px_-10px_rgba(236,95,163,0.7)]",
        "transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
        className,
      )}
    >
      {children}
    </button>
  );
}
