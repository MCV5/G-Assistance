import type { NextFunction, Request, Response } from "express";

/** Authenticated routes allowed before email is confirmed. */
const ALLOW_WHILE_EMAIL_PENDING = new Set([
  "/api/auth/user",
  "/api/auth/logout",
  "/api/auth/verify-email/send",
]);

function normalizePath(url: string): string {
  const path = url.split("?")[0] ?? url;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * Blocks API usage for logged-in users with `emailVerified === false`,
 * except auth endpoints needed to finish verification or end the session.
 */
export function emailVerifiedGate(req: Request, res: Response, next: NextFunction) {
  const path = normalizePath(req.originalUrl || req.url);

  if (!path.startsWith("/api")) {
    next();
    return;
  }

  if (!req.isAuthenticated?.()) {
    next();
    return;
  }

  if (req.user.emailVerified !== false) {
    next();
    return;
  }

  if (ALLOW_WHILE_EMAIL_PENDING.has(path)) {
    next();
    return;
  }

  res.status(403).json({
    error: "Confirm your email address to continue.",
    code: "EMAIL_NOT_VERIFIED",
  });
}
