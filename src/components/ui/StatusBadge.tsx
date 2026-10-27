import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  FileEdit,
  MailOpen,
  Pause,
  Send,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  InvoiceDisplayStatus,
  NotificationStatus,
  OccurrenceStatus,
  QuotationStatus,
  ScheduleStatus,
  UpcomingPayment,
} from "../../lib/documentTypes";
import type { KycStatus, PropertyStatus, RenterStatus, TenancyStatus } from "../../lib/propertyTypes";
import type { DeliveryStatus, ReceiptStatus } from "../../lib/types";
import { Badge } from "./ui";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

interface StatusStyle {
  tone: Tone;
  icon: LucideIcon;
  label: string;
}

// One shared map so a status looks identical on every page. Each status has an
// icon and a text label as well as a colour, so colour is never the only cue.
const RECEIPT_STATUS: Record<ReceiptStatus, StatusStyle> = {
  issued: { tone: "success", icon: CheckCircle2, label: "Issued" },
  voided: { tone: "danger", icon: Ban, label: "Voided" },
  refunded: { tone: "warning", icon: Undo2, label: "Refunded" },
};

const DELIVERY_STATUS: Record<DeliveryStatus, StatusStyle> = {
  queued: { tone: "neutral", icon: Clock, label: "Queued" },
  sent: { tone: "info", icon: Send, label: "Sent" },
  delivered: { tone: "success", icon: CheckCircle2, label: "Delivered" },
  opened: { tone: "success", icon: MailOpen, label: "Opened" },
  bounced: { tone: "danger", icon: XCircle, label: "Bounced" },
  failed: { tone: "danger", icon: XCircle, label: "Failed" },
};

