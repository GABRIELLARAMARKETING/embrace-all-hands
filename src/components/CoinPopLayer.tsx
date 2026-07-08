import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Pop {
  id: number;
  value: number;
  x: number; // percentual horizontal (0-100)
}

let seq = 0;

export function spawnCoinPop(value: number) {
  window.dispatchEvent(
    new CustomEvent<{ value: number }>("coin-pop", { detail: { value } }),
  );
}

export function CoinPopLayer() {
  const [pops, setPops] = useState<Pop[]>([]);

  useEffect(() => {
    const onPop = (e: Event) => {
      const detail = (e as CustomEvent<{ value: number }>).detail;
      const id = ++seq;
      const x = 42 + Math.random() * 16; // 42%-58% (perto do centro)
      setPops((prev) => [...prev, { id, value: detail.value, x }]);
      window.setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.id !== id));
      }, 1300);
    };
    window.addEventListener("coin-pop", onPop);
    return () => window.removeEventListener("coin-pop", onPop);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {pops.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 1, y: -180, scale: 1 }}
            exit={{ opacity: 0, y: -230, scale: 0.9 }}
            transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute flex flex-col items-center"
            style={{ left: `${p.x}%`, top: "62%", transform: "translateX(-50%)" }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 shadow-[0_4px_14px_rgba(0,0,0,0.35),inset_0_-2px_0_rgba(0,0,0,0.15)] ring-2 ring-amber-200/70">
              <span className="text-lg font-black text-amber-900 drop-shadow-sm">
                $
              </span>
            </div>
            <div className="mt-1 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-black text-white shadow-md">
              +R$ {p.value.toFixed(2).replace(".", ",")}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
