import type { ReactNode } from "react";
import { AdminCard } from "./AdminCard";

interface Props {
  label: string;
  value: ReactNode;
  description?: string;
}

export function StatCard({ label, value, description }: Props) {
  return (
    <AdminCard className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-text-3)]">
        {label}
      </span>
      <span className="text-3xl font-bold tracking-tight text-white">{value}</span>
      {description && (
        <span className="text-sm text-[color:var(--admin-text-2)]">{description}</span>
      )}
    </AdminCard>
  );
}
