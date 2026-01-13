import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
const genAI = new GoogleGenerativeAI(API_KEY);

// STABILNE MODELE DO LOGISTYKI
const MODEL_NAME = "gemini-1.5-flash";

// POMOCNIK DO PARSOWANIA JSON
const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź AI");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("Błąd parsowania AI:", text);
    throw new Error("AI zwróciło zły format danych.");
  }
};

// --- KOMPRESJA OBRAZU DLA OSZCZĘDNOŚCI MIEJSCA ---
const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400; 
      const scaleSize = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scaleSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      } else resolve(base64Str);
    };
    img.onerror = () => resolve(base64Str);
  });
};

// --- GENEROWANIE OBRAZU POSIŁKU ---
// Uwaga: gemini-1.5-flash nie generuje obrazów, używamy placeholderów lub opisu
export const generateDishImage = async (dishName: string): Promise<string | undefined> => {
    // Na ten moment Gemini 1.5 Flash nie generuje plików graficznych bezpośrednio.
    // Zostawiamy funkcję jako szkielet pod przyszłe modele (np. Imagen).
    return undefined; 
};

// --- LODÓWKA: PRZEPIS Z INWENTARZA ---
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  
  const prompt = `Jesteś szefem kuchni Plener Chrupnęło. Mam: ${stock}. Stwórz JEDEN przepis. 
  Zwróć WYŁĄCZNIE JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;

  const result = await model.generateContent(prompt);
  return safeParse(result.response.text());
};

// --- SKANER: ANALIZA ZDJĘCIA ---
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const prompt = `Analiza posiłku: ${foodName}, waga: ${weight}g. Podaj makro. 
  Zwróć WYŁĄCZNIE JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;

  let result;
  if (image && image.includes("base64")) {
    result = await model.generateContent([
      prompt,
      { inlineData: { data: image.split(',')[1], mimeType: "image/png" } }
    ]);
  } else {
    result = await model.generateContent(prompt);
  }
  return safeParse(result.response.text());
};

// --- GENERATOR JADŁOSPISU ---
export const generateMealPlan = async (config: any) => {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : config.goalMode === 'bulk' ? 'Masa' : 'Utrzymanie';

  const prompt = `Stwórz plan na 1 dzień: ${config.targetCalories} kcal. Cel: ${goalText}. Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}. 
  Zwróć WYŁĄCZNIE JSON: { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;

  const result = await model.generateContent(prompt);
  const data = safeParse(result.response.text());
  return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
};
