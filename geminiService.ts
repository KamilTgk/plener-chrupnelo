const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

// NOWA LISTA: Celujemy w konkretne, sztywne wersje modeli, a nie ogólne nazwy.
// To eliminuje błąd 404 "Model not found".
const ENDPOINTS = [
  // Najnowszy stabilny Flash (największa szansa sukcesu)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`,
  // Konkretna wersja 001 (zawsze dostępna)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${API_KEY}`,
  // Nowa wersja 002
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${API_KEY}`,
  // Wersja 8b (bardzo szybka i tania, rzadko przeciążona)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${API_KEY}`,
  // Ostatnia deska ratunku - stary Pro w wersji beta
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`
];

const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź od AI.");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("AI zwróciło błąd formatowania.");
  }
};

async function callGemini(prompt: string, imageBase64?: string) {
  // UWAGA: Usunąłem wymuszanie JSON w configu, bo starsze wersje tego nie lubią.
  // Polegamy na instrukcji w tekście prompta.
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

  // PĘTLA RATUNKOWA
  for (const url of ENDPOINTS) {
    try {
      // Wyciągamy nazwę modelu dla logów (np. gemini-1.5-flash-001)
      const modelName = url.split("/models/")[1].split(":")[0];
      console.log(`📡 Próba połączenia z: ${modelName}...`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // Jeśli 429 (za dużo zapytań) lub 404 (nie znaleziono), idziemy dalej
        const errText = await response.text();
        console.warn(`⚠️ Błąd modelu ${modelName}: ${response.status}`, errText);
        continue; 
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Pusta treść");

      console.log(`✅ SUKCES! Połączono z: ${modelName}`);
      return safeParse(text);

    } catch (e) {
      continue; // Próbuj następnego
    }
  }

  throw new Error("Wszystkie serwery Google zajęte lub niedostępne. Spróbuj za chwilę.");
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
