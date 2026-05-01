import Constants from "expo-constants";

const DEFAULT_DEV_API_PORT =
  process.env.EXPO_PUBLIC_API_PORT?.replace(/^:/, "") || "3001";

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
export function getApiBaseUrl(): string | null {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL ||
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : null);
  if (fromEnv) {
    return stripTrailingSlashes(fromEnv);
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const host = expoDevHost();
    if (host) {
      return `http://${host}:${DEFAULT_DEV_API_PORT}`;
    }
  }

  return null;
}
