// src/geminiService.ts

// 🛑 PAMIĘTAJ: Tu musi być Twój NOWY klucz API
const API_KEY = "AIzaSyBKjQ4yUFcskCGrR8uWUpXKd_ufG4_Dqug"; 

// --- LISTA MODELI (Kolejność: Od największego limitu do najmniejszego) ---
const AVAILABLE_MODELS = [
  // 1. "Wół roboczy" - największe limity darmowe, stabilny
  "gemini-1.5-flash", 
  
  // 2. Wersja lekka - bardzo szybka, rzadko się korkuje
  "gemini-1.5-flash-8b",

  // 3. Wersja eksperymentalna - najmądrzejsza, ale małe limity (często rzuca 429)
  "gemini-2.0-flash-exp", 
  
  // 4. Klasyk - jako ostateczność
  "gemini-pro"
];

// Budujemy pełne adresy URL
const ENDPOINTS = AVAILABLE_MODELS.map(model => 
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`
);

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

// Funkcja czekania
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2500,
    }
  };
  
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
  }

  // Pętla po modelach (Failover)
  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    
    try {
      console.log(`📡 [AI] Próba połączenia: ${modelName}...`);
      
      const response = await fetch(url, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(requestBody) 
      });
      
      // SCENARIUSZ: Przekroczono limit (429)
      if (response.status === 429) {
        console.warn(`⏳ Limit wyczerpany dla ${modelName}. Czekam 4 sekundy i zmieniam model...`);
        await wait(4000); // Czekamy dłużej niż prosi Google (2.5s -> 4s)
        continue; // Idź do następnego modelu z listy
      }
      
      // SCENARIUSZ: Inne błędy (404, 500, 503)
      if (!response.ok) {
          console.warn(`❌ Błąd modelu ${modelName}: ${response.status}. Przełączam...`);
          continue; 
      }

      const data = await response.json();
      
      // Czasem wpada 200 OK, ale w środku jest informacja o blokadzie
      if (data.error) {
          throw new Error(data.error.message);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Pusta treść");
      
      console.log(`✅ Sukces! Obsłużył: ${modelName}`);
      return safeParse(text);

    } catch (e: any) { 
        console.warn(`Błąd połączenia z ${modelName}:`, e);
        // Jeśli klucz zablokowany - koniec gry
        if (e.message && (e.message.includes("API key") || e.message.includes("403"))) {
            throw e; 
        }
        await wait(1000); 
        continue; 
    }
  }
  
  throw new Error("Wyczerpano limity dla wszystkich modeli. Odczekaj chwilę (ok. minuty) i spróbuj ponownie.");
}

// =================================================================
// FUNKCJE EKSPORTOWANE
// =================================================================

export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
  console.log(`🚀 Generowanie Planu. Cel: ${config.targetCalories} kcal.`);
  
  const prompt = `
    Jesteś dietetykiem. Plan na 1 dzień.
    Cel: ${config.targetCalories} kcal. Posiłków: ${config.mealCount}.
    Kuchnia: ${config.cuisine}. Wykluczenia: ${config.exclusions || "Brak"}.
    Cel diety: ${goalText}.
    
    Zadanie: Dobierz przepisy i PRZELICZ gramatury tak, aby suma kalorii = ${config.targetCalories}.
    Zwróć JSON:
    { "totalKcal": ${config.targetCalories}, "meals": [ { "name": "Nazwa", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] } ] }
  `;
  const aiData = await callGemini(prompt);
  return { ...aiData, meals: aiData.meals.map((m: any) => ({ ...m, completed: false, imageUrl: null })) };
};

export const swapMealItem = async (category: string, currentName: string, cuisine: string = 'Standard') => {
  console.log(`🎲 Wymiana: ${currentName}`);
  const prompt = `Wymień danie "${currentName}" (${category}) na inne (kuchnia: ${cuisine}). Kaloryczność podobna. Zwróć JSON: { "name": "...", "category": "${category}", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGemini(prompt);
};

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Mam w lodówce: ${stock}. Przepis obiadowy. Zwróć JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGemini(prompt);
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Analiza zdjęcia. Nazwa: ${foodName}, Waga: ${weight}. Podaj makro w JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGemini(prompt, image);
};
