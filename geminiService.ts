import { RECIPES_DB, Recipe, CategoryType } from './recipesDatabase';

// --- SEKCJA AI (Tylko dla Skanera i Lodówki) ---
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

const ENDPOINTS = [
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-1219:generateContent?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = { contents: [{ parts: [{ text: prompt }] }] };
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
  }

  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`📡 [AI] Próba połączenia: ${modelName}...`);
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
        
        if (response.status === 429) {
          await wait(2000); continue;
        }
        if (!response.ok) break;

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return safeParse(text);
      } catch (e) { continue; }
    }
  }
  throw new Error("Serwery AI zajęte.");
}

// --- FUNKCJE EKSPORTOWANE ---

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Jesteś kucharzem. Mam: ${stock}. Stwórz 1 przepis. Zwróć sam czysty JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGemini(prompt);
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Oszacuj makro dla: ${foodName || "Danie"}, Waga: ${weight || "Standard"}. Zwróć sam czysty JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGemini(prompt, image);
};

export const generateMealPlan = async (config: any) => {
  console.log(`🚀 Pobieranie planu z Bazy Lokalnej. Preferowana kuchnia: ${config.cuisine}`);
  
  const getRandomRecipe = (category: CategoryType, preferredCuisine: string): Recipe => {
    let filtered = RECIPES_DB.filter(r => 
      r.category === category && 
      (r.cuisine.toLowerCase().includes(preferredCuisine.toLowerCase()) || preferredCuisine === 'Standard')
    );

    if (filtered.length === 0) {
        filtered = RECIPES_DB.filter(r => r.category === category);
    }
    // Zabezpieczenie przed pustą bazą
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

// --- NOWA FUNKCJA: WYMIANA POSIŁKU (KOSTKA) ---
export const swapMealItem = async (category: CategoryType, currentName: string, cuisine: string = 'Standard') => {
  console.log(`🎲 Losowanie nowego posiłku: ${category} (Kuchnia: ${cuisine})`);

  // 1. Szukamy kandydatów (ta sama kategoria, inna nazwa niż teraz)
  let candidates = RECIPES_DB.filter(r => 
    r.category === category && 
    r.name !== currentName &&
    (r.cuisine.toLowerCase().includes(cuisine.toLowerCase()) || cuisine === 'Standard')
  );

  // 2. Fallback: Jeśli w danej kuchni nie ma innych opcji, szukamy w całej kategorii
  if (candidates.length === 0) {
    candidates = RECIPES_DB.filter(r => r.category === category && r.name !== currentName);
  }

  // 3. Jeśli nadal pusto (bo np. mamy tylko 1 przepis w bazie), zwracamy ten sam
  if (candidates.length === 0) {
    console.warn("Brak alternatyw w bazie!");
    return RECIPES_DB.find(r => r.name === currentName);
  }

  // 4. Losujemy
  const randomIndex = Math.floor(Math.random() * candidates.length);
  await wait(200); // Mały delay dla efektu UI
  return candidates[randomIndex];
};
