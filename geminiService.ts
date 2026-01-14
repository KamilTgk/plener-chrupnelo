import { RECIPES_DB, Recipe, CategoryType } from './recipesDatabase';

// --- KLUCZ API ---
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// --- LISTA MODELI AI ---
const ENDPOINTS = [
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${API_KEY}`,
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
        console.log(`📡 [AI] Łączenie z: ${modelName} (Próba ${attempt})...`);
        const response = await fetch(url, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(requestBody) 
        });
        
        if (response.status === 429) {
          console.warn(`⏳ Model ${modelName} zajęty. Czekam 2 sekundy...`);
          await wait(2000); 
          continue;
        }
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

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stockNames = items.map(i => i.name.toLowerCase());
  const stockString = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  
  try {
    console.log("🧊 Próba generowania z Lodówki przez AI...");
    const prompt = `Jesteś kucharzem. Mam: ${stockString}. Stwórz 1 kreatywny przepis. Zwróć JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
    return await callGemini(prompt);
  } catch (error) {
    console.warn("⚠️ AI niedostępne. Przeszukuję bazę lokalną...");
    const foundLocal = RECIPES_DB.find(recipe => 
        stockNames.some(stockItem => 
            recipe.name.toLowerCase().includes(stockItem) || 
            recipe.ingredients.some(ing => ing.toLowerCase().includes(stockItem))
        )
    );
    if (foundLocal) return { ...foundLocal, name: `${foundLocal.name} (z Twoich zapasów)` };
    return RECIPES_DB[Math.floor(Math.random() * RECIPES_DB.length)];
  }
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Oszacuj makro dla dania ze zdjęcia. Nazwa: ${foodName || "Rozpoznaj"}, Waga: ${weight || "Standardowa porcja"}. Zwróć JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGemini(prompt, image);
};

// --- GŁÓWNY GENERATOR Z AUTO-SKALOWANIEM ---
export const generateMealPlan = async (config: any) => {
  console.log(`🚀 Generowanie planu. Cel: ${config.targetCalories} kcal. Kuchnia: ${config.cuisine}`);
  
  const getRandomRecipe = (category: CategoryType, preferredCuisine: string): Recipe => {
    let filtered = RECIPES_DB.filter(r => 
      r.category === category && 
      (r.cuisine.toLowerCase().includes(preferredCuisine.toLowerCase()) || preferredCuisine === 'Standard')
    );
    if (filtered.length === 0) filtered = RECIPES_DB.filter(r => r.category === category);
    if (filtered.length === 0) return RECIPES_DB[0];
    return filtered[Math.floor(Math.random() * filtered.length)];
  };

  // 1. Dobieramy standardowe przepisy
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

  // 2. Obliczamy sumę kalorii w "surowych" przepisach
  const baseTotalKcal = meals.reduce((sum, m) => sum + m.kcal, 0);

  // 3. Obliczamy MNOŻNIK (Ratio), aby dobić do celu użytkownika
  // Jeśli cel to 2800, a przepisy mają 2000, mnożnik wyniesie 1.4 (czyli +40% porcji)
  const ratio = config.targetCalories / (baseTotalKcal || 1);

  console.log(`📊 Skalowanie porcji: Baza=${baseTotalKcal}, Cel=${config.targetCalories}, Mnożnik=${ratio.toFixed(2)}`);

  // 4. Skalujemy każdy posiłek
  const scaledMeals = meals.map(m => {
    const isScaled = ratio > 1.05 || ratio < 0.95; // Czy zmiana jest istotna?
    const percent = Math.round(ratio * 100);
    
    return {
        ...m,
        kcal: Math.round(m.kcal * ratio),
        protein: Math.round(m.protein * ratio),
        fat: Math.round(m.fat * ratio),
        carbs: Math.round(m.carbs * ratio),
        // Dodajemy informację o wielkości porcji do nazwy
        name: isScaled ? `${m.name} (Porcja: ${percent}%)` : m.name,
        completed: false
    };
  });

  const finalTotal = scaledMeals.reduce((sum, m) => sum + m.kcal, 0);
  await wait(300);

  return {
    totalKcal: finalTotal,
    meals: scaledMeals
  };
};

export const swapMealItem = async (category: CategoryType, currentName: string, cuisine: string = 'Standard') => {
  // UWAGA: Funkcja wymiany zwraca "surowy" przepis (bez skalowania).
  // W idealnym świecie powinniśmy go przeskalować, ale dla uproszczenia
  // zwracamy go w wersji standardowej. Użytkownik zobaczy zmianę w liczniku kalorii.
  
  let candidates = RECIPES_DB.filter(r => 
    r.category === category && 
    r.name !== currentName &&
    (r.cuisine.toLowerCase().includes(cuisine.toLowerCase()) || cuisine === 'Standard')
  );

  if (candidates.length === 0) {
    candidates = RECIPES_DB.filter(r => r.category === category && r.name !== currentName);
  }

  if (candidates.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * candidates.length);
  await wait(200);
  return candidates[randomIndex];
};
