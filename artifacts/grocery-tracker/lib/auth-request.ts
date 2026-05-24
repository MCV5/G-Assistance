import { configureApiClient } from "@/lib/apiBase";

export class AuthRequestError extends Error {
  readonly name = "AuthRequestError";
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function shouldRetry(err: unknown): boolean {
  if (err instanceof AuthRequestError && err.status >= 500) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("aborted") ||
    msg.includes("timeout")
  );
}

/** POST JSON to the API with Render-friendly timeout and one retry. */
export async function authPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const base = configureApiClient();
  const url = `${base}${path}`;
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90_000);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const raw = await response.text();
      let parsed: (T & { error?: string }) | null = null;
      if (raw.trim()) {
        try {
          parsed = JSON.parse(raw) as T & { error?: string };
        } catch {
          throw new AuthRequestError(
            response.status,
            response.status >= 500
              ? "Server is waking up. Wait a few seconds and try again."
              : `Unexpected server response (${response.status}).`,
          );
        }
      }

      if (!response.ok) {
        throw new AuthRequestError(
          response.status,
          parsed?.error || `Request failed (${response.status}).`,
        );
      }
      if (!parsed) {
        throw new AuthRequestError(response.status, "Empty response from server.");
      }
      return parsed as T;
    } catch (err) {
      lastErr = err;
      if (attempt === 0 && shouldRetry(err)) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
