import Constants from "expo-constants";
import { setBaseUrl } from "@workspace/api-client-react";

const DEFAULT_DEV_API_PORT =
  process.env.EXPO_PUBLIC_API_PORT?.replace(/^:/, "") || "3001";

/** Used when no .env / dev host is available (common with Expo Go testers). */
export const PRODUCTION_API_URL = "https://g-assistance.onrender.com";

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Host that serves Metro; same machine also runs the local API in dev. */
function expoDevHost(): string | null {
  const expoConfig = Constants.expoConfig as
    | { hostUri?: string; debuggerHost?: string }
    | undefined;
  if (expoConfig?.hostUri) {
    const host = expoConfig.hostUri.split(":")[0];
    return host || null;
  }
  if (expoConfig?.debuggerHost) {
    const host = expoConfig.debuggerHost.split(":")[0];
    return host || null;
  }
  const manifest = Constants.manifest as { debuggerHost?: string } | null;
  if (manifest?.debuggerHost) {
    return manifest.debuggerHost.split(":")[0] ?? null;
  }
  const m2 = Constants.manifest2 as
    | { extra?: { expoClient?: { hostUri?: string } } }
    | undefined;
  const uri = m2?.extra?.expoClient?.hostUri;
  if (uri) {
    return uri.split(":")[0] ?? null;
  }
  return null;
}

/**
 * API origin (no trailing slash), or null if not configured.
 * When `EXPO_PUBLIC_API_URL` is unset in development, uses the Expo dev host
 * and port `EXPO_PUBLIC_API_PORT` (default 3001) so a physical device can reach
 * `pnpm dev:api` on your machine.
 */
function apiUrlFromExpoConfig(): string | null {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  const url = extra?.apiUrl?.trim();
  return url ? stripTrailingSlashes(url) : null;
}

export function getApiBaseUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL ||
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : null);
  if (fromEnv) {
    return stripTrailingSlashes(fromEnv);
  }

  const fromConfig = apiUrlFromExpoConfig();
  if (fromConfig) {
    return fromConfig;
  }

  // Prefer production over LAN :3001 — Expo Go often has a dev host but no local API.
  if (!wantsLocalApi()) {
    return PRODUCTION_API_URL;
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const host = expoDevHost();
    if (host) {
      return `http://${host}:${DEFAULT_DEV_API_PORT}`;
    }
  }

  return PRODUCTION_API_URL;
}

function wantsLocalApi(): boolean {
  const flag = process.env.EXPO_PUBLIC_USE_LOCAL_API?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  return Boolean(url && /^https?:\/\//i.test(url) && /localhost|127\.0\.0\.1/i.test(url));
}

/** Keep the API client base URL in sync (call on app start and before auth). */
export function configureApiClient(): string {
  const base = getApiBaseUrl();
  setBaseUrl(base);
  return base;
}
