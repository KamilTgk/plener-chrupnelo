import { GoogleGenAI } from "@google/genai";
import { collection, addDoc } from "firebase/firestore";

// --- ŻELAZNA ZASADA: KLUCZ DOSTĘPNY DLA FUNKCJI ---
const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

export const sanitizeForFirestore = (data: any) => JSON.parse(JSON.stringify(data));

const cleanAndParseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { error: "Brak JSON" };
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { error: "Błąd formatu" };
  }
};

// --- FUNKCJE OPERACYJNE Z INICJALIZACJĄ WEWNĄTRZ ---

export const getMealIcon = (name?: string): string => {
  const n = (name || "").toLowerCase();
  if (n.includes('sałatka')) return '🥗';
  if (n.includes('mięso') || n.includes('kurczak')) return '🥩';
  if (n.includes('śniadanie')) return '🍳';
  return '🍽️';
};

export const generateMealPlan = async (prefs: any) => {
  // Inicjalizacja tutaj, a nie na górze pliku!
  const genAI = new GoogleGenAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

  try {
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
  } catch (e) {
    console.error("Błąd AI:", e);
    throw new Error("Błąd komunikacji z Gemini.");
  }
};

export const analyzeMealScan = async (text: string, weight: number, image?: string) => {
  const genAI = new GoogleGenAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

  const prompt = `Analizuj: ${text}, masa: ${weight}g. Podaj kcal i makro w JSON.`;
  const result = await model.generateContent(prompt);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7), completed: true };
};

export const generateFridgeRecipe = async (fridge: string, time: number, diff: string, speed: string, prefs: any) => {
  const genAI = new GoogleGenAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

  const prompt = `Przepis z: ${fridge}. Zwróć JSON.`;
  const result = await model.generateContent(prompt);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7) };
};

export const replaceSingleMeal = async (oldMeal: any, prefs: any) => {
  const genAI = new GoogleGenAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

  const result = await model.generateContent(`Zamiennik dla: ${oldMeal.name}. JSON.`);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7) };
};

export const chatWithGemini = async (messages: any[]) => {
  const genAI = new GoogleGenAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

  const result = await model.generateContent(messages.map(m => m.text).join("\n"));
  return result.response.text();
};

export const savePlanToFirestore = async (db: any, data: any) => {
  if (!db) return;
  try { await addDoc(collection(db, "history"), sanitizeForFirestore(data)); } catch (e) {}
};

// Puste eksporty, żeby App.tsx się nie psuł
export const generateImage = async (p: string) => "";
export const recalculateMealFromIngredients = async (m: any, i: any[]) => ({ ...m, ingredients: i });
