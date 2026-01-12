import { GoogleGenAI } from "@google/genai";
import { collection, addDoc } from "firebase/firestore";

// TWOJA LOGISTYKA KLUCZA - STAŁA WARTOŚĆ
const KEY_VAL = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

// Funkcja pomocnicza: Tworzy model tylko wtedy, gdy go potrzebujemy
const getLiveModel = () => {
  const genAI = new GoogleGenAI(KEY_VAL);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
};

export const sanitizeForFirestore = (data: any) => JSON.parse(JSON.stringify(data));

const cleanAndParseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Brak danych" };
  } catch (e) {
    return { error: "Błąd formatu" };
  }
};

// --- FUNKCJE DLA DASHBOARDU ---

export const generateMealPlan = async (prefs: any) => {
  const model = getLiveModel(); // Aktywacja klucza dopiero teraz!
  const prompt = `Zaplanuj jadłospis: ${prefs.targetCalories} kcal. Zwróć JSON.`;
  const result = await model.generateContent(prompt);
  const data = cleanAndParseJSON(result.response.text());
  return {
    ...data,
    meals: (data.meals || []).map((m: any) => ({
      ...m,
      id: Math.random().toString(36).substring(7),
      completed: false
    }))
  };
};

export const analyzeMealScan = async (text: string, weight: number) => {
  const model = getLiveModel();
  const result = await model.generateContent(`Analizuj: ${text}, masa: ${weight}g. JSON.`);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7), completed: true };
};

// Puste eksporty dla zgodności z App.tsx
export const getMealIcon = (n?: string) => '🍽️';
export const generateImage = async (p: string) => "";
export const generateFridgeRecipe = async (f: any, t: any, d: any, s: any, p: any) => ({});
export const replaceSingleMeal = async (o: any, p: any) => ({});
export const recalculateMealFromIngredients = async (m: any, i: any) => m;
export const chatWithGemini = async (m: any) => "Cześć!";
export const savePlanToFirestore = async (db: any, d: any) => { if(db) await addDoc(collection(db, "history"), d); };
