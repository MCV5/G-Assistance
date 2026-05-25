import { z } from "zod";

const BehaviorCardSchema = z.object({
  type: z.enum([
    "forgot_staple",
    "confirm_exhaustion",
    "soft_reminder",
    "diet_shift",
  ]),
  title: z.string().max(80),
  message: z.string().max(280),
  family: z.string().max(40).optional(),
  itemName: z.string().max(80).optional(),
  pantryItemId: z.string().max(64).optional(),
  confidence: z.number().min(0).max(1),
});

const LlmResponseSchema = z.object({
  cards: z.array(BehaviorCardSchema).max(4),
  muteFamilies: z.array(z.string().max(40)).max(6).optional(),
});

export type Layer1Flag = {
  family: string;
  itemName: string;
  pantryItemId: string;
  daysSincePurchase: number;
  personalIntervalDays: number | null;
  missingFromLatestScan: boolean;
};

export type BehaviorInsightResult = {
  cards: Array<z.infer<typeof BehaviorCardSchema> & { id: string }>;
  mutedFamilies: string[];
  generatedAt: string;
  layer1Flags: Layer1Flag[];
};

type PantryRow = {
  id?: string;
  name?: string;
  category?: string;
  lastPurchasedAt?: string;
  consumed?: boolean;
  averageDaysBetweenPurchases?: number | null;
  estimatedShelfLifeDays?: number;
  consumptionHistory?: Array<{ family?: string | null; daysHeld?: number }>;
};

function inferFamilyName(name: string): string | null {
  const rules: Array<[RegExp, string]> = [
    [/salad|coleslaw|slaw/i, "Salads"],
    [/\bmilk\b|oat milk|almond milk/i, "Milk"],
    [/bread|loaf|baguette|pita|tortilla/i, "Bread"],
    [/\brice\b/i, "Rice"],
    [/\bpasta\b|\bnoodle/i, "Pasta"],
    [/\begg(s)?\b/i, "Eggs"],
    [/\bcheese\b/i, "Cheese"],
    [/\bchicken\b/i, "Chicken"],
  ];
  for (const [re, label] of rules) {
    if (re.test(name)) return label;
  }
  return null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0
    ? Math.round((s[m - 1]! + s[m]!) / 2)
    : s[m]!;
}

function buildFamilyIntervals(pantry: PantryRow[]): Record<string, number> {
  const buckets = new Map<string, number[]>();
  const push = (family: string, d: number) => {
    if (d <= 0 || d > 400) return;
    const arr = buckets.get(family) ?? [];
    arr.push(d);
    buckets.set(family, arr);
  };
  for (const item of pantry) {
    const name = String(item.name ?? "");
    const family = inferFamilyName(name) ?? name;
    const hist = item.consumptionHistory ?? [];
    for (const h of hist) {
      if (h.daysHeld && h.daysHeld > 0) {
        push(h.family ?? family, h.daysHeld);
      }
    }
    if (item.averageDaysBetweenPurchases && item.averageDaysBetweenPurchases > 0) {
      push(family, item.averageDaysBetweenPurchases);
    }
  }
  const out: Record<string, number> = {};
  for (const [fam, vals] of buckets) {
    const med = median(vals);
    if (med) out[fam] = med;
  }
  return out;
}

function daysBetween(a: string, b: Date): number {
  const ad = new Date(a).getTime();
  return Math.round((b.getTime() - ad) / 86400000);
}

export function computeLayer1Flags(
  pantry: PantryRow[],
  latestScanNames: string[],
  mutedFamilies: string[],
): Layer1Flag[] {
  const intervals = buildFamilyIntervals(pantry);
  const latestLower = new Set(
    latestScanNames.map((n) => n.trim().toLowerCase()),
  );
  const flags: Layer1Flag[] = [];
  const now = new Date();

  for (const item of pantry) {
    if (item.consumed) continue;
    const name = String(item.name ?? "");
    const id = String(item.id ?? "");
    const last = item.lastPurchasedAt;
    if (!last || !id) continue;
    const family = inferFamilyName(name) ?? name;
    if (mutedFamilies.includes(family)) continue;

    const interval =
      intervals[family] ??
      item.averageDaysBetweenPurchases ??
      item.estimatedShelfLifeDays ??
      14;
    const daysSince = daysBetween(last, now);
    if (daysSince < interval * 0.85) continue;

    const nameLower = name.trim().toLowerCase();
    const missingFromLatestScan =
      latestScanNames.length > 0 &&
      !latestLower.has(nameLower) &&
      !Array.from(latestLower).some((n) => n.includes(family.toLowerCase()));

    flags.push({
      family,
      itemName: name,
      pantryItemId: id,
      daysSincePurchase: daysSince,
      personalIntervalDays: intervals[family] ?? null,
      missingFromLatestScan,
    });
  }

  return flags.sort((a, b) => b.daysSincePurchase - a.daysSincePurchase).slice(0, 8);
}

