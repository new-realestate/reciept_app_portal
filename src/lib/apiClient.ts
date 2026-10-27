import type { ApiErrorBody } from "./types";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "https://reciept-app-2n43.onrender.com").replace(
  /\/$/,
  "",
);

const TOKEN_STORAGE_KEY = "receipt_portal_token";
// While a super admin acts as a business, their own token waits here.
const ADMIN_TOKEN_STORAGE_KEY = "receipt_portal_admin_token";

export class ApiError extends Error {
  status: number;
  fieldErrors?: { msg: string; loc: (string | number)[] }[];
  /** Structured error details the API sent alongside the message (e.g. duplicate-customer matches). */
  data?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    fieldErrors?: { msg: string; loc: (string | number)[] }[],
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.data = data;
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

export function getStoredAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function setStoredAdminToken(token: string | null) {
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }
}

/** Fired whenever the API rejects a request with 401, so the app can clear the session. */
export type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListener = listener;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  isForm?: boolean;
  query?: Record<string, string | number | undefined | null>;
  headers?: Record<string, string>;
  /** Called with the raw response before the body is parsed (e.g. to read X-Total-Count). */
  onResponse?: (response: Response) => void;
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

export function extractMessage(body: ApiErrorBody | undefined, fallback: string): string {
  // The API wraps HTTP errors as { error: { message } }; request-validation errors keep FastAPI's { detail }.
  // Some errors carry details too, as { error: { message: { message, ...details } } }.
  const wrapped = body?.error?.message;
  if (wrapped && typeof wrapped === "object") return typeof wrapped.message === "string" ? wrapped.message : fallback;
  if (wrapped) return wrapped;
  if (!body?.detail) return fallback;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((e) => e.msg).join("; ");
  }
  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, isForm = false, query, headers: extraHeaders, onResponse } = options;

  const headers: Record<string, string> = { ...extraHeaders };
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

  onResponse?.(response);

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
    const wrapped = body?.error?.message;
    const data = wrapped && typeof wrapped === "object" ? (wrapped as Record<string, unknown>) : undefined;

    if (response.status === 401 && auth) {
      unauthorizedListener?.();
    }

    throw new ApiError(message, response.status, fieldErrors, data);
  }

  return json as T;
}

/** Downloads a protected file (e.g. an invoice PDF) using the session token and saves it. */
export async function downloadAuthedFile(path: string, filename: string): Promise<void> {
  const token = getStoredToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    if (response.status === 401) unauthorizedListener?.();
    throw new ApiError(`Could not download the file (${response.status}).`, response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}