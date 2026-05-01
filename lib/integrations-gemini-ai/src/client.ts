import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

export function getAi(): GoogleGenAI {
  if (_ai) return _ai;

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY must be set in your .env file. Get a free key at https://aistudio.google.com/apikey",
    );
  }

  const integrationBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();

  // Replit's AI integration talks to Gemini through a proxy (custom base URL + integration key).
  // On Render / self-hosted installs, people often set GEMINI_API_KEY from Google AI Studio but
  // still have an old AI_INTEGRATIONS_GEMINI_BASE_URL in env — routing would break. Use the
  // public Gemini endpoint whenever GEMINI_API_KEY is present.
  const useIntegrationProxy =
    Boolean(integrationBase) && !process.env.GEMINI_API_KEY;

  _ai = new GoogleGenAI({
    apiKey,
    ...(useIntegrationProxy && integrationBase
      ? { httpOptions: { apiVersion: "", baseUrl: integrationBase } }
      : {}),
  });

  return _ai;
}

/** @deprecated Use getAi() instead */
export const ai = {
  models: {
    generateContent: (...args: Parameters<GoogleGenAI["models"]["generateContent"]>) =>
      getAi().models.generateContent(...args),
  },
};
