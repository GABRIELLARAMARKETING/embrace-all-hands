import { useGameStore } from "@/store/useGameStore";
import { Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

export function GameHUD({ showHint }: { showHint: boolean }) {
  const combo = useGameStore((s) => s.combo);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);

  return (
    <>
      {/* Combo chip */}
      {combo > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-4">
          <motion.div
            key={combo}
            initial={{ scale: 0.7, opacity: 0, y: -6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="mx-auto w-fit rounded-full bg-fuchsia-500/85 px-4 py-1 text-xs font-black tracking-[0.2em] text-white shadow-lg backdrop-blur"
          >
            COMBO x{combo}
          </motion.div>
        </div>
      )}



      {/* Floating sound toggle */}
      <button
        onClick={toggleSound}
        className="pointer-events-auto absolute bottom-5 right-5 z-20 rounded-full border border-white/20 bg-white/20 p-3 text-white backdrop-blur-md hover:bg-white/30"
        aria-label="Som"
      >
        {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>

      {/* Drag hint */}
      {showHint && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center text-sm font-semibold tracking-wide text-white/85 drop-shadow"
        >
          ← Arraste para girar a torre →
        </motion.div>
      )}

      <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 text-center text-[10px] uppercase tracking-[0.25em] text-white/40">
        Moedas virtuais — sem dinheiro real
      </p>
    </>
  );
}
