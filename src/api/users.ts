import { apiRequest } from "../lib/apiClient";
import type { Me } from "../lib/types";

export const usersApi = {
  /** The signed-in user, including their saved signature. */
  me: () => apiRequest<Me>("/users/me"),

  /** Stops printing a signature on new receipts (issued receipts keep theirs). */
  deleteSignature: () => apiRequest<void>("/users/me/signature", { method: "DELETE" }),
};
