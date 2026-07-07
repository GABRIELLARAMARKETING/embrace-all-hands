import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function FloatingChatButton() {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() =>
        toast("Suporte", {
          description: "Em breve — o chat de suporte será integrado aqui.",
        })
      }
      aria-label="Abrir chat de suporte"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--admin-blue)] text-white shadow-[0_15px_35px_-8px_rgba(59,130,246,0.6)] hover:bg-[#2563eb]"
    >
      <MessageCircle size={24} />
    </motion.button>
  );
}
