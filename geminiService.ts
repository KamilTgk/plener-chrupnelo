import { GoogleGenerativeAI } from "@google/generative-ai";

// NOWY KLUCZ Z GOOGLE CLOUD
const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
const genAI = new GoogleGenerativeAI(API_KEY);

export const sanitizeForFirestore = (data: any) => JSON.parse(JSON.stringify(data));

const cleanAndParseJSON = (text: string | undefined) => {
  if (!text) throw new Error("Błąd AI");
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
  return JSON.parse(jsonMatch![0]);
};

export const generateMealPlan = async (prefs: any) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Zaplanuj jadłospis: ${prefs.targetCalories} kcal. Zwróć JSON z tablicą 'meals'.`;
  const result = await model.generateContent(prompt);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7) };
};

export const analyzeMealScan = async (text: string, weight: number) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Analizuj: ${text}, masa: ${weight}g. Podaj kcal i makro w JSON.`;
  const result = await model.generateContent(prompt);
  return { ...cleanAndParseJSON(result.response.text()), id: Math.random().toString(36).substring(7), completed: true };
};

// Eksporty pomocnicze
export const replaceSingleMeal = async () => ({});
export const chatWithGemini = async () => "";
export const savePlanToFirestore = async () => {};
export const generateFridgeRecipe = async () => ({});
export const getMealIcon = () => '🍽️';
export const recalculateMealFromIngredients = async (m: any) => m;
export const generateImage = async () => "";
