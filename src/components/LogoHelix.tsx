import { motion } from "framer-motion";
import logoAsset from "@/assets/helixfast-logo.png.asset.json";

interface Props {
  className?: string;
}

/**
 * HelixFast brand logo. Uses the official CDN-hosted PNG so it stays crisp
 * and consistent everywhere in the app.
 */
export function LogoHelix({ className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className={"relative inline-block " + (className ?? "")}
      aria-label="HelixFast"
    >
      <img
        src={logoAsset.url}
        alt="HelixFast"
        className="w-[110px] sm:w-[130px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)] select-none"
        draggable={false}
      />
    </motion.div>
  );
}
