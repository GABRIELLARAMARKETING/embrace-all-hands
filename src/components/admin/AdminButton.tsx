import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "blue";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0";

const sizeMap: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

const variantMap: Record<Variant, string> = {
  primary:
    "bg-[color:var(--admin-green)] hover:bg-[color:var(--admin-green-hover)] text-white shadow-[0_6px_20px_-6px_rgba(34,197,94,0.6)] focus-visible:ring-[color:var(--admin-neon)]",
  secondary:
    "bg-[color:var(--admin-input)] hover:bg-[#232535] text-[color:var(--admin-text)] border border-[color:var(--admin-border)]",
  ghost:
    "bg-transparent hover:bg-white/5 text-[color:var(--admin-text-2)] border border-transparent",
  danger:
    "bg-[color:var(--admin-red)] hover:bg-[#dc2626] text-white",
  blue: "bg-[color:var(--admin-blue)] hover:bg-[#2563eb] text-white",
};

export const AdminButton = forwardRef<HTMLButtonElement, Props>(function AdminButton(
  {
    variant = "primary",
    size = "md",
    className,
    children,
    leftIcon,
    rightIcon,
    loading,
    fullWidth,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.98 }}
      disabled={disabled || loading}
      className={cn(
        base,
        sizeMap[size],
        variantMap[variant],
        fullWidth && "w-full",
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {leftIcon}
      <span>{loading ? "Processando..." : children}</span>
      {rightIcon}
    </motion.button>
  );
});
