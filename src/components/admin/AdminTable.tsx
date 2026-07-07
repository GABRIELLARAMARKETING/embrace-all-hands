import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  className?: string;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  emptyState: ReactNode;
  getRowKey?: (row: T, index: number) => string;
}

export function AdminTable<T>({ columns, rows, emptyState, getRowKey }: Props<T>) {
  if (rows.length === 0) return <>{emptyState}</>;
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[color:var(--admin-border)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[color:var(--admin-input)]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-text-3)]"
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={getRowKey ? getRowKey(row, i) : i}
              className="border-t border-[color:var(--admin-border)] transition-colors hover:bg-white/[0.02]"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={"px-4 py-3 text-[color:var(--admin-text-2)] " + (c.className || "")}
                >
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