const INVOICE_STATUS: Record<InvoiceDisplayStatus, StatusStyle> = {
  draft: { tone: "neutral", icon: FileEdit, label: "Draft" },
  issued: { tone: "info", icon: Send, label: "Issued" },
  partially_paid: { tone: "warning", icon: CircleDot, label: "Partially paid" },
  paid: { tone: "success", icon: CheckCircle2, label: "Paid" },
  overdue: { tone: "danger", icon: AlertTriangle, label: "Overdue" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
};

const QUOTATION_STATUS: Record<QuotationStatus, StatusStyle> = {
  draft: { tone: "neutral", icon: FileEdit, label: "Draft" },
  sent: { tone: "info", icon: Send, label: "Sent" },
  viewed: { tone: "info", icon: MailOpen, label: "Viewed" },
  accepted: { tone: "success", icon: CheckCircle2, label: "Accepted" },
  rejected: { tone: "danger", icon: XCircle, label: "Rejected" },
  expired: { tone: "warning", icon: Clock, label: "Expired" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
};

const SCHEDULE_STATUS: Record<ScheduleStatus, StatusStyle> = {
  active: { tone: "success", icon: CheckCircle2, label: "Active" },
  paused: { tone: "warning", icon: Pause, label: "Paused" },
  completed: { tone: "neutral", icon: CheckCircle2, label: "Completed" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
};

const OCCURRENCE_STATUS: Record<OccurrenceStatus, StatusStyle> = {
  expected: { tone: "info", icon: Clock, label: "Expected" },
  invoiced: { tone: "warning", icon: Send, label: "Invoiced" },
  paid: { tone: "success", icon: CheckCircle2, label: "Paid" },
  skipped: { tone: "neutral", icon: Ban, label: "Skipped" },
};

const NOTIFICATION_STATUS: Record<NotificationStatus, StatusStyle> = {
  scheduled: { tone: "info", icon: Clock, label: "Scheduled" },
  sending: { tone: "info", icon: Send, label: "Sending" },
  sent: { tone: "success", icon: CheckCircle2, label: "Sent" },
  failed: { tone: "danger", icon: XCircle, label: "Failed" },
  skipped: { tone: "warning", icon: Ban, label: "Skipped" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
};

const DUE_STATUS: Record<UpcomingPayment["status"], StatusStyle> = {
  overdue: { tone: "danger", icon: AlertTriangle, label: "Overdue" },
  due_today: { tone: "warning", icon: Clock, label: "Due today" },
  upcoming: { tone: "info", icon: Clock, label: "Upcoming" },
};

const KYC_STATUS: Record<KycStatus, StatusStyle> = {
  not_submitted: { tone: "neutral", icon: FileEdit, label: "KYC not submitted" },
  pending_review: { tone: "info", icon: Clock, label: "KYC pending review" },
  verified: { tone: "success", icon: ShieldCheck, label: "KYC verified" },
  rejected: { tone: "danger", icon: XCircle, label: "KYC rejected" },
  requires_correction: { tone: "warning", icon: ShieldAlert, label: "KYC needs correction" },
  expired: { tone: "warning", icon: AlertTriangle, label: "KYC expired" },
};

const PROPERTY_STATUS: Record<PropertyStatus, StatusStyle> = {
  active: { tone: "success", icon: CheckCircle2, label: "Active" },
  inactive: { tone: "warning", icon: Pause, label: "Inactive" },
  archived: { tone: "neutral", icon: Ban, label: "Archived" },
};

const TENANCY_STATUS: Record<TenancyStatus, StatusStyle> = {
  draft: { tone: "neutral", icon: FileEdit, label: "Draft" },
  active: { tone: "success", icon: CheckCircle2, label: "Active" },
  ended: { tone: "neutral", icon: Clock, label: "Ended" },
  terminated: { tone: "danger", icon: Ban, label: "Terminated" },
};

const RENTER_STATUS: Record<RenterStatus, StatusStyle> = {
  active: { tone: "success", icon: CheckCircle2, label: "Current tenant" },
  former: { tone: "neutral", icon: Clock, label: "Former tenant" },
  archived: { tone: "neutral", icon: Ban, label: "Archived" },
};

function StyledBadge({ style, fallback }: { style: StatusStyle | undefined; fallback: string }) {
  const s = style ?? { tone: "neutral" as Tone, icon: Clock, label: fallback };
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}

export const InvoiceStatusBadge = ({ status }: { status: InvoiceDisplayStatus }) => (
  <StyledBadge style={INVOICE_STATUS[status]} fallback={status} />
);
export const QuotationStatusBadge = ({ status }: { status: QuotationStatus }) => (
  <StyledBadge style={QUOTATION_STATUS[status]} fallback={status} />
);
export const ScheduleStatusBadge = ({ status }: { status: ScheduleStatus }) => (
  <StyledBadge style={SCHEDULE_STATUS[status]} fallback={status} />
);
export const OccurrenceStatusBadge = ({ status }: { status: OccurrenceStatus }) => (
  <StyledBadge style={OCCURRENCE_STATUS[status]} fallback={status} />
);
export const NotificationStatusBadge = ({ status }: { status: NotificationStatus }) => (
  <StyledBadge style={NOTIFICATION_STATUS[status]} fallback={status} />
);
export const DueStatusBadge = ({ status }: { status: UpcomingPayment["status"] }) => (
  <StyledBadge style={DUE_STATUS[status]} fallback={status} />
);

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const s = RECEIPT_STATUS[status] ?? { tone: "neutral" as Tone, icon: Clock, label: status };
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const s = DELIVERY_STATUS[status] ?? { tone: "neutral" as Tone, icon: Clock, label: status };
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}

/** Platform admin: whether a business or user account is usable. */
export function AccountStatusBadge({ suspendedAt }: { suspendedAt: string | null }) {
  return suspendedAt ? (
    <Badge tone="danger" icon={Ban}>
      Suspended
    </Badge>
  ) : (
    <Badge tone="success" icon={CheckCircle2}>
      Active
    </Badge>
  );
}

export const KycStatusBadge = ({ status }: { status: KycStatus | null }) => (
  <StyledBadge style={KYC_STATUS[status ?? "not_submitted"]} fallback={status ?? "not_submitted"} />
);
export const PropertyStatusBadge = ({ status }: { status: PropertyStatus }) => (
  <StyledBadge style={PROPERTY_STATUS[status]} fallback={status} />
);
export const TenancyStatusBadge = ({ status }: { status: TenancyStatus }) => (
  <StyledBadge style={TENANCY_STATUS[status]} fallback={status} />
);
export const RenterStatusBadge = ({ status }: { status: RenterStatus }) => (
  <StyledBadge style={RENTER_STATUS[status]} fallback={status} />
);
