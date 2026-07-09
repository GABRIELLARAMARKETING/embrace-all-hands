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
  center: { w: 260, h: 260, scale: 1, opacity: 1, blur: 0, spacing: 200 },
  near: { w: 220, h: 220, scale: 0.92, opacity: 0.75, blur: 0.5, spacing: 200 },
  far: { w: 180, h: 180, scale: 0.82, opacity: 0.45, blur: 1.5, spacing: 200 },
} as const;

const SIZE_MOBILE = {
  center: { w: 200, h: 200, scale: 1, opacity: 1, blur: 0, spacing: 150 },
  near: { w: 170, h: 170, scale: 0.9, opacity: 0.7, blur: 0.5, spacing: 150 },
  far: { w: 140, h: 140, scale: 0.78, opacity: 0.35, blur: 1.5, spacing: 150 },
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
      className="absolute left-1/2 top-1/2 focus:outline-none"
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
          boxShadow: isCenter
            ? `0 20px 60px -10px ${glow}55`
            : "0 10px 30px -12px rgba(0,0,0,0.6)",
        }}

      >
        <MapPreview preview={theme.preview_config} intensity={isCenter ? 1 : 0.7} />
        {!isCenter && <div className="absolute inset-0 bg-black/25" />}
      </motion.div>
    </motion.button>
  );
}
