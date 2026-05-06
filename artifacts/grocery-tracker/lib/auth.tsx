import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

import {
  getCurrentAuthUser,
  login as apiLogin,
  logout as apiLogout,
  regenerateRecoveryCode as apiRegenerateRecoveryCode,
  signup as apiSignup,
  type AuthUser,
} from "@workspace/api-client-react";

import { getApiBaseUrl } from "@/lib/apiBase";

const AUTH_TOKEN_KEY = "auth_session_token";
const AUTH_BOOT_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Auth bootstrap timed out."));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function postPublicAuthJson<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error(
      "API is not configured. Set EXPO_PUBLIC_API_URL, or run the app in development with the API server (pnpm dev:api) on the default port.",
    );
  }
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data?.error || "Request failed.");
  }
  return data;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pendingRecoveryCode: string | null;
  /** Refetch /auth/user without clearing the session on failure (e.g. after profile PATCH). */
  syncAuthUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  acknowledgeRecoveryCode: () => void;
  requestPasswordReset: (email: string) => Promise<{ resetLink?: string }>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<void>;
  regenerateRecoveryCode: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  pendingRecoveryCode: null,
  syncAuthUser: async () => {},
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  acknowledgeRecoveryCode: () => {},
  requestPasswordReset: async () => ({}),
  resetPassword: async () => {},
  regenerateRecoveryCode: async () => "",
});

async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch {}
}

async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      const token = await readToken();
      if (!token) {
        setUser(null);
        return;
      }
      const data = await withTimeout(getCurrentAuthUser(), AUTH_BOOT_TIMEOUT_MS);
      if (data?.user) {
        setUser(data.user);
      } else {
        await clearToken();
        setUser(null);
      }
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  const syncAuthUser = useCallback(async (): Promise<void> => {
    try {
      const token = await readToken();
      if (!token) return;
      const data = await getCurrentAuthUser();
      if (data?.user) setUser(data.user);
    } catch {
      /* keep existing user; network or transient errors */
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const handleAuthSuccess = useCallback(
    async (token: string, nextUser: AuthUser) => {
      await writeToken(token);
      setUser(nextUser);
    },
    [],
  );

  const login = useCallback<AuthContextValue["login"]>(
    async (email, password) => {
      const result = await apiLogin({ email, password });
      await handleAuthSuccess(result.token, result.user);
    },
    [handleAuthSuccess],
  );

  const signup = useCallback<AuthContextValue["signup"]>(
    async (email, password, firstName) => {
      const result = await apiSignup({
        email,
        password,
        firstName: firstName?.trim() || undefined,
      });
      setPendingRecoveryCode(result.recoveryCode);
      await handleAuthSuccess(result.token, result.user);
    },
    [handleAuthSuccess],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {}
    await clearToken();
    setUser(null);
    setPendingRecoveryCode(null);
  }, []);

  const acknowledgeRecoveryCode = useCallback(() => {
    setPendingRecoveryCode(null);
  }, []);

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(
    async (email) => {
      return postPublicAuthJson<{ success: boolean; resetLink?: string }>(
        "/api/auth/forgot-password",
        { email },
      );
    },
    [],
  );

  const resetPassword = useCallback<AuthContextValue["resetPassword"]>(
    async (email, token, newPassword) => {
      await postPublicAuthJson<{ success: boolean }>("/api/auth/reset-password", {
        email,
        token,
        newPassword,
      });
    },
    [],
  );

  const regenerateRecoveryCode = useCallback(async () => {
    const result = await apiRegenerateRecoveryCode();
    return result.recoveryCode;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        pendingRecoveryCode,
        syncAuthUser,
        login,
        signup,
        logout,
        acknowledgeRecoveryCode,
        requestPasswordReset,
        resetPassword,
        regenerateRecoveryCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
