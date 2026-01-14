// Twój klucz:
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// LISTA WSZYSTKICH MOŻLIWYCH MODELI (Od najmniej zajętych)
const ENDPOINTS = [
  // 1. Model "Thinking" - Mało znany, więc często WOLNY (To nasz As)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-1219:generateContent?key=${API_KEY}`,
  
  // 2. Standardowy Flash (Beta) - Klasyk
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,

  // 3. Flash 8B (Wersja lekka)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${API_KEY}`,
  
  // 4. Gemini 2.0 Exp (Ten co daje 429 - zostawiamy go na szarym końcu jako ostatnią deskę ratunku)
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
  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({
      inlineData: { mimeType: "image/png", data: cleanBase64 }
    });
  }

  // PĘTLA PO WSZYSTKICH MODELACH
  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    
    // Dla każdego modelu robimy 2 szybkie próby
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`📡 [${modelName}] Próba ${attempt}/2...`);
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        // Jeśli 429 (Zajęty) -> Czekamy chwilę i ponawiamy (ale tylko raz, potem zmiana modelu)
        if (response.status === 429) {
          console.warn(`⏳ [${modelName}] Zajęty. Czekam 2s...`);
          await wait(2000);
          continue; 
        }

        // Jeśli 404 (Niedostępny) -> Natychmiast przerywamy i idziemy do następnego modelu z listy
        if (response.status === 404) {
          console.warn(`❌ [${modelName}] Niedostępny (404). Zmieniam model.`);
          break; // Break pętli prób, idzie do następnego url
        }

        if (!response.ok) {
           break; 
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Pusta treść");

        console.log(`✅ SUKCES! Model ${modelName} dał radę!`);
        return safeParse(text);

      } catch (e) {
        console.warn("Błąd:", e);
        continue;
      }
    }
  }

  throw new Error("Wszystkie serwery zajęte. Spróbuj za minutę.");
}

// --- EKSPOATOWANE FUNKCJE ---

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
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
  const prompt = `Plan diety 1 dzień: ${config.targetCalories} kcal (${goalText}). Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}. Zwróć sam czysty JSON: { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;
  return await callGemini(prompt);
};
