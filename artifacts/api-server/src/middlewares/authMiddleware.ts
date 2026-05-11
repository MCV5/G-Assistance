import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { clearSession, getSessionId, getSession } from "../lib/auth";

function normalizeAuthUser(raw: AuthUser | undefined): AuthUser | undefined {
  if (!raw?.id) return undefined;
  const createdAt =
    raw.createdAt instanceof Date
      ? raw.createdAt
      : raw.createdAt
        ? new Date(raw.createdAt as unknown as string)
        : new Date(0);
  const emailVerified = raw.emailVerified === false ? false : true;

  return {
    id: raw.id,
    email: raw.email ?? null,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    profileImageUrl: raw.profileImageUrl ?? null,
    createdAt,
    dietaryGoals: Array.isArray(raw.dietaryGoals) ? raw.dietaryGoals : [],
    householdSize:
      typeof raw.householdSize === "number" &&
      raw.householdSize >= 1 &&
      raw.householdSize <= 8
        ? raw.householdSize
        : 1,
    emailVerified,
  };
}

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  const user = normalizeAuthUser(session.user as AuthUser);
  if (!user) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = user;
  next();
}
