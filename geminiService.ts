import { GoogleGenAI } from "@google/genai";
import { collection, addDoc } from "firebase/firestore";

// TWOJA LOGISTYKA KLUCZA
const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

// Funkcja pomocnicza: Tworzy model tylko wtedy, gdy go potrzebujemy
const getModel = () => {
  const genAI = new GoogleGenAI(API_KEY);
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

// --- FUNKCJE KTÓRYCH SZUKA TWÓJ DASHBOARD ---

export const getMealIcon = (name?: string): string => {
  const n = (name || "").toLowerCase();
  if (n.includes('sałatka')) return '🥗';
  if (n.includes('mięso') || n.includes('kurczak')) return '🥩';
  if (n.includes('śniadanie')) return '🍳';
  return '🍽️';
};

export const generateMealPlan = async (prefs: any) => {
  const model = getModel();
  const prompt = `Zaplanuj jadłospis: ${prefs.targetCalories} kcal. Zwróć JSON z tablicą meals.`;
  const result = await model.generateContent(prompt);
  const data = cleanAndParseJSON(result.response.text());
  return {
    ...data,
    meals: (data.meals || []).map((m: any) => ({
      ...m,
      id: Math.random().toString(36).substring(7),
      icon: getMealIcon(m.name),
      completed: false
    }))
  };
};

export const analyzeMealScan = async (textInput: string, weightInput: number, imageBase64?: string) => {
  const model = getModel();
  const prompt = `Analizuj: ${textInput}, masa: ${weightInput}g. Podaj kcal i makro w JSON.`;
  const result = await model.generateContent(prompt);
  const res = cleanAndParseJSON(result.response.text());
  return { ...res, id: Math.random().toString(36).substring(7), completed: true };
};

export const generateFridgeRecipe = async (fridgeContent: string, time: number, difficulty: string, speed: string, prefs: any) => {
  const model = getModel();
  const prompt = `Przepis z: ${fridgeContent}. Zwróć JSON.`;
  const result = await model.generateContent(prompt);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7) };
};

export const replaceSingleMeal = async (oldMeal: any, prefs: any) => {
  const model = getModel();
  const result = await model.generateContent(`Zamiennik dla: ${oldMeal.name}. JSON.`);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7) };
};

export const chatWithGemini = async (messages: any[]) => {
  const model = getModel();
  const result = await model.generateContent(messages.map(m => m.text).join("\n"));
  return result.response.text();
};

export const savePlanToFirestore = async (db: any, data: any) => {
  if (!db) return;
  try { await addDoc(collection(db, "history"), sanitizeForFirestore(data)); } catch (e) {}
};

// PUSTE EKSPORTY DLA ZGODNOŚCI Z App.tsx
export const generateImage = async (p: string) => "";
export const recalculateMealFromIngredients = async (m: any, i: any[]) => ({ ...m, ingredients: i });
