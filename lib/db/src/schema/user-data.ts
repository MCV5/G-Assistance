import { sql } from "drizzle-orm";
import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const userDataTable = pgTable("user_data", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  pantry: jsonb("pantry").notNull().default(sql`'[]'::jsonb`),
  scans: jsonb("scans").notNull().default(sql`'[]'::jsonb`),
  shoppingList: jsonb("shopping_list").notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserDataRow = typeof userDataTable.$inferSelect;
export type UserDataInsert = typeof userDataTable.$inferInsert;
