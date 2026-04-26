import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  GetCurrentAuthUserResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegenerateRecoveryCodeResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
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

const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let chunk = "";
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      chunk += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
    }
    groups.push(chunk);
  }
  return groups.join("-");
}

function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

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
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await bcrypt.hash(
    normalizeRecoveryCode(recoveryCode),
    10,
  );

  const [created] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      recoveryCodeHash,
      firstName,
      lastName,
    })
    .returning();

  const user = publicUser(created);
  const sessionData: SessionData = { user };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json(SignupResponse.parse({ user, token: sid, recoveryCode }));
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

router.post("/auth/reset-password", async (req: Request, res: Response) => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Please enter your email, recovery code, and a new password (6+ chars)." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const submitted = normalizeRecoveryCode(parsed.data.recoveryCode);

  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!row || !row.recoveryCodeHash) {
    res.status(401).json({ error: "Email or recovery code is incorrect." });
    return;
  }

  const ok = await bcrypt.compare(submitted, row.recoveryCodeHash);
  if (!ok) {
    res.status(401).json({ error: "Email or recovery code is incorrect." });
    return;
  }

  const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  const newRecoveryCode = generateRecoveryCode();
  const newRecoveryCodeHash = await bcrypt.hash(
    normalizeRecoveryCode(newRecoveryCode),
    10,
  );

  await db
    .update(usersTable)
    .set({
      passwordHash: newPasswordHash,
      recoveryCodeHash: newRecoveryCodeHash,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, row.id));

  res.json(
    ResetPasswordResponse.parse({ success: true, recoveryCode: newRecoveryCode }),
  );
});

router.post("/auth/recovery-code", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await bcrypt.hash(
    normalizeRecoveryCode(recoveryCode),
    10,
  );

  await db
    .update(usersTable)
    .set({ recoveryCodeHash, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user.id));

  res.json(RegenerateRecoveryCodeResponse.parse({ recoveryCode }));
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json(LogoutResponse.parse({ success: true }));
});

export default router;
