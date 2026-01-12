import { GoogleGenAI } from "@google/genai";
import { collection, addDoc } from "firebase/firestore";
import { DayPlan, UserPreferences, Meal, Ingredient } from "./types";

// TWOJA LOGISTYKA KLUCZA - WPISANY NA SZTYWNO DLA PRZEGLĄDARKI
const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

// Inicjalizacja silnika Gemini
const genAI = new GoogleGenAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

export const sanitizeForFirestore = (data: any) => JSON.parse(JSON.stringify(data));

const cleanAndParseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Brak JSON");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error("Błąd formatu AI.");
  }
};

export const getMealIcon = (name?: string): string => {
  if (!name) return '🍽️';
  const n = name.toLowerCase();
  if (n.includes('sałatka')) return '🥗';
  if (n.includes('mięso')) return '🥩';
  return '🍽️';
};

export const generateImage = async (prompt: string): Promise<string> => "";

export const generateMealPlan = async (prefs: UserPreferences): Promise<DayPlan> => {
  try {
    const prompt = `Zaplanuj jadłospis: Cel ${prefs.targetCalories} kcal, ${prefs.mealCount} posiłków. Zwróć JSON.`;
    const result = await model.generateContent(prompt);
    const rawPlan = cleanAndParseJSON(result.response.text());
    const meals = (rawPlan.meals || []).map((m: any) => ({
      ...m,
      id: Math.random().toString(36).substring(7),
      icon: getMealIcon(m.name),
      completed: false
    }));
    return {
      date: prefs.selectedDate,
      totalKcal: meals.reduce((acc: number, cur: any) => acc + (cur.kcal || 0), 0),
      meals,
      waterCurrent: 0,
      stepsCurrent: 0,
      dailyActivity: { water: { goalMl: 2500 }, steps: { goal: 10000 } }
    } as DayPlan;
  } catch (error: any) {
    throw new Error("Błąd AI: " + error.message);
  }
};

export const analyzeMealScan = async (textInput: string, weightInput: number, imageBase64?: string): Promise<Partial<Meal>> => {
  try {
    const prompt = `Analizuj: ${textInput}, masa: ${weightInput}g. Zwróć JSON.`;
    const result = await model.generateContent(prompt);
    const res = cleanAndParseJSON(result.response.text());
    return { ...res, id: Math.random().toString(36).substring(7), completed: true };
  } catch (error: any) {
    throw new Error("Błąd skanera.");
  }
};

export const generateFridgeRecipe = async (fridgeContent: string, time: number, difficulty: string, speed: string, prefs: UserPreferences): Promise<Meal> => {
  const prompt = `Przepis z: ${fridgeContent}. Zwróć JSON.`;
  const result = await model.generateContent(prompt);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7) };
};

export const replaceSingleMeal = async (oldMeal: Meal, prefs: UserPreferences): Promise<Meal> => {
  const prompt = `Zamiennik dla: ${oldMeal.name}. Zwróć JSON.`;
  const result = await model.generateContent(prompt);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7) };
};

export const recalculateMealFromIngredients = async (meal: Meal, updatedIngredients: Ingredient[]): Promise<Meal> => {
  return { ...meal, ingredients: updatedIngredients };
};

export const chatWithGemini = async (messages: any[]) => {
  const result = await model.generateContent(messages.map(m => m.text).join("\n"));
  return result.response.text();
};

export const savePlanToFirestore = async (db: any, planData: any) => {
  if (!db) return;
  try {
    await addDoc(collection(db, "history"), sanitizeForFirestore(planData));
  } catch (err) {}
};
