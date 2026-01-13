import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { generateMealPlan, analyzeMealScan, generateRecipeFromInventory } from './geminiService';

// --- DEFINICJE TYPÓW (Aby kod działał samodzielnie) ---
export interface BioProfile {
  bio: { gender: 'male' | 'female'; age: number; weight: number; height: number; activity: number; };
  stats: { bmi: number; bmr: number; tdee: number; };
  goals: { targetKcal: number; proteinPct: number; fatPct: number; carbsPct: number; currentGoal: 'cut' | 'maintain' | 'bulk'; correction: number; weightStart: number; weightTarget: number; protein?: number; fat?: number; carbs?: number; };
}
export interface DayPlan {
  totalKcal: number;
  meals: { name: string; kcal: number; protein: number; fat: number; carbs: number; completed: boolean; ingredients?: string[]; instructions?: string[]; imageUrl?: string; }[];
}

// --- KONFIGURACJA FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c",
  projectId: "panel-chrupnelo",
  authDomain: "panel-chrupnelo.firebaseapp.com",
  storageBucket: "panel-chrupnelo.firebasestorage.app",
  messagingSenderId: "695554422212",
  appId: "1:695554422212:web:b4ea9a37c62177748de091"
};

const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(fbApp);

const getToday = () => new Date().toISOString().split('T')[0];
const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
};

const WORLD_CUISINES = [
  "Polska", "Włoska", "Meksykańska", "Indyjska", "Azjatycka", "Japońska", "Francuska", "Grecka", "Hiszpańska", "Turecka",
  "Tajska", "Wietnamska", "Chińska", "Koreańska", "Libańska", "Marokańska", "Gruzińska", "Węgierska", "Czeska", "Amerykańska",
  "Brazylijska", "Argentyńska", "Peruwiańska", "Karaibska", "Etiopska", "Egipska", "Izraelska", "Perska", "Afgańska", "Pakistańska",
  "Indonezyjska", "Malezyjska", "Filipińska", "Portugalska", "Belgijska", "Holenderska", "Niemiecka", "Austriacka", "Szwajcarska", "Skandynawska",
  "Fińska", "Rosyjska", "Ukraińska", "Bałkańska", "Chorwacka", "Bułgarska", "Rumuńska", "Albańska", "Cypryjska", "Maltańska",
  "Tunezyjska", "Algierska", "Senegalska", "Nigeryjska", "Południowoafrykańska", "Keniańska", "Australijska", "Hawajska", "Kanadyjska", "Tex-Mex",
  "Kajun", "Kreolska", "Kubańska", "Jamajska", "Portorykańska", "Wenezuelska", "Kolumbijska", "Chilijska", "Boliwijska", "Ekwadorska",
  "Nepalska", "Tybetańska", "Mongolska", "Kurdyjska", "Armeńska", "Azerbejdżańska", "Uzbecka", "Lankijska", "Birmańska", "Khmerska"
];

const CATEGORIES = ["Wszystkie", "Śniadanie", "Obiad", "Kolacja", "Przekąska"];

