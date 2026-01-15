// src/geminiService.ts

// --- TWÓJ KLUCZ API ---
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// --- LISTA MODELI AI (ZAKTUALIZOWANA POD POLSKĘ) ---
// Kolejność ma znaczenie: system spróbuje pierwszego, jak błąd -> idzie do drugiego.
const ENDPOINTS = [
  // 1. Model "Thinking" (Eksperymentalny) - często mniej zajęty niż zwykły Flash 2.0
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${API_KEY}`,
  
  // 2. Flash 1.5 wersja "002" (NAJWAŻNIEJSZE: Wersja sztywna - działa w UE, gdy zwykła daje 404)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${API_KEY}`,
  
  // 3. Flash 1.5 wersja "8b" (Wersja lekka/szybka - deska ratunku)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${API_KEY}`,

  // 4. Stary Flash 001 (Pancerny, działa zawsze)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${API_KEY}`
];

// --- PARSER (Czyści odpowiedź z AI do czystego JSONa) ---
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

// --- FUNKCJA CZEKANIA ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- GŁÓWNY SILNIK POŁĄCZEŃ ---
async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
        temperature: 0.7, // Lekko kreatywny, ale stabilny
        maxOutputTokens: 2000,
    }
  };
  
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
  }

  // Pętla "Failover" po modelach
  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    
    // Tylko 1 próba na model (żeby szybko przeskoczyć do działającego)
    try {
      console.log(`📡 [Live AI] Próba połączenia: ${modelName}...`);
      
      const response = await fetch(url, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(requestBody) 
      });
      
      // SCENARIUSZ 1: Zajęty (429) -> Idź od razu do następnego modelu!
      if (response.status === 429) {
        console.warn(`⏳ Model ${modelName} jest zapchany. Przełączam na inny...`);
        continue;
      }
      
      // SCENARIUSZ 2: Niedostępny w PL (404) -> Idź dalej
      if (response.status === 404) {
          console.warn(`❌ Model ${modelName} niedostępny w regionie (404).`);
          continue;
      }

      if (!response.ok) {
          console.warn(`⚠️ Inny błąd serwera: ${response.status}`);
          continue; 
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Pusta treść");
      
      console.log(`✅ SUKCES! Model ${modelName} odpowiedział!`);
      return safeParse(text);

    } catch (e) { 
        console.warn("Błąd sieci:", e);
        continue; 
    }
  }
  
  throw new Error("Wszystkie serwery AI są zajęte. Spróbuj za minutę.");
}

// =====================================================================
// FUNKCJE EKSPORTOWANE (LOGIKA BIZNESOWA)
// =====================================================================

// 1. GENERATOR PLANU CAŁODNIOWEGO (AI)
export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : config.goalMode === 'bulk' ? 'Masa' : 'Utrzymanie';
  
  console.log(`🚀 AI Generuje Plan. Cel: ${config.targetCalories} kcal. Kuchnia: ${config.cuisine}`);
  
  const prompt = `
    Jesteś profesjonalnym dietetykiem.
    Stwórz plan żywieniowy na jeden dzień.
    
    PARAMETRY:
    - Cel kalorii: ${config.targetCalories} kcal (Margines +/- 50 kcal).
    - Liczba posiłków: ${config.mealCount}.
    - Preferowana kuchnia: ${config.cuisine}.
    - Wykluczenia: ${config.exclusions || "Brak"}.
    - Cel: ${goalText}.

    ZADANIE:
    1. Dobierz ciekawe przepisy (mogą być z internetu).
    2. PRZELICZ SKŁADNIKI tak, aby suma kalorii idealnie pasowała do celu ${config.targetCalories}.
    3. Jeśli kuchnia to "${config.cuisine}", daj dania w tym stylu.

    FORMAT ODPOWIEDZI (Czysty JSON):
    {
      "totalKcal": ${config.targetCalories},
      "meals": [
        {
          "name": "Pełna nazwa dania",
          "category": "Śniadanie/Obiad/itp",
          "kcal": 0,
          "protein": 0,
          "fat": 0,
          "carbs": 0,
          "ingredients": ["produkt - ilość g", "produkt - ilość g"],
          "instructions": ["Krok 1", "Krok 2"]
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

// 2. WYMIANA POJEDYNCZEGO POSIŁKU (AI)
export const swapMealItem = async (category: string, currentName: string, cuisine: string = 'Standard') => {
  console.log(`🎲 AI szuka zamiennika dla: ${currentName}`);
  
  const prompt = `
    Użytkownik chce wymienić danie: "${currentName}" (Kategoria: ${category}).
    Znajdź INNY przepis z kuchni: ${cuisine}.
    Kaloryczność ma być zbliżona do oryginału.
    
    Zwróć TYLKO JSON:
    { 
      "name": "Nowa nazwa", 
      "category": "${category}", 
      "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, 
      "ingredients": ["..."], "instructions": ["..."] 
    }
  `;

  return await callGemini(prompt);
};

// 3. GENEROWANIE Z LODÓWKI (AI)
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stockString = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  
  const prompt = `
    Jestem głodny. Mam w lodówce: ${stockString}.
    Wymyśl 1 pyszny, kompletny przepis obiadowy z tego.
    
    Zwróć JSON: 
    { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }
  `;
  
  return await callGemini(prompt);
};

// 4. ANALIZA ZDJĘCIA (AI)
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `
    Analiza jedzenia. Nazwa: ${foodName || "Ze zdjęcia"}. Waga: ${weight || "Standard"}.
    Podaj makro.
    Zwróć JSON: 
    { "name": "Precyzyjna nazwa", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }
  `;
  return await callGemini(prompt, image);
};
