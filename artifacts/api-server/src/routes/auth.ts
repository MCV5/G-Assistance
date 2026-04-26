import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import {
  GetCurrentAuthUserResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  SignupBody,
  SignupResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  createSession,
  getSessionId,
  setSessionCookie,
  type SessionData,
} from "../lib/auth";

const router: IRouter = Router();

function publicUser(row: typeof usersTable.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    profileImageUrl: row.profileImageUrl,
  };
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/signup", async (req: Request, res: Response) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Please enter a valid email and a password (6+ chars)." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const firstName = parsed.data.firstName?.trim() || null;
  const lastName = parsed.data.lastName?.trim() || null;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const [created] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      firstName,
      lastName,
    })
    .returning();

  const user = publicUser(created);
  const sessionData: SessionData = { user };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json(SignupResponse.parse({ user, token: sid }));
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();

  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!row || !row.passwordHash) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const ok = await bcrypt.compare(parsed.data.password, row.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const user = publicUser(row);
  const sessionData: SessionData = { user };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json(LoginResponse.parse({ user, token: sid }));
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json(LogoutResponse.parse({ success: true }));
});

export default router;
