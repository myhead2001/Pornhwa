
import { GoogleGenAI } from "@google/genai";
import { db } from './db';

const getApiKey = async (): Promise<string> => {
    // 1. Try User Setting first (for standalone PWA usage)
    try {
        const record = await db.config.get('user_api_key');
        if (record && record.value) return record.value;
    } catch (e) {
        console.warn("Failed to read user_api_key", e);
    }

    // 2. Fallback to Env Var (for hosted/dev)
    return process.env.API_KEY || '';
};

export const generateSceneDescription = async (
  manhwaTitle: string,
  chapter: number,
  keywords: string
): Promise<string> => {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
      throw new Error("API Key missing. Please set it in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    You are an assistant for a Manhwa reader. 
    Write a concise but engaging summary (max 100 words) for a scene in the manhwa "${manhwaTitle}", Chapter ${chapter}.
    Context/Keywords provided by user: ${keywords}.
    Focus on action and character emotion.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Could not generate description.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const analyzeReadingHabits = async (
  readHistory: string[]
): Promise<string> => {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return "Please configure API Key in Settings to use AI features.";
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Based on the following list of Manhwa titles and tags I've read: 
      ${readHistory.join(", ")}.
      Give me a 1-sentence analysis of my reading taste (e.g. "You love underdog stories with leveling systems").
    `;

    try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        return response.text || "Analysis failed.";
    } catch (e) {
        return "Could not generate analysis.";
    }
}
