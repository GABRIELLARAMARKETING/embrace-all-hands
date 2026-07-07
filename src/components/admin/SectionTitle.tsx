interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function SectionTitle({ title, subtitle, right }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[color:var(--admin-text-2)]">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
