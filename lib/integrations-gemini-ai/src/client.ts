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

  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

  _ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { apiVersion: "", baseUrl } } : {}),
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
