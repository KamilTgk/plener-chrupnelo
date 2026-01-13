import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
const genAI = new GoogleGenerativeAI(API_KEY);

const MODELS = ["gemini-1.5-flash", "gemini-1.5-pro"];

// Pomocnik do czyszczenia odpowiedzi JSON od AI
const parseAIJSON = (text: string) => {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Nieprawidłowy format danych AI");
  return JSON.parse(jsonMatch[0]);
};

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `Jesteś szefem kuchni aplikacji Plener Chrupnęło. Stwórz JEDEN konkretny przepis z tych składników: ${stock}. Zwróć WYŁĄCZNIE JSON: { "name": "...", "ingredients": ["..."], "instructions": ["..."] }`;
      const result = await model.generateContent(prompt);
      return parseAIJSON(result.response.text());
    } catch (e) { console.error(`Błąd modelu ${modelName}:`, e); continue; }
  }
  throw new Error("Błąd Magazynu AI");
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `Analizuj posiłek dla sportowca. Nazwa: ${foodName}, Masa: ${weight}g. Podaj precyzyjne makro. Zwróć WYŁĄCZNIE JSON: { "name": "...", "kcal": ..., "protein": ..., "fat": ..., "carbs": ... }`;
      
      let result;
      if (image && image.includes("base64")) {
        result = await model.generateContent([
          prompt,
          { inlineData: { data: image.split(',')[1], mimeType: "image/png" } }
        ]);
      } else {
        result = await model.generateContent(prompt);
      }
      return parseAIJSON(result.response.text());
    } catch (e) { console.error(`Błąd skanera ${modelName}:`, e); continue; }
  }
  throw new Error("Błąd Skanera AI");
};

export const generateMealPlan = async (config: any) => {
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `Zaplanuj jadłospis sportowy: ${config.targetCalories} kcal. Kuchnia: ${config.cuisine}. Wykluczenia: ${config.exclusions}. Ilość posiłków: ${config.mealCount}. Zwróć WYŁĄCZNIE JSON: { "meals": [{ "name": "...", "kcal": ..., "protein": ..., "fat": ..., "carbs": ..., "ingredients": ["..."], "instructions": ["..."] }], "totalKcal": ... }`;
      const result = await model.generateContent(prompt);
      return parseAIJSON(result.response.text());
    } catch (e) { console.error(`Błąd generatora ${modelName}:`, e); continue; }
  }
  throw new Error("Błąd Generatora AI");
};
