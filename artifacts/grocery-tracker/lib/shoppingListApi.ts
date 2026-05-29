import { customFetch } from "@workspace/api-client-react";

import { coerceCategory, guessCategory } from "@/lib/guessCategory";
import type { Category } from "@/lib/types";

export type ParsedShoppingListItem = {
  name: string;
  category: Category;
};

export async function parseShoppingListText(
  text: string,
): Promise<ParsedShoppingListItem[]> {
  try {
    const res = await customFetch<{ items: { name: string; category: string }[] }>(
      "/api/shopping/parse-list",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    return (res.items ?? []).map((it) => ({
      name: it.name.trim(),
      category: coerceCategory(it.name, it.category),
    }));
  } catch {
    return parseShoppingListLocally(text);
  }
}

export function parseShoppingListLocally(text: string): ParsedShoppingListItem[] {
  const cleaned = text
    .replace(/\b(i need|get me|pick up|buy|grab|add)\b/gi, " ")
    .replace(/\b(from trader joe'?s?|at trader joe'?s?|from tj'?s)\b/gi, " ")
    .trim();

  const chunks = cleaned
    .split(/,|\n|;|\band\b|\bplus\b|\balso\b/gi)
    .map((s) => s.replace(/^[\d]+\.?\s*/, "").trim())
    .filter((s) => s.length >= 2);

  const seen = new Set<string>();
  const out: ParsedShoppingListItem[] = [];
  for (const chunk of chunks) {
    const name = chunk.replace(/\s+/g, " ").trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, category: guessCategory(name) });
  }
  return out.slice(0, 30);
}
