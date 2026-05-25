/**
 * Email verification gate for new signups. Off until App Store launch.
 * Set REQUIRE_EMAIL_VERIFICATION=true on Render to turn it back on.
 */
export function isEmailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
}
