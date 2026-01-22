// src/geminiService.ts

// 🛑 WAŻNE: Wklej tu NOWY klucz z Google AI Studio. Stary jest zablokowany.
const API_KEY = "AIzaSyBKjQ4yUFcskCGrR8uWUpXKd_ufG4_Dqug"; 

// --- LISTA MODELI (Zaktualizowana i bezpieczna) ---
const ENDPOINTS = [
  // 1. Stabilny model (Podstawa w PL)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
  // 2. Wersja nowsza (Jako zapas)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  // 3. Wersja szybka
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${API_KEY}`
];

const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź od AI.");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Brak JSON w odpowiedzi");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("AI zwróciło błąd formatowania danych.");
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2500 }
  };
  
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
  }

  // Pętla po modelach
  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    try {
      console.log(`📡 [AI] Próba: ${modelName}...`);
      const response = await fetch(url, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(requestBody) 
      });
      
      // Obsługa błędów
      if (response.status === 403) {
          throw new Error("⛔ Twój klucz API jest nieprawidłowy lub zablokowany. Wygeneruj nowy!");
      }
      
      if (response.status === 429 || response.status === 404 || response.status >= 500) {
         console.warn(`⚠️ Model ${modelName} niedostępny. Przełączam...`);
         continue; 
      }
      
      if (!response.ok) throw new Error(`Błąd API: ${response.status}`);

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Pusta treść");
      
      console.log(`✅ Sukces! (${modelName})`);
      return safeParse(text);

    } catch (e: any) {
        // Jeśli błąd to zablokowany klucz - przerywamy wszystko natychmiast
        if (e.message.includes("zablokowany")) throw e;
        
        console.warn(`Błąd modelu ${modelName}:`, e);
        await wait(500); 
        continue; 
    }
  }
  throw new Error("Serwery AI są zajęte. Spróbuj za chwilę.");
}

// --- FUNKCJE EKSPORTOWANE ---

export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
  console.log(`🚀 Generowanie Planu. Cel: ${config.targetCalories} kcal.`);
  const prompt = `
    Jesteś dietetykiem. Plan na 1 dzień.
    Cel: ${config.targetCalories} kcal. Posiłków: ${config.mealCount}.
    Kuchnia: ${config.cuisine}. Wykluczenia: ${config.exclusions || "Brak"}.
    Cel: ${goalText}.
    Zasady: Znajdź przepisy i PRZELICZ gramaturę tak, aby suma kalorii = ${config.targetCalories}.
    Zwróć TYLKO JSON:
    { "totalKcal": ${config.targetCalories}, "meals": [ { "name": "Nazwa", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] } ] }
  `;
  const aiData = await callGemini(prompt);
  return { ...aiData, meals: aiData.meals.map((m: any) => ({ ...m, completed: false, imageUrl: null })) };
};

export const swapMealItem = async (category: string, currentName: string, cuisine: string = 'Standard') => {
  console.log(`🎲 Wymiana dania: ${currentName}`);
  const prompt = `Wymień danie "${currentName}" (Kat: ${category}) na inne z kuchni ${cuisine}. Kaloryczność podobna. Zwróć JSON: { "name": "...", "category": "${category}", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGemini(prompt);
};

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Mam w lodówce: ${stock}. Wymyśl przepis obiadowy. Zwróć JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGemini(prompt);
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Analiza zdjęcia. Nazwa: ${foodName}, Waga: ${weight}. Podaj makro w JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGemini(prompt, image);
};
