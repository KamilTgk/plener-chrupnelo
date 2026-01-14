const API_KEY = "AIzaSyCP0Yi45gczLq75PaijjU_5o5l-kfBf3iQ";

// AKTUALNE MODELE GEMINI (styczeń 2025) - dla planu PRO
const ENDPOINTS = [
  // 1. GEMINI 3 FLASH (Najnowszy! Grudzień 2025)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`,
  
  // 2. GEMINI 2.5 FLASH (Stabilny, szybki)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
  
  // 3. GEMINI 2.5 PRO (Najbardziej zaawansowany)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}`,
  
  // 4. GEMINI 2.0 FLASH (Stabilny)
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
  
  // 5. GEMINI 2.0 FLASH EXP (Eksperymentalny - ten co u Ciebie działa)
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
    throw new Error("AI zwróciło błąd formatowania.");
  }
};

async function callGemini(prompt: string, imageBase64?: string) {
  const requestBody: any = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
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

  // PĘTLA PRZEZ MODELE
  for (const url of ENDPOINTS) {
    try {
      const modelName = url.split("/models/")[1].split(":")[0];
      console.log(`📡 Próba połączenia: ${modelName}...`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      // Jeśli 429 -> próbuj następnego
      if (response.status === 429) {
         console.warn(`⚠️ Model ${modelName} jest przeciążony (429). Próbuję następnego...`);
         continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.warn(`⚠️ Model ${modelName} niedostępny (Status: ${response.status})`, errorData);
        continue; 
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Pusta treść");

      console.log(`✅ SUKCES! Połączono z: ${modelName}`);
      return safeParse(text);

    } catch (e) {
      console.error(`❌ Błąd dla modelu:`, e);
      continue;
    }
  }

  throw new Error("Wszystkie modele Gemini są niedostępne. Spróbuj ponownie za chwilę.");
}

// --- EKSPORTOWANE FUNKCJE ---

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
