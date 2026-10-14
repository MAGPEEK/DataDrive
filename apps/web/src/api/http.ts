export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: string;
  message?: string;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Sends a request with the session cookie and returns the parsed JSON body (or undefined). */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const body = await readBody(response);
  if (!response.ok) {
    const error = (typeof body === "object" && body !== null ? body : {}) as ErrorBody;
    throw new ApiError(
      response.status,
      error.error ?? "unknown",
      error.message ?? response.statusText,
    );
  }
  return body as T;
}

export const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.set(key, value);
  }
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
}
