const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

// Funkcja pomocnicza do bezpośredniego łączenia z Google (omijamy bibliotekę)
async function callGemini(prompt: string, imageBase64?: string) {
  // Używamy endpointu REST, który jest zawsze aktualny
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  const parts: any[] = [{ text: prompt }];
  
  if (imageBase64) {
    // Google wymaga czystego base64 bez nagłówka data:image/...
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: cleanBase64
      }
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: {
        responseMimeType: "application/json" // Wymuszamy JSON od razu u źródła
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("Błąd API:", errorData);
    throw new Error(`Błąd połączenia z AI (${response.status}). Spróbuj ponownie.`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("AI zwróciło pustą odpowiedź.");
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Błąd JSON:", text);
    throw new Error("AI zwróciło uszkodzone dane.");
  }
}

// --- EKSPOATOWANE FUNKCJE (Interfejs dla App.tsx pozostaje ten sam) ---

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Jesteś szefem kuchni. Mam w lodówce: ${stock}. 
  Stwórz JEDEN przepis. Zwróć JSON: 
  { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  
  return await callGemini(prompt);
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  const prompt = `Analiza posiłku: ${foodName || "Danie"}, Waga: ${weight || "Standard"}. 
  Podaj makro w JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  
  return await callGemini(prompt, image);
};

export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
  const prompt = `Stwórz plan na 1 dzień: ${config.targetCalories} kcal. Cel: ${goalText}. Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}.
  Zwróć JSON: { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;

  const data = await callGemini(prompt);
  // Dodajemy pole completed dla logiki aplikacji
  return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
};
