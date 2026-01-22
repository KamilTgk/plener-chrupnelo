// src/geminiService.ts

// --- TWÓJ KLUCZ API ---
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// --- LISTA MODELI (ZAKTUALIZOWANA I POPRAWIONA) ---
// Usunąłem model "Thinking-01-21", który powodował błąd 404.
const ENDPOINTS = [
  // 1. Flash 1.5 (Wersja 002) - To jest "Złoty Standard" w UE. Rzadko zawodzi.
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${API_KEY}`,
  
  // 2. Flash 2.0 (Ogólna wersja, bez daty) - Czasem zapchana (429), ale istnieje.
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
  
  // 3. Flash 1.5 (Wersja 8b) - Bardzo szybka, lekka.
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${API_KEY}`,

  // 4. Stary Pro (Ostatnia deska ratunku)
  `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`
];

// --- PARSER ---
const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź od AI.");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Brak JSON w odpowiedzi");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("AI zwróciło błąd formatowania.");
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- GŁÓWNY SILNIK ---
async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }],
    // Zmniejszam temperaturę do 0.7, żeby format JSON był stabilniejszy
    generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
    }
  };
  
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
  }

  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    // Jedna solidna próba na model, żeby szybciej przeskoczyć do działającego
    try {
      console.log(`📡 [Live AI] Próba połączenia: ${modelName}...`);
      const response = await fetch(url, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(requestBody) 
      });
      
      // Jeśli model zapchany (429) LUB nie istnieje (404) -> IDŹ DALEJ
      if (response.status === 429 || response.status === 404) {
        console.warn(`⚠️ Model ${modelName} niedostępny (${response.status}). Przełączam...`);
        continue;
      }
      
      if (!response.ok) {
          console.warn(`❌ Inny błąd serwera: ${response.status}`);
          continue; 
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Pusta treść");
      
      console.log("✅ AI Sukces!");
      return safeParse(text);

    } catch (e) { 
        console.warn("Błąd sieci:", e);
        continue; 
    }
  }
  throw new Error("Wszystkie serwery zajęte. Spróbuj za chwilę.");
}

// =====================================================================
// FUNKCJE EKSPORTOWANE
// =====================================================================

// 1. GENERATOR PLANU (PEŁNY AI)
export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
  console.log(`🚀 AI Generuje Plan. Cel: ${config.targetCalories} kcal.`);
  
  const prompt = `
    Jesteś dietetykiem. Stwórz plan na 1 dzień.
    Cel: ${config.targetCalories} kcal.
    Posiłków: ${config.mealCount}.
    Kuchnia: ${config.cuisine}.
    Wykluczenia: ${config.exclusions || "Brak"}.
    Cel diety: ${goalText}.

    Zasady:
    1. Dobierz realne przepisy.
    2. SKALOWANIE: Oblicz gramaturę tak, aby suma kalorii = ${config.targetCalories} (+/- 50).
    3. JSON ma być poprawny.

    Zwróć TYLKO JSON:
    {
      "totalKcal": ${config.targetCalories},
      "meals": [
        {
          "name": "Nazwa dania",
          "category": "Śniadanie/Obiad...",
          "kcal": 0, "protein": 0, "fat": 0, "carbs": 0,
          "ingredients": ["..."],
          "instructions": ["..."]
        }
      ]
    }
  `;

  const aiData = await callGemini(prompt);
  return {
      ...aiData,
      meals: aiData.meals.map((m: any) => ({ ...m, completed: false, imageUrl: null }))
  };
};

// 2. WYMIANA (AI)
export const swapMealItem = async (category: string, currentName: string, cuisine: string = 'Standard') => {
  console.log(`🎲 AI szuka zamiennika dla: ${currentName}`);
  const prompt = `
    Wymień danie: "${currentName}" (Kategoria: ${category}).
    Daj INNY przepis (Kuchnia: ${cuisine}).
    Kaloryczność zbliżona do oryginału.
    Zwróć TYLKO JSON: { "name": "...", "category": "${category}", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }
  `;
  return await callGemini(prompt);
};

// 3. LODÓWKA (AI)
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Mam: ${stock}. Wymyśl 1 przepis obiadowy. Zwróć JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGemini(prompt);
};

// 4. SKAN (AI)
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Analiza zdjęcia. Nazwa: ${foodName}, Waga: ${weight}. Podaj makro w JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGemini(prompt, image);
};
