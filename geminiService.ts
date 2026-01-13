import { GoogleGenerativeAI } from "@google/generative-ai";

// Używamy Twojego klucza API
const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
const genAI = new GoogleGenerativeAI(API_KEY);

// Stabilny model, który nie wyrzuci błędu 404
const MODEL_NAME = "gemini-1.5-flash";

// Pomocnik do czyszczenia JSON z odpowiedzi AI
const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź od AI.");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("AI zwróciło nieprawidłowy format danych.");
  }
};

// --- MAGAZYN: GENEROWANIE PRZEPISU ---
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Jesteś kreatywnym szefem kuchni. Mam w lodówce: ${stock}. 
    Stwórz z nich JEDEN wybitnie smaczny przepis.
    Zwróć WYŁĄCZNIE czysty JSON (bez markdown) w formacie: 
    { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
    
    const result = await model.generateContent(prompt);
    return safeParse(result.response.text());
  } catch (error) {
    throw new Error("Błąd Magazynu AI");
  }
};

// --- SKANER: ANALIZA ---
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Analiza posiłku: ${foodName || "Nieznana potrawa"}, Waga: ${weight || "Standardowa"}. 
    Podaj makroskładniki. Zwróć WYŁĄCZNIE czysty JSON: 
    { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;

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
    throw new Error("Błąd Skanera AI");
  }
};

// --- PLAN: GENERATOR ---
export const generateMealPlan = async (config: any) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const goalText = config.goalMode === 'cut' ? 'Redukcja' : config.goalMode === 'bulk' ? 'Masa' : 'Utrzymanie';
    
    const prompt = `Stwórz plan na 1 dzień. Cel: ${config.targetCalories} kcal (${goalText}). Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}.
    Makro: Białko ${config.proteinPct}%, Tłuszcz ${config.fatPct}%, Węgle ${config.carbsPct}%.
    Zwróć WYŁĄCZNIE czysty JSON: 
    { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;

    const result = await model.generateContent(prompt);
    const data = safeParse(result.response.text());
    
    // Dodajemy pole completed, którego AI nie zwraca, a aplikacja potrzebuje
    return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
  } catch (error) {
    throw new Error("Błąd Generatora AI");
  }
};
