import { apiRequest } from "../lib/apiClient";
import type { LoginPayload, SignupPayload, SignupResponse, TokenResponse } from "../lib/types";

export const authApi = {
  signup: (payload: SignupPayload) =>
    apiRequest<SignupResponse>("/auth/signup", { method: "POST", body: payload, auth: false }),

  login: (payload: LoginPayload) =>
    apiRequest<TokenResponse>("/auth/login", { method: "POST", body: payload, auth: false }),

  verify: (token: string) =>
    apiRequest<{ detail: string }>("/auth/verify", { method: "POST", body: { token }, auth: false }),

  requestPasswordReset: (email: string) =>
    apiRequest<{ detail: string }>("/auth/password-reset/request", { method: "POST", body: { email }, auth: false }),

  confirmPasswordReset: (token: string, new_password: string) =>
    apiRequest<{ detail: string }>("/auth/password-reset/confirm", {
      method: "POST",
      body: { token, new_password },
      auth: false,
    }),
};
