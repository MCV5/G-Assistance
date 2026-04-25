import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { AnalyzeReceiptBody, AnalyzeReceiptResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_INSTRUCTION = `You are an expert grocery item extractor. The user uploads a photo that may be:
- a printed grocery receipt
- a shopping bag with items visible
- a shopping cart with items visible

Your job: identify every grocery / household / personal-care item that appears in the image.

Rules:
- Normalize names to title case singular forms when reasonable (e.g. "Bananas" -> "Bananas" but "Eggs" stays plural since it is a unit). Do not include sizes / brands when not necessary.
- Categorize each item into ONE of: Produce, Dairy, Meat, Pantry, Bakery, Beverages, Frozen, Snacks, Household, Personal Care, Other.
- For quantity: parse from receipt if visible, otherwise default to 1.
- Unit must be one of: piece, dozen, lb, kg, oz, g, ml, l, pack, bottle, can, box, bag.
- estimatedShelfLifeDays: realistic perishability for an average household (eggs ~21, milk ~10, bananas ~6, fresh chicken ~3, bread ~7, frozen ~120, pantry dry ~365, household products ~999, etc.).
- If you can read the store name on a receipt, return it in storeName.
- If you can read the purchase date on a receipt, return it as ISO date-time in purchaseDate.
- If the image is unclear or contains zero grocery items, return items: [].
- Respond ONLY with valid JSON matching the requested schema. Do not include markdown fences or commentary.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: {
            type: "string",
            enum: [
              "Produce",
              "Dairy",
              "Meat",
              "Pantry",
              "Bakery",
              "Beverages",
              "Frozen",
              "Snacks",
              "Household",
              "Personal Care",
              "Other",
            ],
          },
          quantity: { type: "number" },
          unit: { type: "string" },
          estimatedShelfLifeDays: { type: "integer" },
        },
        required: ["name", "category", "quantity", "unit", "estimatedShelfLifeDays"],
      },
    },
    storeName: { type: "string" },
    purchaseDate: { type: "string" },
  },
  required: ["items"],
};

router.post("/analyze-receipt", async (req, res) => {
  const parseResult = AnalyzeReceiptBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { imageBase64, mimeType, sourceType } = parseResult.data;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Source type: ${sourceType}. Extract all grocery items in the image.`,
            },
            {
              inlineData: {
                data: imageBase64,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: RESPONSE_SCHEMA as any,
        maxOutputTokens: 8192,
      },
    });

    const text = response.text ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      req.log.error({ text }, "Gemini returned non-JSON response");
      res.status(500).json({ error: "AI did not return valid JSON" });
      return;
    }

    const validation = AnalyzeReceiptResponse.safeParse(parsed);
    if (!validation.success) {
      req.log.error({ parsed, issues: validation.error.issues }, "Gemini returned invalid shape");
      res.status(500).json({ error: "AI returned an unexpected shape" });
      return;
    }

    res.json(validation.data);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze receipt");
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

export default router;
