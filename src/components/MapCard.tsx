import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import type { GameTheme } from "@/types/theme";
import { MapPreview } from "./MapPreview";

interface Props {
  theme: GameTheme;
  role: "center" | "near" | "far";
  offset: number;
  onClick?: () => void;
}

const SIZE_DESKTOP = {
  center: { w: 175, h: 305, scale: 1, opacity: 1, blur: 0, spacing: 130 },
  near: { w: 140, h: 240, scale: 0.92, opacity: 0.75, blur: 0.5, spacing: 130 },
  far: { w: 110, h: 190, scale: 0.82, opacity: 0.45, blur: 1.5, spacing: 130 },
} as const;

const SIZE_MOBILE = {
  center: { w: 128, h: 220, scale: 1, opacity: 1, blur: 0, spacing: 92 },
  near: { w: 104, h: 178, scale: 0.9, opacity: 0.7, blur: 0.5, spacing: 92 },
  far: { w: 82, h: 140, scale: 0.78, opacity: 0.35, blur: 1.5, spacing: 92 },
} as const;

export function MapCard({ theme, role, offset, onClick }: Props) {
  const isMobile = useIsMobile();
  const SIZE = isMobile ? SIZE_MOBILE : SIZE_DESKTOP;
  const s = SIZE[role];
  const isCenter = role === "center";
  const xPx = offset * s.spacing;
  const glow = theme.preview_config.cardGlow ?? "#a855f7";

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
        animate={isCenter ? { y: [0, -6, 0] } : { y: 0 }}
        transition={
          isCenter
            ? { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
        className="relative overflow-hidden rounded-[20px]"
        style={{
          width: s.w,
          height: s.h,
          border: `2px solid ${isCenter ? glow : "rgba(168,85,247,0.35)"}`,
          boxShadow: isCenter
            ? `0 20px 60px -10px ${glow}, 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 40px ${glow}55`
            : "0 10px 30px -12px rgba(0,0,0,0.6)",
        }}
      >
        <MapPreview preview={theme.preview_config} intensity={isCenter ? 1 : 0.7} />
        {!isCenter && <div className="absolute inset-0 bg-black/25" />}
      </motion.div>
    </motion.button>
  );
}
