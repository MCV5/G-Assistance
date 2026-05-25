import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import {
  ConfirmEmailVerificationResponse,
  GetCurrentAuthUserResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegenerateRecoveryCodeResponse,
  SendVerificationEmailResponse,
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
import { isEmailVerificationRequired } from "../lib/features";

const router: IRouter = Router();
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = 72 * 60 * 60 * 1000;
const DEFAULT_APP_NAME = "Goalcery";

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

function buildVerifyEmailWebLink(email: string, token: string): string {
  const base =
    process.env.EMAIL_VERIFICATION_BASE_URL ||
    process.env.PASSWORD_RESET_BASE_URL ||
    process.env.APP_ORIGIN ||
    "http://localhost:8082";
  const url = new URL("/verify-email", base);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return url.toString();
}

function buildVerifyAppDeepLink(email: string, code: string): string {
  const scheme = process.env.APP_DEEP_LINK_SCHEME || "goalcery";
  const q = new URLSearchParams({ email, code });
  return `${scheme}://verify-email?${q.toString()}`;
}

function generateEmailVerificationCredentials(): {
  token: string;
  code: string;
  tokenHash: string;
  codeHash: string;
  expiresAt: Date;
} {
  const token = crypto.randomBytes(32).toString("hex");
  const code = String(crypto.randomInt(100_000, 999_999));
  return {
    token,
    code,
    tokenHash: hashResetToken(token),
    codeHash: hashResetToken(code),
    expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
  };
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
  const appName = process.env.APP_NAME || DEFAULT_APP_NAME;
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

function getVerifyEmailTemplate(opts: {
  code: string;
  webLink: string;
  appLink: string;
}): { text: string; html: string } {
  const appName = process.env.APP_NAME || DEFAULT_APP_NAME;
  const safeAppName = escapeHtml(appName);
  const safeCode = escapeHtml(opts.code);
  const safeWebLink = escapeHtml(opts.webLink);
  const safeAppLink = escapeHtml(opts.appLink);

  const text =
    `${appName}\n\n` +
    "Confirm your email address to finish setting up your account.\n\n" +
    `Your verification code: ${opts.code}\n\n` +
    `Open the ${appName} app, go to the verify-email screen, and enter this code.\n\n` +
    `Or open in the app: ${opts.appLink}\n\n` +
    `Or use this web link: ${opts.webLink}\n\n` +
    "This code expires in 72 hours. If you did not create an account, you can ignore this email.";

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
            <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">Confirm your email</h2>
            <p style="margin:0 0 16px;">Enter this code in the app (Verify email screen):</p>
            <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:6px;color:#14532d;text-align:center;">
              ${safeCode}
            </p>
            <p style="margin:0 0 20px;">
              <a href="${safeAppLink}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                Open in app
              </a>
            </p>
            <p style="margin:0 0 10px;font-size:13px;color:#4b5563;">
              This code expires in 72 hours.
            </p>
            <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;">
              Web link (if you use a browser build):<br/>
              <a href="${safeWebLink}" style="color:#2563eb;">${safeWebLink}</a>
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

function getWelcomeEmailTemplate(displayName: string): { text: string; html: string } {
  const appName = process.env.APP_NAME || DEFAULT_APP_NAME;
  const safeAppName = escapeHtml(appName);
  const safeName = escapeHtml(displayName);

  const text =
    `${appName}\n\n` +
    `Hi ${displayName},\n\n` +
    "Thanks for creating an account.\n\n" +
    "We also sent a separate message with a 6-digit code to confirm your email. " +
    "Enter that code in the app on the verify-email screen.\n\n" +
    "If you did not sign up, you can ignore this email.";

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
            <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">Welcome, ${safeName}</h2>
            <p style="margin:0 0 16px;">Thanks for creating an account.</p>
            <p style="margin:0 0 16px;">
              We sent a <strong>separate email</strong> with a <strong>6-digit verification code</strong>.
              Enter it in the app on the verify-email screen.
            </p>
            <p style="margin:0;font-size:13px;color:#6b7280;">
              If you did not sign up, you can ignore this message.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

function getResendApiKey(): string | undefined {
  const key = process.env.RESEND_API_KEY?.trim();
  return key || undefined;
}

function getMailFrom(): string | undefined {
  const from =
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    process.env.MAIL_FROM;
  const trimmed = from?.trim();
  return trimmed || undefined;
}

function maskFromAddress(from: string): string {
  const at = from.indexOf("@");
  if (at < 1) return "(invalid from address)";
  return `***${from.slice(at)}`;
}

type EmailDeliveryResult = { sent: boolean; error?: string };

async function resendApiSend(payload: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing on the server.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    name?: string;
  };
  if (!res.ok) {
    const detail = body?.message || body?.name || `HTTP ${res.status}`;
    throw new Error(`Resend: ${detail}`);
  }
}

async function sendResetEmailViaResend(
  to: string,
  template: ReturnType<typeof getResetEmailTemplate>,
): Promise<void> {
  const from = getMailFrom();
  if (!from) {
    throw new Error("EMAIL_FROM or SMTP_FROM is missing on the server.");
  }

  const subject = `Reset your ${process.env.APP_NAME || DEFAULT_APP_NAME} password`;
  await resendApiSend({
    from,
    to: [to],
    subject,
    text: template.text,
    html: template.html,
  });
}

async function sendVerifyEmailViaResend(
  to: string,
  template: ReturnType<typeof getVerifyEmailTemplate>,
): Promise<void> {
  const from = getMailFrom();
  if (!from) {
    throw new Error("EMAIL_FROM or SMTP_FROM is missing on the server.");
  }

  const subject = `Confirm your email — ${process.env.APP_NAME || DEFAULT_APP_NAME}`;
  await resendApiSend({
    from,
    to: [to],
    subject,
    text: template.text,
    html: template.html,
  });
}

async function sendVerificationEmail(
  email: string,
  creds: { token: string; code: string },
): Promise<EmailDeliveryResult> {
  const webLink = buildVerifyEmailWebLink(email, creds.token);
  const appLink = buildVerifyAppDeepLink(email, creds.code);
  const template = getVerifyEmailTemplate({
    code: creds.code,
    webLink,
    appLink,
  });

  if (getResendApiKey() && getMailFrom()) {
    try {
      await sendVerifyEmailViaResend(email, template);
      return { sent: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[auth] Resend verify-email send failed:", message);
      console.info(
        `[auth] verify-email fallback for ${email}: code=${creds.code} app=${appLink} web=${webLink}`,
      );
      return { sent: false, error: message };
    }
  }

  if (!process.env.SMTP_URL?.trim() || !getMailFrom()) {
    const missing = !getResendApiKey()
      ? "RESEND_API_KEY is not set on the server."
      : !getMailFrom()
        ? "EMAIL_FROM (or SMTP_FROM) is not set on the server."
        : "Email is not configured.";
    console.info(
      `[auth] verify-email fallback for ${email}: code=${creds.code} (${missing})`,
    );
    return { sent: false, error: missing };
  }

  try {
    const transporter = nodemailer.createTransport(process.env.SMTP_URL);
    await transporter.sendMail({
      from: getMailFrom(),
      to: email,
      subject: `Confirm your email — ${process.env.APP_NAME || DEFAULT_APP_NAME}`,
      text: template.text,
      html: template.html,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth] SMTP verify-email send failed:", message);
    return { sent: false, error: message };
  }
}

async function sendWelcomeEmailViaResend(
  to: string,
  template: ReturnType<typeof getWelcomeEmailTemplate>,
): Promise<void> {
  const from = getMailFrom();
  if (!from) {
    throw new Error("EMAIL_FROM or SMTP_FROM is missing on the server.");
  }

  await resendApiSend({
    from,
    to: [to],
    subject: `Welcome to ${process.env.APP_NAME || DEFAULT_APP_NAME}`,
    text: template.text,
    html: template.html,
  });
}

async function sendWelcomeEmail(
  email: string,
  firstName: string | null,
): Promise<boolean> {
  const displayName = (firstName?.trim() || email.split("@")[0] || "there").trim();
  const template = getWelcomeEmailTemplate(displayName);

  if (getResendApiKey() && getMailFrom()) {
    try {
      await sendWelcomeEmailViaResend(email, template);
      return true;
    } catch (err) {
      console.error("[auth] Resend welcome email failed:", err);
      return false;
    }
  }

  if (!process.env.SMTP_URL?.trim() || !getMailFrom()) {
    return false;
  }

  const transporter = nodemailer.createTransport(process.env.SMTP_URL);
  await transporter.sendMail({
    from: getMailFrom(),
    to: email,
    subject: `Welcome to ${process.env.APP_NAME || DEFAULT_APP_NAME}`,
    text: template.text,
    html: template.html,
  });
  return true;
}

async function sendResetEmail(email: string, link: string): Promise<boolean> {
  const template = getResetEmailTemplate(link);

  if (getResendApiKey() && getMailFrom()) {
    try {
      await sendResetEmailViaResend(email, template);
      return true;
    } catch (err) {
      console.error("[auth] Resend send failed:", err);
      console.info(`[auth] password reset link for ${email}: ${link}`);
      return false;
    }
  }

  if (!process.env.SMTP_URL?.trim() || !getMailFrom()) {
    console.info(`[auth] password reset link for ${email}: ${link}`);
    return false;
  }

  const transporter = nodemailer.createTransport(process.env.SMTP_URL);
  await transporter.sendMail({
    from: getMailFrom(),
    to: email,
    subject: `Reset your ${process.env.APP_NAME || DEFAULT_APP_NAME} password`,
    text: template.text,
    html: template.html,
  });
  return true;
}

function isEmailVerifiedRow(row: typeof usersTable.$inferSelect): boolean {
  if (!isEmailVerificationRequired()) {
    return true;
  }
  if (row.emailVerified === null || row.emailVerified === undefined) {
    return true;
  }
  return row.emailVerified;
}

async function markEmailVerifiedIfDisabled(userId: string): Promise<void> {
  if (isEmailVerificationRequired()) return;
  await db
    .update(usersTable)
    .set({
      emailVerified: true,
      emailVerifyTokenHash: null,
      emailVerifyCodeHash: null,
      emailVerifyTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}

function normalizeProfileImageUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    new URL(value);
    return value;
  } catch {
    return null;
  }
}

function publicUser(row: typeof usersTable.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    profileImageUrl: normalizeProfileImageUrl(row.profileImageUrl),
    createdAt: row.createdAt,
    dietaryGoals: Array.isArray(row.dietaryGoals) ? [...row.dietaryGoals] : [],
    householdSize:
      typeof row.householdSize === "number" && row.householdSize >= 1
        ? row.householdSize
        : 1,
    emailVerified: isEmailVerifiedRow(row),
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

function isLikelyMissingSchemaColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const o = err as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  const code = o.code ?? o.cause?.code;
  const msg = String(o.message ?? o.cause?.message ?? err);
  if (code === "42703") return true;
  if (/column .* does not exist/i.test(msg)) return true;
  if (/relation .* does not exist/i.test(msg)) return true;
  if (/failed query/i.test(msg) && /email_verif/i.test(msg)) return true;
  return false;
}

function respondSchemaNotReady(res: Response): void {
  res.status(503).json({
    error:
      "Sign-up is temporarily unavailable. The server database needs the latest update (email verification columns). Ask the app owner to run the migration on production Postgres, then redeploy.",
  });
}

router.post("/auth/signup", async (req: Request, res: Response) => {
  try {
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

  let existing: typeof usersTable.$inferSelect | undefined;
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email));
    existing = rows[0];
  } catch (err) {
    console.error("[auth] signup lookup failed:", err);
    if (isLikelyMissingSchemaColumnError(err)) {
      respondSchemaNotReady(res);
      return;
    }
    res.status(500).json({ error: "Could not create your account. Please try again." });
    return;
  }
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

  const requireVerify = isEmailVerificationRequired();
  const verification = requireVerify
    ? generateEmailVerificationCredentials()
    : null;

  let created: typeof usersTable.$inferSelect | undefined;
  const fullInsertValues = requireVerify
    ? {
        email,
        passwordHash,
        recoveryCodeHash,
        firstName,
        lastName,
        emailVerified: false as const,
        emailVerifyTokenHash: verification!.tokenHash,
        emailVerifyCodeHash: verification!.codeHash,
        emailVerifyTokenExpiresAt: verification!.expiresAt,
      }
    : {
        email,
        passwordHash,
        recoveryCodeHash,
        firstName,
        lastName,
        emailVerified: true,
        emailVerifyTokenHash: null,
        emailVerifyCodeHash: null,
        emailVerifyTokenExpiresAt: null,
      };
  try {
    const inserted = await db.insert(usersTable).values(fullInsertValues).returning();
    created = inserted[0];
  } catch (err) {
    console.error("[auth] signup insert failed:", err);
    if (isLikelyMissingSchemaColumnError(err)) {
      const msg = String(
        (err as { message?: string; cause?: { message?: string } }).message ??
          (err as { cause?: { message?: string } }).cause?.message ??
          err,
      );
      const codeHashMissing =
        /email_verify_code_hash/i.test(msg) || /email_verify_code/i.test(msg);
      if (codeHashMissing) {
        try {
          const inserted = await db
            .insert(usersTable)
            .values({
              email,
              passwordHash,
              recoveryCodeHash,
              firstName,
              lastName,
              emailVerified: false,
              emailVerifyTokenHash: verification!.tokenHash,
              emailVerifyTokenExpiresAt: verification!.expiresAt,
            })
            .returning();
          created = inserted[0];
        } catch (retryErr) {
          console.error("[auth] signup insert retry (no code hash) failed:", retryErr);
          if (isLikelyMissingSchemaColumnError(retryErr)) {
            respondSchemaNotReady(res);
            return;
          }
          res.status(500).json({ error: "Could not create your account. Please try again." });
          return;
        }
      } else {
        respondSchemaNotReady(res);
        return;
      }
    } else {
      res.status(500).json({ error: "Could not create your account. Please try again." });
      return;
    }
  }

  if (!created) {
    res.status(500).json({ error: "Could not create your account. Please try again." });
    return;
  }

  void sendWelcomeEmail(email, firstName).catch((err) => {
    console.error("[auth] welcome email:", err);
  });
  const emailDelivery = requireVerify
    ? await sendVerificationEmail(email, {
        token: verification!.token,
        code: verification!.code,
      })
    : { sent: true as const };
  if (requireVerify && !emailDelivery.sent) {
    console.warn(
      `[auth] verification email NOT sent to ${email}: ${emailDelivery.error ?? "unknown"} code=${verification!.code}`,
    );
  }

  try {
    const user = publicUser(created);
    const sessionData: SessionData = { user };
    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    const payload = {
      user,
      token: sid,
      recoveryCode,
      verificationEmailSent: emailDelivery.sent,
      verificationEmailError: emailDelivery.error,
    };
    const parsedResponse = SignupResponse.safeParse({
      user,
      token: sid,
      recoveryCode,
    });
    if (!parsedResponse.success) {
      console.error("[auth] signup response validation:", parsedResponse.error.flatten());
      res.json(payload);
      return;
    }
    res.json({
      ...parsedResponse.data,
      verificationEmailSent: emailDelivery.sent,
      verificationEmailError: emailDelivery.error,
    });
  } catch (err) {
    console.error("[auth] signup session or response failed:", err);
    if (isLikelyMissingSchemaColumnError(err)) {
      respondSchemaNotReady(res);
      return;
    }
    res.status(500).json({ error: "Could not create your account. Please try again." });
  }
  } catch (err) {
    console.error("[auth] signup unhandled:", err);
    if (isLikelyMissingSchemaColumnError(err)) {
      respondSchemaNotReady(res);
      return;
    }
    res.status(500).json({ error: "Could not create your account. Please try again." });
  }
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

  await markEmailVerifiedIfDisabled(row.id);

  const [freshRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, row.id));
  const user = publicUser(freshRow ?? row);
  const sessionData: SessionData = { user };
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  const payload = { user, token: sid };
  const parsedResponse = LoginResponse.safeParse(payload);
  if (!parsedResponse.success) {
    console.error("[auth] login response validation:", parsedResponse.error.flatten());
    res.json(payload);
    return;
  }
  res.json(parsedResponse.data);
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

const ConfirmEmailVerificationBodySchema = z
  .object({
    email: z.string().email(),
    token: z.string().min(20).optional(),
    code: z.string().regex(/^\d{6}$/).optional(),
  })
  .refine((body) => Boolean(body.token || body.code), {
    message: "Provide the 6-digit code or the link token.",
  });

router.post("/auth/verify-email/confirm", async (req: Request, res: Response) => {
  const parsed = ConfirmEmailVerificationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Please provide your email and either the 6-digit code or the link token.",
    });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const usingCode = Boolean(parsed.data.code);
  const submittedHash = hashResetToken(
    usingCode ? parsed.data.code! : parsed.data.token!,
  );

  const [row] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!row) {
    res.status(401).json({ error: "This verification code is invalid or expired." });
    return;
  }

  if (isEmailVerifiedRow(row)) {
    res.json(ConfirmEmailVerificationResponse.parse({ success: true }));
    return;
  }

  if (!row.emailVerifyTokenExpiresAt || row.emailVerifyTokenExpiresAt < new Date()) {
    res.status(401).json({ error: "This verification code is invalid or expired." });
    return;
  }

  const expectedHash = usingCode ? row.emailVerifyCodeHash : row.emailVerifyTokenHash;
  if (!expectedHash || submittedHash !== expectedHash) {
    res.status(401).json({ error: "This verification code is invalid or expired." });
    return;
  }

  await db
    .update(usersTable)
    .set({
      emailVerified: true,
      emailVerifyTokenHash: null,
      emailVerifyCodeHash: null,
      emailVerifyTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, row.id));

  res.json(ConfirmEmailVerificationResponse.parse({ success: true }));
});

