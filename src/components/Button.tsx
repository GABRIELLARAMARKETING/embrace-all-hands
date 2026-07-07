import { motion } from "framer-motion";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { SFX } from "@/utils/sound";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", onClick, children, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={(e) => {
        SFX.click();
        onClick?.(e);
      }}
      className={cn(
        "min-h-11 rounded-2xl px-6 py-3 text-sm font-bold tracking-tight transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        variant === "primary" &&
          "bg-white text-slate-900 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)] hover:bg-white/90",
        variant === "ghost" &&
          "bg-white/15 text-white backdrop-blur-md hover:bg-white/25 border border-white/20",
        variant === "danger" &&
          "bg-rose-500 text-white hover:bg-rose-600 shadow-[0_10px_30px_-8px_rgba(244,63,94,0.5)]",
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
});
