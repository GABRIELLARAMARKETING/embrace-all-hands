import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "sm" | "md" | "lg";
}

const paddingMap = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function AdminCard({ children, className, padding = "lg", ...rest }: Props) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-[color:var(--admin-border)] bg-[color:var(--admin-card)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
        paddingMap[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
