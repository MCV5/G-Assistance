import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import {
  GetCurrentAuthUserResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegenerateRecoveryCodeResponse,
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
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

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

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetLink(email: string, token: string): string {
  const base =
    process.env.PASSWORD_RESET_BASE_URL ||
    process.env.APP_ORIGIN ||
    "http://localhost:8082";
  const url = new URL("/forgot-password", base);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getResetEmailTemplate(link: string): { text: string; html: string } {
  const appName = process.env.APP_NAME || "Grocery Tracker";
  const safeAppName = escapeHtml(appName);
  const safeLink = escapeHtml(link);

  const text =
    `${appName}\n\n` +
    "We received a request to reset your password.\n\n" +
    `Reset password: ${link}\n\n` +
    "This link expires in 1 hour. If you did not request this, you can ignore this email.";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;background:#f8fafc;padding:24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;background:#f0fdf4;">
            <h1 style="margin:0;font-size:20px;color:#14532d;">${safeAppName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">Reset your password</h2>
            <p style="margin:0 0 16px;">We received a request to reset your password.</p>
            <p style="margin:0 0 20px;">
              <a href="${safeLink}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                Reset password
              </a>
            </p>
            <p style="margin:0 0 10px;font-size:13px;color:#4b5563;">
              This link expires in 1 hour.
            </p>
            <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;">
              If the button does not work, copy and paste this URL:<br/>
              <a href="${safeLink}" style="color:#2563eb;">${safeLink}</a>
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

function getMailFrom(): string | undefined {
  return process.env.SMTP_FROM || process.env.EMAIL_FROM;
}

async function sendResetEmailViaResend(
  to: string,
  template: ReturnType<typeof getResetEmailTemplate>,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getMailFrom();
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and SMTP_FROM or EMAIL_FROM are required for Resend.");
  }

  const subject = `Reset your ${process.env.APP_NAME || "Grocery Tracker"} password`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: template.text,
      html: template.html,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new Error(body?.message || `Resend error: ${res.status}`);
  }
}

async function sendResetEmail(email: string, link: string): Promise<boolean> {
  const template = getResetEmailTemplate(link);

  if (process.env.RESEND_API_KEY && getMailFrom()) {
    try {
      await sendResetEmailViaResend(email, template);
      return true;
    } catch (err) {
      console.error("[auth] Resend send failed:", err);
      console.info(`[auth] password reset link for ${email}: ${link}`);
      return false;
    }
  }

  if (!process.env.SMTP_URL || !getMailFrom()) {
    console.info(`[auth] password reset link for ${email}: ${link}`);
    return false;
  }

  const transporter = nodemailer.createTransport(process.env.SMTP_URL);
  await transporter.sendMail({
    from: getMailFrom(),
    to: email,
    subject: `Reset your ${process.env.APP_NAME || "Grocery Tracker"} password`,
    text: template.text,
    html: template.html,
  });
  return true;
}

function publicUser(row: typeof usersTable.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    profileImageUrl: row.profileImageUrl,
    createdAt: row.createdAt,
    dietaryGoals: [...row.dietaryGoals],
    householdSize: row.householdSize,
  };
}

router.get("/auth/user", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json(GetCurrentAuthUserResponse.parse({ user: null }));
    return;
  }

  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  if (!row) {
    res.json(GetCurrentAuthUserResponse.parse({ user: null }));
    return;
  }

  res.json(GetCurrentAuthUserResponse.parse({ user: publicUser(row) }));
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
  const parsed = z
    .object({
      email: z.string().email(),
      token: z.string().min(20),
      newPassword: z.string().min(6),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Please provide your email, reset token, and a new password (6+ chars)." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const submittedTokenHash = hashResetToken(parsed.data.token);

  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  const rowWithReset = row as
    | (typeof row & {
        passwordResetTokenHash?: string | null;
        passwordResetTokenExpiresAt?: Date | null;
      })
    | undefined;

  if (
    !rowWithReset ||
    !rowWithReset.passwordResetTokenHash ||
    !rowWithReset.passwordResetTokenExpiresAt ||
    rowWithReset.passwordResetTokenExpiresAt < new Date()
  ) {
    res.status(401).json({ error: "This reset link is invalid or expired." });
    return;
  }

  if (submittedTokenHash !== rowWithReset.passwordResetTokenHash) {
    res.status(401).json({ error: "This reset link is invalid or expired." });
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
      recoveryCodeHash: newRecoveryCodeHash, // maintained for backward compatibility
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      updatedAt: new Date(),
    } as any)
    .where(eq(usersTable.id, row.id));

  res.json({ success: true });
});

router.post("/auth/forgot-password", async (req: Request, res: Response) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter a valid email." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  // Always return success to avoid leaking account existence.
  if (!row) {
    res.json({ success: true });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  const resetLink = buildResetLink(email, token);

  await db
    .update(usersTable)
    .set({
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    } as any)
    .where(eq(usersTable.id, row.id));

  const delivered = await sendResetEmail(email, resetLink);

  if (process.env.NODE_ENV !== "production" && !delivered) {
    res.json({ success: true, resetLink });
    return;
  }

  res.json({ success: true });
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
