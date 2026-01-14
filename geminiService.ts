// Twój działający klucz:
const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// JEDYNY ADRES, KTÓRY REAGUJE (nawet jeśli jest zajęty)
const TARGET_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;

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

// Funkcja czekania (Promise)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiWithRetry(prompt: string, imageBase64?: string) {
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

  // STRATEGIA "UPARTY KURIER"
  // Próbujemy aż 5 razy, zwiększając czas oczekiwania
  const maxRetries = 5;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 Próba ${attempt}/${maxRetries} połączenia z Gemini 2.0...`);
      
      const response = await fetch(TARGET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      // SCENARIUSZ 1: Serwer zajęty (429)
      if (response.status === 429) {
        // Czekamy coraz dłużej: 2s, 4s, 6s, 8s...
        const delay = attempt * 2000; 
        console.warn(`⏳ Serwer pełny (429). Czekam ${delay/1000} sekund w kolejce...`);
        await wait(delay);
        continue; // Spróbuj ponownie
      }

      // SCENARIUSZ 2: Błąd inny niż zajętość (np. 500, 503)
      if (!response.ok) {
        console.warn(`⚠️ Błąd serwera: ${response.status}. Ponawiam...`);
        await wait(2000);
        continue;
      }

      // SCENARIUSZ 3: SUKCES (200 OK)
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Pusta treść");

      console.log(`✅ SUKCES! Weszliśmy!`);
      return safeParse(text);

    } catch (e) {
      console.warn("Błąd sieci/połączenia:", e);
      await wait(2000);
    }
  }

  throw new Error("Serwer jest ekstremalnie obciążony. Spróbuj ponownie za minutę.");
}

// --- EKSPOATOWANE FUNKCJE (Używają nowej funkcji retry) ---

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
  const data = await callGeminiWithRetry(prompt);
  return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
};
