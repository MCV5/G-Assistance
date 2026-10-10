import { guessCategory } from "@/lib/guessCategory";
import type { Category } from "@/lib/types";

export type LiveShoppingItem = {
  id: string;
  name: string;
  category: Category;
  /** Still being spoken — shown dimmed until the phrase completes. */
  pending?: boolean;
};

export type SpeechTranscriptUpdate = {
  committed: string;
  interim: string;
  isFinal: boolean;
};

export function buildFullTranscript(committed: string, interim: string): string {
  const c = committed.trim();
  const i = interim.trim();
  if (!c) return i;
  if (!i) return c;
  return `${c} ${i}`;
}

/** Fast local parse for live updates while the user is speaking. */
export function parseShoppingListLocally(text: string): LiveShoppingItem[] {
  const cleaned = text
    .replace(/\b(uh+|um+|like|you know)\b/gi, " ")
    .replace(
      /\b(i need|i want|we need|get me|pick up|pickup|buy|grab|add|please|can i get)\b/gi,
      " ",
    )
    .replace(/\b(from trader joe'?s?|at trader joe'?s?|from tj'?s)\b/gi, " ")
    .replace(/\b(comma)\b/gi, ",")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 2) return [];

  const chunks = cleaned
    .split(
      /[,;]|\n|\band then\b|\band also\b|\boh and\b|\bthen\b|\band\b|\bplus\b|\balso\b|\banother\b/gi,
    )
    .map((s) =>
      s
        .replace(/^[\d]+\.?\s*/, "")
        .replace(/^(some|a couple of|a few|a|an|the)\s+/i, "")
        .trim(),
    )
    .filter((s) => s.length >= 2);

  const seen = new Set<string>();
  const out: LiveShoppingItem[] = [];
  for (const chunk of chunks) {
    const name = chunk.replace(/\s+/g, " ").trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `live_${key}`,
      name,
      category: guessCategory(name),
    });
  }
  return out.slice(0, 30);
}

export function itemsFromTranscript(
  committed: string,
  interim: string,
): LiveShoppingItem[] {
  const full = buildFullTranscript(committed, interim);
  const items = parseShoppingListLocally(full);
  if (items.length === 0 || !interim.trim()) return items;

  const trimmed = full.trim();
  const endsOnDelimiter =
    /[,;]\s*$/.test(trimmed) ||
    /\b(and|plus|also|then)\s*$/i.test(trimmed);

  if (endsOnDelimiter) return items;

  return items.map((item, idx) =>
    idx === items.length - 1 ? { ...item, pending: true } : item,
  );
}

export function itemsToTranscript(items: LiveShoppingItem[]): string {
  return items.map((it) => it.name).join(", ");
}

export function mergePolishedItems(
  current: LiveShoppingItem[],
  polished: { name: string; category: Category }[],
): LiveShoppingItem[] {
  const seen = new Set<string>();
  const out: LiveShoppingItem[] = [];
  for (const it of polished) {
    const name = it.name.trim();
    if (name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `live_${key}`,
      name,
      category: it.category,
    });
  }
  return out.length > 0 ? out : current.map((it) => ({ ...it, pending: false }));
}
