import { Router, type IRouter } from "express";
import type { z } from "zod";
import { AnalyzeReceiptBody, AnalyzeReceiptResponse } from "@workspace/api-zod";

type AnalyzeReceiptOutput = z.infer<typeof AnalyzeReceiptResponse>;

const router: IRouter = Router();

/**
 * Strip `data:*;base64,` prefix and whitespace. Some runtimes send full data URLs;
 * Gemini expects raw base64. Whitespace/newlines in the payload also break decoding.
 */
function normalizeReceiptImage(
  imageBase64: string,
  mimeType: string,
): { data: string; mimeType: string } {
  const trimmed = imageBase64.trim();
  const dataUrl = /^data:([^;]+);base64,(.+)$/is.exec(trimmed);
  if (dataUrl) {
    const mt = (dataUrl[1]?.trim() || mimeType).split(";")[0]?.trim() || mimeType;
    const data = (dataUrl[2] ?? "").replace(/\s+/g, "");
    return { data, mimeType: mt || "image/jpeg" };
  }
  return { data: trimmed.replace(/\s+/g, ""), mimeType };
}

function extractTextFromGeminiResponse(response: unknown): string {
  if (response && typeof response === "object" && "text" in response) {
    const t = (response as { text?: string }).text;
    if (typeof t === "string" && t.trim()) return t;
  }
  const r = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string } | Record<string, unknown>> };
    }>;
  };
  const parts = r.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  const pieces: string[] = [];
  for (const p of parts) {
    if (p && typeof p === "object" && "text" in p && typeof (p as { text?: string }).text === "string") {
      pieces.push((p as { text: string }).text);
    }
  }
  return pieces.join("").trim();
}

function isProbablyTransientGeminiError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    msg.includes("429") ||
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("resource_exhausted") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("unavailable") ||
    m.includes("deadline") ||
    m.includes("timeout") ||
    m.includes("etimedout") ||
    m.includes("econnreset") ||
    m.includes("fetch failed") ||
    m.includes("network error") ||
    m.includes("overloaded") ||
    m.includes("not found") ||
    m.includes("not_found") ||
    m.includes("empty response")
  );
}

/** Limits what we ask Gemini for and what we return (override via .env). */
function getScanLimits() {
  const rawMax = Number.parseInt(process.env.SCAN_MAX_ITEMS ?? "50", 10);
  const maxItems = Number.isFinite(rawMax) ? Math.min(Math.max(rawMax, 1), 200) : 50;

  const rawName = Number.parseInt(process.env.SCAN_MAX_ITEM_NAME_LENGTH ?? "80", 10);
  const maxItemNameLength = Number.isFinite(rawName) ? Math.min(Math.max(rawName, 16), 200) : 80;

  const includeStoreMetadata = process.env.SCAN_INCLUDE_STORE_METADATA !== "false";

  const rawTokens = Number.parseInt(process.env.SCAN_MAX_OUTPUT_TOKENS ?? "2048", 10);
  const maxOutputTokens = Number.isFinite(rawTokens) ? Math.min(Math.max(rawTokens, 512), 8192) : 4096;

  return { maxItems, maxItemNameLength, includeStoreMetadata, maxOutputTokens };
}

function limitsPromptBlock(limits: ReturnType<typeof getScanLimits>): string {
  const meta =
    limits.includeStoreMetadata
      ? "Include storeName and purchaseDate only when clearly readable on the image; otherwise omit those keys entirely."
      : "Do not include storeName or purchaseDate — omit both keys from the JSON.";
  return `
OUTPUT LIMITS (strict):
• Return at most ${limits.maxItems} items total. If there are more lines on the receipt, keep the clearest / highest-confidence product lines first.
• Each item "name" must be ${limits.maxItemNameLength} characters or fewer (short readable label).
• ${meta}`;
}

function sanitizeAnalyzeResponse(
  data: AnalyzeReceiptOutput,
  limits: ReturnType<typeof getScanLimits>,
): AnalyzeReceiptOutput {
  const items = data.items.slice(0, limits.maxItems).map((it) => ({
    ...it,
    name:
      it.name.length > limits.maxItemNameLength
        ? `${it.name.slice(0, limits.maxItemNameLength - 1)}…`
        : it.name,
  }));

  const out: AnalyzeReceiptOutput = { ...data, items };
  if (!limits.includeStoreMetadata) {
    delete out.storeName;
    delete out.purchaseDate;
  }
  return out;
}

