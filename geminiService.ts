import { GoogleGenerativeAI } from "@google/generative-ai";

// TWOJA LOGISTYKA AI
const API_KEY = "AIzaSyD82LdmA6ry5mqPUsbhKPlnHw3V5C5uEK4";
const genAI = new GoogleGenerativeAI(API_KEY);

export const generateMealPlan = async (config: {
  targetCalories: number;
  mealCount: number;
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
  selectedDate: string;
}) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `Jesteś dietetykiem sportowym. Stwórz plan posiłków na dzień ${config.selectedDate}.
    Cel: ${config.targetCalories} kcal. Makroskładniki: Białko ${config.proteinPct}%, Tłuszcze ${config.fatPct}%, Węglowodany ${config.carbsPct}%.
    Ilość posiłków: ${config.mealCount}.
    Dla każdego posiłku podaj: nazwę, składniki z wagą, kcal, białko, tłuszcz, węgle oraz krótki opis przygotowania.
    Format wyjściowy: WYŁĄCZNIE JSON zgodny z interfejsem DayPlan.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanJson = text.replace(/```json|```/g, "");
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Błąd Gemini:", error);
    throw new Error("Logistyka AI napotkała problem z dostawą danych.");
  }
};

export const analyzeMealScan = async (imageB64: string, weight?: string) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Przeanalizuj to zdjęcie posiłku${weight ? ` o wadze ${weight}g` : ""}. 
    Podaj szacunkowe kcal, białko, tłuszcze i węglowodany. 
    Zaproponuj nazwę posiłku. Odpowiedz w formacie JSON.`;

  try {
    const result = await model.generateContent([prompt, { inlineData: { data: imageB64, mimeType: "image/jpeg" } }]);
    const response = await result.response;
    return JSON.parse(response.text().replace(/```json|```/g, ""));
  } catch (error) {
    console.error("Błąd skanera:", error);
    throw error;
  }
};

export const sanitizeForFirestore = (data: any) => {
  return JSON.parse(JSON.stringify(data));
};
