import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  message?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ message = "Nada por aqui ainda", icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-[color:var(--admin-border)] bg-[color:var(--admin-input)]/40 py-12 text-center">
      <div className="text-[color:var(--admin-text-3)]">
        {icon ?? <Inbox size={28} />}
      </div>
      <p className="text-sm text-[color:var(--admin-text-3)]">{message}</p>
    </div>
  );
}
