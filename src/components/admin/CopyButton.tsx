import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyToClipboard } from "@/utils/clipboard";
import { AdminButton } from "./AdminButton";
import { toast } from "sonner";

interface Props {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = "Copiar" }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <AdminButton
      type="button"
      variant="primary"
      leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}
      onClick={async () => {
        const ok = await copyToClipboard(value);
        if (ok) {
          setCopied(true);
          toast.success("Copiado!");
          setTimeout(() => setCopied(false), 1600);
        } else {
          toast.error("Não foi possível copiar");
        }
      }}
    >
      {copied ? "Copiado!" : label}
    </AdminButton>
  );
}
