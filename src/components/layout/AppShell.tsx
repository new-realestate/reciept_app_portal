import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BellRing,
  Building,
  Building2,
  CalendarClock,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
  Menu,
  UsersRound,
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
import { useAccess } from "../../auth/AccessContext";
import { permissions, ROLE_LABELS } from "../../auth/permissions";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { applyTheme, getStoredTheme, resolvedTheme, type ThemePreference } from "../../lib/theme";
import { Button, IconButton } from "../ui/ui";
import { DropdownMenu, type MenuItem } from "../ui/DropdownMenu";

export function AppShell() {
  const { session, logout, stopImpersonation } = useAuth();
  const { can, isManager, me, business } = useAccess();
  const businessName = business?.name ?? "Receipt Portal";
  const location = useLocation();
  const navigate = useNavigate();
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

  function exitImpersonation() {
    const tenantId = session?.impersonating?.tenantId;
    stopImpersonation();
    navigate(tenantId ? `/platform/businesses/${tenantId}` : "/platform", { replace: true });
  }

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
    ...(can("receipts.issue") ? [{ label: "Receipt", icon: ReceiptText, to: "/receipts/new" }] : []),
    ...(can("invoices.issue") ? [{ label: "Invoice", icon: FileText, to: "/invoices/new" }] : []),
    ...(can("quotations.issue") ? [{ label: "Quotation", icon: ClipboardList, to: "/quotations/new" }] : []),
    ...(can("invoices.issue") ? [{ label: "Payment schedule", icon: CalendarClock, to: "/schedules/new" }] : []),
    ...(can("renters.manage") ? [{ label: "Tenant", icon: Home, to: "/tenants/new", separatorBefore: true }] : []),
  ];
  const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " nav-link--active" : ""}`;

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
        <Link to="/dashboard" className="sidebar-brand" title={businessName}>
          <BrandMark logoUrl={business?.logo_url} name={businessName} />
          <span className="brand-name">{businessName}</span>
        </Link>

        {createItems.length > 0 && (
          <DropdownMenu label="Create new" items={createItems} triggerClassName="btn btn--primary btn--full" block>
            <Plus size={16} aria-hidden />
            New…
          </DropdownMenu>
        )}

        <nav className="sidebar-nav" aria-label="Main">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
            <LayoutDashboard size={18} aria-hidden />
            Dashboard
          </NavLink>
          <NavLink to="/properties" className={navClass}>
            <Building size={18} aria-hidden />
            Properties
          </NavLink>
          {can("renters.manage") && (
            <NavLink to="/tenants" className={navClass}>
              <Home size={18} aria-hidden />
              Tenants
            </NavLink>
          )}
          {can("customers.view") && (
            <NavLink to="/customers" className={navClass}>
              <Users size={18} aria-hidden />
              Customers
            </NavLink>
          )}
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
          {isManager && (
            <NavLink to="/team" className={navClass}>
              <UsersRound size={18} aria-hidden />
              Team
            </NavLink>
          )}
          {(isManager || can("renters.kyc_review")) && (
            <NavLink to="/kyc" end className={navClass}>
              <ShieldCheck size={18} aria-hidden />
              KYC review
            </NavLink>
          )}
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
          {isManager && (
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
              {(me.full_name || session.role).charAt(0).toUpperCase()}
            </span>
            <span className="user-meta">
              <span className="user-role">{me.full_name}</span>
              <span className="user-sub">{ROLE_LABELS[session.role]}</span>
            </span>
            <ChevronsUpDown size={16} aria-hidden />
          </DropdownMenu>
        </div>
      </aside>

      <div className="app-main">
        {session.impersonating && (
          <div className="impersonation-banner" role="status">
            <ShieldCheck size={16} aria-hidden />
            <span>
              Acting as <strong>{session.impersonating.businessName}</strong>. Everything you do is logged under your name.
            </span>
            <Button size="sm" variant="secondary" icon={LogOut} onClick={exitImpersonation}>
              Exit
            </Button>
          </div>
        )}
        <div className="topbar">
          <IconButton
            ref={toggleRef}
            label={menuOpen ? "Close navigation" : "Open navigation"}
            icon={Menu}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            onClick={() => setMenuOpen((v) => !v)}
          />
          <span className="topbar-title" title={businessName}>
            <BrandMark logoUrl={business?.logo_url} name={businessName} small />
            <span className="brand-name">{businessName}</span>
          </span>
          {createItems.length > 0 && (
            <DropdownMenu label="Create new" items={createItems} triggerClassName="btn btn--primary btn--sm">
              <Plus size={16} aria-hidden />
              New…
            </DropdownMenu>
          )}
        </div>

        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** The business logo, or the default mark tinted with the business colour when there's no logo. */
function BrandMark({ logoUrl, name, small }: { logoUrl?: string | null; name: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return <img className={`brand-logo${small ? " brand-logo--small" : ""}`} src={logoUrl} alt={`${name} logo`} onError={() => setFailed(true)} />;
  }
  return (
    <span className={`brand-mark${small ? " brand-mark--small" : ""}`} aria-hidden>
      <ReceiptText size={small ? 15 : 18} />
    </span>
  );
}
