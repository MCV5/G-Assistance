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

export type ParsedShoppingItem = {
  name: string;
  category: string;
};

function normalizeCategory(raw: string): string {
  const c = raw.trim();
  if (c === "Produce") return "Vegetables";
  if (ALLOWED_CATEGORIES.has(c)) return c;
  return "Other";
}

/** Rule-based fallback when Gemini is unavailable. */
export function parseShoppingListLocally(text: string): ParsedShoppingItem[] {
  const cleaned = text
    .replace(/\b(i need|get me|pick up|buy|grab|add)\b/gi, " ")
    .replace(/\b(from trader joe'?s?|at trader joe'?s?|from tj'?s)\b/gi, " ")
    .trim();

  const chunks = cleaned
    .split(/,|\n|;|\band\b|\bplus\b|\balso\b/gi)
    .map((s) => s.replace(/^[\d]+\.?\s*/, "").trim())
    .filter((s) => s.length >= 2);

  const seen = new Set<string>();
  const out: ParsedShoppingItem[] = [];
  for (const chunk of chunks) {
    const name = chunk
      .replace(/\s+/g, " ")
      .replace(/^some\s+/i, "")
      .trim();
    if (name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, category: guessCategoryFromName(name) });
  }
  return out.slice(0, 30);
}

function guessCategoryFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\b(milk|cheese|yogurt|butter|egg)\b/.test(n)) return "Dairy";
  if (/\b(chicken|beef|pork|fish|salmon|turkey|bacon)\b/.test(n)) return "Meat";
  if (/\b(apple|banana|berry|fruit)\b/.test(n)) return "Fruit";
  if (/\b(spinach|lettuce|broccoli|vegetable|tomato|onion)\b/.test(n))
    return "Vegetables";
  if (/\b(chip|cookie|cracker|snack|candy|bar)\b/.test(n)) return "Snacks";
  if (/\b(frozen|ice cream)\b/.test(n)) return "Frozen";
  if (/\b(juice|soda|coffee|tea|water|wine|beer)\b/.test(n))
    return "Beverages";
  if (/\b(bread|bagel|muffin|croissant)\b/.test(n)) return "Bakery";
  if (/\b(paper towel|toilet paper|soap|detergent|clean)\b/.test(n))
    return "Household";
  if (/\b(pizza|meal|salad|soup|prepared)\b/.test(n)) return "Prepared";
  return "Other";
}

function extractTextFromGeminiResponse(response: unknown): string {
  if (response && typeof response === "object" && "text" in response) {
    const t = (response as { text?: string }).text;
    if (typeof t === "string" && t.trim()) return t;
  }
  const r = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const parts = r.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts
    .map((p) => (p && "text" in p ? p.text : ""))
    .join("")
    .trim();
}

function sanitizeItems(items: ParsedShoppingItem[]): ParsedShoppingItem[] {
  const seen = new Set<string>();
  const out: ParsedShoppingItem[] = [];
  for (const it of items) {
    const name = it.name.trim().slice(0, 80);
    if (name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, category: normalizeCategory(it.category) });
  }
  return out.slice(0, 30);
}

export async function parseShoppingListWithGemini(
  text: string,
): Promise<ParsedShoppingItem[]> {
  const { ai } = await import("@workspace/integrations-gemini-ai");
  const prompt = `You parse spoken or typed grocery shopping lists into product lines.

User said:
"""
${text.slice(0, 2000)}
"""

Return ONLY valid JSON (no markdown):
{"items":[{"name":"short product name","category":"one of Fruit|Vegetables|Dairy|Meat|Pantry|Bakery|Beverages|Frozen|Snacks|Household|Personal Care|Prepared|Other"}]}

Rules:
- Split into separate buyable products (not full sentences).
- Drop filler words (I need, get, from Trader Joe's).
- Keep TJ product names readable (e.g. "Cookie Butter", "Chili Lime Chips").
- Max 20 items.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  });

  const raw = extractTextFromGeminiResponse(response);
  if (!raw) throw new Error("Empty Gemini response");

  const parsed = JSON.parse(raw) as { items?: ParsedShoppingItem[] };
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("No items in Gemini response");
  }
  return sanitizeItems(parsed.items);
}

export async function parseShoppingListText(
  text: string,
): Promise<ParsedShoppingItem[]> {
  const trimmed = text.trim();
  if (trimmed.length < 2) return [];

  try {
    return await parseShoppingListWithGemini(trimmed);
  } catch {
    return parseShoppingListLocally(trimmed);
  }
}
