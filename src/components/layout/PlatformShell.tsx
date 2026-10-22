import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Building2, ChevronsUpDown, LayoutDashboard, LogOut, Menu, Monitor, Moon, ScrollText, ShieldCheck, Sun, Users } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { applyTheme, getStoredTheme, resolvedTheme, type ThemePreference } from "../../lib/theme";
import { IconButton } from "../ui/ui";
import { DropdownMenu, type MenuItem } from "../ui/DropdownMenu";

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " nav-link--active" : ""}`;

/** Layout for the platform super admin's own pages (/platform/*); mirrors AppShell. */
export function PlatformShell() {
  const { logout } = useAuth();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    if (!menuOpen) return;
    sidebarRef.current?.querySelector<HTMLElement>("a")?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function chooseTheme(next: ThemePreference) {
    applyTheme(next);
    setTheme(next);
  }

  const userItems: MenuItem[] = [
    resolvedTheme(theme) === "dark"
      ? { label: "Switch to light theme", icon: Sun, onSelect: () => chooseTheme("light") }
      : { label: "Switch to dark theme", icon: Moon, onSelect: () => chooseTheme("dark") },
    ...(theme !== "system" ? [{ label: "Use system theme", icon: Monitor, onSelect: () => chooseTheme("system") }] : []),
    { label: "Sign out", icon: LogOut, onSelect: logout, danger: true, separatorBefore: true },
  ];

  const drawerHidden = isMobile && !menuOpen;
  // "Businesses" stays highlighted on a business's detail page.
  const businessesActive = location.pathname.startsWith("/platform/businesses");

  return (
    <div className={`app-shell${menuOpen ? " app-shell--menu-open" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {menuOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <aside id="sidebar" ref={sidebarRef} className="sidebar" aria-label="Primary" inert={drawerHidden || undefined}>
        <Link to="/platform" className="sidebar-brand">
          <span className="brand-mark" aria-hidden>
            <ShieldCheck size={18} />
          </span>
          Platform Admin
        </Link>

        <nav className="sidebar-nav" aria-label="Main">
          <NavLink to="/platform" end className={navClass}>
            <LayoutDashboard size={18} aria-hidden />
            Overview
          </NavLink>
          <Link
            to="/platform/businesses"
            className={`nav-link${businessesActive ? " nav-link--active" : ""}`}
            aria-current={businessesActive ? "page" : undefined}
          >
            <Building2 size={18} aria-hidden />
            Businesses
          </Link>
          <NavLink to="/platform/users" className={navClass}>
            <Users size={18} aria-hidden />
            Users
          </NavLink>
          <NavLink to="/platform/audit-log" className={navClass}>
            <ScrollText size={18} aria-hidden />
            Audit log
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <DropdownMenu label="Account menu" items={userItems} direction="up" align="start" block triggerClassName="user-trigger">
            <span className="user-avatar" aria-hidden>
              <ShieldCheck size={16} />
            </span>
            <span className="user-meta">
              <span className="user-role">Super admin</span>
              <span className="user-sub">Platform</span>
            </span>
            <ChevronsUpDown size={16} aria-hidden />
          </DropdownMenu>
        </div>
      </aside>

      <div className="app-main">
        <div className="topbar">
          <IconButton
            ref={toggleRef}
            label={menuOpen ? "Close navigation" : "Open navigation"}
            icon={Menu}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            onClick={() => setMenuOpen((v) => !v)}
          />
          <span className="topbar-title">Platform Admin</span>
        </div>

        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
