import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentProps,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link, type LinkProps } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Info,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { handleRadioGroupKeyDown } from "../../lib/a11y";

/* ---------- Layout ---------- */

export function Card({
  children,
  className = "",
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return <section className={`card${flush ? " card--flush" : ""} ${className}`}>{children}</section>;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card-header">
      <div>
        <h2 className="card-title">{title}</h2>
        {description && <p className="card-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to={back.to}>
              <ChevronLeft size={16} aria-hidden />
              {back.label}
            </Link>
          </nav>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="row-actions">{actions}</div>}
    </header>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

function buttonClass(variant: ButtonVariant, size: "sm" | "md", full: boolean | undefined, extra: string) {
  return `btn btn--${variant}${size === "sm" ? " btn--sm" : ""}${full ? " btn--full" : ""} ${extra}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  full?: boolean;
  isLoading?: boolean;
  icon?: LucideIcon;
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  isLoading,
  icon: Icon,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, full, className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? <span className="btn-spinner" aria-hidden /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </button>
  );
}

/** A router link styled as a button. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  full,
  icon: Icon,
  className = "",
  children,
  ...rest
}: Omit<LinkProps, "className"> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  full?: boolean;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Link className={buttonClass(variant, size, full, className)} {...rest}>
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </Link>
  );
}

/** A plain anchor (external/file URL) styled as a button. */
export function ButtonAnchor({
  variant = "secondary",
  size = "md",
  icon: Icon,
  className = "",
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: "sm" | "md"; icon?: LucideIcon }) {
  return (
    <a className={buttonClass(variant, size, false, className)} {...rest}>
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </a>
  );
}

export function IconButton({
  label,
  icon: Icon,
  ...rest
}: ComponentProps<"button"> & { label: string; icon: LucideIcon }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} {...rest}>
      <Icon size={18} aria-hidden />
    </button>
  );
}

/* ---------- Forms ---------- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactElement;
}) {
  const describedBy = [hint && !error ? `${htmlFor}-hint` : null, error ? `${htmlFor}-error` : null]
    .filter(Boolean)
    .join(" ");

  // Wire the hint/error to the control so assistive tech announces them.
  const control = isValidElement<Record<string, unknown>>(Children.only(children))
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="required-mark" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {control}
      {hint && !error && (
        <p className="field-hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${htmlFor}-error`} role="alert">
          <AlertCircle size={14} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${className}`.trim()} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${className}`.trim()} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${className}`.trim()} />;
}

export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-wrap">
      <input {...props} type={visible ? "text" : "password"} className={`input ${className}`.trim()} />
      <span className="input-adornment">
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          icon={visible ? EyeOff : Eye}
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
        />
      </span>
    </div>
  );
}

/** Input with a fixed leading label, e.g. a currency code. */
export function PrefixedInput({ prefix, ...props }: InputHTMLAttributes<HTMLInputElement> & { prefix: string }) {
  return (
    <div className="input-prefix-wrap">
      <span className="input-prefix" aria-hidden>
        {prefix}
      </span>
      <input {...props} className="input" />
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label} onKeyDown={handleRadioGroupKeyDown}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Feedback ---------- */

export function Badge({
  tone,
  icon: Icon,
  children,
}: {
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {Icon && <Icon size={13} aria-hidden />}
      {children}
    </span>
  );
}

const ALERT_ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertCircle };

export function Alert({ tone, children }: { tone: keyof typeof ALERT_ICONS; children: ReactNode }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-block">
      {Icon && (
        <span className="state-icon">
          <Icon size={22} aria-hidden />
        </span>
      )}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block state-block--error" role="alert">
      <span className="state-icon">
        <AlertCircle size={22} aria-hidden />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="spinner-row" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ width = "100%" }: { width?: string }) {
  return <span className="skeleton" style={{ width }} aria-hidden />;
}

export function LockedNotice({ children }: { children: ReactNode }) {
  return (
    <div className="locked-notice">
      <Lock size={16} aria-hidden />
      <span>{children}</span>
    </div>
  );
}
