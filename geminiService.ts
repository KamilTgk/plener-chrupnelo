import { GoogleGenAI } from "@google/genai";

// TO JEST TWÓJ KLUCZ PROJEKTOWY - MUSI BYĆ TUTAJ WPISANY NA SZTYWNO
const KEY = "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c";

export const getGeminiModel = () => {
  const genAI = new GoogleGenAI(KEY);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
};

// Reszta Twoich funkcji (generateMealPlan, analyzeMealScan itd.) 
// musi teraz używać getGeminiModel() ZAMIAST stałej zdefiniowanej na górze.
