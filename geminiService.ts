import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
const genAI = new GoogleGenerativeAI(API_KEY);

// LISTA MODELI (Priorytety)
// System spróbuje pierwszego. Jak dostanie 404, spróbuje kolejnego.
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro", "gemini-1.0-pro"];

const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź od AI.");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("AI zwróciło błąd formatowania.");
  }
};

// --- PANCERNA FUNKCJA WYWOŁANIA AI ---
// Iteruje po modelach, aż któryś zadziała
async function runWithFallback(prompt: string, imageBase64?: string) {
  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log(`Próba połączenia z modelem: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      let result;
      if (imageBase64) {
        result = await model.generateContent([
          prompt,
          { inlineData: { data: imageBase64, mimeType: "image/png" } }
        ]);
      } else {
        result = await model.generateContent(prompt);
      }
      
      // Jeśli sukces, zwracamy wynik i kończymy pętlę
      console.log(`Sukces z modelem: ${modelName}`);
      return safeParse(result.response.text());
      
    } catch (e: any) {
      console.warn(`Błąd modelu ${modelName}:`, e.message);
      // Jeśli to nie jest błąd 404 (nieznany model), to może być coś innego, ale próbujemy dalej
      continue;
    }
  }
  throw new Error("Wszystkie modele AI są niedostępne. Sprawdź klucz API.");
}

// --- MAGAZYN ---
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Jesteś szefem kuchni. Mam w lodówce: ${stock}. 
  Stwórz z nich JEDEN przepis. Zwróć WYŁĄCZNIE czysty JSON: 
  { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  
  return await runWithFallback(prompt);
};

// --- SKANER ---
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Analiza posiłku: ${foodName || "Danie"}, Waga: ${weight || "Standard"}. 
  Podaj makro w JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;

  let imgData = undefined;
  if (image && image.includes("base64")) {
    imgData = image.split(',')[1];
  }
  
  return await runWithFallback(prompt, imgData);
};

// --- PLAN ---
export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
  const prompt = `Plan na 1 dzień: ${config.targetCalories} kcal. Cel: ${goalText}. Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}.
  Zwróć JSON: { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;

  const data = await runWithFallback(prompt);
  return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
};
