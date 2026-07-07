import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  suffix?: ReactNode;
}

export const AdminInput = forwardRef<HTMLInputElement, Props>(function AdminInput(
  { label, hint, error, suffix, className, id, ...rest },
  ref,
) {
  const inputId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-text-3)]"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center rounded-[10px] border bg-[color:var(--admin-input)] px-3 h-11 transition-colors",
          error
            ? "border-[color:var(--admin-red)]"
            : "border-[color:var(--admin-border)] focus-within:border-[color:var(--admin-green)]",
        )}
      >
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex-1 bg-transparent text-sm text-white placeholder:text-[color:var(--admin-text-3)] outline-none",
            className,
          )}
          {...rest}
        />
        {suffix && (
          <span className="ml-2 text-sm text-[color:var(--admin-text-2)]">{suffix}</span>
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-[color:var(--admin-text-3)]">{hint}</p>
      )}
      {error && <p className="text-xs text-[color:var(--admin-red)]">{error}</p>}
    </div>
  );
});
