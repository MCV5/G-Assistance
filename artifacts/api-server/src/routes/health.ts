import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/** Same as healthz — matches OpenAPI `/api/health` for clients and load balancers. */
router.get("/health", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Safe diagnostics for receipt scanning (no secrets). Open in a browser:
 * `https://<your-service>.onrender.com/api/gemini-config`
 */
router.get("/gemini-config", (_req, res) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasIntegrationKey = Boolean(process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim());
  const hasBase = Boolean(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim());
  const useProxy = Boolean(hasBase && !hasGemini);
  const configured = hasGemini || hasIntegrationKey;

  let hint: string | undefined;
  if (!configured) {
    hint =
      "Set GEMINI_API_KEY in Render → Environment (create a key at https://aistudio.google.com/apikey ) then redeploy.";
  } else if (useProxy && hasBase) {
    hint =
      "Using integration proxy (no GEMINI_API_KEY). On Render, add GEMINI_API_KEY and remove AI_INTEGRATIONS_GEMINI_BASE_URL unless you rely on that proxy.";
  } else if (hasGemini && hasBase) {
    hint =
      "GEMINI_API_KEY is set — the app uses Google's API directly and ignores AI_INTEGRATIONS_GEMINI_BASE_URL. You can delete the unused base URL env var on Render.";
  }

  const apiKeyPresent = hasGemini || hasIntegrationKey;
  const scanReady = apiKeyPresent && (!useProxy || hasIntegrationKey);

  res.json({
    scanReady,
    configured,
    mode: !configured ? "missing" : useProxy ? "integration_proxy" : "direct",
    hasGeminiApiKey: hasGemini,
    hasIntegrationApiKey: hasIntegrationKey,
    integrationBaseUrlSet: hasBase,
    hint,
  });
});

export default router;
