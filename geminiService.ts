// src/geminiService.ts

// --- TWÓJ KLUCZ API ---
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// --- LISTA MODELI AI (Priorytet: Flash 1.5 - szybki i stabilny w PL) ---
const ENDPOINTS = [
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`, // Nowszy, ale czasem zajęty
  `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`
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

// --- FUNKCJA CZEKANIA (Dla ponownych prób) ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- GŁÓWNY SILNIK POŁĄCZEŃ ---
async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }],
    // Ustawiamy temperaturę na wyższą (0.9), żeby AI było bardziej kreatywne i różnorodne
    generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 2500,
    }
  };
  
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
  }

  // Pętla "Failover" - jak jeden serwer zajęty, próbuje drugiego
  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`📡 [Live AI] Zapytanie do: ${modelName} (Próba ${attempt})...`);
        const response = await fetch(url, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(requestBody) 
        });
        
        if (response.status === 429) {
          console.warn(`⏳ Model ${modelName} przeciążony. Czekam 3s...`);
          await wait(3000); 
          continue;
        }
        
        if (!response.ok) {
            console.warn(`❌ Błąd serwera: ${response.status}`);
            break; // Idź do następnego modelu
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Pusta treść");
        
        console.log("✅ AI odpowiedziało poprawnie!");
        return safeParse(text);

      } catch (e) { 
          console.warn("Błąd połączenia:", e);
          await wait(1000);
          continue; 
      }
    }
  }
  throw new Error("Przepraszamy, serwery AI są w tym momencie niedostępne. Spróbuj za minutę.");
}

// =====================================================================
// FUNKCJE EKSPORTOWANE (LOGIKA BIZNESOWA)
// =====================================================================

// 1. GENERATOR PLANU CAŁODNIOWEGO (AI tworzy i liczy)
export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : config.goalMode === 'bulk' ? 'Masa' : 'Utrzymanie';
  
  console.log(`🚀 AI Generuje Plan Online. Cel: ${config.targetCalories} kcal. Kuchnia: ${config.cuisine}`);
  
  const prompt = `
    Jesteś profesjonalnym dietetykiem i szefem kuchni.
    Zadanie: Stwórz plan żywieniowy na jeden dzień.
    
    PARAMETRY UŻYTKOWNIKA:
    - Cel kalorii: ${config.targetCalories} kcal (Margines błędu +/- 50 kcal).
    - Liczba posiłków: ${config.mealCount}.
    - Preferowana kuchnia: ${config.cuisine}.
    - Wykluczenia: ${config.exclusions || "Brak"}.
    - Cel diety: ${goalText}.

    WYMAGANIA:
    1. Przeszukaj swoją wiedzę kulinarną i znajdź ciekawe, realne przepisy pasujące do kuchni ${config.cuisine}.
    2. SKALOWANIE: Dostosuj gramaturę składników w każdym przepisie tak, aby suma kalorii całego dnia wynosiła dokładnie ok. ${config.targetCalories}.
    3. Przepisy mają mieć dokładne instrukcje krok po kroku.
    4. Unikaj powtórzeń (np. nie dawaj owsianki dwa razy).

    FORMAT ODPOWIEDZI (Tylko czysty JSON):
    {
      "totalKcal": ${config.targetCalories},
      "meals": [
        {
          "name": "Kreatywna nazwa dania",
          "category": "Śniadanie/Obiad/Kolacja",
          "kcal": 0,
          "protein": 0,
          "fat": 0,
          "carbs": 0,
          "ingredients": ["Składnik 1 - ilość g", "Składnik 2 - ilość g"],
          "instructions": ["Krok 1...", "Krok 2..."]
        }
      ]
    }
  `;

  const aiData = await callGemini(prompt);
  
  // Dodajemy pola techniczne dla aplikacji
  return {
      ...aiData,
      meals: aiData.meals.map((m: any) => ({ ...m, completed: false, imageUrl: null }))
  };
};

// 2. WYMIANA POJEDYNCZEGO POSIŁKU (AI szuka zamiennika)
export const swapMealItem = async (category: string, currentName: string, cuisine: string = 'Standard') => {
  console.log(`🎲 AI szuka w internecie zamiennika dla: ${currentName} (${category})`);
  
  const prompt = `
    Użytkownik chce wymienić danie: "${currentName}" (Kategoria: ${category}).
    Znajdź w swojej bazie wiedzy INNY, ciekawy przepis z kuchni: ${cuisine}.
    
    Wymagania:
    - Danie musi być z tej samej kategorii (np. jeśli to Obiad, to daj inny Obiad).
    - Musi być kalorycznie zbliżone do standardowego posiłku w tej kategorii.
    - Podaj dokładne składniki i instrukcję.
    
    Zwróć TYLKO JSON obiektu przepisu:
    { 
      "name": "Nowa nazwa dania", 
      "category": "${category}", 
      "kcal": 0, 
      "protein": 0, 
      "fat": 0, 
      "carbs": 0, 
      "ingredients": ["..."], 
      "instructions": ["..."] 
    }
  `;

  return await callGemini(prompt);
};

// 3. GENEROWANIE Z LODÓWKI (AI kreatywne)
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stockString = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  
  const prompt = `
    Jesteś szefem kuchni Zero Waste.
    Mam w lodówce: ${stockString}.
    Wymyśl 1 pyszny przepis obiadowy wykorzystujący te składniki.
    Możesz dodać podstawowe produkty (woda, oliwa, przyprawy, mąka), ale bazuj na tym co mam.
    
    Zwróć TYLKO JSON: 
    { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }
  `;
  
  return await callGemini(prompt);
};

// 4. ANALIZA ZDJĘCIA (AI Vision)
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `
    Jesteś dietetykiem. Analizujesz zdjęcie potrawy.
    Nazwa użytkownika (opcjonalna): ${foodName || "Rozpoznaj z obrazka"}.
    Waga (opcjonalna): ${weight || "Oszacuj standardową porcję"}.
    
    Zidentyfikuj potrawę i podaj jej makroskładniki.
    Zwróć TYLKO JSON: 
    { "name": "Precyzyjna nazwa", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }
  `;
  return await callGemini(prompt, image);
};
