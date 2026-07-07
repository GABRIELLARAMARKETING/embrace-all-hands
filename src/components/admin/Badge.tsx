import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "green" | "neutral" | "blue" | "purple" | "red";

interface Props {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

const toneMap: Record<Tone, string> = {
  green: "bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)] border-[color:var(--admin-green)]/30",
  neutral: "bg-white/5 text-[color:var(--admin-text-2)] border-[color:var(--admin-border)]",
  blue: "bg-[color:var(--admin-blue)]/15 text-[color:var(--admin-blue)] border-[color:var(--admin-blue)]/30",
  purple: "bg-[color:var(--admin-purple)]/15 text-[color:var(--admin-purple)] border-[color:var(--admin-purple)]/30",
  red: "bg-[color:var(--admin-red)]/15 text-[color:var(--admin-red)] border-[color:var(--admin-red)]/30",
};

export function Badge({ children, tone = "neutral", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        toneMap[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
