import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  recoveryCodeHash: varchar("recovery_code_hash"),
  passwordResetTokenHash: varchar("password_reset_token_hash"),
  passwordResetTokenExpiresAt: timestamp("password_reset_token_expires_at", {
    withTimezone: true,
  }),
  /**
   * Email confirmation: `null` = account created before verification existed (treated as verified).
   * `false` = pending; `true` = confirmed.
   */
  emailVerified: boolean("email_verified"),
  emailVerifyTokenHash: varchar("email_verify_token_hash"),
  emailVerifyCodeHash: varchar("email_verify_code_hash"),
  emailVerifyTokenExpiresAt: timestamp("email_verify_token_expires_at", {
    withTimezone: true,
  }),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  /** Dietary preference tags (validated in API). */
  dietaryGoals: text("dietary_goals")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  householdSize: integer("household_size").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
