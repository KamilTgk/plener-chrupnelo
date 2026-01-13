import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
const genAI = new GoogleGenerativeAI(API_KEY);

// Ten model działa stabilnie i nie wyrzuca błędu 404
const MODEL_NAME = "gemini-1.5-flash";

const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź od AI.");
  try {
    // Czyścimy odpowiedź z formatowania Markdown
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("AI zwróciło błąd. Spróbuj ponownie.");
  }
};

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Jesteś kreatywnym szefem kuchni. Mam w lodówce: ${stock}. 
    Stwórz z nich JEDEN przepis. Zwróć WYŁĄCZNIE czysty JSON: 
    { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
    
    const result = await model.generateContent(prompt);
    return safeParse(result.response.text());
  } catch (error) {
    throw new Error("AI Magazyn Błąd");
  }
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Analiza posiłku: ${foodName || "Danie"}, Waga: ${weight || "Standard"}. 
    Podaj makro w JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;

    let result;
    if (image && image.includes("base64")) {
      const base64Data = image.split(',')[1];
      result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: "image/png" } }
      ]);
    } else {
      result = await model.generateContent(prompt);
    }
    return safeParse(result.response.text());
  } catch (error) {
    throw new Error("AI Skaner Błąd");
  }
};

export const generateMealPlan = async (config: any) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Plan na 1 dzień: ${config.targetCalories} kcal. Cel: ${config.goalMode}. Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}.
    Zwróć JSON: { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;

    const result = await model.generateContent(prompt);
    const data = safeParse(result.response.text());
    return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
  } catch (error) {
    throw new Error("AI Generator Błąd");
  }
};
