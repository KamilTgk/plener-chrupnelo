// Twój działający klucz (potwierdzony przez błąd 429):
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// Używamy TYLKO tego modelu, który "odpowiedział" (nawet błędem 429).
// Inne modele (3.0, 2.5) powodują błędy krytyczne, więc je usunąłem.
const ENDPOINTS = [
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  // Jako absolutny zapas dodaję Flasha 1.5 w wersji eksperymentalnej 8b (czasami działa w PL)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${API_KEY}`
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

// Funkcja "Wait" - czekanie przed ponowną próbą
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({
      inlineData: {
        mimeType: "image/png",
        data: cleanBase64
      }
    });
  }

  // Strategia: "Do trzech razy sztuka"
  // Próbujemy połączyć się z modelem 2.0. Jak zajęty -> czekamy i znowu.
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const modelName = url.split("/models/")[1].split(":")[0];
        console.log(`📡 Próba ${attempt}/3: ${modelName}...`);
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        // 429 = Serwer zapchany. Czekamy dłużej (3 sekundy) i ponawiamy.
        if (response.status === 429) {
          console.warn(`⏳ Serwer przeciążony. Czekam 3 sekundy...`);
          await wait(3000); 
          continue; 
        }

        // 403/404 = Model niedostępny/nieistniejący. Przerywamy pętlę dla tego adresu.
        if (!response.ok) {
           console.warn(`❌ Błąd modelu ${modelName}: ${response.status}`);
           break; 
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Pusta treść");

        console.log(`✅ SUKCES!`);
        return safeParse(text);

      } catch (e) {
        console.warn("Błąd połączenia:", e);
        await wait(1000);
        continue;
      }
    }
  }

  throw new Error("Serwery Google są teraz bardzo obciążone (Błąd 429). Spróbuj za minutę.");
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
  const data = await callGemini(prompt);
  return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
};
