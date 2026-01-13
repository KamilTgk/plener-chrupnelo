import { GoogleGenerativeAI } from "@google/generative-ai";

// Używamy klucza z konfiguracji Firebase dla spójności logistyki
const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
const genAI = new GoogleGenerativeAI(API_KEY);

// Helper to safely parse JSON response
const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Otrzymano pustą odpowiedź od AI.");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("Błąd parsowania odpowiedzi AI:", text);
    throw new Error("AI zwróciło nieprawidłowy format danych.");
  }
};

// --- IMAGE COMPRESSION HELPER ---
const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 250; 
      const scaleSize = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scaleSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.5)); 
      } else {
          resolve(base64Str); 
      }
    };
    img.onerror = () => resolve(base64Str); 
  });
};

// --- IMAGE GENERATION ---
const generateDishImage = async (dishName: string): Promise<string | undefined> => {
  return undefined; // Gemini 1.5 Flash nie generuje obrazów bezpośrednio w ten sposób
};

// --- MAGAZYN: GENEROWANIE PRZEPISU Z LODÓWKI ---
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Jesteś kreatywnym szefem kuchni. Mam w lodówce: ${stock}. Stwórz z nich JEDEN przepis. Zwróć WYŁĄCZNIE JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
    const result = await model.generateContent(prompt);
    return safeParse(result.response.text());
  } catch (error: any) {
    throw new Error("Błąd Magazynu: AI nie mogło wygenerować przepisu.");
  }
};

// --- SKANER: ANALIZA WIZUALNA ---
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza posiłku: ${foodName || "Nieznana potrawa"}, Waga: ${weight || "Standardowa"}. Podaj makroskładniki w JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
    let result;
    if (image && image.includes("base64")) {
      result = await model.generateContent([prompt, { inlineData: { data: image.split(',')[1], mimeType: "image/png" } }]);
    } else {
      result = await model.generateContent(prompt);
    }
    return safeParse(result.response.text());
  } catch (error: any) {
    throw new Error("Błąd Skanera AI");
  }
};

// --- PLAN: GENERATOR JADŁOSPISU ---
export const generateMealPlan = async (config: any) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
    const prompt = `Stwórz plan posiłków: ${config.targetCalories} kcal. Cel: ${goalText}. Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}. Zwróć JSON: { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;
    const result = await model.generateContent(prompt);
    const data = safeParse(result.response.text());
    return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
  } catch (error: any) {
    throw new Error("Błąd Generatora AI");
  }
};
