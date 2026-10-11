import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link to="/login" className="auth-brand">
          <span className="brand-mark" aria-hidden>
            <ReceiptText size={18} />
          </span>
          Receipt Portal
        </Link>
        <h1>{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </main>
  );
}