function extractGeminiText(response: unknown): string {
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
    .map((p) => (p && "text" in p ? (p as { text?: string }).text : ""))
    .join("")
    .trim();
}

export async function generateBehaviorInsight(input: {
  pantry: PantryRow[];
  latestScanItemNames: string[];
  existingMutedFamilies: string[];
  layer1Flags: Layer1Flag[];
  familyIntervals: Record<string, number>;
}): Promise<BehaviorInsightResult> {
  const generatedAt = new Date().toISOString();
  const activePantry = input.pantry
    .filter((p) => !p.consumed)
    .slice(0, 40)
    .map((p) => ({
      name: p.name,
      category: p.category,
      lastPurchasedAt: p.lastPurchasedAt,
      id: p.id,
    }));

  if (input.layer1Flags.length === 0 && input.latestScanItemNames.length === 0) {
    return {
      cards: [],
      mutedFamilies: input.existingMutedFamilies,
      generatedAt,
      layer1Flags: [],
    };
  }

  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim(),
  );

  if (!hasGemini) {
    return buildFallbackCards(input.layer1Flags, input.existingMutedFamilies, generatedAt);
  }

  const payload = {
    activePantry: activePantry,
    latestScan: input.latestScanItemNames,
    historicalIntervals: input.familyIntervals,
    statisticalFlags: input.layer1Flags,
    mutedFamilies: input.existingMutedFamilies,
  };

  const systemInstruction = `You are the behavioral analytics engine for Goalcery, a smart grocery app.
Analyze the user's pantry and their latest receipt scan.
Return ONLY valid JSON (no markdown) matching:
{
  "cards": [
    {
      "type": "forgot_staple" | "confirm_exhaustion" | "soft_reminder" | "diet_shift",
      "title": string,
      "message": string,
      "family": string (optional),
      "itemName": string (optional),
      "pantryItemId": string (optional),
      "confidence": number 0-1
    }
  ],
  "muteFamilies": string[] (optional, families to stop nagging — only for clear diet shifts)
}
Rules:
- Max 3 cards. Be helpful, not alarmist. No URGENT language.
- forgot_staple: latest scan has meal ingredients but a staple (e.g. rice, pasta) is due and missing from scan.
- confirm_exhaustion: pantry item is likely finished based on intervals — ask softly.
- soft_reminder: might be low soon.
- diet_shift: user stopped buying a family for a long time; suggest muting predictions (add to muteFamilies).
- Prefer pantryItemId from statisticalFlags when referencing a specific item.`;

  try {
    const { ai } = await import("@workspace/integrations-gemini-ai");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify(payload, null, 2) }],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    });

    let text = extractGeminiText(response);
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) text = match[0];
    const parsed = LlmResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return buildFallbackCards(
        input.layer1Flags,
        input.existingMutedFamilies,
        generatedAt,
      );
    }

    const muteSet = new Set([
      ...input.existingMutedFamilies,
      ...(parsed.data.muteFamilies ?? []),
    ]);

    const cards = parsed.data.cards
      .filter((c) => c.confidence >= 0.45)
      .map((c, i) => ({
        ...c,
        id: `ai_${Date.now()}_${i}`,
      }));

    return {
      cards,
      mutedFamilies: [...muteSet],
      generatedAt,
      layer1Flags: input.layer1Flags,
    };
  } catch {
    return buildFallbackCards(
      input.layer1Flags,
      input.existingMutedFamilies,
      generatedAt,
    );
  }
}

function buildFallbackCards(
  flags: Layer1Flag[],
  muted: string[],
  generatedAt: string,
): BehaviorInsightResult {
  const cards = flags.slice(0, 3).map((f, i) => {
    if (f.missingFromLatestScan) {
      return {
        id: `fb_${Date.now()}_${i}`,
        type: "forgot_staple" as const,
        title: `Still have ${f.family}?`,
        message: `You shopped recently but didn't grab ${f.itemName}. Running low on your usual ${f.personalIntervalDays ?? "?"}-day cycle?`,
        family: f.family,
        itemName: f.itemName,
        pantryItemId: f.pantryItemId,
        confidence: 0.65,
      };
    }
    return {
      id: `fb_${Date.now()}_${i}`,
      type: "confirm_exhaustion" as const,
      title: f.itemName,
      message: `It's been ${f.daysSincePurchase} days since you bought this. Finished it, or still have some?`,
      family: f.family,
      itemName: f.itemName,
      pantryItemId: f.pantryItemId,
      confidence: 0.6,
    };
  });

  return {
    cards,
    mutedFamilies: muted,
    generatedAt,
    layer1Flags: flags,
  };
}
