import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { permissions, ROLE_LABELS } from "../../auth/permissions";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/receipts", label: "Receipts", icon: "🧾" },
  { to: "/receipts/new", label: "New Receipt", icon: "➕" },
  { to: "/customers", label: "Customers", icon: "👥" },
  { to: "/profile", label: "My Profile", icon: "🖋️" },
];

export function AppShell() {
  const { session, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!session) return null;
  const canAdmin = permissions.canViewAdminPortal(session.role);

  return (
    <div className={`app-shell ${menuOpen ? "app-shell--menu-open" : ""}`}>
      <button className="mobile-menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle navigation">
        ☰
      </button>

      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">🧾</span>
          <span>Receipt Portal</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}

          <div className="nav-section-label">Administration</div>
          <NavLink
            to="/admin"
            className={({ isActive }) => `nav-link ${isActive ? "nav-link--active" : ""} ${!canAdmin ? "nav-link--locked" : ""}`}
            onClick={() => setMenuOpen(false)}
          >
            <span className="nav-icon" aria-hidden>
              🏢
            </span>
            Admin Portal
            {!canAdmin && <span className="lock-badge" aria-label="Restricted">🔒</span>}
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{session.role.charAt(0).toUpperCase()}</div>
            <div>
              <div className="user-role">{ROLE_LABELS[session.role]}</div>
              <div className="user-id">ID …{session.userId.slice(-6)}</div>
            </div>
          </div>
          <button className="btn btn--ghost btn--full" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
