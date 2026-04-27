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
  const err = (error ?? {}) as ApiErrorShape;
  const status = err.response?.status ?? err.status;
  const rawMessage =
    normalizeText(err.response?.data?.error) ||
    normalizeText(err.response?.data?.message) ||
    normalizeText(err.message);

  return { status, message: rawMessage };
}

function isNetworkMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error")
  );
}

export function getAuthErrorMessage(error: unknown, action: AuthAction): string {
  const { status, message } = getErrorDetails(error);

  if (isNetworkMessage(message)) {
    return "We couldn't reach the server. Check your connection and try again.";
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
    return "Couldn't create your account right now. Please try again.";
  }

  if (action === "resetPassword") {
    if (
      status === 401 ||
      message.toLowerCase().includes("recovery code is incorrect") ||
      message.toLowerCase().includes("email or recovery code is incorrect")
    ) {
      return "That email and recovery code don't match. Please check and try again.";
    }
    if (status === 400) {
      return "Please check each field and try again.";
    }
    return "Couldn't reset your password right now. Please try again.";
  }

  return "Something went wrong. Please try again.";
}
