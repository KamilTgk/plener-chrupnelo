// Twój klucz:
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// LISTA CELÓW:
// 1. Gemini 1.5 Flash-002 (Sztywna wersja - często działa w UE, gdy ogólna "flash" daje 404)
// 2. Gemini 2.0 Flash Exp (Nasz pewniak, ale często zajęty)
const ENDPOINTS = [
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${API_KEY}`,
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

// Funkcja czekania z losowością (Jitter) - żeby nie uderzać w serwer równo z innymi
const waitRandom = (min: number, max: number) => {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiWithRetry(prompt: string, imageBase64?: string) {
  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({
      inlineData: { mimeType: "image/png", data: cleanBase64 }
    });
  }

  // PRÓBUJEMY KAŻDEGO ADRESU Z LISTY
  for (const url of ENDPOINTS) {
    const modelName = url.split("/models/")[1].split(":")[0];
    
    // DLA KAŻDEGO ADRESU ROBIMY AŻ 5 PRÓB "WŚLIZGNIĘCIA SIĘ"
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        console.log(`📡 [${modelName}] Próba ${attempt}/5...`);
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        // SCENARIUSZ 1: Serwer zajęty (429) -> Czekamy losowo i próbujemy dalej
        if (response.status === 429) {
          const delay = attempt * 1500 + Math.floor(Math.random() * 1000); // 1.5s - 8s
          console.warn(`⏳ [${modelName}] Zajęty. Czekam ${delay}ms...`);
          await waitRandom(delay, delay + 500);
          continue; 
        }

        // SCENARIUSZ 2: Model niedostępny (404) -> Przerywamy próby dla tego modelu i idziemy do następnego
        if (response.status === 404) {
          console.warn(`❌ [${modelName}] Niedostępny w regionie (404).`);
          break; // Wyjdź z pętli prób, idź do następnego url
        }

        if (!response.ok) {
           console.warn(`⚠️ Błąd inni niż 429/404: ${response.status}`);
           break; 
        }

        // SCENARIUSZ 3: SUKCES
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Pusta treść");

        console.log(`✅ SUKCES! Model ${modelName} odpowiedział!`);
        return safeParse(text);

      } catch (e) {
        console.warn("Błąd sieci:", e);
        await waitRandom(1000, 2000);
      }
    }
  }

  throw new Error("Wszystkie linie zajęte (429) lub modele niedostępne (404). Spróbuj za minutę.");
}

// --- EKSPOATOWANE FUNKCJE ---

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Jesteś kucharzem. Mam: ${stock}. Stwórz 1 przepis. Zwróć sam czysty JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGeminiWithRetry(prompt);
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Oszacuj makro dla: ${foodName || "Danie"}, Waga: ${weight || "Standard"}. Zwróć sam czysty JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGeminiWithRetry(prompt, image);
};

export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
  const prompt = `Plan diety 1 dzień: ${config.targetCalories} kcal (${goalText}). Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}. Zwróć sam czysty JSON: { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;
  return await callGeminiWithRetry(prompt); // Poprawione wywołanie
};
