import { GoogleGenAI } from "@google/genai";

export const generateSceneDescription = async (
  manhwaTitle: string,
  chapter: number,
  keywords: string
): Promise<string> => {
  // Use process.env.API_KEY directly as per SDK guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    // Use process.env.API_KEY directly as per SDK guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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