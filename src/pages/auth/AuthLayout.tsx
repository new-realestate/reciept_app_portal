import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/login" className="auth-brand">
          <span aria-hidden>🧾</span> Receipt Portal
        </Link>
        <h1>{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  );
}
