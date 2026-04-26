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
  resetPassword as apiResetPassword,
  signup as apiSignup,
  type AuthUser,
} from "@workspace/api-client-react";

const AUTH_TOKEN_KEY = "auth_session_token";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pendingRecoveryCode: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  acknowledgeRecoveryCode: () => void;
  resetPassword: (
    email: string,
    recoveryCode: string,
    newPassword: string,
  ) => Promise<string>;
  regenerateRecoveryCode: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  pendingRecoveryCode: null,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  acknowledgeRecoveryCode: () => {},
  resetPassword: async () => "",
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
      const data = await getCurrentAuthUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        await clearToken();
        setUser(null);
      }
    } catch {
      setUser(null);
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

  const resetPassword = useCallback<AuthContextValue["resetPassword"]>(
    async (email, recoveryCode, newPassword) => {
      const result = await apiResetPassword({
        email,
        recoveryCode,
        newPassword,
      });
      return result.recoveryCode;
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
        login,
        signup,
        logout,
        acknowledgeRecoveryCode,
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
