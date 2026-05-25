import { Router, type IRouter, type Request, type Response } from "express";
import { db, userDataTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  computeLayer1Flags,
  generateBehaviorInsight,
} from "../lib/behaviorInsight";

const router: IRouter = Router();

const RequestBody = z.object({
  latestScanItemNames: z.array(z.string()).optional(),
  force: z.boolean().optional(),
});

const CACHE_MS = 24 * 60 * 60 * 1000;

function defaultBehaviorMeta() {
  return { cards: [] as unknown[], mutedFamilies: [] as string[] };
}

function parseBehaviorMeta(raw: unknown): {
  generatedAt?: string;
  cards: unknown[];
  mutedFamilies: string[];
} {
  if (!raw || typeof raw !== "object") return defaultBehaviorMeta();
  const o = raw as Record<string, unknown>;
  return {
    generatedAt:
      typeof o.generatedAt === "string" ? o.generatedAt : undefined,
    cards: Array.isArray(o.cards) ? o.cards : [],
    mutedFamilies: Array.isArray(o.mutedFamilies)
      ? (o.mutedFamilies as string[])
      : [],
  };
}

function buildFamilyIntervals(pantry: unknown[]): Record<string, number> {
  const buckets = new Map<string, number[]>();
  for (const row of pantry) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const name = String(item.name ?? "");
    const family =
      /\brice\b/i.test(name)
        ? "Rice"
        : /\bpasta\b/i.test(name)
          ? "Pasta"
          : /\begg/i.test(name)
            ? "Eggs"
            : name;
    const avg = item.averageDaysBetweenPurchases;
    if (typeof avg === "number" && avg > 0) {
      const arr = buckets.get(family) ?? [];
      arr.push(avg);
      buckets.set(family, arr);
    }
    const hist = item.consumptionHistory;
    if (Array.isArray(hist)) {
      for (const h of hist) {
        if (h && typeof h === "object" && typeof (h as { daysHeld?: number }).daysHeld === "number") {
          const d = (h as { daysHeld: number }).daysHeld;
          const f = String((h as { family?: string }).family ?? family);
          const arr = buckets.get(f) ?? [];
          arr.push(d);
          buckets.set(f, arr);
        }
      }
    }
  }
  const out: Record<string, number> = {};
  for (const [k, vals] of buckets) {
    if (!vals.length) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    const m = Math.floor(sorted.length / 2);
    out[k] =
      sorted.length % 2 === 0
        ? Math.round((sorted[m - 1]! + sorted[m]!) / 2)
        : sorted[m]!;
  }
  return out;
}

router.post("/me/behavior-insight", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = RequestBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [row] = await db
    .select()
    .from(userDataTable)
    .where(eq(userDataTable.userId, req.user.id));

  const pantry = (row?.pantry ?? []) as unknown[];
  const existingMeta = parseBehaviorMeta(row?.behaviorMeta);
  const latestScanItemNames = parsed.data.latestScanItemNames ?? [];
  const force = parsed.data.force === true;

  if (
    !force &&
    existingMeta.generatedAt &&
    Date.now() - new Date(existingMeta.generatedAt).getTime() < CACHE_MS &&
    existingMeta.cards.length > 0
  ) {
    res.json({
      behaviorMeta: {
        generatedAt: existingMeta.generatedAt,
        cards: existingMeta.cards,
        mutedFamilies: existingMeta.mutedFamilies,
      },
    });
    return;
  }

  const layer1Flags = computeLayer1Flags(
    pantry as Parameters<typeof computeLayer1Flags>[0],
    latestScanItemNames,
    existingMeta.mutedFamilies,
  );
  const familyIntervals = buildFamilyIntervals(pantry);

  const result = await generateBehaviorInsight({
    pantry: pantry as Parameters<typeof generateBehaviorInsight>[0]["pantry"],
    latestScanItemNames,
    existingMutedFamilies: existingMeta.mutedFamilies,
    layer1Flags,
    familyIntervals,
  });

  const behaviorMeta = {
    generatedAt: result.generatedAt,
    cards: result.cards,
    mutedFamilies: result.mutedFamilies,
  };

  await db
    .insert(userDataTable)
    .values({
      userId: req.user.id,
      pantry: row?.pantry ?? [],
      scans: row?.scans ?? [],
      shoppingList: row?.shoppingList ?? [],
      behaviorMeta,
    })
    .onConflictDoUpdate({
      target: userDataTable.userId,
      set: {
        behaviorMeta,
        updatedAt: new Date(),
      },
    });

  res.json({ behaviorMeta });
});

export default router;
