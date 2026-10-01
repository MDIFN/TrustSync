import OpenAI from "openai";

/** Shared OpenAI client for embedding generation (server-side only). */
export function createAdminOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}
