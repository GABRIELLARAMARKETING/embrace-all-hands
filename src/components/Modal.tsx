import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
}

export function Modal({ open, title, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-full max-w-md rounded-3xl bg-slate-900/85 backdrop-blur-xl border border-white/10 p-6 text-white shadow-2xl"
          >
            {title && (
              <h2 className="mb-4 text-2xl font-bold tracking-tight">{title}</h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
