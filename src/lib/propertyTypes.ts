// Types for properties, team members, renters ("tenants" in the UI) and KYC.
// They mirror app/schemas/{property,team,renter,kyc}.py.

import type { Customer, CustomerCreatePayload, Permission, UserRole } from "./types";

/* ---------- Properties ---------- */

export type PropertyType = "residential" | "commercial" | "mixed" | "land" | "other";
export type PropertyStatus = "active" | "inactive" | "archived";
export type UnitType = "apartment" | "room" | "office" | "shop" | "house" | "other";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  residential: "Residential",
  commercial: "Commercial",
  mixed: "Mixed use",
  land: "Land",
  other: "Other",
};

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  apartment: "Apartment",
  room: "Room",
  office: "Office",
  shop: "Shop",
  house: "House",
  other: "Other",
};

export interface Property {
  id: string;
  name: string;
  property_type: PropertyType;
  address: string | null;
  location: string | null;
  description: string | null;
  status: PropertyStatus;
  unit_count: number;
  occupied_unit_count: number;
  active_tenancy_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface Unit {
  id: string;
  property_id: string;
  label: string;
  unit_type: UnitType;
  status: PropertyStatus;
  default_rent_cents: number | null;
  occupied: boolean;
  created_at: string;
}

export interface AssignedStaff {
  user_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  assigned_at: string;
}

export interface PropertyDetail extends Property {
  units: Unit[];
  assigned_staff: AssignedStaff[];
}

export interface PropertyPayload {
  name?: string;
  property_type?: PropertyType;
  address?: string;
  location?: string;
  description?: string;
  status?: PropertyStatus;
}

export interface UnitPayload {
  label?: string;
  unit_type?: UnitType;
  status?: PropertyStatus;
  default_rent_cents?: number | null;
}

export interface Assignment {
  id: string;
  property_id: string;
  property_name: string | null;
  user_id: string;
  user_name: string | null;
  assigned_by_user_id: string | null;
  assigned_at: string;
  revoked_by_user_id: string | null;
  revoked_at: string | null;
  active: boolean;
}

/* ---------- Team ---------- */

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  permissions: Permission[];
  uses_default_permissions: boolean;
  is_active: boolean;
  deactivated_at: string | null;
  last_login_at: string | null;
  created_at: string;
  assigned_property_ids: string[];
  kyc_status: KycStatus | null;
}

export interface TeamMemberCreatePayload {
  full_name: string;
  email: string;
  phone?: string;
  role: "admin" | "staff";
  permissions?: Permission[];
}

export interface TeamMemberUpdatePayload {
  full_name?: string;
  phone?: string | null;
  role?: "admin" | "staff";
  permissions?: Permission[];
  reset_permissions?: boolean;
}

export interface PermissionCatalog {
  all: Permission[];
  staff_defaults: Permission[];
}

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  "customers.view": { label: "View customers", description: "Customer directory and document history" },
  "customers.manage": { label: "Manage customers", description: "Add, edit and archive customers" },
  "renters.manage": { label: "Manage tenants", description: "Tenants and tenancies on their properties, and submit tenant KYC" },
  "renters.kyc_review": { label: "Review tenant KYC", description: "Approve or reject tenant KYC and open identity documents" },
  "receipts.issue": { label: "Issue receipts", description: "Record payments received and send receipts" },
  "invoices.issue": { label: "Issue invoices", description: "Create invoices and payment schedules, convert quotations" },
  "invoices.record_payment": { label: "Record invoice payments", description: "Record payments against invoices" },
  "quotations.issue": { label: "Issue quotations", description: "Create and send quotations" },
  "documents.view": { label: "View general documents", description: "Documents not tied to a property" },
  "reports.view": { label: "View reports", description: "Reserved for reporting" },
};

/* ---------- Renters and tenancies ---------- */

export type RentFrequency = "once" | "weekly" | "monthly" | "quarterly" | "annually";
export type TenancyStatus = "draft" | "active" | "ended" | "terminated";
export type RenterStatus = "active" | "former" | "archived";

