// Human wording and links for audit-trail actions, shared by the dashboard and the audit log page.

export const ACTIVITY_LABELS: Record<string, string> = {
  "user.signup": "Account created",
  "user.login": "Signed in",
  "platform.login": "Platform admin signed in",
  "platform.tenant_suspended": "Business suspended",
  "platform.tenant_reactivated": "Business reactivated",
  "platform.impersonation_started": "Platform admin started acting as this business",
  "platform.user_role_changed": "User role changed",
  "platform.user_verification_changed": "User verification changed",
  "platform.user_suspended": "User suspended",
  "platform.user_reactivated": "User reactivated",
  "platform.password_reset_sent": "Password reset email sent",
  "platform.user_deleted": "User deleted",
  "tenant.letterhead_updated": "Business details updated",
  "invoice.created": "Invoice drafted",
  "invoice.updated": "Invoice draft edited",
  "invoice.issued": "Invoice issued",
  "invoice.cancelled": "Invoice cancelled",
  "invoice.payment_recorded": "Payment recorded on an invoice",
  "invoice.sent": "Invoice sent",
  "invoice.reminder_sent": "Reminder sent",
  "invoice.reminders_updated": "Invoice reminder settings changed",
  "invoice.link_rotated": "Invoice link replaced",
  "invoice.link_revoked": "Invoice link disabled",
  "quotation.created": "Quotation drafted",
  "quotation.updated": "Quotation draft edited",
  "quotation.sent": "Quotation sent",
  "quotation.viewed": "Quotation viewed by the customer",
  "quotation.accepted": "Quotation accepted",
  "quotation.rejected": "Quotation declined",
  "quotation.converted": "Quotation converted to an invoice",
  "quotation.cancelled": "Quotation cancelled",
  "quotation.link_rotated": "Quotation link replaced",
  "receipt.created": "Receipt issued",
  "receipt.sent": "Receipt sent",
  "receipt.resent": "Receipt resent",
  "schedule.created": "Payment schedule created",
  "schedule.updated": "Payment schedule edited",
  "schedule.paused": "Schedule paused",
  "schedule.active": "Schedule resumed",
  "schedule.cancelled": "Schedule cancelled",
  "schedule.reminders_updated": "Schedule reminder settings changed",
  "schedule.occurrence_skipped": "Scheduled payment skipped",
  "reminder.settings_updated": "Business reminder settings changed",
  "reminder.cancelled": "Reminder stopped",
};

export function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, " ");
}

export function entityLink(type: string, id: string | null): string | null {
  if (!id) return null;
  const base = { invoice: "/invoices", quotation: "/quotations", receipt: "/receipts", schedule: "/schedules" }[type];
  return base ? `${base}/${id}` : null;
}
