const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

type ApiOptions = { headers?: Record<string, string>; signal?: AbortSignal };
type UploadOptions = ApiOptions & { method?: "POST" | "PUT" | "PATCH" };

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

async function request<T>(method: string, path: string, body?: any, opts?: ApiOptions): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = getAuthToken();

  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {}),
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    signal: opts?.signal,
  });

  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return (await res.text()) as any;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string, opts?: ApiOptions) => request<T>("GET", path, undefined, opts);
export const apiPost = <T>(path: string, body?: any, opts?: ApiOptions) => request<T>("POST", path, body, opts);
export const apiPatch = <T>(path: string, body?: any, opts?: ApiOptions) => request<T>("PATCH", path, body, opts);
export const apiDel = <T>(path: string, opts?: ApiOptions) => request<T>("DELETE", path, undefined, opts);
export const apiUpload = <T>(path: string, formData: FormData, opts?: UploadOptions) =>
  request<T>(opts?.method ?? "POST", path, formData, opts);

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => apiGet<T>(path, opts),
  post: <T>(path: string, body?: any, opts?: ApiOptions) => apiPost<T>(path, body, opts),
  patch: <T>(path: string, body?: any, opts?: ApiOptions) => apiPatch<T>(path, body, opts),
  del: <T>(path: string, opts?: ApiOptions) => apiDel<T>(path, opts),
};