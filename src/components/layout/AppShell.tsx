import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BellRing,
  Building2,
  CalendarClock,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Menu,
  Monitor,
  Moon,
  Plus,
  ReceiptText,
  Sun,
  UserRound,
  Users,
  Lock,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { permissions, ROLE_LABELS } from "../../auth/permissions";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { applyTheme, getStoredTheme, resolvedTheme, type ThemePreference } from "../../lib/theme";
import { IconButton } from "../ui/ui";
import { DropdownMenu, type MenuItem } from "../ui/DropdownMenu";

export function AppShell() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Close the drawer whenever the route changes or the viewport grows past it.
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

  if (!session) return null;
  const canAdmin = permissions.canViewAdminPortal(session.role);

  // "Receipts" stays highlighted on a receipt's detail page, but not on "New receipt".
  const receiptsActive =
    location.pathname === "/receipts" ||
    (location.pathname.startsWith("/receipts/") && location.pathname !== "/receipts/new");

  function chooseTheme(next: ThemePreference) {
    applyTheme(next);
    setTheme(next);
  }

  const themeItems: MenuItem[] = [
    resolvedTheme(theme) === "dark"
      ? { label: "Switch to light theme", icon: Sun, onSelect: () => chooseTheme("light"), separatorBefore: true }
      : { label: "Switch to dark theme", icon: Moon, onSelect: () => chooseTheme("dark"), separatorBefore: true },
    ...(theme !== "system" ? [{ label: "Use system theme", icon: Monitor, onSelect: () => chooseTheme("system") }] : []),
  ];

  const createItems: MenuItem[] = [
    { label: "Receipt", icon: ReceiptText, to: "/receipts/new" },
    { label: "Invoice", icon: FileText, to: "/invoices/new" },
    { label: "Quotation", icon: ClipboardList, to: "/quotations/new" },
    { label: "Payment schedule", icon: CalendarClock, to: "/schedules/new" },
  ];

  const userItems: MenuItem[] = [
    { label: "My profile", icon: UserRound, to: "/profile" },
    ...themeItems,
    { label: "Sign out", icon: LogOut, onSelect: logout, danger: true, separatorBefore: true },
  ];

  const drawerHidden = isMobile && !menuOpen;

  return (
    <div className={`app-shell${menuOpen ? " app-shell--menu-open" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {menuOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <aside id="sidebar" ref={sidebarRef} className="sidebar" aria-label="Primary" inert={drawerHidden || undefined}>
        <Link to="/dashboard" className="sidebar-brand">
          <span className="brand-mark" aria-hidden>
            <ReceiptText size={18} />
          </span>
          Receipt Portal
        </Link>

        <DropdownMenu label="Create new" items={createItems} triggerClassName="btn btn--primary btn--full" block>
          <Plus size={16} aria-hidden />
          New…
        </DropdownMenu>

        <nav className="sidebar-nav" aria-label="Main">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
            <LayoutDashboard size={18} aria-hidden />
            Dashboard
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
            <Users size={18} aria-hidden />
            Customers
          </NavLink>
          <Link
            to="/receipts"
            className={`nav-link${receiptsActive ? " nav-link--active" : ""}`}
            aria-current={receiptsActive ? "page" : undefined}
          >
            <ReceiptText size={18} aria-hidden />
            Receipts
          </Link>
          <NavLink to="/invoices" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
            <FileText size={18} aria-hidden />
            Invoices
          </NavLink>
          <NavLink to="/quotations" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
            <ClipboardList size={18} aria-hidden />
            Quotations
          </NavLink>
          <NavLink to="/schedules" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
            <CalendarClock size={18} aria-hidden />
            Payment schedules
          </NavLink>
          <NavLink to="/reminders" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
            <BellRing size={18} aria-hidden />
            Payment reminders
          </NavLink>

          <div className="nav-section-label" id="nav-settings">
            Settings
          </div>
          <NavLink
            to="/admin"
            aria-describedby={!canAdmin ? "admin-readonly" : undefined}
            className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
          >
            <Building2 size={18} aria-hidden />
            Business
            {!canAdmin && (
              <>
                <Lock size={14} className="nav-trailing" aria-hidden />
                <span className="sr-only" id="admin-readonly">
                  View only for your role
                </span>
              </>
            )}
          </NavLink>
          {permissions.canManageDocuments(session.role) && (
            <NavLink to="/audit-log" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
              <ScrollText size={18} aria-hidden />
              Audit log
            </NavLink>
          )}
          <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
            <UserRound size={18} aria-hidden />
            Profile
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <DropdownMenu label="Account menu" items={userItems} direction="up" align="start" block triggerClassName="user-trigger">
            <span className="user-avatar" aria-hidden>
              {session.role.charAt(0).toUpperCase()}
            </span>
            <span className="user-meta">
              <span className="user-role">{ROLE_LABELS[session.role]}</span>
              <span className="user-sub">Account</span>
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
          <span className="topbar-title">Receipt Portal</span>
          <DropdownMenu label="Create new" items={createItems} triggerClassName="btn btn--primary btn--sm">
            <Plus size={16} aria-hidden />
            New…
          </DropdownMenu>
        </div>

        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
