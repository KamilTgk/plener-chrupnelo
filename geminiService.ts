const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

// ZMIANA: Używamy wersji v1 (stabilnej) i modelu gemini-pro (klasyk)
const BASE_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

const safeParse = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź od AI.");
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("AI zwróciło nieprawidłowy format.");
  }
};

async function callGemini(prompt: string, imageBase64?: string) {
  // UWAGA: gemini-pro (v1) nie obsługuje obrazków w ten sam sposób co Flash.
  // Dla stabilności w tej wersji wyłączamy przesyłanie obrazka, jeśli powoduje błędy,
  // ale zostawiamy logikę tekstową, która jest kluczowa.
  
  const endpoint = `${BASE_URL}?key=${API_KEY}`;
  
  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  // Logika bezpiecznego połączenia
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("Błąd API Google:", errorData);
    throw new Error(`Błąd połączenia (${response.status}). Sprawdź konsolę.`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return safeParse(text);
}

// --- EKSPOATOWANE FUNKCJE ---

export const generateRecipeFromInventory = async (items: {name: string, weight: string}[]) => {
  const stock = items.map(i => `${i.name} (${i.weight}g)`).join(", ");
  const prompt = `Jesteś kucharzem. Mam: ${stock}. Stwórz 1 przepis. Zwróć JSON: { "name": "...", "category": "Obiad", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }`;
  return await callGemini(prompt);
};

export const analyzeMealScan = async (image: string, foodName: string, weight: string) => {
  // W wersji gemini-pro (v1) analizujemy tylko tekst (nazwę i wagę), bo model wizyjny wymaga innej konfiguracji
  const prompt = `Oszacuj makro dla dania: ${foodName || "Danie"}, Waga: ${weight || "Standard"}. Zwróć JSON: { "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }`;
  return await callGemini(prompt);
};

export const generateMealPlan = async (config: any) => {
  const goalText = config.goalMode === 'cut' ? 'Redukcja' : 'Masa';
  const prompt = `Plan diety 1 dzień: ${config.targetCalories} kcal (${goalText}). Kuchnia: ${config.cuisine}. Posiłków: ${config.mealCount}. Zwróć JSON: { "totalKcal": 0, "meals": [{ "name": "...", "kcal": 0, "protein": 0, "fat": 0, "carbs": 0, "ingredients": ["..."], "instructions": ["..."] }] }`;
  const data = await callGemini(prompt);
  return { ...data, meals: data.meals.map((m: any) => ({ ...m, completed: false })) };
};
