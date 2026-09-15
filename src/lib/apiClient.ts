import type { ApiErrorBody } from "./types";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "https://reciept-app-2n43.onrender.com").replace(
  /\/$/,
  "",
);

const TOKEN_STORAGE_KEY = "receipt_portal_token";

export class ApiError extends Error {
  status: number;
  fieldErrors?: { msg: string; loc: (string | number)[] }[];

  constructor(message: string, status: number, fieldErrors?: { msg: string; loc: (string | number)[] }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/** Fired whenever the API rejects a request with 401, so the app can clear the session. */
export type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListener = listener;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  isForm?: boolean;
  query?: Record<string, string | number | undefined | null>;
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function extractMessage(body: ApiErrorBody | undefined, fallback: string): string {
  if (!body?.detail) return fallback;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((e) => e.msg).join("; ");
  }
  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, isForm = false, query } = options;

  const headers: Record<string, string> = {};
  if (!isForm) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let json: unknown = undefined;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // non-JSON response body, ignore
    }
  }

  if (!response.ok) {
    const body = json as ApiErrorBody | undefined;
    const fieldErrors = Array.isArray(body?.detail) ? body?.detail : undefined;
    const message = extractMessage(body, `Request failed (${response.status})`);

    if (response.status === 401 && auth) {
      unauthorizedListener?.();
    }

    throw new ApiError(message, response.status, fieldErrors);
  }

  return json as T;
}
