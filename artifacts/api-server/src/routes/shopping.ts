import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";

import { parseShoppingListText } from "../lib/parseShoppingList";

const router: IRouter = Router();

const ParseBody = z.object({
  text: z.string().min(2).max(2000),
});

router.post("/shopping/parse-list", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = ParseBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Provide 2–2000 characters to parse." });
    return;
  }

  try {
    const items = await parseShoppingListText(parsed.data.text);
    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "Shopping list parse failed");
    res.status(500).json({ error: "Could not parse list. Try again." });
  }
});

export default router;
