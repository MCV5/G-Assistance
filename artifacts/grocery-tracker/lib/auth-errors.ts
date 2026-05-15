import { HttpApiError } from "@workspace/api-client-react";

import { getApiBaseUrl } from "@/lib/apiBase";

type AuthAction = "login" | "signup" | "resetPassword";

interface ApiErrorShape {
  status?: number;
  message?: string;
  response?: {
    status?: number;
    data?: {
      error?: string;
      message?: string;
    };
  };
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getErrorDetails(error: unknown): { status?: number; message: string } {
  if (error instanceof HttpApiError) {
    const data = error.data as { error?: string; message?: string } | null;
    return {
      status: error.status,
      message:
        normalizeText(data?.error) ||
        normalizeText(data?.message) ||
        normalizeText(error.message),
    };
  }

  const err = (error ?? {}) as ApiErrorShape & {
    status?: number;
    data?: { error?: string; message?: string } | null;
  };
  const status = err.status ?? err.response?.status;
  const fromFetchBody =
    normalizeText(err.data?.error) ||
    normalizeText(err.data?.message);
  const rawMessage =
    fromFetchBody ||
    normalizeText(err.response?.data?.error) ||
    normalizeText(err.response?.data?.message) ||
    normalizeText(err.message);

  return { status, message: rawMessage };
}

function isHtmlErrorBody(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("<!doctype") ||
    lower.includes("<html") ||
    lower.includes("internal server error</pre>")
  );
}

function isNetworkMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error")
  );
}

export function getAuthErrorStatus(error: unknown): number | undefined {
  return getErrorDetails(error).status;
}

export function getAuthErrorMessage(error: unknown, action: AuthAction): string {
  const { status, message } = getErrorDetails(error);

  if (
    message.toLowerCase().includes("api is not configured") ||
    message.toLowerCase().includes("expo_public_api_url")
  ) {
    return "This build is not connected to the server. Fully quit Expo Go, run the app again from the project that includes the API URL, then try sign-up.";
  }

  if (isNetworkMessage(message)) {
    const api = getApiBaseUrl();
    if (api) {
      return `We couldn't reach the server (${api}). Check Wi‑Fi and that the API is running, then reload the app.`;
    }
    return "We couldn't reach the server. Set EXPO_PUBLIC_API_URL in .env to your API (e.g. https://g-assistance.onrender.com), restart Expo, and try again.";
  }

  if (isHtmlErrorBody(message) || (status === 500 && message.includes("HTTP 500"))) {
    if (action === "signup") {
      return "The server had a problem creating your account. The database may need an update on Render — run the email-verification migration on Postgres, redeploy the API, then try again.";
    }
    return "The server had a problem. Please try again in a moment.";
  }

  if (action === "login") {
    if (status === 401 || message.toLowerCase().includes("invalid email or password")) {
      return "Email or password didn't match. Please try again.";
    }
    return "Couldn't log you in right now. Please try again.";
  }

  if (action === "signup") {
    if (status === 409 || message.toLowerCase().includes("already exists")) {
      return "That email is already registered. Try logging in instead.";
    }
    if (status === 400) {
      return "Please review your details and try again.";
    }
    if (status === 503 && message) {
      return message;
    }
    if (status === 500 && message && message.length > 0 && message.length < 220) {
      return message;
    }
    return "Couldn't create your account right now. Please try again.";
  }

  if (action === "resetPassword") {
    const lower = message.toLowerCase();
    if (
      status === 401 ||
      lower.includes("reset link is invalid or expired") ||
      lower.includes("verification link is invalid or expired")
    ) {
      return "This link is invalid or expired. Request a new one and try again.";
    }
    if (status === 400) {
      return "Please check each field and try again.";
    }
    return "Couldn't reset your password right now. Please try again.";
  }

  return "Something went wrong. Please try again.";
}
