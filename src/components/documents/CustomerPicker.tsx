import { useEffect, useId, useRef, useState } from "react";
import { Home, Search, X } from "lucide-react";
import { customersApi } from "../../api/customers";
import { ApiError } from "../../lib/apiClient";
import type { Customer } from "../../lib/types";
import { Badge, Button, Input, Spinner } from "../ui/ui";

const SEARCH_DEBOUNCE_MS = 250;
const RESULT_LIMIT = 8;

function contactLine(c: Customer) {
  return [c.email, c.phone].filter(Boolean).join(" · ") || "No contact details";
}

/**
 * Search-as-you-type customer selector. Shows whether a customer is also a tenant,
 * but any customer can be chosen: documents never require a tenant.
 */
export function CustomerPicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  invalid?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (value) return;
    const timer = window.setTimeout(async () => {
      const reqId = ++requestId.current;
      setIsLoading(true);
      setError(null);
      try {
        const page = await customersApi.listPage(query.trim() || undefined, RESULT_LIMIT, 0, { status: "active" });
        if (reqId === requestId.current) setResults(page.items);
      } catch (err) {
        if (reqId === requestId.current) setError(err instanceof ApiError ? err.message : "Could not search customers.");
      } finally {
        if (reqId === requestId.current) setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  if (value) {
    return (
      <div className="picker-selected">
        <div>
          <strong>{value.name}</strong>
          {value.renter_id && (
            <Badge tone="info" icon={Home}>
              Tenant
            </Badge>
          )}
          <div className="muted-text">{contactLine(value)}</div>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="picker">
      <div className="search-input">
        <Search size={16} aria-hidden />
        <Input
          id={id}
          type="search"
          placeholder="Search by name, email or phone"
          autoComplete="off"
          value={query}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="picker-results" id={listId} aria-live="polite">
        {isLoading && <Spinner label="Searching…" />}
        {!isLoading && error && <p className="field-error">{error}</p>}
        {!isLoading && !error && results.length === 0 && (
          <p className="muted-text">{query ? "No customers match. Use “New” to add one." : "No customers yet."}</p>
        )}
        {!isLoading &&
          results.map((c) => (
            <button key={c.id} type="button" className="picker-option" onClick={() => onChange(c)}>
              <span>
                <strong>{c.name}</strong>
                <span className="muted-text">{contactLine(c)}</span>
              </span>
              {c.renter_id && (
                <Badge tone="info" icon={Home}>
                  Tenant
                </Badge>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}
