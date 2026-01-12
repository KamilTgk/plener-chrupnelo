import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, Firestore, collection, query, where, getDocs, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, User, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { generateMealPlan, replaceSingleMeal, chatWithGemini, savePlanToFirestore, sanitizeForFirestore, generateFridgeRecipe, analyzeMealScan, getMealIcon, recalculateMealFromIngredients, generateImage } from './geminiService';
import { DayPlan, BioProfile, Meal, ChatMessage, Ingredient } from './types';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAFryvqf0ktCil0QyjdHfjmN2ZFAhHHe7A",
  authDomain: "panel-chrupnelo.firebaseapp.com",
  projectId: "panel-chrupnelo",
  storageBucket: "panel-chrupnelo.firebasestorage.app",
  messagingSenderId: "695554422212",
  appId: "1:695554422212:web:b4ea9a37c62177748de091"
};

// Stabilna inicjalizacja bez blokowania
const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

const ADMIN_EMAIL = "admin@plener.pl"; // Zmień na swój email

const getToday = () => new Date().toISOString().split('T')[0];

const MacroBar = ({ label, current, target, color }: { label: string, current: number, target: number, color: string }) => {
  const pct = Math.min(100, (current / (target || 1)) * 100);
  return (
    <div className="flex-1 space-y-1">
      <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-stone-500">
        <span>{label}</span>
        <span className="text-stone-300">{Math.round(current)}G / {Math.round(target)}G</span>
      </div>
      <div className="h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden border border-white/5">
        <div className="h-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(255,255,255,0.1)]" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [testerStatus, setTesterStatus] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'meals' | 'body' | 'ingredients' | 'scanner'>('meals');
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        if (db) {
          const profileSnap = await getDoc(doc(db, "users", u.uid, "data", "profile"));
          if (profileSnap.exists()) setProfile(profileSnap.data() as BioProfile);
          const plansSnap = await getDoc(doc(db, "users", u.uid, "data", "plans"));
          if (plansSnap.exists()) setPlans(plansSnap.data().data as Record<string, DayPlan>);
        }
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const [plans, setPlans] = useState<Record<string, DayPlan>>(() => {
    const saved = localStorage.getItem('ch_plans_v5');
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    const today = new Date();
    const threshold = new Date();
    threshold.setDate(today.getDate() - 30);
    const cleaned: Record<string, DayPlan> = {};
    Object.keys(parsed).forEach(date => {
      if (new Date(date) >= threshold) cleaned[date] = parsed[date];
    });
    return cleaned;
  });

  const [profile, setProfile] = useState<BioProfile>(() => {
    const saved = localStorage.getItem('ch_profile_v5');
    if (saved) return JSON.parse(saved);
    return {
      bio: { gender: 'male', age: 30, weight: 85, height: 185, activity: 1.4 },
      stats: { bmi: 0, bmr: 0, tdee: 0 },
      goals: { targetKcal: 2605, protein: 195, fat: 72, carbs: 293, proteinPct: 30, fatPct: 25, carbsPct: 45, currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 }
    };
  });

  const [fridgeItems, setFridgeItems] = useState<{name: string, qty: string, unit: string}[]>(() => {
    const saved = localStorage.getItem('ch_fridge_v5');
    return saved ? JSON.parse(saved) : [];
  });

  const [savedRecipes, setSavedRecipes] = useState<Meal[]>(() => {
    const saved = localStorage.getItem('ch_recipes_v5');
    return saved ? JSON.parse(saved) : [];
  });

  const [defaultActivityGoals, setDefaultActivityGoals] = useState(() => {
    const saved = localStorage.getItem('ch_activity_defaults_v5');
    return saved ? JSON.parse(saved) : { waterMl: 2500, steps: 10000 };
  });

  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('ch_checked_v5');
    return saved ? JSON.parse(saved) : {};
  });

  const [mealCount, setMealCount] = useState<number>(() => {
    const saved = localStorage.getItem('ch_meal_count_v5');
    return saved ? parseInt(saved) : 4;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedMealIds, setExpandedMealIds] = useState<Set<string>>(new Set());
  const [newIngName, setNewIngName] = useState("");
  const [newIngQty, setNewIngQty] = useState("");
  const [newIngUnit, setNewIngUnit] = useState("g");
  const [cuisine, setCuisine] = useState("Polska, Nowoczesna");
  const [exclusions, setExclusions] = useState("");
  const [isRolling, setIsRolling] = useState(false);

  const [scannerName, setScannerName] = useState("");
  const [scannerWeight, setScannerWeight] = useState("");
  const [scannerImage, setScannerImage] = useState<string | null>(null);
  const [scannerResult, setScannerResult] = useState<Partial<Meal> | null>(null);

  const [editIng, setEditIng] = useState<{ mealId: string, index: number, item: string, amount: number, measure: string } | null>(null);

  // Sync Logic
  useEffect(() => { 
    if (!user) return;
    localStorage.setItem('ch_plans_v5', JSON.stringify(plans)); 
    if (db) setDoc(doc(db, "users", user.uid, "data", "plans"), { data: sanitizeForFirestore(plans) }, { merge: true });
  }, [plans, user]);

  useEffect(() => { 
    if (!user) return;
    localStorage.setItem('ch_profile_v5', JSON.stringify(profile)); 
    if (db) setDoc(doc(db, "users", user.uid, "data", "profile"), profile, { merge: true });
  }, [profile, user]);

  useEffect(() => { localStorage.setItem('ch_fridge_v5', JSON.stringify(fridgeItems)); }, [fridgeItems]);
  useEffect(() => { localStorage.setItem('ch_recipes_v5', JSON.stringify(savedRecipes)); }, [savedRecipes]);
  useEffect(() => { localStorage.setItem('ch_activity_defaults_v5', JSON.stringify(defaultActivityGoals)); }, [defaultActivityGoals]);
  useEffect(() => { localStorage.setItem('ch_checked_v5', JSON.stringify(checkedIngredients)); }, [checkedIngredients]);
  useEffect(() => { localStorage.setItem('ch_meal_count_v5', mealCount.toString()); }, [mealCount]);

  const calculated = useMemo(() => {
    const { gender, age, weight, height, activity } = profile.bio;
    const { correction, proteinPct, fatPct, carbsPct, weightStart, weightTarget } = profile.goals;
    const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
    const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161));
    const tdee = Math.round(bmr * activity);
    const targetKcal = tdee + (correction || 0);
    const protein = Math.round((targetKcal * (proteinPct / 100)) / 4);
    const fat = Math.round((targetKcal * (fatPct / 100)) / 9);
    const carbs = Math.round((targetKcal * (carbsPct / 100)) / 4);

    let bmiColor = '#3b82f6';
    let bmiLabel = 'NIEDOWAGA';
    if (bmi >= 18.5 && bmi < 25) { bmiColor = '#ff7a00'; bmiLabel = 'NORMA'; }
    else if (bmi >= 25 && bmi < 30) { bmiColor = '#f59e0b'; bmiLabel = 'NADWAGA'; }
    else if (bmi >= 30) { bmiColor = '#ef4444'; bmiLabel = 'OTYŁOŚĆ'; }

    let weightProgress = 0;
    const start = weightStart || weight;
    const target = weightTarget || weight;
    const current = weight;
    if (start !== target) {
      if (target < start) weightProgress = ((start - current) / (start - target)) * 100;
      else weightProgress = ((current - start) / (target - start)) * 100;
    }
    weightProgress = Math.max(0, Math.min(100, weightProgress));
    return { bmi, tdee, bmr, targetKcal, protein, fat, carbs, bmiColor, bmiLabel, weightProgress };
  }, [profile.bio, profile.goals]);

  const currentPlan = plans[selectedDate] || { 
    date: selectedDate, totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, meals: [], extraMeals: [],
    waterCurrent: 0, stepsCurrent: 0, 
    dailyActivity: { 
      water: { goalGlasses: Math.ceil(defaultActivityGoals.waterMl / 250), goalMl: defaultActivityGoals.waterMl }, 
      steps: { goal: defaultActivityGoals.steps } 
    } 
  };

  const updateCurrentPlan = async (updates: Partial<DayPlan>) => {
    const newPlan = { ...currentPlan, ...updates };
    setPlans(p => ({ ...p, [selectedDate]: newPlan }));
  };

  const handleGenerate = async () => {
    setLoading(true); setError(null);
    try {
      const plan = await generateMealPlan({ 
        targetCalories: calculated.targetKcal, mealCount, proteinPct: profile.goals.proteinPct, fatPct: profile.goals.fatPct, carbsPct: profile.goals.carbsPct, selectedDate, favCuisines: cuisine, excludedIngredients: exclusions, imagePrefs: { size: '1K', aspectRatio: '1:1' }, goalMode: profile.goals.currentGoal 
      });
      await updateCurrentPlan({ ...plan });
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const statsProgress = useMemo(() => {
    const completedPlanned = currentPlan.meals.filter(m => m.completed);
    const extraMeals = currentPlan.extraMeals || [];
    return [...completedPlanned, ...extraMeals].reduce((acc, m) => ({
      kcal: acc.kcal + Number(m.kcal || 0),
      p: acc.p + Number(m.macros?.p || 0),
      f: acc.f + Number(m.macros?.f || 0),
      c: acc.c + Number(m.macros?.c || 0)
    }), { kcal: 0, p: 0, f: 0, c: 0 });
  }, [currentPlan]);

  const toggleMealDetails = (id: string) => {
    setExpandedMealIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMealCompleted = async (id: string) => {
    const updatedMeals = currentPlan.meals.map(m => m.id === id ? { ...m, completed: !m.completed } : m);
    await updateCurrentPlan({ meals: updatedMeals });
  };

  const handleReplaceMeal = async (mealId: string) => {
    const mealToReplace = currentPlan.meals.find(m => m.id === mealId);
    if (!mealToReplace) return;
    setLoading(true); setError(null);
    try {
      const newMeal = await replaceSingleMeal(mealToReplace, {
        targetCalories: calculated.targetKcal, mealCount, proteinPct: profile.goals.proteinPct, fatPct: profile.goals.fatPct, carbsPct: profile.goals.carbsPct, selectedDate, favCuisines: cuisine, excludedIngredients: exclusions, imagePrefs: { size: '1K', aspectRatio: '1:1' }
      });
      const updatedMeals = currentPlan.meals.map(m => m.id === mealId ? newMeal : m);
      await updateCurrentPlan({ meals: updatedMeals });
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPass) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
    } catch (e: any) {
      try {
        await createUserWithEmailAndPassword(auth, loginEmail, loginPass);
      } catch (e2: any) {
        setError("Błąd logowania: " + e.message);
      }
    } finally { setLoading(false); }
  };

  const handleLogout = () => signOut(auth);

  const fetchTesters = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("tester", "==", true));
      const snap = await getDocs(q);
      const testers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTesterStatus(testers);
      setShowAdminPanel(true);
    } catch (e) { setError("Brak uprawnień admina."); }
    finally { setLoading(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setScannerImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addScannedToDay = () => {
    if (!scannerResult) return;
    const newMeal: Meal = {
      ...scannerResult,
      id: Math.random().toString(36).substring(7),
      currentStep: 0,
      completed: true,
      ingredients: (scannerResult as Meal).ingredients || [],
      steps: (scannerResult as Meal).steps || ["Produkt zidentyfikowany przez Vision AI."],
      spices: (scannerResult as Meal).spices || [],
      inspiration: "Analiza wizualna",
      imageUrl: scannerImage || undefined,
      macros: (scannerResult as Meal).macros || { p: 0, f: 0, c: 0 },
      kcal: scannerResult.kcal || 0,
      name: scannerResult.name || "Nieznany produkt"
    } as Meal;

    const updatedExtraMeals = [...(currentPlan.extraMeals || []), newMeal];
    updateCurrentPlan({ extraMeals: updatedExtraMeals });
    
    setScannerResult(null);
    setScannerName("");
    setScannerWeight("");
    setScannerImage(null);
    setActiveTab('meals');
  };

  const handleScanAction = async () => {
    if (!scannerName && !scannerImage) return;
    setLoading(true);
    try {
      const result = await analyzeMealScan(scannerName, Number(scannerWeight) || 0, scannerImage || undefined);
      setScannerResult(result);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const addFridgeItem = () => {
    if (!newIngName.trim()) return;
    setFridgeItems([...fridgeItems, { name: newIngName.trim(), qty: newIngQty.trim() || "1", unit: newIngUnit }]);
    setNewIngName(""); setNewIngQty("");
  };

  const removeFridgeItem = (index: number) => setFridgeItems(fridgeItems.filter((_, i) => i !== index));

  const handleFridgeCreation = async () => {
    setLoading(true);
    try {
      const fridgeString = fridgeItems.map(i => `${i.name}: ${i.qty} ${i.unit}`).join(", ");
      await generateFridgeRecipe(fridgeString, 30, "Średnie", "Standard", {
        targetCalories: calculated.targetKcal, mealCount: 4, proteinPct: profile.goals.proteinPct, fatPct: profile.goals.fatPct, carbsPct: profile.goals.carbsPct, selectedDate, favCuisines: cuisine, excludedIngredients: exclusions, imagePrefs: { size: '1K', aspectRatio: '1:1' }
      });
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const rollCuisine = () => {
    const cs = ["Tajska", "Włoska", "Polska", "Meksykańska", "Indyjska", "Japońska"];
    setIsRolling(true);
    setTimeout(() => { setCuisine(cs[Math.floor(Math.random() * cs.length)]); setIsRolling(false); }, 600);
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center italic text-[#ff7a00] font-black text-xl">Inicjalizacja Logistyki...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-stone-100 flex flex-col items-center justify-center p-8 space-y-12">
        <header className="text-center">
          <h1 className="text-5xl logistic-font italic tracking-tighter">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
          <p className="text-[10px] text-stone-600 font-black uppercase tracking-[0.5em] mt-2 italic">Deep Night Logistics</p>
        </header>
        <div className="bg-[#161618] p-10 rounded-[3rem] border border-[#27272a] shadow-2xl w-full max-w-sm space-y-8 animate-in zoom-in duration-700">
           <h2 className="logistic-font text-2xl text-[#ff7a00] text-center italic">Logowanie do bazy</h2>
           <div className="space-y-4">
              <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full bg-[#0a0a0b] border border-[#27272a] p-5 rounded-2xl text-sm outline-none focus:border-[#ff7a00] font-bold italic" />
              <input type="password" placeholder="Hasło" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full bg-[#0a0a0b] border border-[#27272a] p-5 rounded-2xl text-sm outline-none focus:border-[#ff7a00] font-bold italic" />
           </div>
           <button onClick={handleLogin} className="w-full bg-[#ff7a00] text-black py-5 rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl active:scale-95 transition-all">Autoryzuj 🚀</button>
           <p className="text-[9px] text-stone-700 text-center uppercase font-black">Twoje dane są synchronizowane w czasie rzeczywistym.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100 flex flex-col max-w-xl mx-auto pb-40 relative">
      <header className="py-12 text-center sticky top-0 bg-[#0a0a0b]/90 backdrop-blur-xl z-50 border-b border-white/5 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
             <span className="text-[8px] font-black uppercase text-stone-600 tracking-widest">{user.email?.split('@')[0]}</span>
          </div>
          <h1 className="text-4xl logistic-font italic tracking-tighter ml-[-40px]">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
          <button onClick={handleLogout} className="text-stone-700 text-xl hover:text-red-500">🚪</button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-8">
        {activeTab === 'meals' && (
          <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
            <section className="bg-[#161618] p-10 rounded-[4rem] border border-[#27272a] shadow-2xl space-y-8 relative overflow-hidden">
              <div className="flex justify-between items-end relative z-10">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em] italic">Spożyte Paliwo</span>
                  <div className="logistic-font text-5xl text-[#ff7a00] flex items-baseline gap-2">
                    {Math.round(statsProgress.kcal)} <small className="text-lg lowercase font-bold text-stone-600">kcal</small>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em] italic">Pozostało</span>
                  <div className="logistic-font text-2xl text-stone-300">
                    {Math.max(0, calculated.targetKcal - Math.round(statsProgress.kcal))} <small className="text-xs ml-1 font-bold text-stone-600 uppercase">kcal</small>
                  </div>
                </div>
              </div>
              <div className="space-y-6 pt-4 border-t border-white/5 relative z-10">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-stone-500 italic tracking-widest">
                  <span>Cel Dzienny: {calculated.targetKcal} kcal</span>
                  <span className="text-[#ff7a00]">{Math.round((statsProgress.kcal / calculated.targetKcal) * 100)}%</span>
                </div>
                <div className="h-3 bg-[#0a0a0b] rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-[#ff7a00] to-orange-400 transition-all duration-1000 ease-in-out" style={{ width: `${Math.min(100, (statsProgress.kcal / calculated.targetKcal) * 100)}%` }} />
                </div>
                <div className="flex gap-6">
                  <MacroBar label="B" current={statsProgress.p} target={calculated.protein} color="#3b82f6" />
                  <MacroBar label="T" current={statsProgress.f} target={calculated.fat} color="#f59e0b" />
                  <MacroBar label="W" current={statsProgress.c} target={calculated.carbs} color="#10b981" />
                </div>
              </div>
            </section>

            <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-xl space-y-8">
               <h2 className="logistic-font text-xl text-[#ff7a00]">WODA I RUCH</h2>
               <div className="grid grid-cols-1 gap-6">
                  <div className="bg-[#0a0a0b] p-6 rounded-[2.5rem] border border-[#27272a] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-stone-600 uppercase tracking-widest italic">💧 Nawodnienie</span>
                        <div className="logistic-font text-4xl text-blue-400">
                          {currentPlan.waterCurrent} <span className="text-stone-700 text-sm">/ {currentPlan.dailyActivity.water.goalMl} ml</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => updateCurrentPlan({ waterCurrent: Math.max(0, currentPlan.waterCurrent - 250) })} className="w-12 h-12 bg-[#161618] border border-white/5 rounded-2xl font-black text-xl hover:bg-stone-800 transition-colors">-</button>
                        <button onClick={() => updateCurrentPlan({ waterCurrent: currentPlan.waterCurrent + 250 })} className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl font-black text-blue-400 text-xl hover:bg-blue-500/20 transition-colors">+</button>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0b] p-6 rounded-[2.5rem] border border-[#27272a] space-y-4">
                    <div className="flex justify-between items-center text-[9px] font-black text-stone-600 uppercase italic">
                      <span>👟 Logistyka Kroków</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[#ff7a00] font-black text-lg">{currentPlan.stepsCurrent}</span>
                        <span className="text-stone-700 font-bold">/ {currentPlan.dailyActivity.steps.goal}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#161618] rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-[#ff7a00] transition-all duration-700 shadow-[0_0_10px_rgba(255,122,0,0.3)]" style={{ width: `${Math.min(100, (currentPlan.stepsCurrent / (currentPlan.dailyActivity.steps.goal || 1)) * 100)}%` }} />
                    </div>
                    <input type="range" min="0" max={Math.max(20000, currentPlan.dailyActivity.steps.goal)} value={currentPlan.stepsCurrent} onChange={e => updateCurrentPlan({ stepsCurrent: Number(e.target.value) })} className="w-full accent-[#ff7a00]" />
                  </div>
               </div>
            </section>

            <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-2xl space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest flex justify-between italic">Kuchnia <button onClick={rollCuisine} className={isRolling ? 'animate-shake' : 'hover:scale-125 transition-transform'}>🎲</button></label>
                  <input value={cuisine} onChange={e => setCuisine(e.target.value)} className="w-full bg-[#0a0a0b] border border-[#27272a] p-3 rounded-xl font-bold text-xs outline-none focus:border-[#ff7a00] shadow-inner" placeholder="np. Tajska..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest italic">Alergeny</label>
                  <input value={exclusions} onChange={e => setExclusions(e.target.value)} className="w-full bg-[#0a0a0b] border border-[#27272a] p-3 rounded-xl font-bold text-xs outline-none focus:border-[#ff7a00] shadow-inner" placeholder="Brak..." />
                </div>
                <div className="space-y-2 col-span-2 pt-2">
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest italic flex justify-between">Ilość Posiłków 🍱 <span className="text-[#ff7a00] font-black">{mealCount}</span></label>
                  <div className="flex bg-[#0a0a0b] rounded-2xl p-1 border border-white/5">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button key={n} onClick={() => setMealCount(n)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mealCount === n ? 'bg-[#ff7a00] text-black shadow-lg' : 'text-stone-700 hover:text-stone-400'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleGenerate} className="w-full bg-[#ff7a00] text-black py-4 rounded-xl logistic-font text-sm shadow-xl active:scale-95 transition-all shadow-[#ff7a00]/20">LOGUJ PLAN 🚀</button>
            </section>

            <section className="space-y-8 pb-10">
              <h2 className="logistic-font text-lg text-stone-500 italic px-4 uppercase tracking-[0.4em]">Logistyka Planowana</h2>
              {currentPlan.meals.map((m: Meal) => {
                return (
                  <div key={m.id} className={`bg-[#161618] rounded-[3.5rem] overflow-hidden border transition-all duration-700 shadow-2xl ${m.completed ? 'border-emerald-500/50 opacity-60 scale-[0.98]' : 'border-[#27272a]'}`}>
                    <div className="relative h-48 w-full bg-[#0a0a0b] overflow-hidden border-b border-white/5">
                      {m.imageUrl ? (
                        <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover opacity-80" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl opacity-40 grayscale">
                          {m.icon || '🍽️'}
                        </div>
                      )}
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                         <span className="text-sm">{m.icon}</span>
                         <span className="text-[10px] font-black uppercase tracking-widest italic">{m.time} min</span>
                      </div>
                    </div>
                    <div className="p-10 flex items-center justify-between gap-6">
                      <div className="space-y-1">
                        <h3 className="logistic-font text-xl italic leading-none">{m.name}</h3>
                        <div className="text-[10px] font-black text-stone-600 uppercase tracking-widest">{m.kcal} kcal</div>
                      </div>
                      <button onClick={() => toggleMealCompleted(m.id)} className={`w-12 h-12 rounded-full border flex items-center justify-center text-xl transition-all ${m.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/10 text-white/20'}`}>{m.completed ? '✓' : ''}</button>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="space-y-10 animate-in scale-95 duration-500 pb-40">
            <section className="bg-[#161618] p-12 rounded-[4rem] border border-[#27272a] text-center space-y-12">
               <div className="w-40 h-40 bg-[#0a0a0b] rounded-full flex items-center justify-center mx-auto border border-[#ff7a00]/20 shadow-2xl relative overflow-hidden group">
                  {scannerImage ? <img src={scannerImage} className="w-full h-full object-cover" /> : <span className="text-7xl group-hover:scale-110 transition-transform">📷</span>}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
               </div>
               <div className="space-y-6">
                  <h2 className="logistic-font text-4xl text-[#ff7a00] italic">Skaner Vision AI</h2>
                  <p className="text-stone-500 text-[10px] italic uppercase font-black tracking-widest">Analiza teksturalna Online</p>
               </div>
               <div className="space-y-5 text-left">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-600 tracking-widest italic ml-4">Nazwa Dania</label>
                    <input value={scannerName} onChange={e => setScannerName(e.target.value)} placeholder="np. Burger..." className="w-full bg-[#0a0a0b] border border-[#27272a] p-5 rounded-3xl text-sm outline-none focus:border-[#ff7a00] font-bold italic" />
                  </div>
                  <button onClick={handleScanAction} className="w-full bg-[#ff7a00] text-black py-7 rounded-[3rem] logistic-font text-lg shadow-2xl active:scale-95 transition-all">INICJUJ SKANER ⚙️</button>
               </div>
            </section>
            {scannerResult && (
              <section className="bg-[#161618] rounded-[4rem] border border-[#ff7a00]/40 p-10 space-y-8 animate-in zoom-in duration-500 shadow-xl">
                 <div className="flex items-center gap-6">
                    <div className="text-6xl">{scannerResult.icon}</div>
                    <div className="space-y-1">
                       <h3 className="logistic-font text-3xl italic leading-none">{scannerResult.name}</h3>
                       <p className="text-[#ff7a00] font-black text-xl italic">{scannerResult.kcal} kcal</p>
                    </div>
                 </div>
                 <button onClick={addScannedToDay} className="w-full bg-[#ff7a00] text-black py-6 rounded-[2.5rem] logistic-font text-sm">DODAJ DO DNIA 🍽️</button>
              </section>
            )}
          </div>
        )}

        {activeTab === 'body' && (
          <div className="space-y-10 animate-in slide-in-from-bottom duration-500 pb-40">
            <section className="bg-[#161618] p-10 rounded-[4rem] border border-[#27272a] shadow-3xl space-y-10">
              <div className="flex justify-between items-start">
                <h2 className="logistic-font text-4xl text-[#ff7a00] italic leading-tight">Status<br/>Biologiczny</h2>
                <div className="text-right p-8 bg-[#0a0a0b] rounded-[3rem] border border-white/5 flex flex-col items-center">
                  <div className="text-[10px] font-black text-stone-600 uppercase tracking-widest italic mb-2">BMI</div>
                  <div className="logistic-font text-6xl" style={{ color: calculated.bmiColor }}>{calculated.bmi}</div>
                  <div className="text-[10px] font-black uppercase mt-4 px-6 py-2 rounded-full" style={{ backgroundColor: `${calculated.bmiColor}15`, color: calculated.bmiColor }}>{calculated.bmiLabel}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-600 tracking-widest italic ml-2">Płeć</label>
                  <div className="flex bg-[#0a0a0b] rounded-2xl p-1 border border-white/5">
                    <button onClick={() => setProfile(p => ({ ...p, bio: { ...p.bio, gender: 'male' } }))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${profile.bio.gender === 'male' ? 'bg-[#ff7a00] text-black' : 'text-stone-700'}`}>M</button>
                    <button onClick={() => setProfile(p => ({ ...p, bio: { ...p.bio, gender: 'female' } }))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${profile.bio.gender === 'female' ? 'bg-[#ff7a00] text-black' : 'text-stone-700'}`}>K</button>
                  </div>
                </div>
                {[{ label: 'Wiek', key: 'age' }, { label: 'Masa (KG)', key: 'weight' }, { label: 'Wzrost (CM)', key: 'height' }].map(f => (
                  <div key={f.key} className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-600 tracking-widest italic ml-2">{f.label}</label>
                    <input type="number" value={(profile.bio as any)[f.key]} onChange={e => setProfile(p => ({ ...p, bio: { ...p.bio, [f.key]: Number(e.target.value) } }))} className="w-full bg-[#0a0a0b] border border-[#27272a] p-4 rounded-2xl font-black text-xl text-stone-300 outline-none text-center" />
                  </div>
                ))}
              </div>
              
              {user.email === ADMIN_EMAIL && (
                <button onClick={fetchTesters} className="w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all">PANEL ADMINA 🛡️</button>
              )}
            </section>
            
            <section className="bg-[#161618] p-10 rounded-[4rem] border border-[#27272a] shadow-3xl space-y-10">
              <h2 className="logistic-font text-3xl text-[#ff7a00] italic">Cel Wagi</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-600 tracking-widest italic ml-2">Waga Startowa (kg)</label>
                  <input type="number" value={profile.goals.weightStart || 0} onChange={e => setProfile(p => ({ ...p, goals: { ...p.goals, weightStart: Number(e.target.value) } }))} className="w-full bg-[#0a0a0b] border border-[#27272a] p-4 rounded-2xl font-black text-xl text-stone-300 outline-none text-center" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-stone-600 tracking-widest italic ml-2">Waga Docelowa (kg)</label>
                  <input type="number" value={profile.goals.weightTarget || 0} onChange={e => setProfile(p => ({ ...p, goals: { ...p.goals, weightTarget: Number(e.target.value) } }))} className="w-full bg-[#0a0a0b] border border-[#27272a] p-4 rounded-2xl font-black text-xl text-stone-300 outline-none text-center" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-stone-500 italic tracking-widest"><span>Postęp Celu</span><span className="text-[#ff7a00]">{Math.round(calculated.weightProgress)}%</span></div>
                <div className="h-4 bg-[#0a0a0b] rounded-full overflow-hidden border border-white/5 p-1 shadow-inner"><div className="h-full bg-[#ff7a00] rounded-full transition-all duration-1000 ease-in-out" style={{ width: `${calculated.weightProgress}%` }} /></div>
              </div>
            </section>

            <section className="bg-[#161618] p-10 rounded-[4rem] border border-[#27272a] shadow-3xl space-y-10">
              <h2 className="logistic-font text-3xl text-[#ff7a00] italic">Inżynieria Makro</h2>
              <div className="flex gap-4 p-2 bg-[#0a0a0b] rounded-3xl border border-white/5">
                {['cut', 'maintain', 'bulk'].map(g => (
                  <button key={g} onClick={() => setProfile(p => ({ ...p, goals: { ...p.goals, currentGoal: g as any, correction: g === 'cut' ? -300 : g === 'bulk' ? 300 : 0 } }))} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] transition-all duration-500 ${profile.goals.currentGoal === g ? 'bg-[#ff7a00] text-black shadow-lg' : 'text-stone-600'}`}>{g === 'cut' ? 'Redukcja' : g === 'bulk' ? 'Masa' : 'Utrzymanie'}</button>
                ))}
              </div>
              <div className="space-y-8 bg-[#0a0a0b] p-8 rounded-[3rem] border border-white/5 shadow-inner">
                {[{ label: 'Białko', key: 'proteinPct', color: 'accent-blue-500' }, { label: 'Tłuszcz', key: 'fatPct', color: 'accent-amber-500' }, { label: 'Węglowodany', key: 'carbsPct', color: 'accent-emerald-500' }].map(m => (
                  <div key={m.key} className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase text-stone-600 italic tracking-widest"><span>{m.label}</span><span className="text-[#ff7a00]">{(profile.goals as any)[m.key]}%</span></div>
                    <input type="range" min="0" max="100" value={(profile.goals as any)[m.key]} onChange={e => setProfile(p => ({ ...p, goals: { ...p.goals, [m.key]: Number(e.target.value) } }))} className={`w-full ${m.color}`} />
                  </div>
                ))}
                <div className="text-center py-4 bg-[#ff7a00]/5 border border-[#ff7a00]/10 rounded-2xl"><span className="text-[12px] font-black uppercase text-[#ff7a00] tracking-widest italic">Cel: {calculated.targetKcal} Kcal</span></div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'ingredients' && (
          <div className="space-y-12 animate-in slide-in-from-bottom duration-500 pb-40">
            <section className="bg-[#161618] p-12 rounded-[4rem] border border-[#27272a] shadow-4xl space-y-12 text-center">
              <div className="w-24 h-24 bg-[#0a0a0b] rounded-full flex items-center justify-center border border-[#ff7a00]/20 mx-auto text-5xl">📦</div>
              <h2 className="logistic-font text-3xl text-[#ff7a00] italic">Moja Lodówka</h2>
              <div className="space-y-4">
                <input value={newIngName} onChange={e => setNewIngName(e.target.value)} placeholder="Produkt..." className="w-full bg-[#0a0a0b] border border-[#27272a] p-5 rounded-2xl text-sm outline-none font-bold italic" />
                <button onClick={addFridgeItem} className="w-full bg-[#ff7a00] text-black py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest">Dopisz +</button>
              </div>
              <div className="flex flex-wrap gap-3 pt-6">
                {fridgeItems.map((it, i) => <div key={i} className="bg-[#0a0a0b] border border-white/5 px-6 py-3 rounded-full text-[11px] italic flex items-center gap-4 group"><span>{it.name}</span><button onClick={() => removeFridgeItem(i)} className="text-stone-700 hover:text-red-500">✕</button></div>)}
              </div>
              <button onClick={handleFridgeCreation} className="w-full bg-[#ff7a00] text-black py-7 rounded-[3rem] logistic-font text-lg">Generuj ZERO WASTE ⚡</button>
            </section>
          </div>
        )}
      </main>

      {showAdminPanel && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[200] p-10 flex flex-col space-y-10 animate-in fade-in duration-500 overflow-y-auto">
           <div className="flex justify-between items-center">
             <h2 className="logistic-font text-3xl text-[#ff7a00] italic">Panel Zarządzania Testerami</h2>
             <button onClick={() => setShowAdminPanel(false)} className="text-stone-500 text-4xl">✕</button>
           </div>
           <div className="space-y-4">
             {testerStatus.map((t, idx) => (
               <div key={t.id} className="bg-[#161618] border border-[#27272a] p-6 rounded-3xl flex justify-between items-center shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#0a0a0b] rounded-full flex items-center justify-center text-[10px] font-black text-stone-500">{idx + 1}</div>
                    <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase text-stone-600">ID: {t.id.substring(0,8)}...</div>
                        <div className="text-xs font-bold italic text-stone-300">Tester Anonimowy</div>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase ${t.planCompleted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {t.planCompleted ? 'Plan Wypełniony' : 'Oczekiwanie'}
                  </div>
               </div>
             ))}
             {testerStatus.length === 0 && <p className="text-center text-stone-700 italic">Brak zarejestrowanych testerów.</p>}
           </div>
        </div>
      )}

      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 flex bg-[#161618]/95 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-3 shadow-2xl z-50">
        {[{ id: 'meals', icon: '🍴', label: 'PLAN' }, { id: 'scanner', icon: '📷', label: 'SKAN' }, { id: 'body', icon: '⚖️', label: 'BIO' }, { id: 'ingredients', icon: '📦', label: 'SKŁAD' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-8 py-5 flex flex-col items-center gap-2 transition-all duration-700 rounded-[3.5rem] relative ${activeTab === t.id ? 'bg-[#ff7a00] text-black shadow-xl scale-[1.1]' : 'text-stone-700'}`}>
            <span className="text-2xl">{t.icon}</span>
            <span className="text-[8px] font-black uppercase tracking-widest italic">{t.label}</span>
          </button>
        ))}
      </nav>

      {loading && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[250] flex flex-col items-center justify-center p-12 space-y-14">
          <div className="relative w-40 h-40">
            <div className="absolute inset-0 border-[8px] border-[#ff7a00]/10 rounded-full" />
            <div className="absolute inset-0 border-[8px] border-[#ff7a00] border-t-transparent rounded-full animate-spin" />
          </div>
          <h3 className="logistic-font text-5xl italic text-[#ff7a00] tracking-tighter animate-pulse text-center">Analiza AI...</h3>
        </div>
      )}

      {error && <div className="fixed top-12 left-1/2 -translate-x-1/2 bg-[#ff7a00] text-black px-12 py-6 rounded-full font-black uppercase text-[11px] z-[260] shadow-2xl animate-bounce">{error}</div>}
    </div>
  );
}
