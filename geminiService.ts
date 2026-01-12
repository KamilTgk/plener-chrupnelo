
import { GoogleGenAI, Type } from "@google/genai";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { DayPlan, UserPreferences, Meal, ImagePreferences, Ingredient } from "./types";

/**
 * Globalna funkcja pomocnicza do czyszczenia danych przed zapisem w Firestore.
 */
export const sanitizeForFirestore = (data: any) => {
  return JSON.parse(JSON.stringify(data));
};

const cleanAndParseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Nie znaleziono bloku JSON w odpowiedzi.");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Błąd parsowania JSON od AI:", text);
    throw new Error("Błąd formatu danych AI. Spróbuj ponownie.");
  }
};

const BASE_SYSTEM_INSTRUCTION = `Jesteś inteligentnym asystentem kulinarnym aplikacji „Plener Chrupnęło”. 

TWOJA TOŻSAMOŚĆ:
Jesteś pasjonatem gotowania i twórcą kulinarnym. Używasz prostego, konkretnego języka. Tworzysz unikalne, nowoczesne przepisy.

ZASADY OPERACYJNE (TRYB ONLINE):
1. INSPIRACJA Z SIECI: Zawsze szukaj inspiracji w internecie przy użyciu Google Search.
2. NAPRAWA LINKÓW: Weryfikuj sourceUrl przez Google Search.
3. PRZYPRAWY: Każdy posiłek MUSI zawierać tablicę 'spices'.
4. SKŁADNIKI: Proporcje WYŁĄCZNIE w GRAMACH (g).
5. OBRAZY: Generuj apetyczne prompty obrazowe dla potraw.
6. PERSONALIZACJA: Dopasuj kalorie i składniki pod cele użytkownika.
7. CZAS: Każdy przepis musi mieć pole 'time' (minuty).`;

export const getMealIcon = (name?: string): string => {
  if (!name) return '🍽️';
  const n = name.toLowerCase();
  if (n.includes('sałatka') || n.includes('warzywa')) return '🥗';
  if (n.includes('mięso') || n.includes('kurczak') || n.includes('wołowe')) return '🥩';
  if (n.includes('ryba') || n.includes('łosoś')) return '🐟';
  if (n.includes('deser') || n.includes('owoc')) return '🍎';
  if (n.includes('śniadanie') || n.includes('jajka')) return '🍳';
  if (n.includes('zupa')) return '🍜';
  if (n.includes('makaron') || n.includes('pasta')) return '🍝';
  return '🍽️';
};

