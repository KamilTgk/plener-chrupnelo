import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { generateMealPlan, analyzeMealScan, generateRecipeFromInventory } from './geminiService';
import { DayPlan, BioProfile } from './types';

// KONFIGURACJA FIREBASE
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

const WORLD_CUISINES = ["Polska", "Włoska", "Meksykańska", "Indyjska", "Azjatycka", "Japońska", "Francuska", "Grecka"];
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

  // --- STANY MAGAZYNU ---
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
    goals: { targetKcal: 2500, proteinPct: 30, fatPct: 25, carbsPct: 45, currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 }
  });
  const [water, setWater] = useState({ current: 0, target: 2500 });
  const [steps, setSteps] = useState({ current: 0, target: 10000 });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  useEffect(() => {
    const d = { p: localStorage.getItem('pl_p'), pr: localStorage.getItem('pl_pr'), w: localStorage.getItem('pl_w'), s: localStorage.getItem('pl_s'), i: localStorage.getItem('pl_i'), r: localStorage.getItem('pl_r') };
    if (d.p) setPlans(JSON.parse(d.p));
    if (d.pr) setProfile(JSON.parse(d.pr));
    if (d.w) setWater(JSON.parse(d.w));
    if (d.s) setSteps(JSON.parse(d.s));
    if (d.i) setInventory(JSON.parse(d.i));
    if (d.r) setSavedRecipes(JSON.parse(d.r));
  }, []);

  useEffect(() => {
    localStorage.setItem('pl_p', JSON.stringify(plans));
    localStorage.setItem('pl_pr', JSON.stringify(profile));
    localStorage.setItem('pl_w', JSON.stringify(water));
    localStorage.setItem('pl_s', JSON.stringify(steps));
    localStorage.setItem('pl_i', JSON.stringify(inventory));
    localStorage.setItem('pl_r', JSON.stringify(savedRecipes));
  }, [plans, profile, water, steps, inventory, savedRecipes]);

  const calculated = useMemo(() => {
    const { weight, height, age, gender, activity } = profile.bio;
    const { proteinPct, fatPct, carbsPct, correction } = profile.goals;
    const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
    const s = gender === 'male' ? 5 : -161;
    const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + s);
    const tdee = Math.round(bmr * activity);
    const totalTarget = tdee + correction;
    return { bmi, totalTarget, proteinG: Math.round((totalTarget * (proteinPct / 100)) / 4), fatG: Math.round((totalTarget * (fatPct / 100)) / 9), carbsG: Math.round((totalTarget * (carbsPct / 100)) / 4), isPctValid: (proteinPct + fatPct + carbsPct) === 100, bmiColor: bmi < 25 ? '#10b981' : '#ef4444' };
  }, [profile]);

  const handleAuth = () => signInWithEmailAndPassword(auth, "tester1@chrupnelo.pl", pass).catch(() => alert("Błąd hasła"));
  
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const plan = await generateMealPlan({ targetCalories: calculated.totalTarget, cuisine, mealCount });
      setPlans({...plans, [selectedDate]: plan});
    } catch (e) { alert("Błąd AI"); } finally { setLoading(false); }
  };

  const currentPlan = plans[selectedDate] || { meals: [], totalKcal: 0 };
  const consumedStats = (currentPlan.meals || []).reduce((acc: any, meal: any) => {
    if (meal.completed) {
      return { kcal: acc.kcal + meal.kcal, p: acc.p + meal.protein, f: acc.f + meal.fat, c: acc.c + meal.carbs };
    }
    return acc;
  }, { kcal: 0, p: 0, f: 0, c: 0 });

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl italic font-black mb-8 italic">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <input type="password" placeholder="Hasło" className="bg-[#161618] p-4 rounded-xl mb-4 text-center border border-white/10" value={pass} onChange={e => setPass(e.target.value)} />
        <button onClick={handleAuth} className="bg-[#ff7a00] text-black px-10 py-4 rounded-xl font-bold uppercase">Wjedź 🚀</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col max-w-xl mx-auto pb-44">
      <header className="p-10 flex flex-col items-center sticky top-0 bg-[#0a0a0b]/90 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <button onClick={() => signOut(auth)} className="absolute right-6 top-10 text-[8px] text-stone-600 font-bold uppercase">Logout</button>
      </header>

      <main className="p-6 space-y-6">
        {activeTab === 'meals' && (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
             <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] space-y-4">
                <input placeholder="Kuchnia..." value={cuisine} onChange={e => setCuisine(e.target.value)} className="w-full bg-[#0a0a0b] p-4 rounded-2xl text-center border border-white/5" />
                <button onClick={handleGenerate} className="w-full bg-[#ff7a00] text-black py-5 rounded-3xl font-black uppercase text-xs">Generuj Plan AI 🚀</button>
             </section>
             <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] space-y-6 text-center">
                <span className="text-[9px] font-black text-stone-500 uppercase">Spożycie Realne</span>
                <div className="text-5xl text-[#ff7a00] font-black italic">{Math.round(consumedStats.kcal)} / {calculated.totalTarget}</div>
                <div className="flex gap-4">
                  <MacroBar label="B" current={consumedStats.p} target={calculated.proteinG} color="#3b82f6" />
                  <MacroBar label="T" current={consumedStats.f} target={calculated.fatG} color="#f59e0b" />
                  <MacroBar label="W" current={consumedStats.c} target={calculated.carbsG} color="#10b981" />
                </div>
             </section>
             {currentPlan.meals.map((meal: any, idx: number) => (
                <div key={idx} className={`bg-[#161618] p-6 rounded-[2.5rem] border transition-all ${meal.completed ? 'border-emerald-500 opacity-60' : 'border-[#27272a]'}`}>
                  <div className="flex justify-between items-center">
                    <h4 className="font-black italic text-stone-200">{meal.name}</h4>
                    <button onClick={() => {
                        const nm = [...currentPlan.meals]; nm[idx].completed = !nm[idx].completed;
                        setPlans({...plans, [selectedDate]: {...currentPlan, meals: nm}});
                    }} className="text-xs font-black uppercase text-[#ff7a00]">{meal.completed ? '✓' : 'Zjedz'}</button>
                  </div>
                  <p className="text-[10px] text-stone-500">{meal.kcal} kcal | B:{meal.protein} T:{meal.fat} W:{meal.carbs}</p>
                </div>
             ))}
          </div>
        )}

        {/* SKANER */}
        {activeTab === 'scanner' && (
          <div className="space-y-6 animate-in zoom-in duration-500">
             <section className="bg-[#161618] p-8 rounded-[3rem] border border-[#27272a] text-center space-y-6">
                <div className="w-32 h-32 bg-black rounded-full mx-auto flex items-center justify-center border-2 border-dashed border-[#ff7a00]/30 relative overflow-hidden">
                   {selectedImage ? <img src={selectedImage} className="w-full h-full object-cover" /> : <span className="text-4xl">📷</span>}
                   <input type="file" accept="image/*" onChange={e => { const r = new FileReader(); r.onload = () => setSelectedImage(r.result as string); if(e.target.files?.[0]) r.readAsDataURL(e.target.files[0]); }} className="absolute inset-0 opacity-0" />
                </div>
                <button onClick={async () => { setLoading(true); try { const r = await analyzeMealScan(selectedImage || "", manualFood, manualWeight); setScanResult(r); } catch(e) { alert("Błąd"); } finally { setLoading(false); } }} className="w-full bg-[#ff7a00] text-black py-5 rounded-3xl font-black uppercase">Analizuj AI ⚙️</button>
                {scanResult && <div className="bg-black p-6 rounded-3xl border border-[#ff7a00]/30"><div className="text-2xl font-black italic text-[#ff7a00]">{scanResult.kcal} kcal</div></div>}
             </section>
          </div>
        )}

        {/* BIO */}
        {activeTab === 'body' && (
          <div className="space-y-6 animate-in slide-in-from-right">
             <section className="bg-[#161618] p-8 rounded-[3rem] border border-[#27272a] text-center">
                <div className="text-[10px] font-black text-stone-500 uppercase mb-2">Twoje BMI</div>
                <div className="text-5xl font-black italic" style={{ color: calculated.bmiColor }}>{calculated.bmi}</div>
                <input type="range" min="50" max="120" step="0.5" value={profile.bio.weight} onChange={e => setProfile({...profile, bio: {...profile.bio, weight: parseFloat(e.target.value)}})} className="w-full h-1 accent-[#ff7a00] bg-black appearance-none mt-8" />
                <div className="text-xs font-black uppercase mt-2">Waga: {profile.bio.weight} kg</div>
             </section>
          </div>
        )}

        {/* MAGAZYN */}
        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <section className="bg-[#161618] p-8 rounded-[3rem] border border-[#27272a] space-y-4">
               <div className="flex gap-2">
                 <input placeholder="Produkt..." value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="flex-1 bg-black p-4 rounded-xl border border-white/5" />
                 <button onClick={() => { setInventory([...inventory, newItem]); setNewItem({name: '', weight: ''}); }} className="bg-[#ff7a00] text-black px-6 rounded-xl font-bold">+</button>
               </div>
               <button onClick={async () => { setLoading(true); try { const r = await generateRecipeFromInventory(inventory); setSavedRecipes([r, ...savedRecipes]); } catch(e) { alert("Błąd"); } finally { setLoading(false); } }} className="w-full bg-white text-black py-4 rounded-xl font-black text-xs uppercase">Generuj z lodówki 👨‍🍳</button>
            </section>
            {savedRecipes.map((r, i) => <div key={i} className="bg-[#161618] p-6 rounded-3xl border border-[#27272a]"><h5 className="font-black italic text-[#ff7a00]">{r.name}</h5><p className="text-[10px] text-stone-400 mt-2">{r.instructions?.join(" ")}</p></div>)}
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 flex bg-[#161618]/95 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-2 shadow-2xl z-50">
        {[ { id: 'meals', i: '🍴', l: 'PLAN' }, { id: 'scanner', i: '📷', l: 'SKAN' }, { id: 'body', i: '⚖️', l: 'BIO' }, { id: 'inventory', i: '📦', l: 'MAGAZYN' } ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-6 py-4 rounded-[2.5rem] flex flex-col items-center gap-1 transition-all ${activeTab === t.id ? 'bg-[#ff7a00] text-black shadow-lg shadow-orange-500/20' : 'text-stone-600'}`}>
            <span className="text-xl">{t.i}</span>
            <span className="text-[7px] font-black uppercase">{t.l}</span>
          </button>
        ))}
      </nav>

      {loading && (
        <div className="fixed inset-0 bg-black/90 z-[1000] flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#ff7a00] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#ff7a00] text-[10px] font-black uppercase animate-pulse">Analizuję dane...</p>
        </div>
      )}
    </div>
  );
}