const MacroBar = ({ label, current, target, color }: { label: string, current: number, target: number, color: string }) => {
  const pct = Math.min(100, (current / (target || 1)) * 100);
  return (
    <div className="flex-1 space-y-1 text-center">
      <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-stone-500">
        <span>{label}</span>
        <span className="text-stone-300">{Math.round(current)}G / {Math.round(target)}G</span>
      </div>
      <div className="h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden border border-white/5">
        <div className="h-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [pass, setPass] = useState("");
  const [activeTab, setActiveTab] = useState<'meals' | 'scanner' | 'body' | 'inventory'>('meals');
  const [planViewMode, setPlanViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getToday());

  // --- STANY ---
  const [inventory, setInventory] = useState<{name: string, weight: string}[]>([]);
  const [newItem, setNewItem] = useState({ name: '', weight: '' });
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [inventoryFilter, setInventoryFilter] = useState("Wszystkie");
  
  const [planModal, setPlanModal] = useState<{show: boolean, recipe: any | null}>({show: false, recipe: null});

  const [scanResult, setScanResult] = useState<any>(null);
  const [manualFood, setManualFood] = useState("");
  const [manualWeight, setManualWeight] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [cuisine, setCuisine] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [mealCount, setMealCount] = useState(4);

  const [plans, setPlans] = useState<Record<string, DayPlan>>({});
  const [profile, setProfile] = useState<BioProfile>({
    bio: { gender: 'male', age: 30, weight: 84.5, height: 185, activity: 1.4 },
    stats: { bmi: 0, bmr: 0, tdee: 0 },
    goals: { 
      targetKcal: 2500, proteinPct: 30, fatPct: 25, carbsPct: 45, 
      currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 
    }
  });
  const [water, setWater] = useState({ current: 0, target: 2500 });
  const [steps, setSteps] = useState({ current: 0, target: 10000 });

  // --- LOGOWANIE ---
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  const handleAuth = () => {
      // Logowanie sztywne dla testera
      signInWithEmailAndPassword(auth, "tester1@chrupnelo.pl", pass)
      .catch((e) => alert("Błąd logowania: " + e.code));
  };

  // --- PERSYSTENCJA ---
  useEffect(() => {
    const d = { 
      p: localStorage.getItem('pl_p'), pr: localStorage.getItem('pl_pr'), 
      w: localStorage.getItem('pl_w'), s: localStorage.getItem('pl_s'), 
      i: localStorage.getItem('pl_i'), r: localStorage.getItem('pl_r') 
    };

    let loadedPlans = d.p ? JSON.parse(d.p) : {};
    
    // Auto Cleanup 30 dni
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 30);
    
    const cleanedPlans: Record<string, any> = {};
    let wasCleaned = false;

    Object.keys(loadedPlans).forEach(dateStr => {
      const planDate = new Date(dateStr);
      if (planDate >= cutoff) {
        cleanedPlans[dateStr] = loadedPlans[dateStr];
      } else {
        wasCleaned = true;
      }
    });

    if (wasCleaned) console.log("Oczyszczono stare dane.");

    setPlans(cleanedPlans);
    if (d.pr) setProfile(JSON.parse(d.pr)); 
    if (d.w) setWater(JSON.parse(d.w)); 
    if (d.s) setSteps(JSON.parse(d.s)); 
    if (d.i) setInventory(JSON.parse(d.i)); 
    if (d.r) setSavedRecipes(JSON.parse(d.r));
  }, []);

  // --- ZAPIS Z OBSŁUGĄ QUOTA EXCEEDED ---
  useEffect(() => {
    const saveData = () => {
        try {
            localStorage.setItem('pl_p', JSON.stringify(plans)); 
            localStorage.setItem('pl_pr', JSON.stringify(profile)); 
            localStorage.setItem('pl_w', JSON.stringify(water)); 
            localStorage.setItem('pl_s', JSON.stringify(steps)); 
            localStorage.setItem('pl_i', JSON.stringify(inventory)); 
            localStorage.setItem('pl_r', JSON.stringify(savedRecipes));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                alert("⚠️ Brak miejsca! Czyszczę stare zdjęcia...");
                const sortedDates = Object.keys(plans).sort();
                const oldestDates = sortedDates.slice(0, 7);
                const lighterPlans = { ...plans };
                oldestDates.forEach(date => {
                    if (lighterPlans[date]) {
                        lighterPlans[date] = {
                            ...lighterPlans[date],
                            meals: lighterPlans[date].meals?.map((m: any) => {
                                const { imageUrl, ...rest } = m; 
                                return rest;
                            })
                        };
                    }
                });
                setPlans(lighterPlans);
            }
        }
    };
    saveData();
  }, [plans, profile, water, steps, inventory, savedRecipes]);

  // --- OBLICZENIA ---
  const calculated = useMemo(() => {
    const { weight, height, age, gender, activity } = profile.bio;
    const { proteinPct, fatPct, carbsPct, correction } = profile.goals;
    
    const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
    let bmiColor = '#3b82f6';
    let bmiLabel = 'NIEDOWAGA';
    
    if (bmi >= 18.5 && bmi < 25) { bmiColor = '#10b981'; bmiLabel = 'NORMA'; } 
    else if (bmi >= 25 && bmi < 30) { bmiColor = '#f59e0b'; bmiLabel = 'NADWAGA'; } 
    else if (bmi >= 30) { bmiColor = '#ef4444'; bmiLabel = 'OTYŁOŚĆ'; }

    const s = gender === 'male' ? 5 : -161;
    const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + s);
    const tdee = Math.round(bmr * activity);
    const totalTarget = tdee + correction;

    return {
      bmi, bmiLabel, bmiColor, totalTarget, bmr, tdee,
      proteinG: Math.round((totalTarget * (proteinPct / 100)) / 4),
      fatG: Math.round((totalTarget * (fatPct / 100)) / 9),
      carbsG: Math.round((totalTarget * (carbsPct / 100)) / 4),
      isPctValid: (proteinPct + fatPct + carbsPct) === 100,
      pctSum: proteinPct + fatPct + carbsPct,
    };
  }, [profile]);

  const currentPlan = plans[selectedDate] || { meals: [], totalKcal: 0 };

  const consumedStats = useMemo(() => {
    return (currentPlan.meals || []).reduce((acc: any, meal: any) => {
      if (meal.completed) {
        return {
          kcal: acc.kcal + (meal.kcal || 0),
          p: acc.p + (meal.protein || 0),
          f: acc.f + (meal.fat || 0),
          c: acc.c + (meal.carbs || 0)
        };
      }
      return acc;
    }, { kcal: 0, p: 0, f: 0, c: 0 });
  }, [currentPlan]);

  const shoppingList = useMemo(() => {
    if (!currentPlan.meals) return [];
    return Array.from(new Set(currentPlan.meals.flatMap((m: any) => m.ingredients || [])));
  }, [currentPlan]);

  const monthHistory = useMemo(() => {
    const days = [];
    for(let i=0; i<30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const plan = plans[dateStr];
        if (plan) {
            const consumed = (plan.meals || []).filter((m: any) => m.completed).reduce((s: number, m: any) => s + (m.kcal || 0), 0);
            days.push({ date: dateStr, plan, consumed });
        }
    }
    return days;
  }, [plans]);

  const filteredRecipes = useMemo(() => {
    if (inventoryFilter === "Wszystkie") return savedRecipes;
    return savedRecipes.filter(r => r.category === inventoryFilter);
  }, [savedRecipes, inventoryFilter]);

  // --- ACTIONS ---
  const addToInventory = () => {
    if (newItem.name.trim() && newItem.weight) {
      setInventory(prev => [...prev, { name: newItem.name.trim(), weight: newItem.weight }]);
      setNewItem({ name: '', weight: '' });
    }
  };

  const generateFromStock = async () => {
    if (inventory.length === 0) return alert("Lodówka jest pusta!");
    setLoading(true);
    try {
      const recipe = await generateRecipeFromInventory(inventory);
      if (recipe) setSavedRecipes(prev => [recipe, ...prev]);
    } catch (e) { alert("Błąd AI"); } finally { setLoading(false); }
  };

  const handleAddToPlan = (targetDate: string, mealIndex: number) => {
    const recipe = planModal.recipe;
    if (!recipe) return;

    setPlans(prev => {
        const currentMeals = prev[targetDate]?.meals || Array(mealCount).fill(null).map((_, i) => ({
            name: `Posiłek ${i+1} (Pusty)`, kcal: 0, protein: 0, fat: 0, carbs: 0, completed: false, ingredients: [], instructions: []
        }));

        const newMeal = {
            name: recipe.name,
            kcal: recipe.kcal || 0,
            protein: recipe.protein || 0,
            fat: recipe.fat || 0,
            carbs: recipe.carbs || 0,
            ingredients: recipe.ingredients || [],
            instructions: recipe.instructions || [],
            imageUrl: recipe.imageUrl,
            completed: false
        };

        if (mealIndex >= 0 && mealIndex < currentMeals.length) {
            currentMeals[mealIndex] = newMeal;
        } else {
            currentMeals.push(newMeal);
        }

        return { ...prev, [targetDate]: { ...prev[targetDate], meals: currentMeals } };
    });

    setPlanModal({show: false, recipe: null});
    alert("Dodano przepis do planu!");
  };

  const handleSmartScan = async () => {
    if (!selectedImage && !manualFood) return alert("Dodaj zdjęcie lub nazwę!");
    setLoading(true);
    try {
      const result = await analyzeMealScan(selectedImage || "", manualFood, manualWeight);
      setScanResult(result);
    } catch (e) { alert("Błąd AI"); } finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    if (!calculated.isPctValid) return alert("Suma makro musi wynosić 100%!");
    setLoading(true);
    try {
      const plan = await generateMealPlan({
        targetCalories: calculated.totalTarget,
        goalMode: profile.goals.currentGoal,
        proteinPct: profile.goals.proteinPct,
        fatPct: profile.goals.fatPct,
        carbsPct: profile.goals.carbsPct,
        cuisine, exclusions, mealCount
      });
      if (plan) setPlans(prev => ({ ...prev, [selectedDate]: plan }));
    } catch (e) { alert("Błąd AI"); } finally { setLoading(false); }
  };

  const toggleMealCompletion = (idx: number) => {
    const updatedMeals = [...currentPlan.meals];
    updatedMeals[idx].completed = !updatedMeals[idx].completed;
    setPlans(prev => ({ ...prev, [selectedDate]: { ...currentPlan, meals: updatedMeals } }));
  };

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const editWaterGoal = () => {
    const val = prompt("Ustaw dzienny cel wody (ml):", water.target.toString());
    if (val && !isNaN(parseInt(val))) setWater(prev => ({ ...prev, target: Math.abs(parseInt(val)) }));
  };

  const editStepsGoal = () => {
    const val = prompt("Ustaw dzienny cel kroków:", steps.target.toString());
    if (val && !isNaN(parseInt(val))) setSteps(prev => ({ ...prev, target: Math.abs(parseInt(val)) }));
  };

  const setStrategy = (mode: 'cut' | 'maintain' | 'bulk' | 'custom', val: number) => {
    setProfile(prev => ({ ...prev, goals: { ...prev.goals, currentGoal: mode, correction: val } }));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6 font-sans">
        <h1 className="text-4xl italic font-black mb-8 italic">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <div className="w-full max-w-xs space-y-4">
            <input type="password" placeholder="Hasło" className="w-full bg-[#161618] p-4 rounded-xl border border-white/10 text-center outline-none focus:border-[#ff7a00]" value={pass} onChange={e => setPass(e.target.value)} />
            <button onClick={handleAuth} className="w-full bg-[#ff7a00] text-black py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-[#ff8c20] active:scale-95 transition-all">WJEDŹ 🚀</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col max-w-xl mx-auto pb-44 font-sans text-center selection:bg-[#ff7a00]/30 relative">
      <header className="p-10 flex flex-col items-center sticky top-0 bg-[#0a0a0b]/90 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
          Plener <span className="text-[#ff7a00]">Chrupnęło</span>
        </h1>
        <button onClick={() => signOut(auth)} className="absolute right-6 top-10 text-[8px] text-stone-600 font-bold uppercase hover:text-white transition-all">Logout</button>
      </header>

      <main className="p-6 space-y-6">
        {/* ZAKŁADKA PLAN */}
        {activeTab === 'meals' && (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="flex bg-[#161618] p-1 rounded-2xl border border-white/5 mb-4">
               {['day', 'week', 'month'].map((m) => (
                   <button key={m} onClick={() => setPlanViewMode(m as any)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${planViewMode === m ? 'bg-[#ff7a00] text-black' : 'text-stone-600'}`}>
                       {m === 'day' ? 'Dzień' : m === 'week' ? 'Tydzień' : 'Miesiąc'}
                   </button>
               ))}
            </div>

            {planViewMode === 'day' && (
                <>
                    <div className="flex items-center justify-between bg-[#161618] p-4 rounded-3xl border border-white/5">
                        <button onClick={() => changeDate(-1)} className="text-xl px-4 text-stone-500 hover:text-white">←</button>
                        <span className="font-black italic text-[#ff7a00] uppercase tracking-widest">{selectedDate}</span>
                        <button onClick={() => changeDate(1)} className="text-xl px-4 text-stone-500 hover:text-white">→</button>
                    </div>

                    <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-2xl space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <input placeholder="Kuchnia..." value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic outline-none focus:border-[#ff7a00] text-center" />
                                <button onClick={() => setCuisine(WORLD_CUISINES[Math.floor(Math.random() * WORLD_CUISINES.length)])} className="absolute right-3 top-1/2 -translate-y-1/2 text-xl hover:scale-110 transition-transform">🎲</button>
                            </div>
                            <div className="flex flex-col items-center shrink-0">
                                <span className="text-[7px] font-black text-stone-600 mb-1 uppercase">Posiłki: {mealCount}</span>
                                <input type="range" min="2" max="6" value={mealCount} onChange={(e) => setMealCount(parseInt(e.target.value))} className="w-20 accent-[#ff7a00]" />
                            </div>
                        </div>
                        <textarea placeholder="Wykluczenia..." value={exclusions} onChange={(e) => setExclusions(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic outline-none h-16 resize-none focus:border-[#ff7a00] text-center" />
                        <button onClick={handleGenerate} className="w-full bg-[#ff7a00] text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-lg shadow-orange-500/10">Generuj Jadłospis AI 🚀</button>
                    </section>

                    <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] space-y-6 text-left relative overflow-hidden">
                        <div className="flex justify-between items-end px-2 relative z-10">
                            <div>
                                <span className="text-[9px] font-black text-stone-500 uppercase italic">Spożycie</span>
                                <div className="text-4xl text-[#ff7a00] font-black italic flex items-baseline gap-2">
                                    {Math.round(consumedStats.kcal)} <span className="text-sm text-stone-600 font-bold">/ {calculated.totalTarget} kcal</span>
                                </div>
                            </div>
                            <div className="text-right"><span className="text-stone-300 font-bold text-[10px]">{Math.round((consumedStats.kcal / calculated.totalTarget) * 100)}% CELU</span></div>
                        </div>
                        <div className="h-1 bg-[#0a0a0b] w-full rounded-full overflow-hidden">
                             <div className="h-full bg-[#ff7a00] transition-all duration-1000" style={{ width: `${Math.min(100, (consumedStats.kcal / calculated.totalTarget) * 100)}%` }} />
                        </div>
                        <div className="flex gap-4 relative z-10">
                            <MacroBar label="Białko" current={consumedStats.p} target={calculated.proteinG} color="#3b82f6" />
                            <MacroBar label="Tłuszcz" current={consumedStats.f} target={calculated.fatG} color="#f59e0b" />
                            <MacroBar label="Węgle" current={consumedStats.c} target={calculated.carbsG} color="#10b981" />
                        </div>
                    </section>

                    <div className="space-y-4">
                    {currentPlan.meals.map((meal: any, idx: number) => (
                        <details key={idx} className={`bg-[#161618] rounded-[2.5rem] border transition-all duration-500 overflow-hidden group ${meal.completed ? 'border-emerald-500/30 opacity-70' : 'border-[#27272a]'}`}>
                        <summary className="p-6 flex items-center justify-between cursor-pointer list-none outline-none text-left">
                            <div className="flex items-center gap-4">
                                <button onClick={(e) => { e.preventDefault(); toggleMealCompletion(idx); }} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${meal.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-stone-700 text-transparent hover:border-[#ff7a00]'}`}>✓</button>
                                <div>
                                <h4 className="text-[9px] font-black uppercase text-stone-500">Posiłek {idx + 1}</h4>
                                <p className={`font-black italic text-lg ${meal.completed ? 'text-emerald-400 line-through decoration-2' : 'text-stone-200'}`}>{meal.name}</p>
                                <p className="text-[8px] text-stone-600 font-bold uppercase">{meal.kcal} kcal • B:{meal.protein}g T:{meal.fat}g W:{meal.carbs}g</p>
                                </div>
                            </div>
                            <span className="text-2xl group-open:rotate-180 transition-transform">🍽️</span>
                        </summary>
                        <div className="px-8 pb-8 space-y-4 border-t border-white/5 pt-4 text-[11px] text-stone-400 text-left">
                            {meal.imageUrl && <div className="w-full h-48 bg-[#0a0a0b] rounded-2xl overflow-hidden mb-4 border border-white/5 relative group/img"><img src={meal.imageUrl} alt={meal.name} className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4"><span className="text-[#ff7a00] font-black text-[10px] uppercase tracking-widest">Wizualizacja AI</span></div></div>}
                            <p className="text-[#ff7a00] font-black uppercase italic text-[10px]">Składniki:</p>
                            <ul className="list-disc pl-4 space-y-1">{meal.ingredients?.map((ing: string, i: number) => <li key={i} className="marker:text-stone-600">{ing}</li>)}</ul>
                            <p className="text-[#ff7a00] font-black uppercase italic text-[10px] mt-2">Instrukcja:</p>
                            <div className="space-y-2">{meal.instructions?.map((s: string, i: number) => <div key={i} className="flex gap-3"><span className="font-black text-stone-600 min-w-[1.5rem]">{i+1}.</span><p>{s}</p></div>)}</div>
                        </div>
                        </details>
                    ))}
                    </div>

                    {shoppingList.length > 0 && (
                        <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-white/5 mt-8 text-left">
                             <h3 className="text-center text-[10px] font-black text-[#ff7a00] uppercase italic tracking-[0.2em] mb-6">Lista Zakupów</h3>
                             <div className="grid grid-cols-2 gap-3">
                                 {shoppingList.map((item: string, i: number) => (
                                     <div key={i} className="flex items-start gap-2 text-[10px] text-stone-300">
                                         <div className="w-3 h-3 border border-stone-600 rounded-sm mt-0.5 shrink-0" /><span>{item}</span>
                                     </div>
                                 ))}
                             </div>
                        </section>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <section className="bg-[#161618] p-6 rounded-[3rem] border border-[#27272a] space-y-3">
                            <div className="flex justify-between items-center"><span className="text-[8px] font-black text-stone-500 uppercase">🥛 Woda</span><button onClick={editWaterGoal} className="text-[7px] font-bold text-stone-600 hover:text-[#ff7a00] uppercase tracking-widest bg-[#0a0a0b] px-2 py-1 rounded-full border border-white/5">Cel: {water.target}</button></div>
                            <div className="flex justify-between items-center px-2"><button onClick={() => setWater({...water, current: Math.max(0, water.current - 250)})} className="text-stone-600 font-black text-xl hover:text-white transition-colors">-</button><div className="flex flex-col items-center leading-none"><span className="text-sm font-black text-blue-400">{water.current}ml</span><span className="text-[7px] font-bold text-stone-600 mt-0.5">/ {water.target}ml</span></div><button onClick={() => setWater({...water, current: water.current + 250})} className="text-blue-400 font-black text-xl hover:text-blue-300 transition-colors">+</button></div>
                        </section>
                        <section className="bg-[#161618] p-6 rounded-[3rem] border border-[#27272a] space-y-3">
                            <div className="flex justify-between items-center"><span className="text-[8px] font-black text-stone-500 uppercase">👣 Kroki</span><button onClick={editStepsGoal} className="text-[7px] font-bold text-stone-600 hover:text-[#ff7a00] uppercase tracking-widest bg-[#0a0a0b] px-2 py-1 rounded-full border border-white/5">Cel: {steps.target}</button></div>
                            <div className="text-xs font-black text-green-400 flex items-baseline justify-center gap-1">{steps.current} <span className="text-[8px] text-stone-600 font-bold">/ {steps.target}</span></div>
                            <input type="range" min="0" max={Math.max(steps.target, steps.current)} value={steps.current} onChange={(e) => setSteps({...steps, current: parseInt(e.target.value)})} className="w-full h-1 accent-green-500" />
                        </section>
                    </div>
                </>
             )}

             {planViewMode === 'month' && (
                <div className="space-y-4">
                    <h3 className="text-center text-[10px] font-black text-stone-500 uppercase italic tracking-[0.2em]">Archiwum Operacyjne</h3>
                    {monthHistory.length === 0 && <p className="text-stone-600 text-xs italic py-10">Brak danych.</p>}
                    {monthHistory.map((day: any) => (
                        <div key={day.date} className="bg-[#161618] p-5 rounded-[2rem] border border-white/5 flex justify-between items-center">
                            <div><p className="text-[10px] font-black uppercase text-stone-500">{day.date}</p><p className="text-stone-300 font-bold text-xs">{day.plan.meals?.length} posiłków</p></div>
                            <div className="text-right"><span className="block text-[#ff7a00] font-black italic">{day.consumed} kcal</span><span className="text-[8px] uppercase text-stone-600">Zjedzone</span></div>
                        </div>
                    ))}
                </div>
             )}
             
             {planViewMode === 'week' && <div className="py-20 text-stone-500 text-xs italic uppercase font-black">Widok tygodniowy w budowie...</div>}
          </div>
        )}

        {/* ZAKŁADKA SKAN */}
        {activeTab === 'scanner' && (
          <div className="space-y-6 animate-in zoom-in duration-500">
             <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] shadow-2xl space-y-8 text-center">
              <div className="w-40 h-40 bg-[#0a0a0b] rounded-full flex items-center justify-center border-2 border-dashed border-[#ff7a00]/30 mx-auto relative overflow-hidden group">
                {selectedImage ? <img src={selectedImage} className="w-full h-full object-cover" /> : <span className="text-5xl">📷</span>}
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if(file){ const reader = new FileReader(); reader.onloadend = () => setSelectedImage(reader.result as string); reader.readAsDataURL(file); } }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              </div>
              <div className="space-y-4">
                <input placeholder="Nazwa dania..." value={manualFood} onChange={(e) => setManualFood(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic outline-none focus:border-[#ff7a00] text-center" />
                <div className="relative">
                  <input type="number" placeholder="Waga (g)" value={manualWeight} onChange={(e) => setManualWeight(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic outline-none focus:border-[#ff7a00] text-center" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-stone-600 uppercase">G</span>
                </div>
              </div>
              <button onClick={handleSmartScan} className="w-full bg-[#ff7a00] text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl">Analizuj AI ⚙️</button>
              {scanResult && (
                <div className="bg-[#0a0a0b] p-6 rounded-[3rem] border border-[#ff7a00]/20 animate-in slide-in-from-top mt-4">
                  <h3 className="text-[#ff7a00] font-black italic text-xl uppercase leading-none">{scanResult.name}</h3>
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {[{l:'KCAL',v:scanResult.kcal,c:'white'},{l:'B',v:scanResult.protein,c:'blue-500'},{l:'T',v:scanResult.fat,c:'orange-500'},{l:'W',v:scanResult.carbs,c:'green-500'}].map(m=><div key={m.l} className="bg-[#161618] p-3 rounded-xl text-center"><span className={`text-[7px] font-black block text-${m.c}`}>{m.l}</span><span className="text-sm font-black">{m.v}</span></div>)}
                  </div>
                </div>
              )}
             </section>
          </div>
        )}

        {/* ZAKŁADKA BIO */}
        {activeTab === 'body' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
            <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-2xl flex justify-around items-center">
              <div className="text-center">
                <span className="text-[8px] font-black text-stone-600 uppercase block mb-1">BMI</span>
                <div className="text-4xl font-black italic" style={{ color: calculated.bmiColor }}>{calculated.bmi}</div>
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: calculated.bmiColor }}>{calculated.bmiLabel}</span>
              </div>
              <div className="h-12 w-px bg-white/5"></div>
              <div className="text-center">
                <span className="text-[8px] font-black text-stone-600 uppercase block mb-1">ZAPOTRZEBOWANIE</span>
                <div className="text-4xl font-black italic text-[#ff7a00]">{calculated.totalTarget}</div>
                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">KCAL / DZIEŃ</span>
              </div>
            </section>

            <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] space-y-6">
              <h3 className="text-center text-[10px] font-black text-stone-500 uppercase italic tracking-[0.2em]">Parametry</h3>
              <div className="flex bg-[#0a0a0b] p-1 rounded-2xl border border-white/5">
                <button onClick={() => setProfile({...profile, bio: {...profile.bio, gender: 'male'}})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${profile.bio.gender === 'male' ? 'bg-[#3b82f6] text-black shadow-lg' : 'text-stone-600'}`}>Mężczyzna</button>
                <button onClick={() => setProfile({...profile, bio: {...profile.bio, gender: 'female'}})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${profile.bio.gender === 'female' ? 'bg-[#ff7a00] text-black shadow-lg' : 'text-stone-600'}`}>Kobieta</button>
              </div>
              <div className="space-y-8 px-2">
                {[{l:'Waga', k:'weight', u:'kg', min:40, max:150, s:0.5}, {l:'Wzrost', k:'height', u:'cm', min:140, max:220, s:1}, {l:'Wiek', k:'age', u:'lat', min:15, max:90, s:1}].map(i => (
                    <div key={i.k} className="space-y-2"><div className="flex justify-between items-end"><span className="text-[9px] font-black text-stone-500 uppercase">{i.l}</span><span className="text-xl font-black italic text-white">{(profile.bio as any)[i.k]} <small className="text-xs text-stone-600">{i.u}</small></span></div><input type="range" min={i.min} max={i.max} step={i.s} value={(profile.bio as any)[i.k]} onChange={(e) => setProfile({...profile, bio: {...profile.bio, [i.k]: parseFloat(e.target.value)}})} className="w-full h-2 bg-[#0a0a0b] rounded-full appearance-none accent-[#ff7a00] cursor-pointer" /></div>
                ))}
              </div>
              <div className="space-y-4 pt-4 border-t border-white/5">
                  <label className="text-[9px] font-black text-stone-500 uppercase block text-center tracking-widest">Aktywność</label>
                  <div className="grid grid-cols-5 gap-2">{[{v:1.2,l:'0'},{v:1.375,l:'1'},{v:1.55,l:'2'},{v:1.725,l:'3'},{v:1.9,l:'4'}].map(o=><button key={o.v} onClick={()=>setProfile({...profile, bio:{...profile.bio, activity:o.v}})} className={`py-3 rounded-xl text-[10px] font-black ${profile.bio.activity===o.v?'bg-[#ff7a00] text-black':'bg-[#0a0a0b] text-stone-600 border border-white/5'}`}>{o.l}</button>)}</div>
              </div>
              <div className="space-y-6 pt-4 border-t border-white/5">
                  <label className="text-[9px] font-black text-stone-500 uppercase block text-center tracking-widest">Strategia</label>
                  <div className="flex bg-[#0a0a0b] p-1 rounded-2xl border border-white/5">{[{l:'Redukcja',v:-300,m:'cut'},{l:'Utrzymanie',v:0,m:'maintain'},{l:'Masa',v:300,m:'bulk'}].map(s=><button key={s.m} onClick={()=>setStrategy(s.m as any, s.v)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${profile.goals.currentGoal===s.m?'bg-[#ff7a00] text-black':'text-stone-600'}`}>{s.l}</button>)}</div>
                  <div className="px-2 space-y-2"><div className="flex justify-between items-end"><span className="text-[8px] font-black text-stone-500 uppercase">Korekta</span><span className="text-[#ff7a00] font-black italic">{profile.goals.correction} kcal</span></div><input type="range" min="-1000" max="1000" step="50" value={profile.goals.correction} onChange={(e)=>setStrategy('custom' as any, parseInt(e.target.value))} className="w-full h-2 bg-[#0a0a0b] rounded-full appearance-none accent-[#ff7a00] cursor-pointer" /></div>
              </div>
            </section>

            <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] space-y-6">
              <h3 className="text-center text-[10px] font-black text-stone-500 uppercase italic tracking-[0.2em]">Strategia Makro (%)</h3>
              <div className="grid grid-cols-3 gap-4">
                {[ { key: 'proteinPct', label: 'Białko', g: calculated.proteinG, color: 'text-blue-400' }, { key: 'fatPct', label: 'Tłuszcz', g: calculated.fatG, color: 'text-orange-400' }, { key: 'carbsPct', label: 'Węgle', g: calculated.carbsG, color: 'text-green-400' } ].map(m => (
                  <div key={m.key} className="bg-[#0a0a0b] p-4 rounded-3xl border border-white/5 text-center">
                    <span className="text-[7px] font-black text-stone-600 uppercase block mb-1">{m.label}</span>
                    <input type="number" value={(profile.goals as any)[m.key]} onChange={(e) => setProfile({...profile, goals: {...profile.goals, [m.key]: parseInt(e.target.value) || 0}})} className={`w-full bg-transparent text-center font-black italic text-xl outline-none ${m.color}`} />
                    <span className="text-[9px] font-bold text-stone-500">{m.g}g</span>
                  </div>
                ))}
              </div>
              {!calculated.isPctValid && <p className="text-red-500 text-[9px] font-black uppercase text-center animate-pulse mt-2">Błąd: Suma musi wynosić 100%</p>}
            </section>
          </div>
        )}

        {/* ZAKŁADKA MAGAZYN */}
        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
            <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-2xl space-y-6 text-center">
              <div className="flex items-center gap-3"><span className="text-2xl">🧊</span><h3 className="text-lg font-black italic uppercase">Lodówka</h3></div>
              <div className="flex gap-2">
                <input placeholder="Składnik..." value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} className="flex-[2] bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic outline-none focus:border-[#ff7a00] text-center" />
                <input type="number" placeholder="Waga (g)" value={newItem.weight} onChange={(e) => setNewItem({...newItem, weight: e.target.value})} className="flex-1 bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic outline-none focus:border-[#ff7a00] text-center" />
                <button onClick={addToInventory} className="bg-[#ff7a00] text-black w-12 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">+</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {inventory.map((item, idx) => (
                  <div key={idx} className="bg-[#0a0a0b] px-4 py-2 rounded-full border border-white/10 text-[9px] font-bold flex gap-2 items-center text-center"><span className="text-stone-300">{item.name}</span><span className="text-[#ff7a00]">{item.weight}g</span><button onClick={() => setInventory(inventory.filter((_, i) => i !== idx))} className="text-red-500 ml-1">×</button></div>
                ))}
              </div>
              <button onClick={generateFromStock} className="w-full bg-white text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-xl">Generuj z tych składników 👨‍🍳</button>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em] italic px-4 text-center">Baza Przepisów</h3>
              <div className="flex overflow-x-auto gap-2 pb-2 px-2 no-scrollbar">
                  {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setInventoryFilter(cat)} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase whitespace-nowrap transition-all border border-white/5 ${inventoryFilter === cat ? 'bg-[#ff7a00] text-black' : 'bg-[#161618] text-stone-500'}`}>{cat}</button>
                  ))}
              </div>
              {filteredRecipes.map((recipe, idx) => (
                <details key={idx} className="bg-[#161618] rounded-[2.5rem] border border-[#27272a] overflow-hidden group">
                  <summary className="p-6 flex items-center justify-between cursor-pointer list-none outline-none text-left">
                    <div className="space-y-1 text-left flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-1"><span className="text-[8px] font-black uppercase bg-[#0a0a0b] px-2 py-1 rounded text-stone-500 border border-white/5">{recipe.category || "Inne"}</span><span className="text-[9px] font-black uppercase text-[#ff7a00] italic">Przepis AI</span></div>
                      <p className="font-black italic text-stone-200 text-lg leading-tight">{recipe.name}</p>
                    </div>
                    <span className="text-2xl group-open:rotate-180 transition-transform">📖</span>
                  </summary>
                  <div className="px-8 pb-8 space-y-4 border-t border-white/5 pt-4 text-[11px] text-stone-400 text-left leading-relaxed">
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        {[{l:'Kcal', v: recipe.kcal}, {l:'B', v: recipe.protein}, {l:'T', v: recipe.fat}, {l:'W', v: recipe.carbs}].map((m, i) => (
                            <div key={i} className="bg-[#0a0a0b] p-2 rounded-xl text-center border border-white/5"><span className="block text-[8px] text-stone-500 font-bold">{m.l}</span><span className="block text-xs font-black text-white">{m.v}</span></div>
                        ))}
                    </div>
                    <p className="font-black text-stone-500 italic">Składniki:</p><ul className="list-disc pl-4 mb-2">{recipe.ingredients?.map((ing: string, i: number) => <li key={i}>{ing}</li>)}</ul>
                    <p className="font-black text-stone-500 italic">Wykonanie:</p>{recipe.instructions?.map((s: string, i: number) => <p key={i} className="mb-1">{i+1}. {s}</p>)}
                    <button onClick={() => setPlanModal({show: true, recipe})} className="w-full bg-[#ff7a00]/10 text-[#ff7a00] py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-[#ff7a00]/20 mt-4 hover:bg-[#ff7a00] hover:text-black transition-all">Dodaj do planu +</button>
                  </div>
                </details>
              ))}
            </section>
          </div>
        )}
      </main>

      {/* PLAN MODAL */}
      {planModal.show && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-[#161618] w-full max-w-sm rounded-[3rem] p-8 border border-[#ff7a00]/20 space-y-6 relative">
                  <button onClick={() => setPlanModal({show: false, recipe: null})} className="absolute top-6 right-6 text-stone-500 text-2xl">×</button>
                  <h3 className="text-xl font-black italic text-[#ff7a00] uppercase text-center">Dodaj do Planu</h3>
                  <div className="space-y-4">
                      <p className="text-center text-xs font-bold text-stone-400 mb-4">{planModal.recipe.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleAddToPlan(getToday(), -1)} className="bg-[#0a0a0b] py-4 rounded-2xl border border-white/10 hover:border-[#ff7a00] text-xs font-black uppercase transition-all">Dziś</button>
                        <button onClick={() => handleAddToPlan(getTomorrow(), -1)} className="bg-[#0a0a0b] py-4 rounded-2xl border border-white/10 hover:border-[#ff7a00] text-xs font-black uppercase transition-all">Jutro</button>
                      </div>
                      <p className="text-[9px] text-stone-600 font-black uppercase text-center tracking-widest mt-4">Lub zamień posiłek:</p>
                      <div className="grid grid-cols-4 gap-2">
                          {[0,1,2,3].map(i => <button key={i} onClick={() => handleAddToPlan(getToday(), i)} className="bg-[#0a0a0b] py-3 rounded-xl border border-white/5 hover:border-[#ff7a00] text-[10px] font-black text-stone-300">#{i+1}</button>)}
                      </div>
                  </div>
              </div>
          </div>
      )}

      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 flex bg-[#161618]/95 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-3 shadow-2xl z-50">
        {[ { id: 'meals', icon: '🍴', label: 'PLAN' }, { id: 'scanner', icon: '📷', label: 'SKAN' }, { id: 'body', icon: '⚖️', label: 'BIO' }, { id: 'inventory', icon: '📦', label: 'MAGAZYN' } ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-10 py-5 rounded-[3rem] flex flex-col items-center gap-1 transition-all ${activeTab === t.id ? 'bg-[#ff7a00] text-black scale-105 shadow-xl shadow-orange-500/10' : 'text-stone-700 hover:text-stone-400'}`}>
            <span className="text-xl">{t.icon}</span>
            <span className="text-[7px] font-black uppercase tracking-widest text-center">{t.label}</span>
          </button>
        ))}
      </nav>

      {loading && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex flex-col items-center justify-center p-12 space-y-6 text-center">
          <div className="w-12 h-12 border-4 border-[#ff7a00] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#ff7a00] font-black italic uppercase tracking-widest animate-pulse">System AI Plener Analizuje Dane...</p>
        </div>
      )}
    </div>
  );
}