const ALLOWED_CATEGORIES = new Set([
  "Fruit",
  "Vegetables",
  "Dairy",
  "Meat",
  "Pantry",
  "Bakery",
  "Beverages",
  "Frozen",
  "Snacks",
  "Household",
  "Personal Care",
  "Prepared",
  "Other",
]);

function normalizeCategoryLabel(raw: string): string {
  const c = raw.trim();
  if (c === "Produce") return "Vegetables";
  if (ALLOWED_CATEGORIES.has(c)) return c;
  return "Other";
}

function normalizeReceiptItems(
  items: AnalyzeReceiptOutput["items"],
): AnalyzeReceiptOutput["items"] {
  return items
    .map((it) => {
      const qty =
        typeof it.quantity === "number" && Number.isFinite(it.quantity) ? it.quantity : 1;
      const name = it.name.trim();
      const nameLower = name.toLowerCase();
      const inferredOrganic = /\borganic\b|\borg\b/.test(nameLower);
      const modelOrganic =
        typeof it.isOrganic === "boolean" ? it.isOrganic : undefined;
      const organicSource =
        typeof it.organicSource === "string" ? it.organicSource : undefined;
      const organicConfidence =
        typeof it.organicConfidence === "number" &&
        Number.isFinite(it.organicConfidence)
          ? Math.max(0, Math.min(1, it.organicConfidence))
          : undefined;

      return {
        ...it,
        name,
        quantity: Math.max(1, qty),
        category: normalizeCategoryLabel(it.category),
        isOrganic:
          modelOrganic != null ? modelOrganic : inferredOrganic ? true : undefined,
        organicConfidence:
          organicConfidence ??
          (modelOrganic == null ? (inferredOrganic ? 0.62 : undefined) : 0.8),
        organicSource:
          organicSource ??
          (modelOrganic != null ? "label" : inferredOrganic ? "name_keyword" : undefined),
      };
    })
    .filter((it) => it.name.length >= 2);
}

function parseIsoDateOnly(s: string): string | null {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(s.trim());
  return m ? m[0] : null;
}

function resolvePurchaseDate(params: {
  modelPurchase?: string;
  scannedAtClient?: string;
}): { purchaseDate: string; isEstimated: boolean } {
  const serverFallback = new Date().toISOString().slice(0, 10);
  const scan = parseIsoDateOnly(params.scannedAtClient ?? "") ?? serverFallback;

  const raw = params.modelPurchase?.trim();
  if (!raw) {
    return { purchaseDate: scan, isEstimated: true };
  }
  let parsed = parseIsoDateOnly(raw);
  if (!parsed && raw.includes("T")) parsed = parseIsoDateOnly(raw.slice(0, 10));
  if (!parsed) {
    return { purchaseDate: scan, isEstimated: true };
  }
  if (parsed > scan) {
    return { purchaseDate: scan, isEstimated: true };
  }
  return { purchaseDate: parsed, isEstimated: false };
}