router.post("/auth/verify-email/send", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (!row?.email) {
    res.status(400).json({ error: "No email on file." });
    return;
  }

  if (isEmailVerifiedRow(row)) {
    res.json(SendVerificationEmailResponse.parse({ success: true }));
    return;
  }

  const verification = generateEmailVerificationCredentials();

  await db
    .update(usersTable)
    .set({
      emailVerifyTokenHash: verification.tokenHash,
      emailVerifyCodeHash: verification.codeHash,
      emailVerifyTokenExpiresAt: verification.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, row.id));

  const emailDelivery = await sendVerificationEmail(row.email, {
    token: verification.token,
    code: verification.code,
  });
  if (!emailDelivery.sent) {
    console.warn(
      `[auth] resend verify-email NOT sent to ${row.email}: ${emailDelivery.error ?? "unknown"} code=${verification.code}`,
    );
  }

  res.status(emailDelivery.sent ? 200 : 503).json({
    success: emailDelivery.sent,
    emailSent: emailDelivery.sent,
    error: emailDelivery.error,
  });
});

/**
 * Safe diagnostics — open in a browser after deploy:
 * https://<your-service>.onrender.com/api/auth/email-config
 */
router.get("/auth/email-config", (_req, res) => {
  const key = getResendApiKey();
  const from = getMailFrom();
  const smtp = process.env.SMTP_URL?.trim();

  let hint: string | undefined;
  if (!key && !smtp) {
    hint =
      "Add RESEND_API_KEY and EMAIL_FROM on Render → Environment, then redeploy.";
  } else if (key && !from) {
    hint =
      'Add EMAIL_FROM (e.g. Goalcery <noreply@your-verified-domain.com>). The domain must be verified in Resend.';
  } else if (key && from && !from.includes("@")) {
    hint = 'EMAIL_FROM must look like: Goalcery <name@your-domain.com>';
  } else if (key && from) {
    hint =
      "Resend env vars are present. If users still get no mail, check Resend → Emails for bounces and confirm the FROM domain is verified. On Resend test mode, mail may only reach your Resend account email.";
  }

  res.json({
    resendApiKeyPresent: Boolean(key),
    fromAddressPresent: Boolean(from),
    fromAddressMasked: from ? maskFromAddress(from) : null,
    smtpUrlPresent: Boolean(smtp),
    ready: Boolean((key && from) || (smtp && from)),
    hint,
  });
});

export default router;
