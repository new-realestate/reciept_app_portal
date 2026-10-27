import { useMemo, useState, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";
import { prefetchPath } from "../../lib/detailQueries";
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

// Clicks on these keep their own behaviour instead of opening the row.
const INTERACTIVE = "a, button, input, select, textarea, label, summary, [role='menu'], [role='menuitem'], [role='button']";

/**
 * Makes the whole row open the row's primary link (the `.table-link` a page puts in a cell).
 * The link itself stays the keyboard/screen-reader target; this only widens the mouse target.
 */
/** Starts loading the row's page while the pointer is over it, so the click opens faster. */
function prefetchRow(e: SyntheticEvent<HTMLTableRowElement>) {
  const link = e.currentTarget.querySelector<HTMLAnchorElement>("a.table-link[href]");
  if (link) prefetchPath(link.pathname);
}

function openRowLink(e: MouseEvent<HTMLTableRowElement>) {
  if (e.button > 1) return; // right-click: leave the context menu alone
  const target = e.target as HTMLElement;
  if (target.closest(INTERACTIVE)) return;
  if (window.getSelection()?.toString()) return; // the user is selecting text to copy
  const link = e.currentTarget.querySelector<HTMLAnchorElement>("a.table-link[href]");
  if (!link) return;
  if (e.button === 1 || e.ctrlKey || e.metaKey) {
    window.open(link.href, "_blank", "noopener");
  } else {
    link.click(); // goes through the router link, so it navigates in-app
  }
}

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
  serverPaging,
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
  /** When set, `rows` is already one server-side page and the footer pages through the server. */
  serverPaging?: {
    total: number;
    offset: number;
    limit: number;
    onOffsetChange: (offset: number) => void;
    /** Lets the user choose rows per page; the page resets to the first. */
    onLimitChange?: (limit: number) => void;
  };
}) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [localSize, setLocalSize] = useState(pageSize);

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

  const effectivePageSize = serverPaging ? serverPaging.limit : localSize;
  const totalCount = serverPaging ? serverPaging.total : sorted.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const safePage = serverPaging ? Math.floor(serverPaging.offset / effectivePageSize) : Math.min(page, pageCount - 1);
  const visible = serverPaging ? sorted : sorted.slice(safePage * effectivePageSize, safePage * effectivePageSize + effectivePageSize);

  function changePageSize(next: number) {
    if (serverPaging) serverPaging.onLimitChange?.(next);
    else {
      setLocalSize(next);
      setPage(0);
    }
  }
  const sizeOptions = [...new Set([effectivePageSize, 10, 25, 50, 100])].sort((a, b) => a - b);
  const canChangeSize = serverPaging ? Boolean(serverPaging.onLimitChange) : true;

  function goToPage(next: number) {
    if (serverPaging) serverPaging.onOffsetChange(next * serverPaging.limit);
    else setPage(next);
  }

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
                    ) : c.sortValue && !serverPaging ? (
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
                <tr key={rowKey(row)} onClick={openRowLink} onAuxClick={openRowLink} onMouseEnter={prefetchRow} onFocus={prefetchRow}>
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

      {!isLoading && totalCount > 0 && (
        <div className="table-footer">
          <span aria-live="polite">
            Showing {safePage * effectivePageSize + 1}–{Math.min((safePage + 1) * effectivePageSize, totalCount)} of{" "}
            {totalCount} {itemLabel} · Page {safePage + 1} of {pageCount}
          </span>
          <div className="row-actions">
            {canChangeSize && (
              <label className="page-size">
                <span>Rows per page</span>
                <select className="input" value={effectivePageSize} onChange={(e) => changePageSize(Number(e.target.value))}>
                  {sizeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button variant="secondary" size="sm" disabled={safePage === 0} onClick={() => goToPage(safePage - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => goToPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