const SYSTEM_INSTRUCTION = `You are an expert grocery item extractor. The user uploads a photo that is one of:
  A) A printed grocery receipt
  B) A shopping bag with items visible
  C) A shopping cart with items visible

════════════════════════════════════════
RECEIPT RULES (source: receipt)
════════════════════════════════════════
• For RECEIPTS ONLY: extract lines that are **printed as purchased products** on the slip. Do not infer SKUs, nutrition panels, or items not shown as purchase lines.
• Read every line that is a purchasable grocery, household, or personal-care product.
• SKIP non-product lines: tax, subtotal, total, savings, discount, coupon, loyalty points, bag fee, deposit, service charge, payment method lines, store address/phone, cashier name, receipt number.
• Handle common receipt abbreviations and truncations:
  - MLK/MILK → Milk, CHKN/CHICK → Chicken, ORG → Organic, WHL → Whole, LF → Low Fat
  - OJ → Orange Juice, BB → Blueberries, STRBRY → Strawberries, BRD → Bread
  - YGT/YGRT → Yogurt, BTR/BTTR → Butter, EGG → Eggs, BNNA → Bananas
  - GRN → Green, BROC → Broccoli, TOM → Tomatoes, POT → Potatoes
  - Any ALL-CAPS truncated word: use context clues to expand it to the full product name.
• Quantity multipliers on receipts:
  - "2 @ $1.99" or "2/$3.98" or "2x" means quantity=2
  - "1 lb" means quantity=1 unit=lb
  - "0.75 lb" means quantity=0.75 unit=lb
• If the same item appears multiple times (repeat purchase), combine into one entry with the summed quantity.
• Store name: read from the top header of the receipt.
• Purchase date: read from the receipt (usually near the top or bottom). Return as ISO 8601 date string.

════════════════════════════════════════
BAG / CART RULES (source: bag or cart)
════════════════════════════════════════
• Identify every visible grocery product by its packaging label, shape, or colour.
• If you can read a brand name, include it only if it helps identify the product (e.g. "Heinz Ketchup" not just "Bottle").
• Estimate quantity from how many individual units are visible.
• Do not make up items you cannot reasonably identify from the image.

════════════════════════════════════════
SHARED RULES (all source types)
════════════════════════════════════════
• Normalize names to readable title-case (e.g. "whole milk", "baby spinach", "chicken breast"). Omit brand names when the product is still clear without them.
• Remove extraneous size info from names when it is captured in quantity/unit instead.
• Categorize into EXACTLY ONE of: Fruit, Vegetables, Dairy, Meat, Pantry, Bakery, Beverages, Frozen, Snacks, Household, Personal Care, Prepared, Other.
  - Fruit: tree/vine fruits, berries, citrus, melons (fresh fruit).
  - Vegetables: vegetables, leafy greens, fresh herbs, potatoes, tomatoes used as veg (not canned unless obviously canned veg → Pantry).
  - Prepared: ready-to-eat deli items, rotisserie chicken, sushi, packaged salad kits, frozen meals sold chilled ready meal sections—anything primarily sold as prepared food for immediate/easy eating.
• unit must be one of: piece, dozen, lb, kg, oz, g, ml, l, pack, bottle, can, box, bag.
  - Loose produce sold by weight → lb or kg
  - Packaged individual items → piece or pack
  - Liquids → bottle, l, or ml
  - Canned goods → can
• estimatedShelfLifeDays — realistic refrigerated household shelf life (guidelines, not safety guarantees):
  - Raw poultry/chicken pieces: 5 | Raw beef/lamb/pork cuts: 5–7 | Ground meat: 3–4 | Fresh fish: 3 | Deli cooked meats (opened-style): 5–7
  - Fresh berries: 4 | Bananas: 6 | Most other fruit (whole): 7 | Salad greens: 5–7
  - Milk: 10 | Yogurt: 14 | Eggs: 21 | Hard cheese: 30
  - Bread/bakery: 7 | Frozen items: 120 | Prepared ready meals: 5–7
  - Dry pantry staples: 365 | Household/personal care: 999
• If the image is unclear or contains zero grocery items, return items: [].
• Organic fields (optional but useful):
  - isOrganic: true only when "organic/ORG" is explicitly visible or strongly implied by product text.
  - organicConfidence: number 0..1 for that inference.
  - organicSource: one of label, name_keyword, manual.
• Return ONLY valid JSON matching the schema. No markdown, no commentary.`;

// Try faster model first; fall back to 2.5 if needed (quality / availability).
const CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-09-2025",
];

