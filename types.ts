
export interface Ingredient {
  item: string;
  amount: number;
  measure: string;
}

export interface Meal {
  id: string;
  name: string;
  kcal: number;
  time?: number; // Czas przygotowania w minutach
  macros: {
    p: number;
    f: number;
    c: number;
  };
  ingredients: Ingredient[];
  spices: string[];
  steps: string[];
  currentStep: number;
  inspiration: string;
  imageUrl?: string;
  icon?: string;
  imagePrompt?: string;
  sourceUrl?: string;
  sourceName?: string;
  completed?: boolean;
}

export interface DailyActivity {
  water: {
    goalGlasses: number;
    goalMl: number;
  };
  steps: {
    goal: number;
  };
}

export interface DayPlan {
  date: string;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: Meal[];
  extraMeals?: Meal[];
  dailyActivity: DailyActivity;
  waterCurrent: number;
  stepsCurrent: number;
}

export interface ImagePreferences {
  size: '1K' | '2K' | '4K';
  aspectRatio: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface UserPreferences {
  targetCalories: number;
  mealCount: number;
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
  selectedDate: string;
  favCuisines: string;
  excludedIngredients: string;
  specificDish?: string;
  imagePrefs: ImagePreferences;
  goalMode?: 'cut' | 'maintain' | 'bulk';
}

export interface BioProfile {
  bio: {
    gender: 'male' | 'female';
    age: number;
    weight: number;
    height: number;
    activity: number;
  };
  stats: {
    bmi: number;
    bmr: number;
    tdee: number;
  };
  goals: {
    targetKcal: number;
    protein: number;
    fat: number;
    carbs: number;
    proteinPct: number;
    fatPct: number;
    carbsPct: number;
    currentGoal: 'cut' | 'maintain' | 'bulk';
    correction: number;
    weightStart?: number;
    weightTarget?: number;
  };
}