import { motion } from "framer-motion";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  full?: boolean;
}

export function PrimaryButton({ className, children, full, ...rest }: Props) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      animate={{
        boxShadow: [
          "0 10px 30px -6px rgba(8,217,139,0.55), 0 0 0 0 rgba(8,217,139,0.4)",
          "0 14px 40px -6px rgba(8,217,139,0.75), 0 0 0 8px rgba(8,217,139,0.0)",
          "0 10px 30px -6px rgba(8,217,139,0.55), 0 0 0 0 rgba(8,217,139,0.4)",
        ],
      }}
      transition={{
        boxShadow: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
      }}
      className={cn(
        "mx-auto block h-[64px] sm:h-[76px] rounded-full font-extrabold text-white text-xl sm:text-2xl tracking-wide",
        "bg-gradient-to-b from-[#0ee08f] to-[#05c47a] hover:from-[#12f39c] hover:to-[#07d386]",
        full ? "w-full max-w-[295px]" : "w-[80%] max-w-[295px]",
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
