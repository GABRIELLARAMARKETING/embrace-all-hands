import { formatCurrency } from "@/utils/formatCurrency";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  className?: string;
  positive?: boolean;
}

export function MoneyValue({ value, className, positive }: Props) {
  return (
    <span
      className={cn(
        "font-semibold tracking-tight",
        positive ? "text-[color:var(--admin-neon)]" : "text-white",
        className,
      )}
    >
      {formatCurrency(value)}
    </span>
  );
}
