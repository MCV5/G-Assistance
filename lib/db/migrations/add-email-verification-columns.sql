-- Run once on production Postgres (e.g. Render → Database → Connect → psql or SQL shell).
-- Required for signup / email verification after the email-verification feature shipped.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token_hash varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token_expires_at timestamptz;
