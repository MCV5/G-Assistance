import { Router, type IRouter, type Request, type Response } from "express";
import { db, userDataTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetMyStoreResponse, PutMyStoreBody } from "@workspace/api-zod";

const router: IRouter = Router();

const EMPTY_STORE = {
  pantry: [],
  scans: [],
  shoppingList: [],
};

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

  const { pantry, scans, shoppingList } = parsed.data;

  await db
    .insert(userDataTable)
    .values({
      userId: req.user.id,
      pantry,
      scans,
      shoppingList,
    })
    .onConflictDoUpdate({
      target: userDataTable.userId,
      set: {
        pantry,
        scans,
        shoppingList,
        updatedAt: new Date(),
      },
    });

  res.json(GetMyStoreResponse.parse({ pantry, scans, shoppingList }));
});

export default router;
