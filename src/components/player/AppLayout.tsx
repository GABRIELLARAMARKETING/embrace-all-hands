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

const EASE = [0.22, 1, 0.36, 1] as const;

export function AppLayout({ title, children }: AppLayoutProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div
      className="player-scroll text-white antialiased selection:bg-[#EC5FA3]/40 selection:text-white"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {title && (
        <header className="sticky top-0 z-30 px-5 pt-6 pb-4 bg-gradient-to-b from-[#0B0416]/95 via-[#0B0416]/70 to-transparent backdrop-blur-xl">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="text-center text-[17px] font-semibold tracking-[-0.01em] text-white"
          >
            {title}
          </motion.h1>
          <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </header>
      )}
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="mx-auto w-full max-w-[460px] px-4 pb-36"
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
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[460px] -translate-x-1/2 border-t border-white/[0.06] bg-[#0B0416]/85 backdrop-blur-2xl shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.6)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <ul className="relative grid grid-cols-5 items-end px-3 pt-2 pb-2">
        {NAV.map((item) => {
          const active =
            pathname === item.to || (item.to === "/app/indicar" && pathname.startsWith("/app/indicar"));
          const Icon = item.icon;
          if (item.center) {
            return (
              <li key={item.to} className="flex justify-center">
                <Link
                  to={item.to}
                  aria-label={item.label}
                  className="group -translate-y-5 flex flex-col items-center gap-1.5 outline-none"
                >
                  <span
                    className={cn(
                      "relative grid h-[62px] w-[62px] place-items-center rounded-full",
                      "bg-gradient-to-br from-[#B266FF] via-[#C93FBE] to-[#EC5FA3]",
                      "shadow-[0_10px_28px_-6px_rgba(201,63,190,0.65),0_0_0_4px_#0B0416,inset_0_1px_0_rgba(255,255,255,0.35)]",
                      "transition-all duration-300 ease-out",
                      "group-hover:scale-[1.04] group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-white/40",
                    )}
                  >
                    <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent opacity-70" />
                    <Icon className="relative h-7 w-7 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" strokeWidth={2.4} />
                  </span>
                  <span className="text-[10.5px] font-medium tracking-wide text-white/70">
                    {item.label}
                  </span>
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
                  "flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 outline-none transition-all duration-200 ease-out",
                  "focus-visible:ring-2 focus-visible:ring-[#EC5FA3]/60",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl transition-all duration-300 ease-out",
                    active
                      ? "bg-gradient-to-br from-[#A855F7]/25 to-[#EC5FA3]/25 text-[#EC5FA3] shadow-[inset_0_0_0_1px_rgba(236,95,163,0.25)]"
                      : "text-white/55 hover:text-white/85 hover:bg-white/[0.04]",
                  )}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={2.2} />
                </span>
                <span
                  className={cn(
                    "text-[10.5px] tracking-wide transition-colors",
                    active ? "font-semibold text-white" : "text-white/55",
                  )}
                >
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
        "relative rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#1e0b36]/80 to-[#160828]/70 backdrop-blur-xl",
        "shadow-[0_20px_60px_-25px_rgba(168,85,247,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]",
        "before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent",
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
        "relative w-full overflow-hidden rounded-full py-4 text-[15px] font-semibold tracking-wide text-white outline-none",
        "bg-gradient-to-r from-[#A855F7] via-[#C93FBE] to-[#EC5FA3]",
        "shadow-[0_14px_34px_-12px_rgba(236,95,163,0.7),inset_0_1px_0_rgba(255,255,255,0.28)]",
        "transition-all duration-300 ease-out hover:brightness-[1.06] hover:-translate-y-[1px]",
        "active:translate-y-0 active:brightness-95 active:scale-[0.99]",
        "focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0416]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:brightness-100",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent opacity-80" />
      <span className="relative">{children}</span>
    </button>
  );
}
