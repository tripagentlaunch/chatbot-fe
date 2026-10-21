const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "tripagent.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const OFFLINE_MESSAGE = "We couldn't reach Tara just now. Please try again in a moment.";

// The backend can be waking up or mid-deploy (2026-10-12): the request then
// fails with no response at all, which showed as "Something went wrong."
// Network failures and 502-504s are retried a few times before giving up.
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const waits = [1500, 4000, 8000];
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (![502, 503, 504].includes(res.status) || attempt >= waits.length) return res;
    } catch {
      if (attempt >= waits.length) throw new ApiError(0, OFFLINE_MESSAGE);
    }
    await new Promise((r) => setTimeout(r, waits[attempt]));
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetchWithRetry(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error ?? body.detail?.error ?? (res.status >= 500 ? OFFLINE_MESSAGE : "Something went wrong.");
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
};

/** A file the member attached in the composer: base64 without the data: prefix. */
export interface ChatAttachment {
  name: string;
  mediaType: string;
  data: string;
}

export async function streamChat(
  message: string,
  chatId: string | undefined,
  onEvent: (event: Record<string, unknown>) => void,
  attachments: ChatAttachment[] = [],
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(attachments.length ? { message, chatId, attachments } : { message, chatId }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error ?? body.detail?.error ?? (res.status >= 500 ? OFFLINE_MESSAGE : "Something went wrong.");
    throw new ApiError(res.status, msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const payload = line.replace(/^data: /, "").trim();
      if (payload) onEvent(JSON.parse(payload));
    }
  }
}

export { BASE_URL };
