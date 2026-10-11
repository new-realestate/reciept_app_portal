import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  /** Internal route (client-side navigation). */
  to?: string;
  /** External / file URL, opened in a new tab. */
  href?: string;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
}

/**
 * Accessible menu button: Enter/Space/ArrowDown open it, arrows move between
 * items, Escape closes and returns focus to the trigger.
 */
export function DropdownMenu({
  children,
  triggerClassName = "btn btn--secondary",
  items,
  label,
  align = "end",
  direction = "down",
  block = false,
  disabled = false,
}: {
  /** Content of the trigger button; icon-only triggers must include sr-only text. */
  children: ReactNode;
  triggerClassName?: string;
  items: MenuItem[];
  /** Accessible name of the menu itself. */
  label: string;
  align?: "start" | "end";
  direction?: "up" | "down";
  block?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function focusItem(index: number) {
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    if (!nodes || nodes.length === 0) return;
    nodes[(index + nodes.length) % nodes.length].focus();
  }

  useEffect(() => {
    if (!open) return;
    focusItem(0);

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const nodes = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    );
    const current = nodes.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(nodes.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className={`menu${block ? " menu--block" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`menu-panel${direction === "up" ? " menu-panel--up" : ""}${align === "start" ? " menu-panel--start" : ""}`}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => {
            const content = (
              <>
                {item.icon && <item.icon size={16} aria-hidden />}
                {item.label}
              </>
            );
            const className = `menu-item${item.danger ? " menu-item--danger" : ""}`;
            const separator = item.separatorBefore ? <div className="menu-separator" role="separator" /> : null;

            if (item.to && !item.disabled) {
              return (
                <div key={item.label} role="none">
                  {separator}
                  <Link to={item.to} role="menuitem" className={className} tabIndex={-1} onClick={() => close(false)}>
                    {content}
                  </Link>
                </div>
              );
            }
            if (item.href && !item.disabled) {
              return (
                <div key={item.label} role="none">
                  {separator}
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className={className}
                    tabIndex={-1}
                    onClick={() => close(false)}
                  >
                    {content}
                  </a>
                </div>
              );
            }
            return (
              <div key={item.label} role="none">
                {separator}
                <button
                  type="button"
                  role="menuitem"
                  className={className}
                  tabIndex={-1}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => {
                    if (item.disabled) return;
                    close();
                    item.onSelect?.();
                  }}
                >
                  {content}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
