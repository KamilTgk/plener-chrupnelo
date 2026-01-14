import { RECIPES_DB, Recipe, CategoryType } from './recipesDatabase';

// --- KLUCZ API ---
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// --- LISTA MODELI AI (Zaktualizowana pod Polskę) ---
// Usunąłem modele, które dawały błąd 404. Zostawiłem te najstabilniejsze.
const ENDPOINTS = [
  // 1. Flash 2.0 (Najmądrzejszy, ale często zajęty)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  // 2. Flash 1.5 w wersji "002" (Często działa lepiej niż zwykły)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${API_KEY}`,
  // 3. Wersja starsza, ale stabilna
  `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`
];

const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź od AI.");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("Błąd formatowania danych JSON.");
  }
};

// Funkcja czekania (Retry strategy)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = { contents: [{ parts: [{ text: prompt }] }] };
  
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
  }

  // Próbujemy każdego modelu po kolei
  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    
    // 2 próby na każdy model
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`📡 [AI] Łączenie z: ${modelName} (Próba ${attempt})...`);
        const response = await fetch(url, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(requestBody) 
        });
        
        // Jeśli serwer zajęty (429), czekamy chwilę
        if (response.status === 429) {
          console.warn(`⏳ Model ${modelName} zajęty. Czekam 2 sekundy...`);
          await wait(2000); 
          continue;
        }

        // Jeśli model niedostępny (404), przerywamy pętlę dla tego modelu
        if (response.status === 404) {
            console.warn(`❌ Model ${modelName} niedostępny.`);
            break; 
        }

        if (!response.ok) break;

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Pusta odpowiedź");
        
        return safeParse(text);

      } catch (e) { 
          console.warn("Błąd połączenia:", e);
          continue; 
      }
    }
  }
  throw new Error("Wszystkie serwery AI są obecnie przeciążone. Spróbuj później.");
}

// --- FUNKCJE EKSPORTOWANE ---

// 1. Z LODÓWKI (HYBRYDA: AI -> FALLBACK DO BAZY LOKALNEJ)
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stockNames = items.map(i => i.name.toLowerCase());
  const stockString = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  
  try {
    // Krok 1: Próbujemy AI (jest bardziej kreatywne)
    console.log("🧊 Próba generowania z Lodówki przez AI...");
    const prompt = `Jesteś kucharzem. Mam: ${stockString}. Stwórz 1 kreatywny przepis wykorzystujący te składniki. Zwróć JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
    return await callGemini(prompt);

  } catch (error) {
    // Krok 2: Jeśli AI padnie (błędy 429/404), szukamy w bazie lokalnej
    console.warn("⚠️ AI niedostępne. Przeszukuję bazę lokalną...", error);
    
    // Szukamy przepisu, który zawiera chociaż jeden składnik z lodówki w swojej nazwie lub składnikach
    const foundLocal = RECIPES_DB.find(recipe => 
        stockNames.some(stockItem => 
            recipe.name.toLowerCase().includes(stockItem) || 
            recipe.ingredients.some(ing => ing.toLowerCase().includes(stockItem))
        )
    );

    if (foundLocal) {
        console.log("✅ Znaleziono pasujący przepis w bazie lokalnej!");
        return {
            ...foundLocal,
            name: `${foundLocal.name} (z Twoich zapasów)` // Oznaczenie dla użytkownika
        };
    }

    // Ostateczność: Losowy przepis z bazy
    console.log("🎲 Brak pasujących. Losuję propozycję.");
    return RECIPES_DB[Math.floor(Math.random() * RECIPES_DB.length)];
  }
};

// 2. ZE SKANU (Tylko AI - tu nie ma fallbacku, bo musimy widzieć zdjęcie)
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Oszacuj makro dla dania ze zdjęcia. Nazwa: ${foodName || "Rozpoznaj"}, Waga: ${weight || "Standardowa porcja"}. Zwróć JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGemini(prompt, image);
};

// 3. GENERATOR PLANU (PEŁNY OFFLINE - SZYBKI I NIEZAWODNY)
export const generateMealPlan = async (config: any) => {
  console.log(`🚀 Pobieranie planu z Bazy Lokalnej. Preferowana kuchnia: ${config.cuisine}`);
  
  const getRandomRecipe = (category: CategoryType, preferredCuisine: string): Recipe => {
    // Szukamy w wybranej kuchni
    let filtered = RECIPES_DB.filter(r => 
      r.category === category && 
      (r.cuisine.toLowerCase().includes(preferredCuisine.toLowerCase()) || preferredCuisine === 'Standard')
    );

    // Fallback: Jeśli pusto, szukamy w całej kategorii
    if (filtered.length === 0) {
        filtered = RECIPES_DB.filter(r => r.category === category);
    }
    
    // Fallback ostateczny: Losowy z bazy
    if (filtered.length === 0) return RECIPES_DB[0];

    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex];
  };

  let meals: Recipe[] = [];
  const count = parseInt(config.mealCount) || 3;
  const cuisine = config.cuisine || 'Standard'; 

  if (count === 3) {
    meals.push(getRandomRecipe('sniadanie', cuisine));
    meals.push(getRandomRecipe('obiad', cuisine));
    meals.push(getRandomRecipe('kolacja', cuisine));
  } else if (count === 4) {
    meals.push(getRandomRecipe('sniadanie', cuisine));
    meals.push(getRandomRecipe('drugie_sniadanie', cuisine));
    meals.push(getRandomRecipe('obiad', cuisine));
    meals.push(getRandomRecipe('kolacja', cuisine));
  } else if (count >= 5) {
    meals.push(getRandomRecipe('sniadanie', cuisine));
    meals.push(getRandomRecipe('drugie_sniadanie', cuisine));
    meals.push(getRandomRecipe('obiad', cuisine));
    meals.push(getRandomRecipe('podwieczorek', cuisine));
    meals.push(getRandomRecipe('kolacja', cuisine));
  }

  const totalKcal = meals.reduce((sum, m) => sum + m.kcal, 0);
  await wait(300);

  return {
    totalKcal,
    meals: meals.map(m => ({ ...m, completed: false }))
  };
};

// 4. WYMIANA POSIŁKU (OFFLINE)
export const swapMealItem = async (category: CategoryType, currentName: string, cuisine: string = 'Standard') => {
  console.log(`🎲 Losowanie nowego posiłku: ${category} (Kuchnia: ${cuisine})`);

  let candidates = RECIPES_DB.filter(r => 
    r.category === category && 
    r.name !== currentName &&
    (r.cuisine.toLowerCase().includes(cuisine.toLowerCase()) || cuisine === 'Standard')
  );

  if (candidates.length === 0) {
    candidates = RECIPES_DB.filter(r => r.category === category && r.name !== currentName);
  }

  if (candidates.length === 0) {
    console.warn("Brak alternatyw w bazie!");
    return null;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  await wait(200);
  return candidates[randomIndex];
};
