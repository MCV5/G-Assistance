# Workspace

## Overview

Grocery Tracker — an Expo (React Native) mobile app that uses AI vision to extract grocery items from photos of receipts, shopping bags, and carts. The app tracks pantry inventory, learns each user's purchase cadence per item, and predicts when to restock.

## Architecture

This is a pnpm monorepo with the following workspace structure:

- **`artifacts/grocery-tracker`** — The Expo mobile app (also runs on web).
  - 5 tabs: Home, Pantry, Scan, Shop, Insights.
  - Auth-gated: unauthenticated users see `app/login.tsx` (login + signup tabs with a "How it works" preview); auth state managed by `lib/auth.tsx`.
  - Auth is **email + password** (bcrypt-hashed). Successful signup/login returns a session token stored in `expo-secure-store`. The generated API client attaches it as `Bearer` via `setAuthTokenGetter` (configured in `app/_layout.tsx`).
  - Persistence is **server-synced** through `lib/storage.ts` (calls `GET/PUT /api/me/store`). `PantryContext` loads on login, debounce-saves on every mutation, and clears on logout.
  - Profile + log out UI lives in the Insights tab (`components/ProfileCard.tsx`).
  - Image capture via `expo-image-picker`; barcode via `expo-camera` + Open Food Facts.
  - Theme: sage green on cream; Inter font family.

- **`artifacts/api-server`** — Express API.
  - Wired with `cors({credentials:true})`, `cookieParser`, `authMiddleware` (sessions + Bearer token), JSON body limit 20 MB.
  - `POST /api/analyze-receipt` — Gemini `gemini-2.5-flash` vision → `ExtractedItem[]`.
  - `routes/auth.ts` — `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/user`. Uses `bcryptjs` for password hashing and stores sessions in the `sessions` table (opaque `sid` tokens served as Bearer or `sid` cookie).
  - `routes/me.ts` — `GET/PUT /api/me/store` returns/persists `{ pantry, scans, shoppingList }` for the current user (gated by `req.isAuthenticated()`).

- **`lib/api-spec`** — OpenAPI source of truth (`openapi.yaml`).
  - Schemas: `ExtractedItem`, `ReceiptInput`, `ReceiptResult`, `ApiError`.
  - Operation `analyzeReceipt` produces zod schemas `AnalyzeReceiptBody` / `AnalyzeReceiptResponse` (orval names them after the operationId — schema names must NOT collide with these).
  - Run `pnpm --filter @workspace/api-spec run codegen` after edits.

- **`lib/api-client-react`** / **`lib/api-zod`** — Generated clients consumed by the mobile app and server respectively.

- **`lib/integrations-gemini-ai`** — Replit-managed Gemini integration. Env vars `AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY` provided automatically.

- **`lib/db`** — Drizzle schema + Postgres client.
  - `schema/auth.ts` — `users` and `sessions` tables (Replit Auth template).
  - `schema/user-data.ts` — `user_data` (one row per user, JSONB columns `pantry`, `scans`, `shopping_list`, FK to `users` with cascade).
  - Push schema: `pnpm --filter @workspace/db run db:push`.

## Domain Model

- `PantryItem` — name, category, quantity, unit, `purchases[]`, `averageDaysBetweenPurchases`, `estimatedShelfLifeDays`, `lastPurchasedAt`, `consumed`.
- `ScanRecord` — id, scannedAt, sourceType, storeName, itemCount.
- `ShoppingListItem` — predicted (auto from pantry) or manual; checkable.

### Prediction Logic (`lib/predictions.ts`)

- `averageDaysBetweenPurchases` = mean of gaps between consecutive purchases (needs >=2 purchases).
- `predictNextNeededDate` = `lastPurchasedAt + (avgDaysBetween ?? estimatedShelfLifeDays)`.
- `getItemStatus`: `fresh` (>5d), `running-low` (<=5d), `due` (<=2d), `overdue` (<=0d), `expired` (consumed or >3d overdue).
- Items with status running-low / due / overdue / expired are auto-added to the predicted shopping list.

## Workflows

- `artifacts/grocery-tracker: expo` — Metro + Expo Web on `$PORT`.
- `artifacts/api-server: API Server` — Express on `:8080`.
- `artifacts/mockup-sandbox: Component Preview Server` — Vite preview sandbox.

## Recent Changes (2026-04-25)

- Initial build of Grocery Tracker mobile app with full scan → review → pantry → shopping flow.
- Added `/analyze-receipt` endpoint backed by Gemini 2.5 Flash vision.
- Established sage/cream theme and Inter typography.
- Added Insights tab (top items, cadence, predicted restocks, category breakdown).
- Added Postgres-backed cloud sync: `GET/PUT /api/me/store` and a profile/log-out card in Insights. Local `AsyncStorage` was replaced by API-backed persistence.
- Added email + password authentication (signup / login / logout) with bcrypt + opaque session tokens. The login screen shows tabs for log in vs sign up plus a 4-step "How it works" preview.
- Added recovery codes for password reset (no email service required). Signup returns a one-time `recoveryCode` shown on a "save your code" screen; `POST /api/auth/reset-password` validates `{email, recoveryCode, newPassword}` and rotates the code; `POST /api/auth/recovery-code` (authed) lets a user generate a fresh code from the profile card. New `app/forgot-password.tsx` screen + "Forgot your password?" link on login.
