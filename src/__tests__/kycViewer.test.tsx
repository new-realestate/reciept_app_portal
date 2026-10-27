import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { kycApi } from "../api/kyc";
import type { KycProfile } from "../lib/propertyTypes";
import { KycPanel } from "../components/kyc/KycPanel";
import { makeMe, renderWithApp } from "./helpers";

const profile: KycProfile = {
  id: "p1", subject_type: "staff", user_id: "u1", renter_id: null, subject_name: "Sam", legal_name: "Sam Staff",
  date_of_birth: null, residential_address: null, id_document_type: "national_id", id_number_masked: "••••67AB",
  id_expiry_date: null, emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_relationship: null,
  staff_reference: null, status: "not_submitted", verification_method: "manual", submitted_at: null,
  submitted_by_user_id: null, reviewed_at: null, reviewed_by_user_id: null, review_note: null,
  documents: [{ id: "d1", kind: "id_front", content_type: "image/png", size_bytes: 2048, original_filename: "id.png",
    uploaded_at: "2026-10-27T10:00:00Z", uploaded_by_user_id: "u1" }],
  reviews: [], can_edit: true, can_submit: true, can_review: false, can_view_documents: true,
};

describe("KYC document viewer", () => {
  it("shows an uploaded image in the page instead of opening a new tab", async () => {
    URL.createObjectURL = vi.fn(() => "blob:kyc-image");
    URL.revokeObjectURL = vi.fn();
    const openSpy = vi.spyOn(window, "open");
    vi.spyOn(kycApi, "downloadUrl").mockResolvedValue({ url: "http://api.test/kyc/files/token", expires_at: "" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, blob: async () => new Blob(["png"], { type: "image/png" }) } as Response);

    render(renderWithApp(<KycPanel load={async () => profile} />, { me: makeMe("staff") }));
    await userEvent.click(await screen.findByRole("button", { name: "View" }));

    const img = await screen.findByRole("img", { name: "ID — front" });
    expect(img.getAttribute("src")).toBe("blob:kyc-image");
    expect(openSpy).not.toHaveBeenCalled();
  });
});