export const RENT_FREQUENCY_LABELS: Record<RentFrequency, string> = {
  once: "One-off",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export interface Tenancy {
  id: string;
  reference: string;
  renter_id: string;
  property_id: string;
  property_name: string | null;
  unit_id: string | null;
  unit_label: string | null;
  start_date: string;
  end_date: string | null;
  rent_amount_cents: number;
  currency: string;
  rent_frequency: RentFrequency;
  deposit_cents: number;
  status: TenancyStatus;
  notes: string | null;
  payment_schedule_id: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Renter {
  id: string;
  customer_id: string;
  customer: Customer;
  status: RenterStatus;
  occupation: string | null;
  employer: string | null;
  notes: string | null;
  kyc_status: KycStatus | null;
  current_tenancies: Tenancy[];
  created_at: string;
}

export interface RenterDetail extends Renter {
  tenancies: Tenancy[];
}

export interface TenancyPayload {
  property_id: string;
  unit_id?: string | null;
  start_date: string;
  end_date?: string | null;
  rent_amount_cents: number;
  currency?: string;
  rent_frequency?: RentFrequency;
  deposit_cents?: number;
  status?: "draft" | "active";
  notes?: string;
  create_rent_schedule?: boolean;
}

export interface RenterCreatePayload {
  customer_id?: string;
  customer?: Omit<CustomerCreatePayload, "allow_duplicate">;
  allow_duplicate_customer?: boolean;
  occupation?: string;
  employer?: string;
  notes?: string;
  tenancy?: TenancyPayload;
}

export interface RenterUpdatePayload {
  status?: RenterStatus;
  occupation?: string | null;
  employer?: string | null;
  notes?: string | null;
}

/* ---------- KYC ---------- */

export type KycStatus = "not_submitted" | "pending_review" | "verified" | "rejected" | "requires_correction" | "expired";
export type IdDocumentType = "national_id" | "passport" | "driving_permit" | "refugee_id" | "other";
export type KycDocumentKind = "id_front" | "id_back" | "passport_page" | "photo" | "proof_of_address" | "other";
export type KycDecision = "approved" | "rejected" | "requires_correction";

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  not_submitted: "Not submitted",
  pending_review: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  requires_correction: "Needs correction",
  expired: "Expired",
};

export const ID_DOCUMENT_LABELS: Record<IdDocumentType, string> = {
  national_id: "National ID",
  passport: "Passport",
  driving_permit: "Driving permit",
  refugee_id: "Refugee ID",
  other: "Other",
};

export const KYC_DOCUMENT_LABELS: Record<KycDocumentKind, string> = {
  id_front: "ID — front",
  id_back: "ID — back",
  passport_page: "Passport photo page",
  photo: "Photograph",
  proof_of_address: "Proof of address",
  other: "Other",
};

export interface KycDocument {
  id: string;
  kind: KycDocumentKind;
  content_type: string;
  size_bytes: number;
  original_filename: string | null;
  uploaded_at: string;
  uploaded_by_user_id: string | null;
}

export interface KycReview {
  id: string;
  decision: KycDecision;
  note: string | null;
  reviewer_user_id: string | null;
  reviewer_name: string | null;
  created_at: string;
}

export interface KycProfile {
  id: string;
  subject_type: "staff" | "renter";
  user_id: string | null;
  renter_id: string | null;
  subject_name: string | null;
  legal_name: string | null;
  date_of_birth: string | null;
  residential_address: string | null;
  id_document_type: IdDocumentType | null;
  id_number_masked: string | null;
  id_expiry_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  staff_reference: string | null;
  status: KycStatus;
  verification_method: string;
  submitted_at: string | null;
  submitted_by_user_id: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  review_note: string | null;
  documents: KycDocument[];
  reviews: KycReview[];
  can_edit: boolean;
  can_submit: boolean;
  can_review: boolean;
  can_view_documents: boolean;
}

export interface KycProfileUpdate {
  legal_name?: string | null;
  date_of_birth?: string | null;
  residential_address?: string | null;
  id_document_type?: IdDocumentType | null;
  /** Write-only; responses only carry the masked form. */
  id_number?: string;
  id_expiry_date?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  staff_reference?: string | null;
}

export interface KycQueueItem {
  profile_id: string;
  subject_type: "staff" | "renter";
  subject_name: string | null;
  user_id: string | null;
  renter_id: string | null;
  status: KycStatus;
  submitted_at: string | null;
}
