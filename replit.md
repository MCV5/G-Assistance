# Workspace

## Overview

Grocery Tracker — an Expo (React Native) mobile app that uses AI vision to extract grocery items from photos of receipts, shopping bags, and carts. The app tracks pantry inventory, learns each user's purchase cadence per item, and predicts when to restock.

## Architecture

This is a pnpm monorepo with the following workspace structure:

- **`artifacts/grocery-tracker`** — The Expo mobile app (also runs on web).
  - 4 tabs: Home, Pantry, Scan, Shop.
  - Local persistence via `AsyncStorage` (no backend database).
  - State managed by `PantryContext` (`contexts/PantryContext.tsx`).
  - Image capture via `expo-image-picker` (camera + library).
  - Theme: sage green (`#2f6d3f`) on cream (`#fbf8f1`); Inter font family.
  - Server URL: configured via `setBaseUrl(EXPO_PUBLIC_DOMAIN)` in `app/_layout.tsx`.

- **`artifacts/api-server`** — Express API.
  - `POST /api/analyze-receipt` accepts `{ imageBase64, mimeType, sourceType }` and returns `{ items: ExtractedItem[], storeName?, purchaseDate? }`.
  - Uses Gemini `gemini-2.5-flash` with vision input + JSON schema response (via `@workspace/integrations-gemini-ai`).
  - JSON body limit raised to 20 MB to accept base64 images.

- **`lib/api-spec`** — OpenAPI source of truth (`openapi.yaml`).
  - Schemas: `ExtractedItem`, `ReceiptInput`, `ReceiptResult`, `ApiError`.
  - Operation `analyzeReceipt` produces zod schemas `AnalyzeReceiptBody` / `AnalyzeReceiptResponse` (orval names them after the operationId — schema names must NOT collide with these).
  - Run `pnpm --filter @workspace/api-spec run codegen` after edits.

- **`lib/api-client-react`** / **`lib/api-zod`** — Generated clients consumed by the mobile app and server respectively.

- **`lib/integrations-gemini-ai`** — Replit-managed Gemini integration. Env vars `AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY` provided automatically.

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
