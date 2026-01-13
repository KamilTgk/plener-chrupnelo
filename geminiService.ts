import { GoogleGenAI } from "@google/genai";
import { collection, addDoc } from "firebase/firestore";

// TWOJA LOGISTYKA KLUCZA - WPISANY NA SZTYWNO
const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

export const sanitizeForFirestore = (data: any) => JSON.parse(JSON.stringify(data));

const cleanAndParseJSON = (text: string | undefined) => {
  if (!text) throw new Error("Pusta odpowiedź AI");
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Brak bloku JSON");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error("Błąd formatu danych AI.");
  }
};

export const getMealIcon = (name?: string): string => {
  const n = (name || "").toLowerCase();
  if (n.includes('sałatka')) return '🥗';
  if (n.includes('mięso') || n.includes('kurczak')) return '🥩';
  return '🍽️';
};

// --- KLUCZOWE FUNKCJE OPERACYJNE ---

export const generateMealPlan = async (prefs: any) => {
  // Inicjalizacja WEWNĄTRZ funkcji - to naprawia błąd "API Key must be set"
  const genAI = new GoogleGenAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

  try {
    const prompt = `Zaplanuj jadłospis: Cel ${prefs.targetCalories} kcal. Zwróć JSON z tablicą 'meals'.`;
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
  } catch (e: any) {
    throw new Error("Błąd AI: " + e.message);
  }
};

export const analyzeMealScan = async (text: string, weight: number, image?: string) => {
  const genAI = new GoogleGenAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

  const prompt = `Analizuj: ${text}, masa: ${weight}g. Podaj kcal i makro w JSON.`;
  const result = await model.generateContent(prompt);
  return { 
    ...cleanAndParseJSON(result.response.text()), 
    id: Math.random().toString(36).substring(7), 
    completed: true 
  };
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

// Puste eksporty dla zgodności z Twoim App.tsx
export const generateImage = async (p: string) => "";
export const generateFridgeRecipe = async (f: any, t: any, d: any, s: any, p: any) => ({});
export const replaceSingleMeal = async (o: any, p: any) => ({});
export const recalculateMealFromIngredients = async (m: any, i: any) => m;
