export interface SessionUser {
  id: number;
  name: string;
  email: string;
  account_type: "shop" | "admin";
  email_verified: boolean;
  email_verification_required: boolean;
  shop: {
    id: number;
    name: string;
    phone?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
    timezone?: string;
    currency?: string | null;
    settings_version?: number;
    status: "pending" | "active" | "suspended";
  } | null;
  role: string | null;
  permissions: string[];
}
export function canAccessVerifiedAccount(
  user: SessionUser | null | undefined,
): user is SessionUser {
  return (
    !!user &&
    (user.email_verified || user.email_verification_required === false)
  );
}
export interface ApiEnvelope<T> {
  data: T;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
    public requestId?: string,
  ) {
    super(message);
  }
}
export function safeReturn(value: string | null, fallback = "/") {
  return value &&
    /^\/(?![/\\])/.test(value) &&
    !value.includes("://") &&
    !value.startsWith("/auth")
    ? value
    : fallback;
}
export function createApi(actor: "shop" | "admin") {
  const authPath = actor === "admin" ? "/admin/auth" : "/auth";
  async function request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    headers.set("X-Requested-With", "XMLHttpRequest");
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (options.method && options.method !== "GET") {
      const csrf = await fetch("/api/v1" + authPath + "/csrf", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!csrf.ok)
        throw new ApiError(
          csrf.status,
          "Unable to establish a secure session. Please try again.",
        );
      const { token } = await csrf.json();
      if (typeof token !== "string" || !token)
        throw new ApiError(
          419,
          "Unable to establish a secure session. Please try again.",
        );
      headers.set("X-CSRF-TOKEN", token);
    }
    const response = await fetch("/api/v1" + path, {
      ...options,
      credentials: "same-origin",
      headers,
    });
    if (response.status === 204) return undefined as T;
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new ApiError(
        response.status,
        "The server returned an unexpected response. Please try again.",
      );
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith(authPath + "/"))
        window.dispatchEvent(new Event("optical:unauthenticated"));
      throw new ApiError(
        response.status,
        body.message || "Unable to complete this request.",
        body.errors || {},
        body.request_id,
      );
    }
    return body as T;
  }
  return {
    request,
    auth: <T>(path: string, body?: object) =>
      request<T>(
        authPath + path,
        body ? { method: "POST", body: JSON.stringify(body) } : {},
      ),
    post: <T>(path: string, body: object = {}) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  };
}
