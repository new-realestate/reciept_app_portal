import { Spinner } from "./ui/ui";

/** Shown while a page's code is downloading (first visit only). */
export function PageLoading() {
  return (
    <div className="full-page-center">
      <Spinner label="Loading…" />
    </div>
  );
}
