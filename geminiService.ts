const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

// LISTA PANCERNA: Mieszamy wersje Beta i Stabilne (v1).
// Jeśli Beta (testowa) nie działa, v1 (oficjalna) MUSI zadziałać.
const ENDPOINTS = [
  // 1. Flash na wersji STABILNEJ (v1) - to powinno rozwiązać problem 404
  `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
  
  // 2. Flash na wersji Beta (jako zapas)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
  
  // 3. Klasyczny Gemini Pro na wersji STABILNEJ (v1) - najbardziej niezawodny
  `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`
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
  // Budujemy ciało zapytania
  const requestBody: any = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  // Jeśli jest zdjęcie, dodajemy je
  if (imageBase64) {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    requestBody.contents[0].parts.push({
      inlineData: {
        mimeType: "image/png",
        data: cleanBase64
      }
    });
  }

  // PĘTLA PO ADRESACH
  for (const url of ENDPOINTS) {
    try {
      // Wyciągamy nazwę modelu i wersję dla logów (np. v1/gemini-pro)
      const version = url.includes("/v1/") ? "v1 (Stable)" : "v1beta";
      const model = url.split("/models/")[1].split(":")[0];
      console.log(`📡 Próba: ${model} na ${version}...`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // Jeśli 404, lecimy dalej bez rzucania błędu do aplikacji (silent fail in loop)
        console.warn(`⚠️ Nieudane połączenie z ${model}: ${response.status}`);
        continue; 
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Pusta treść");

      console.log(`✅ SUKCES! Połączono z: ${model} (${version})`);
      return safeParse(text);

    } catch (e) {
      continue; // Próbuj następnego adresu z listy
    }
  }

  throw new Error("Wszystkie serwery Google są niedostępne dla tego klucza. Sprawdź status usługi.");
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
