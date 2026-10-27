import { useEffect } from "react";

const APP_NAME = "Receipt Portal";

// Set from AccessContext once the member's business is known, so tabs read "Page · Business".
let siteName = APP_NAME;
const listeners = new Set<() => void>();

export function setSiteName(name: string | null | undefined) {
  siteName = name?.trim() || APP_NAME;
  listeners.forEach((refresh) => refresh());
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const apply = () => {
      document.title = title ? `${title} · ${siteName}` : siteName;
    };
    apply();
    listeners.add(apply);
    return () => {
      listeners.delete(apply);
    };
  }, [title]);
}
