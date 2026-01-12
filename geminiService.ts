import { GoogleGenAI } from "@google/genai";

// Funkcja pomocnicza, którą wywołamy wewnątrz każdej operacji
const getModel = () => {
  const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
  const genAI = new GoogleGenAI(API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
};

export const generateMealPlan = async (prefs: any) => {
  try {
    const model = getModel(); // Klucz jest inicjowany dopiero tutaj
    const prompt = `Zaplanuj jadłospis: ${prefs.targetCalories} kcal. Zwróć JSON.`;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Błąd AI:", error);
    throw error;
  }
};

// Dodaj resztę funkcji (analyzeMealScan, itd.) w ten sam sposób: 
// zawsze wywołuj getModel() wewnątrz funkcji async.import { GoogleGenAI } from "@google/genai";

// Funkcja pomocnicza, którą wywołamy wewnątrz każdej operacji
const getModel = () => {
  const API_KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";
  const genAI = new GoogleGenAI(API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
};

export const generateMealPlan = async (prefs: any) => {
  try {
    const model = getModel(); // Klucz jest inicjowany dopiero tutaj
    const prompt = `Zaplanuj jadłospis: ${prefs.targetCalories} kcal. Zwróć JSON.`;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Błąd AI:", error);
    throw error;
  }
};

// Dodaj resztę funkcji (analyzeMealScan, itd.) w ten sam sposób: 
// zawsze wywołuj getModel() wewnątrz funkcji async.
