import { apiRequest } from "../lib/apiClient";
import type { Tenant, TenantUpdatePayload } from "../lib/types";

export const tenantApi = {
  getMine: () => apiRequest<Tenant>("/tenant/me"),

  update: (payload: TenantUpdatePayload) => apiRequest<Tenant>("/tenant/me", { method: "PATCH", body: payload }),

  setTimezone: (timezone: string) => apiRequest<Tenant>("/tenant/me", { method: "PATCH", body: { timezone } }),

  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<{ logo_url: string }>("/tenant/logo", { method: "POST", body: form, isForm: true });
  },

  uploadSignature: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<{ signature_image_url: string }>("/users/me/signature", {
      method: "POST",
      body: form,
      isForm: true,
    });
  },
};
