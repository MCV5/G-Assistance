import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";

import { isUsdaConfigured, lookupNutrition } from "../lib/nutritionLookup";

const router: IRouter = Router();

const LookupBody = z.object({
  barcode: z.string().optional(),
  productName: z.string().optional(),
});

router.post("/nutrition/lookup", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = LookupBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { barcode, productName } = parsed.data;
  if (!barcode?.trim() && !productName?.trim()) {
    res.status(400).json({
      error: "Provide barcode or productName for nutrition lookup.",
    });
    return;
  }

  try {
    const result = await lookupNutrition({ barcode, productName });
    res.json({
      ...result,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Nutrition lookup failed");
    res.status(500).json({ error: "Nutrition lookup failed. Try again later." });
  }
});

router.get("/nutrition/config", (_req: Request, res: Response) => {
  res.json({
    usdaConfigured: isUsdaConfigured(),
    openFoodFacts: true,
  });
});

export default router;
