import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
// Errors stay a little longer; hovering or focusing a toast pauses its timer.
const DURATION_MS: Record<ToastKind, number> = { success: 4500, info: 4500, error: 8000 };

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const Icon = ICONS[toast.kind];

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), DURATION_MS[toast.kind]);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, toast.kind, onDismiss]);

  return (
    <div
      className={`toast toast--${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon className="toast-icon icon" size={18} aria-hidden />
      <div className="toast-message">{toast.message}</div>
      <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
