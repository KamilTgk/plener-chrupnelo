import { GoogleGenAI } from "@google/genai";
import { collection, addDoc } from "firebase/firestore";
import { DayPlan, UserPreferences, Meal, Ingredient } from "./types";

// Funkcja pomocnicza do czyszczenia danych dla Firebase
export const sanitizeForFirestore = (data: any) => JSON.parse(JSON.stringify(data));

// Funkcja do wyciągania czystego JSONa z odpowiedzi AI
const cleanAndParseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Brak bloku JSON");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Błąd parsowania:", text);
    throw new Error("AI zwróciło niepoprawny format.");
  }
};

// --- LOGISTYKA KLUCZA PROJEKTOWEGO ---
const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
const genAI = new GoogleGenAI(API_KEY);
// Wymuszamy wersję v1, aby uniknąć błędu 404
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

export const getMealIcon = (name?: string): string => {
  if (!name) return '🍽️';
  const n = name.toLowerCase();
  if (n.includes('sałatka') || n.includes('warzywa')) return '🥗';
  if (n.includes('mięso') || n.includes('kurczak')) return '🥩';
  if (n.includes('ryba')) return '🐟';
  if (n.includes('śniadanie') || n.includes('jajka')) return '🍳';
  return '🍽️';
};

// --- FUNKCJE OPERACYJNE ---

export const generateImage = async (prompt: string): Promise<string> => {
  // Funkcja uproszczona, by nie generować kosztów/błędów na start
  return "";
};

export const generateMealPlan = async (prefs: UserPreferences): Promise<DayPlan> => {
  try {
    const prompt = `Jesteś dietetykiem Plener Chrupnęło. Zaplanuj jadłospis: Cel ${prefs.targetCalories} kcal, ${prefs.mealCount} posiłków. 
    Makro: B:${prefs.proteinPct}%, T:${prefs.fatPct}%, W:${prefs.carbsPct}%. 
    Zwróć TYLKO JSON: { "meals": [{ "name": "nazwa", "kcal": 500, "macros": {"p": 30, "f": 15, "c": 50}, "time": 20, "icon": "🍽️" }] }`;
    
    const result = await model.generateContent(prompt);
    const rawPlan = cleanAndParseJSON(result.response.text());
    
    const meals = (rawPlan.meals || []).map((m: any) => ({
      ...m,
      id: Math.random().toString(36).substring(7),
      icon: getMealIcon(m.name),
      completed: false,
      ingredients: m.ingredients || [],
      steps: m.steps || ["Przygotuj zgodnie z opisem."]
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
    throw new Error("Błąd Generacji: " + error.message);
  }
};

export const analyzeMealScan = async (textInput: string, weightInput: number, imageBase64?: string): Promise<Partial<Meal>> => {
  try {
    const prompt = `Analizuj potrawę: ${textInput}, masa: ${weightInput}g. Podaj kcal i makro w formacie JSON.`;
    const result = await model.generateContent(prompt);
    const res = cleanAndParseJSON(result.response.text());
    return { 
      ...res, 
      id: Math.random().toString(36).substring(7), 
      name: res.name || textInput,
      completed: true,
      icon: getMealIcon(res.name || textInput)
    };
  } catch (error: any) {
    throw new Error("Błąd Skanera.");
  }
};

export const generateFridgeRecipe = async (fridgeContent: string, time: number, difficulty: string, speed: string, prefs: UserPreferences): Promise<Meal> => {
  try {
    const prompt = `Stwórz przepis ZERO WASTE z: ${fridgeContent}. Cel: ${Math.round(prefs.targetCalories / 4)} kcal. Zwróć JSON.`;
    const result = await model.generateContent(prompt);
    const m = cleanAndParseJSON(result.response.text());
    return { ...m, id: Math.random().toString(36).substring(7), icon: getMealIcon(m.name) };
  } catch (error) {
    throw new Error("Błąd Zero Waste.");
  }
};

export const replaceSingleMeal = async (oldMeal: Meal, prefs: UserPreferences): Promise<Meal> => {
  try {
    const prompt = `Zaproponuj zamiennik dla: ${oldMeal.name} o kaloryczności ${oldMeal.kcal} kcal. Zwróć JSON.`;
    const result = await model.generateContent(prompt);
    const m = cleanAndParseJSON(result.response.text());
    return { ...m, id: Math.random().toString(36).substring(7), icon: getMealIcon(m.name) };
  } catch (error) {
    throw new Error("Błąd wymiany posiłku.");
  }
};

export const recalculateMealFromIngredients = async (meal: Meal, updatedIngredients: Ingredient[]): Promise<Meal> => {
  return { ...meal, ingredients: updatedIngredients };
};

export const chatWithGemini = async (messages: any[]) => {
  try {
    const chatPrompt = messages.map(m => m.text).join("\n");
    const result = await model.generateContent(chatPrompt);
    return result.response.text();
  } catch (e) {
    return "Przepraszam, mam problem z połączeniem.";
  }
};

export const savePlanToFirestore = async (db: any, planData: any) => {
  if (!db) return;
  try {
    await addDoc(collection(db, "history"), sanitizeForFirestore(planData));
  } catch (err) {
    console.error("Błąd zapisu historii:", err);
  }
};
