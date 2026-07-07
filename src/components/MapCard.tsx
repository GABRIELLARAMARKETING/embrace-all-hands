import { motion } from "framer-motion";
import type { MapTheme } from "@/data/themes";
import { MapPreview } from "./MapPreview";

interface Props {
  theme: MapTheme;
  role: "center" | "near" | "far";
  offset: number; // -2..2
  onClick?: () => void;
}

const SIZE = {
  center: { w: 175, h: 305, scale: 1, opacity: 1, blur: 0 },
  near: { w: 140, h: 240, scale: 0.92, opacity: 0.75, blur: 0.5 },
  far: { w: 110, h: 190, scale: 0.82, opacity: 0.45, blur: 1.5 },
} as const;

export function MapCard({ theme, role, offset, onClick }: Props) {
  const s = SIZE[role];
  const isCenter = role === "center";
  const xPx = offset * 130; // horizontal spread

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={`Selecionar mapa ${theme.label}`}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
      style={{ zIndex: isCenter ? 30 : 20 - Math.abs(offset) }}
      initial={false}
      animate={{
        x: `calc(-50% + ${xPx}px)`,
        y: "-50%",
        scale: s.scale,
        opacity: s.opacity,
        filter: `blur(${s.blur}px)`,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      <motion.div
        animate={
          isCenter
            ? { y: [0, -6, 0] }
            : { y: 0 }
        }
        transition={
          isCenter
            ? { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
        className="relative overflow-hidden rounded-[20px]"
        style={{
          width: s.w,
          height: s.h,
          border: `2px solid ${isCenter ? "#a855f7" : "rgba(168,85,247,0.35)"}`,
          boxShadow: isCenter
            ? "0 20px 60px -10px rgba(168,85,247,0.65), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 40px rgba(168,85,247,0.35)"
            : "0 10px 30px -12px rgba(0,0,0,0.6)",
        }}
      >
        <MapPreview theme={theme} intensity={isCenter ? 1 : 0.7} />
        {!isCenter && <div className="absolute inset-0 bg-black/25" />}
      </motion.div>
    </motion.button>
  );
}
