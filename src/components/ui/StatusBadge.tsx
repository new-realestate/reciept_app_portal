import {
  Ban,
  CheckCircle2,
  Clock,
  MailOpen,
  Send,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
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
