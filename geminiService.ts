const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

// LISTA ADRESÓW (Naprawiona: mieszanka v1beta i v1 dla pewności)
const ENDPOINTS = [
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}` // Wersja v1 (stabilna) jako ostateczny ratunek
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
  // UWAGA: Usunięto 'generationConfig' z wymuszaniem JSON, 
  // ponieważ starsze modele (gemini-pro) tego nie obsługują i wyrzucają błąd.
  const requestBody: any = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  // Obsługa zdjęcia (tylko jeśli jest)
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
      // Wyciągamy nazwę modelu z URL dla logów
      const modelName = url.includes("models/") ? url.split("models/")[1].split(":")[0] : "AI";
      console.log(`Próba: ${modelName}...`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // Jeśli ten model nie działa (404/500), idź do następnego
        throw new Error(`Status: ${response.status}`);
      }

      const data = await response.json();
      
      // Bezpieczne wyciąganie tekstu
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Pusta treść");

      console.log(`✅ SUKCES z modelem: ${modelName}`);
      return safeParse(text);

    } catch (e) {
      console.warn(`Nieudana próba, sprawdzam kolejny model...`);
      continue; // Skok do następnego adresu w liście ENDPOINTS
    }
  }

  throw new Error("BŁĄD KRYTYCZNY: Żaden model AI nie odpowiedział. Sprawdź limity Google.");
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
