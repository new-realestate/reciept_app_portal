import { apiRequest } from "../lib/apiClient";
import type { KycDecision, KycDocument, KycDocumentKind, KycProfile, KycProfileUpdate, KycQueueItem } from "../lib/propertyTypes";

export const kycApi = {
  mine: () => apiRequest<KycProfile>("/kyc/me"),

  forMember: (userId: string) => apiRequest<KycProfile>(`/team/members/${userId}/kyc`),

  forRenter: (renterId: string) => apiRequest<KycProfile>(`/renters/${renterId}/kyc`),

  get: (profileId: string) => apiRequest<KycProfile>(`/kyc/profiles/${profileId}`),

  update: (profileId: string, payload: KycProfileUpdate) =>
    apiRequest<KycProfile>(`/kyc/profiles/${profileId}`, { method: "PUT", body: payload }),

  submit: (profileId: string) => apiRequest<KycProfile>(`/kyc/profiles/${profileId}/submit`, { method: "POST" }),

  review: (profileId: string, decision: KycDecision, note?: string) =>
    apiRequest<KycProfile>(`/kyc/profiles/${profileId}/review`, { method: "POST", body: { decision, note: note || undefined } }),

  queue: () => apiRequest<KycQueueItem[]>("/kyc/review-queue"),

  /** The full ID number, for reviewers. The API records every reveal in the audit log. */
  revealIdNumber: (profileId: string) =>
    apiRequest<{ id_number: string }>(`/kyc/profiles/${profileId}/reveal-id-number`, { method: "POST" }),

  upload: (profileId: string, kind: KycDocumentKind, file: File) => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    return apiRequest<KycDocument>(`/kyc/profiles/${profileId}/documents`, { method: "POST", body: form, isForm: true });
  },

  /** A link valid for a few minutes; opening it is audited. */
  downloadUrl: (documentId: string) =>
    apiRequest<{ url: string; expires_at: string }>(`/kyc/documents/${documentId}/download-url`, { method: "POST" }),

  deleteDocument: (documentId: string) => apiRequest<void>(`/kyc/documents/${documentId}`, { method: "DELETE" }),
};
