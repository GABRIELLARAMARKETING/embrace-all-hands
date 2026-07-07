import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/** Fake-live counter of concurrent matches. Drifts every few seconds. */
export function LiveCounter() {
  const [count, setCount] = useState(852);

  useEffect(() => {
    const t = setInterval(() => {
      setCount(() => 820 + Math.floor(Math.random() * 80));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="mx-auto flex h-11 w-[90%] max-w-[575px] items-center justify-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5">
        <motion.span
          className="absolute inset-0 rounded-full bg-emerald-400"
          animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <span className="relative m-auto h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.9)]" />
      </span>
      <span className="text-sm font-medium tracking-tight">
        <span className="font-bold tabular-nums">{count}</span> partidas ao vivo agora
      </span>
    </motion.div>
  );
}
