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

// --- FUNKCJE HYBRYDOWE ---

// 1. Z LODÓWKI (Używa AI - tu kuchnia nie ma znaczenia, liczą się składniki)
export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Jesteś kucharzem. Mam: ${stock}. Stwórz 1 przepis. Zwróć sam czysty JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGemini(prompt);
};

// 2. ZE SKANU (Używa AI - rozpoznaje to co widzi)
export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Oszacuj makro dla: ${foodName || "Danie"}, Waga: ${weight || "Standard"}. Zwróć sam czysty JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGemini(prompt, image);
};

// 3. GENERATOR PLANU (UŻYWA LOKALNEJ BAZY 8000 PRZEPISÓW + FILTR KUCHNII)
export const generateMealPlan = async (config: any) => {
  console.log(`🚀 Pobieranie planu z Bazy Lokalnej. Preferowana kuchnia: ${config.cuisine}`);
  
  // Funkcja losująca z uwzględnieniem preferencji
  const getRandomRecipe = (category: CategoryType, preferredCuisine: string): Recipe => {
    
    // Krok 1: Szukamy przepisu, który pasuje do kategorii ORAZ wybranej kuchni
    // Np. Obiad + Włoska
    let filtered = RECIPES_DB.filter(r => 
      r.category === category && 
      (r.cuisine.toLowerCase().includes(preferredCuisine.toLowerCase()) || preferredCuisine === 'Standard')
    );

    // Krok 2: Jeśli nie ma nic w wybranej kuchni (np. brak Japońskiego śniadania),
    // bierzemy cokolwiek z danej kategorii (Fallback), żeby nie zwrócić błędu.
    if (filtered.length === 0) {
        console.warn(`Brak przepisu ${preferredCuisine} dla ${category}. Biorę losowy.`);
        filtered = RECIPES_DB.filter(r => r.category === category);
    }

    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex];
  };

  let meals: Recipe[] = [];
  const count = parseInt(config.mealCount) || 3;
  const cuisine = config.cuisine || 'Standard'; // Pobieramy kuchnię z konfiguracji użytkownika

  // Generowanie posiłków
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

  // Obliczamy sumy
  const totalKcal = meals.reduce((sum, m) => sum + m.kcal, 0);

  // Symulujemy małe opóźnienie dla UX
  await wait(300);

  return {
    totalKcal,
    meals: meals.map(m => ({ ...m, completed: false }))
  };
};
