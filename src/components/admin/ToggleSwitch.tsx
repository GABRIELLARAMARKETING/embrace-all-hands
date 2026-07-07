import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: "green" | "blue";
  label?: string;
  id?: string;
}

export function ToggleSwitch({ checked, onChange, color = "green", label, id }: Props) {
  const activeBg =
    color === "green"
      ? "bg-[color:var(--admin-green)]"
      : "bg-[color:var(--admin-blue)]";
  return (
    <label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center gap-3 select-none"
    >
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? activeBg : "bg-[color:var(--admin-border)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
      {label && (
        <span className="text-sm text-[color:var(--admin-text-2)]">{label}</span>
      )}
    </label>
  );
}
