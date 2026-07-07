import { motion } from "framer-motion";

interface Props {
  className?: string;
}

/**
 * Stylized "Helix Multi" logo built purely in SVG so it renders crisp at any
 * size and never depends on an external asset. Includes a small red "x20" seal.
 */
export function LogoHelix({ className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className={"relative inline-block " + (className ?? "")}
      aria-label="Helix Multi"
    >
      <svg
        viewBox="0 0 220 130"
        className="w-[100px] sm:w-[120px] drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
      >
        <defs>
          <linearGradient id="helix-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eaf6ff" />
            <stop offset="55%" stopColor="#9fd3ff" />
            <stop offset="100%" stopColor="#4a8dd8" />
          </linearGradient>
          <linearGradient id="multi-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd58a" />
            <stop offset="100%" stopColor="#ff7a1a" />
          </linearGradient>
        </defs>

        <g
          style={{
            fontFamily:
              "Poppins, Montserrat, Inter, ui-sans-serif, system-ui, sans-serif",
            fontWeight: 900,
            letterSpacing: -1.2,
          }}
        >
          <text
            x="110"
            y="62"
            textAnchor="middle"
            fontSize="52"
            fill="url(#helix-fill)"
            stroke="#0b0018"
            strokeWidth="4"
            paintOrder="stroke"
          >
            Helix
          </text>
          <text
            x="110"
            y="108"
            textAnchor="middle"
            fontSize="34"
            fill="url(#multi-fill)"
            stroke="#2a0a04"
            strokeWidth="3"
            paintOrder="stroke"
            letterSpacing="4"
          >
            MULTI
          </text>
        </g>
      </svg>

      <span
        className="absolute -top-1 -right-2 rounded-full bg-red-600 px-2 py-[2px] text-[10px] font-black text-white shadow-[0_4px_12px_rgba(220,20,40,0.6)] ring-1 ring-white/30"
        aria-hidden
      >
        x20
      </span>
    </motion.div>
  );
}
