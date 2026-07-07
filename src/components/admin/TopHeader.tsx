import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useAdminUI } from "@/routes/admin";

interface Props {
  title: string;
  subtitle?: string;
  context?: ReactNode;
}

export function TopHeader({ title, subtitle, context }: Props) {
  const { openMobileMenu } = useAdminUI();

  return (
    <header className="border-b border-[color:var(--admin-line)] bg-[color:var(--admin-bg)]/60 px-4 pb-4 pt-4 backdrop-blur sm:px-6">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button
          type="button"
          onClick={openMobileMenu}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-card)] text-[color:var(--admin-text-2)] lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[color:var(--admin-text-2)]">{subtitle}</p>
          )}
          {context && (
            <p className="mt-2 text-xs text-[color:var(--admin-text-3)]">{context}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-[color:var(--admin-text-2)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--admin-neon)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--admin-neon)]" />
          </span>
          Online
        </div>
      </div>
    </header>
  );
}
