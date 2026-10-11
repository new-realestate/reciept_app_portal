import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button, ErrorState, Skeleton } from "./ui";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "start" | "end";
  /** Marks the trailing action-menu column (no header text shown). */
  actions?: boolean;
}

type SortState = { key: string; direction: "asc" | "desc" } | null;

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  empty,
  pageSize = 10,
  itemLabel = "items",
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty: ReactNode;
  pageSize?: number;
  itemLabel?: string;
}) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const get = column.sortValue;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  if (!isLoading && rows.length === 0) return <>{empty}</>;

  return (
    <>
      <div className="table-scroll">
        <table className="data-table" aria-busy={isLoading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key ? sort.direction : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.align === "end" ? "cell-end" : undefined}
                    aria-sort={active ? (active === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {c.actions ? (
                      <span className="sr-only">Actions</span>
                    ) : c.sortValue ? (
                      <button type="button" className="sort-btn" onClick={() => toggleSort(c.key)}>
                        {c.header}
                        {active === "asc" ? (
                          <ArrowUp size={13} aria-hidden />
                        ) : active === "desc" ? (
                          <ArrowDown size={13} aria-hidden />
                        ) : (
                          <ChevronsUpDown size={13} aria-hidden />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {columns.map((c) => (
                      <td key={c.key} data-label={c.header}>
                        <Skeleton width={c.actions ? "24px" : "80%"} />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row) => (
                  <tr key={rowKey(row)}>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        data-label={c.actions ? "" : c.header}
                        className={c.actions ? "cell-actions" : c.align === "end" ? "cell-end" : undefined}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!isLoading && sorted.length > pageSize && (
        <div className="table-footer">
          <span aria-live="polite">
            Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}{" "}
            {itemLabel}
          </span>
          <div className="row-actions">
            <Button variant="secondary" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