async function callGemini(
  imageBase64: string,
  mimeType: string,
  sourceType: string,
  limits: ReturnType<typeof getScanLimits>,
) {
  const { ai } = await import("@workspace/integrations-gemini-ai");

  const sourcePrompts: Record<string, string> = {
    receipt:
      "This is a grocery receipt. Read every product line carefully, expand abbreviations, and extract all purchased grocery/household/personal-care items. Skip totals, tax, and non-product lines.",
    bag: "This is a photo of a shopping bag with grocery items inside. Identify every visible product from its packaging, label, shape, or colour.",
    cart: "This is a photo of a shopping cart filled with groceries. Identify every visible product.",
  };
  const base = sourcePrompts[sourceType] ?? `Source: ${sourceType}. Extract all grocery items.`;
  const userPrompt = `${base}${limitsPromptBlock(limits)}`;

  let lastError: unknown;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: userPrompt },
              { inlineData: { data: imageBase64, mimeType } },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
          maxOutputTokens: limits.maxOutputTokens,
        },
      });

      let text = extractTextFromGeminiResponse(response);
      if (!text) {
        throw new Error(
          "Gemini returned an empty response (image may be too large or unclear). Try a smaller photo or better lighting.",
        );
      }
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) text = jsonMatch[0];
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (isProbablyTransientGeminiError(msg)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  // All models exhausted
  throw lastError;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.post("/analyze-receipt", async (req, res) => {
  const parseResult = AnalyzeReceiptBody.safeParse(req.body);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    const detail = issue
      ? `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}`
      : "Invalid JSON body";
    res.status(400).json({ error: `Invalid request — ${detail}` });
    return;
  }

  const { imageBase64, mimeType, sourceType, scannedAt } = parseResult.data;
  const normalized = normalizeReceiptImage(imageBase64, mimeType);
  if (!normalized.data || normalized.data.length < 80) {
    res.status(400).json({
      error: "Image data is missing or too small. Retake the photo or pick another image.",
    });
    return;
  }
  const limits = getScanLimits();

  try {
    // Retry once on transient errors (rate-limit or first-request init glitch)
    let text: string;
    try {
      text = await callGemini(normalized.data, normalized.mimeType, sourceType, limits);
    } catch (firstErr) {
      const firstMsg = firstErr instanceof Error ? firstErr.message : "";
      const isTransient = isProbablyTransientGeminiError(firstMsg);
      if (isTransient) {
        req.log.warn("Gemini transient error on first attempt, retrying after 2s...");
        await sleep(2000);
        text = await callGemini(normalized.data, normalized.mimeType, sourceType, limits);
      } else {
        throw firstErr;
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      req.log.error({ text }, "Gemini returned non-JSON response");
      res.status(500).json({ error: "AI did not return valid JSON. Try again." });
      return;
    }

    // Gemini may return explicit nulls for optional fields.
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (obj.storeName == null) delete obj.storeName;
      if (obj.purchaseDate == null) delete obj.purchaseDate;
    }

    const validation = AnalyzeReceiptResponse.safeParse(parsed);
    if (!validation.success) {
      const i0 = validation.error.issues[0];
      req.log.error({ parsed, issues: validation.error.issues }, "Gemini returned invalid shape");
      res.status(500).json({
        error: i0
          ? `AI response was not usable (${i0.path.join(".") || "root"}: ${i0.message}). Try again with a clearer photo.`
          : "AI returned an unexpected shape. Try again.",
      });
      return;
    }

    const normalizedItems = normalizeReceiptItems(validation.data.items);
    const purchaseResolved = resolvePurchaseDate({
      modelPurchase: validation.data.purchaseDate,
      scannedAtClient: scannedAt,
    });

    let merged: AnalyzeReceiptOutput = {
      ...validation.data,
      items: normalizedItems,
      purchaseDate: purchaseResolved.purchaseDate,
      purchaseDateIsEstimated: purchaseResolved.isEstimated,
    };

    const capped = sanitizeAnalyzeResponse(merged, limits);
    if (merged.items.length > capped.items.length) {
      req.log.info(
        { dropped: merged.items.length - capped.items.length, maxItems: limits.maxItems },
        "Scan output truncated to SCAN_MAX_ITEMS",
      );
    }

    res.json(capped);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (
      message.includes("GEMINI_API_KEY") ||
      message.includes("AI_INTEGRATIONS_GEMINI_BASE_URL") ||
      message.includes("AI_INTEGRATIONS_GEMINI_API_KEY")
    ) {
      res.status(503).json({
        error:
          "Receipt scanning is not configured. Add GEMINI_API_KEY to your .env file (get a free key at aistudio.google.com).",
      });
      return;
    }
    if (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate")) {
      req.log.warn({ err }, "Gemini rate limit hit after retry");
      res.status(429).json({
        error: "The AI is busy right now (rate limit). Please wait a moment and try again.",
      });
      return;
    }
    if (message.includes("NOT_FOUND") || message.toLowerCase().includes("not found")) {
      req.log.warn({ err }, "Configured Gemini model is unavailable for this key");
      res.status(503).json({
        error: "The configured Gemini model is unavailable for this API key. Please use a key with Gemini 2.5 Flash access.",
      });
      return;
    }
    req.log.error({ err }, "Failed to analyze receipt");
    res.status(500).json({ error: `Analysis failed: ${message || "unknown error"}` });
  }
});

export default router;
