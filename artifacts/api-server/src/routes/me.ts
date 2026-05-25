import { Router, type IRouter, type Request, type Response } from "express";
import { db, userDataTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetMyStoreResponse,
  PatchMyProfileBody,
  PatchMyProfileResponse,
  PutMyStoreBody,
} from "@workspace/api-zod";

import { sanitizeDietaryGoals } from "../lib/dietaryOptions";

const router: IRouter = Router();

const EMPTY_STORE = {
  pantry: [],
  scans: [],
  shoppingList: [],
  behaviorMeta: { cards: [], mutedFamilies: [] },
};

function normalizeBehaviorMeta(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return { cards: [], mutedFamilies: [] as string[] };
  }
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

router.get("/me/store", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [row] = await db
    .select()
    .from(userDataTable)
    .where(eq(userDataTable.userId, req.user.id));

  if (!row) {
    res.json(GetMyStoreResponse.parse(EMPTY_STORE));
    return;
  }

  res.json(
    GetMyStoreResponse.parse({
      pantry: row.pantry ?? [],
      scans: row.scans ?? [],
      shoppingList: row.shoppingList ?? [],
      behaviorMeta: normalizeBehaviorMeta(row.behaviorMeta),
    }),
  );
});

router.put("/me/store", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = PutMyStoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid store payload" });
    return;
  }

  const { pantry, scans, shoppingList, behaviorMeta } = parsed.data;

  await db
    .insert(userDataTable)
    .values({
      userId: req.user.id,
      pantry,
      scans,
      shoppingList,
      behaviorMeta: behaviorMeta ?? { cards: [], mutedFamilies: [] },
    })
    .onConflictDoUpdate({
      target: userDataTable.userId,
      set: {
        pantry,
        scans,
        shoppingList,
        ...(behaviorMeta !== undefined ? { behaviorMeta } : {}),
        updatedAt: new Date(),
      },
    });

  const [saved] = await db
    .select()
    .from(userDataTable)
    .where(eq(userDataTable.userId, req.user.id));

  res.json(
    GetMyStoreResponse.parse({
      pantry,
      scans,
      shoppingList,
      behaviorMeta: normalizeBehaviorMeta(saved?.behaviorMeta ?? behaviorMeta),
    }),
  );
});

router.patch("/me/profile", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = PatchMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile payload." });
    return;
  }

  const { dietaryGoals: bodyGoals, householdSize: bodyHouse } = parsed.data;
  if (bodyGoals === undefined && bodyHouse === undefined) {
    res.status(400).json({ error: "Nothing to update." });
    return;
  }

  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  if (!row) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let nextDietary =
    bodyGoals !== undefined ? sanitizeDietaryGoals(bodyGoals) : [...row.dietaryGoals];
  let nextHouse =
    bodyHouse !== undefined ? bodyHouse : row.householdSize;

  await db
    .update(usersTable)
    .set({
      dietaryGoals: nextDietary,
      householdSize: nextHouse,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, req.user.id));

  res.json(
    PatchMyProfileResponse.parse({
      dietaryGoals: nextDietary,
      householdSize: nextHouse,
    }),
  );
});

export default router;