/**
 * Generowanie realistycznej grafiki potrawy przy użyciu Gemini 2.5 Flash Image.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `High quality food photography of: ${prompt}, close up, professional lighting, appetizing, top down view, studio setup.` }],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return "";
  } catch (error) {
    console.warn("Image Generation Failed, skipping.", error);
    return "";
  }
};

export const generateMealPlan = async (prefs: UserPreferences): Promise<DayPlan> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = `${BASE_SYSTEM_INSTRUCTION} Cel: ${prefs.targetCalories} kcal.`;
    
    const prompt = `ZAPLANUJ JADŁOSPIS ONLINE: Cel ${prefs.targetCalories} kcal, liczba posiłków: ${prefs.mealCount}. 
    Kuchnia: ${prefs.favCuisines}. Wykluczenia: ${prefs.excludedIngredients}. 
    Makro: B:${prefs.proteinPct}%, T:${prefs.fatPct}%, W:${prefs.carbsPct}%. 
    Dostosuj nazewnictwo posiłków. Użyj Google Search do znalezienia najnowszych trendów kulinarnych.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }] 
      }
    });

    const rawPlan = cleanAndParseJSON(response.text);
    const meals = await Promise.all((rawPlan.meals || []).map(async (m: any) => {
      const imageUrl = await generateImage(m.name);
      return {
        ...m,
        id: Math.random().toString(36).substring(7),
        imageUrl: imageUrl,
        icon: getMealIcon(m.name),
        currentStep: 0,
        completed: false,
        spices: m.spices || [],
        ingredients: m.ingredients || [],
        steps: m.steps || ["Rozpocznij przygotowanie zgodnie ze specyfikacją."]
      };
    }));

    return {
      date: prefs.selectedDate,
      totalKcal: meals.reduce((acc, cur) => acc + cur.kcal, 0),
      totalProtein: meals.reduce((acc, cur) => acc + cur.macros.p, 0),
      totalFat: meals.reduce((acc, cur) => acc + cur.macros.f, 0),
      totalCarbs: meals.reduce((acc, cur) => acc + cur.macros.c, 0),
      meals,
      waterCurrent: 0,
      stepsCurrent: 0,
      dailyActivity: rawPlan.dailyActivity || {
        water: { goalGlasses: 10, goalMl: 2500 },
        steps: { goal: 10000 }
      }
    };
  } catch (error: any) {
    throw new Error(error.message || "Błąd generowania planu online.");
  }
};

export const analyzeMealScan = async (textInput: string, weightInput: number, imageBase64?: string): Promise<Partial<Meal>> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];
    
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64.split(',')[1] || imageBase64
        }
      });
    }

    const promptText = `PEŁNA ANALIZA VISION AI (TEKSTURA + OBJĘTOŚĆ). 
    Wprowadzona nazwa: ${textInput || "Analiza wizualna"}
    Zadeklarowana masa: ${weightInput || "Do oszacowania na podstawie objętości"} g.
    ZADANIE: Wykonaj precyzyjną analizę teksturalną i objętościową potrawy ze zdjęcia. 
    Skorzystaj z Google Search, aby znaleźć rynkowe odpowiedniki składników i podać najdokładniejsze wartości odżywcze.
    Zwróć JSON:
    {
      "name": "uściślona nazwa produktu/dania",
      "kcal": liczba_kcal,
      "macros": { "p": bialko_g, "f": tluszcz_g, "c": wegle_g },
      "ingredients": [{"item": "skladnik", "amount": gramy}],
      "analysisNote": "krótka notatka o teksturze i objętości"
    }`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        systemInstruction: "Jesteś ekspertem analizy teksturalnej i objętościowej żywności. Wykorzystaj Google Search do weryfikacji danych produktów rynkowych."
      }
    });

    const result = cleanAndParseJSON(response.text);
    return {
      id: Math.random().toString(36).substring(7),
      name: result.name,
      kcal: result.kcal,
      macros: result.macros,
      ingredients: result.ingredients || [],
      completed: true,
      icon: getMealIcon(result.name)
    };
  } catch (error: any) {
    throw new Error("Błąd Skanera Vision AI (Online).");
  }
};

export const generateFridgeRecipe = async (fridgeContent: string, time: number, difficulty: string, speed: string, prefs: UserPreferences): Promise<Meal> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = `Ekspert ZERO WASTE Online. Stwórz przepis z: ${fridgeContent}. Cel: ok. ${Math.round(prefs.targetCalories / 4)} kcal.`;
    const prompt = `KREATOR ZERO WASTE ONLINE: ${fridgeContent}. Czas: ${time}min. Styl: ${speed}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }] 
      }
    });

    const m = cleanAndParseJSON(response.text);
    const imageUrl = await generateImage(m.name);

    return {
      ...m,
      id: Math.random().toString(36).substring(7),
      imageUrl: imageUrl,
      icon: getMealIcon(m.name),
      currentStep: 0,
      completed: false,
      spices: m.spices || [],
      ingredients: m.ingredients || [],
      steps: m.steps || ["Przygotuj składniki."]
    };
  } catch (error) {
    throw new Error("Błąd generatora Zero Waste Online.");
  }
};

export const replaceSingleMeal = async (oldMeal: Meal, prefs: UserPreferences): Promise<Meal> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = `${BASE_SYSTEM_INSTRUCTION} Zamiennik dla posiłku o kaloryczności ${oldMeal.kcal} kcal.`;
    const prompt = `ZAPROPONUJ ZAMIENNIK ONLINE dla: "${oldMeal.name}". Cel: ${oldMeal.kcal} kcal. Respektuj wykluczenia: ${prefs.excludedIngredients}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        systemInstruction, 
        responseMimeType: "application/json", 
        tools: [{ googleSearch: {} }] 
      }
    });

    const m = cleanAndParseJSON(response.text);
    const imageUrl = await generateImage(m.name);
    return { 
      ...m, 
      id: Math.random().toString(36).substring(7), 
      imageUrl: imageUrl, 
      icon: getMealIcon(m.name), 
      currentStep: 0, 
      completed: false, 
      spices: m.spices || [], 
      ingredients: m.ingredients || [],
      steps: m.steps || ["Rozpocznij przygotowanie zamiennika."]
    };
  } catch (error) {
    throw new Error("Błąd wymiany posiłku Online.");
  }
};

export const recalculateMealFromIngredients = async (meal: Meal, updatedIngredients: Ingredient[]): Promise<Meal> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `PRZELICZ WARTOŚCI ODŻYWCZE ONLINE: ${meal.name}. Składniki: ${updatedIngredients.map(i => `${i.item}: ${i.amount}g`).join(", ")}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        systemInstruction: "Kalkulator kalorii i makroskładników online korzystający z najświeższych baz danych żywności."
      }
    });

    const result = cleanAndParseJSON(response.text);
    return {
      ...meal,
      kcal: result.kcal || meal.kcal,
      macros: result.macros || meal.macros,
      ingredients: updatedIngredients
    };
  } catch (error) {
    return { ...meal, ingredients: updatedIngredients };
  }
};

export const chatWithGemini = async (messages: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: messages,
    config: { systemInstruction: "Asystent kulinarny Plener Chrupnęło. Pomoc online w czasie rzeczywistym." }
  });
  return response.text;
};

export const savePlanToFirestore = async (db: any, planData: any) => {
  if (!db) return;
  try {
    const sanitized = sanitizeForFirestore(planData);
    await addDoc(collection(db, "history"), sanitized);
  } catch (err) {}
};
