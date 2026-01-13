import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { generateMealPlan, analyzeMealScan, generateRecipeFromInventory } from './geminiService';
import { DayPlan, BioProfile } from './types';

// --- CONFIG FIREBASE ---
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

const WORLD_CUISINES = ["Polska", "Włoska", "Meksykańska", "Indyjska", "Azjatycka", "Japońska", "Francuska", "Grecka", "Amerykańska"];
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

  // STANY DANYCH
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

  // LOGOWANIE
  useEffect(() => { return onAuthStateChanged(auth, (u) => setUser(u || null)); }, []);
  const handleAuth = () => signInWithEmailAndPassword(auth, "tester1@chrupnelo.pl", pass).catch(() => alert("Błąd hasła!"));

  // PERSYSTENCJA
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

  // OBLICZENIA
  const calculated = useMemo(() => {
    const { weight, height, age, gender, activity } = profile.bio;
    const { proteinPct, fatPct, carbsPct, correction } = profile.goals;
    const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
    let bmiColor = bmi < 25 ? '#10b981' : '#ef4444';
    const s = gender === 'male' ? 5 : -161;
    const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + s);
    const tdee = Math.round(bmr * activity);
    const totalTarget = tdee + correction;
    return { bmi, bmiColor, totalTarget, proteinG: Math.round((totalTarget * (proteinPct / 100)) / 4), fatG: Math.round((totalTarget * (fatPct / 100)) / 9), carbsG: Math.round((totalTarget * (carbsPct / 100)) / 4), isPctValid: (proteinPct + fatPct + carbsPct) === 100 };
  }, [profile]);

  const currentPlan = plans[selectedDate] || { meals: [], totalKcal: 0 };
  const consumedStats = (currentPlan.meals || []).reduce((acc: any, meal: any) => {
    if (meal.completed) return { kcal: acc.kcal + meal.kcal, p: acc.p + meal.protein, f: acc.f + meal.fat, c: acc.c + meal.carbs };
    return acc;
  }, { kcal: 0, p: 0, f: 0, c: 0 });

  const shoppingList = Array.from(new Set((currentPlan.meals || []).flatMap((m: any) => m.ingredients || [])));

  // HANDLERY
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const plan = await generateMealPlan({ targetCalories: calculated.totalTarget, goalMode: profile.goals.currentGoal, proteinPct: profile.goals.proteinPct, fatPct: profile.goals.fatPct, carbsPct: profile.goals.carbsPct, cuisine, mealCount });
      setPlans(prev => ({ ...prev, [selectedDate]: plan }));
    } catch (e) { alert("Błąd AI"); } finally { setLoading(false); }
  };

  const handleSmartScan = async () => {
    if (!selectedImage && !manualFood) return alert("Dodaj dane!");
    setLoading(true);
    try {
      const result = await analyzeMealScan(selectedImage || "", manualFood, manualWeight);
      setScanResult(result);
    } catch (e) { alert("Błąd Skanera"); } finally { setLoading(false); }
  };

  const generateFromStock = async () => {
    if (inventory.length === 0) return alert("Pusta lodówka!");
    setLoading(true);
    try {
      const recipe = await generateRecipeFromInventory(inventory);
      setSavedRecipes([recipe, ...savedRecipes]);
    } catch (e) { alert("Błąd AI"); } finally { setLoading(false); }
  };

  const handleAddToPlan = (targetDate: string, mealIndex: number) => {
    const recipe = planModal.recipe; if (!recipe) return;
    setPlans(prev => {
        const currentMeals = prev[targetDate]?.meals || Array(mealCount).fill(null).map((_, i) => ({ name: `Pusty ${i+1}`, kcal: 0, protein: 0, fat: 0, carbs: 0, completed: false }));
        if (mealIndex >= 0) currentMeals[mealIndex] = { ...recipe, completed: false }; else currentMeals.push({ ...recipe, completed: false });
        return { ...prev, [targetDate]: { ...prev[targetDate], meals: currentMeals } };
    });
    setPlanModal({show: false, recipe: null});
  };

  const setStrategy = (mode: string, val: number) => {
    setProfile(prev => ({ ...prev, goals: { ...prev.goals, currentGoal: mode as any, correction: val } }));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl italic font-black mb-8">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <input type="password" placeholder="Hasło" className="bg-[#161618] p-5 rounded-2xl mb-4 text-center border border-white/5 outline-none focus:border-[#ff7a00]" value={pass} onChange={e => setPass(e.target.value)} />
        <button onClick={handleAuth} className="bg-[#ff7a00] text-black px-10 py-4 rounded-xl font-black uppercase tracking-widest">WJEDŹ 🚀</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col max-w-xl mx-auto pb-44 text-center relative selection:bg-[#ff7a00]/30">
      <header className="p-10 flex flex-col items-center sticky top-0 bg-[#0a0a0b]/90 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <button onClick={() => signOut(auth)} className="absolute right-6 top-10 text-[8px] text-stone-600 font-bold uppercase hover:text-white">Logout</button>
      </header>

      <main className="p-6 space-y-6">
        {/* ZAKŁADKA PLAN */}
        {activeTab === 'meals' && (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
             <div className="flex justify-between items-center bg-[#161618] p-4 rounded-3xl border border-white/5">
                <button onClick={() => { const x = new Date(selectedDate); x.setDate(x.getDate()-1); setSelectedDate(x.toISOString().split('T')[0]); }} className="text-stone-500 px-4">←</button>
                <span className="font-black italic text-[#ff7a00] uppercase tracking-widest">{selectedDate}</span>
                <button onClick={() => { const x = new Date(selectedDate); x.setDate(x.getDate()+1); setSelectedDate(x.toISOString().split('T')[0]); }} className="text-stone-500 px-4">→</button>
             </div>
             
             <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-2xl space-y-6">
                <input placeholder="Kuchnia świata..." value={cuisine} onChange={e => setCuisine(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic text-center outline-none focus:border-[#ff7a00]" />
                <button onClick={handleGenerate} className="w-full bg-[#ff7a00] text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Generuj Jadłospis AI 🚀</button>
             </section>

             <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] space-y-6 text-left">
                <div className="flex justify-between items-end px-2">
                    <div><span className="text-[9px] font-black text-stone-500 uppercase italic">Spożycie</span><div className="text-4xl text-[#ff7a00] font-black italic">{Math.round(consumedStats.kcal)} / {calculated.totalTarget}</div></div>
                </div>
                <div className="flex gap-4">
                  <MacroBar label="BIAŁKO" current={consumedStats.p} target={calculated.proteinG} color="#3b82f6" />
                  <MacroBar label="TŁUSZCZ" current={consumedStats.f} target={calculated.fatG} color="#f59e0b" />
                  <MacroBar label="WĘGLE" current={consumedStats.c} target={calculated.carbsG} color="#10b981" />
                </div>
             </section>

             {currentPlan.meals.map((m: any, i: number) => (
                <div key={i} className={`bg-[#161618] p-6 rounded-[2.5rem] border transition-all ${m.completed ? 'border-emerald-500/40 opacity-60' : 'border-[#27272a]'}`}>
                  <div className="flex justify-between items-center">
                    <div><h4 className="text-[9px] font-black uppercase text-stone-500">Posiłek {i+1}</h4><h4 className={`font-black italic text-lg ${m.completed ? 'text-emerald-400 line-through' : 'text-stone-200'}`}>{m.name}</h4></div>
                    <button onClick={() => { const nm = [...currentPlan.meals]; nm[i].completed = !nm[i].completed; setPlans({...plans, [selectedDate]: {...currentPlan, meals: nm}}); }} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black ${m.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-stone-700 text-transparent hover:border-[#ff7a00]'}`}>✓</button>
                  </div>
                  <p className="text-[10px] text-stone-600 font-bold uppercase mt-1 tracking-widest text-left">{m.kcal} kcal | B:{m.protein} T:{m.fat} W:{m.carbs}</p>
                </div>
             ))}
             
             {shoppingList.length > 0 && <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-white/5 text-left"><h3 className="text-[9px] font-black text-[#ff7a00] uppercase mb-4 text-center tracking-widest">Lista Zakupów</h3><div className="grid grid-cols-2 gap-3">{shoppingList.map((it, i) => <div key={i} className="text-[10px] text-stone-400 flex gap-2"><span>-</span>{it}</div>)}</div></section>}
          </div>
        )}

        {/* ZAKŁADKA SKAN */}
        {activeTab === 'scanner' && (
          <div className="space-y-6 animate-in zoom-in duration-500">
             <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] shadow-2xl space-y-8 text-center">
                <div className="w-40 h-40 bg-black rounded-full mx-auto flex items-center justify-center border-2 border-dashed border-[#ff7a00]/30 relative overflow-hidden">
                   {selectedImage ? <img src={selectedImage} className="w-full h-full object-cover" /> : <span className="text-5xl">📷</span>}
                   <input type="file" accept="image/*" onChange={e => { const r = new FileReader(); r.onload = () => setSelectedImage(r.result as string); if(e.target.files?.[0]) r.readAsDataURL(e.target.files[0]); }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                </div>
                <div className="space-y-4">
                    <input placeholder="Co jesz?" value={manualFood} onChange={e => setManualFood(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic text-center outline-none focus:border-[#ff7a00]" />
                    <input type="number" placeholder="Waga (g)" value={manualWeight} onChange={e => setManualWeight(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic text-center outline-none focus:border-[#ff7a00]" />
                </div>
                <button onClick={handleSmartScan} className="w-full bg-[#ff7a00] text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Analizuj AI ⚙️</button>
                {scanResult && (
                    <div className="bg-black p-8 rounded-[3rem] border border-[#ff7a00]/20 animate-in slide-in-from-top">
                        <h3 className="text-[#ff7a00] font-black italic text-xl uppercase mb-2">{scanResult.name}</h3>
                        <div className="text-4xl font-black italic mb-4">{scanResult.kcal} <small className="text-xs">kcal</small></div>
                        <div className="grid grid-cols-3 gap-2">{[{l:'B',v:scanResult.protein},{l:'T',v:scanResult.fat},{l:'W',v:scanResult.carbs}].map(m=><div key={m.l} className="bg-[#161618] p-3 rounded-xl text-[10px] font-black uppercase text-stone-400"><span className="text-white">{m.l}</span>: {m.v}g</div>)}</div>
                    </div>
                )}
             </section>
          </div>
        )}

        {/* ZAKŁADKA BIO */}
        {activeTab === 'body' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
             <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] flex justify-around shadow-2xl items-center">
                <div className="text-center"><span className="text-[8px] text-stone-600 font-black uppercase block mb-1 tracking-widest">BMI</span><div className="text-4xl font-black italic" style={{ color: calculated.bmiColor }}>{calculated.bmi}</div></div>
                <div className="text-center"><span className="text-[8px] text-stone-600 font-black uppercase block mb-1 tracking-widest">Cel</span><div className="text-4xl font-black italic text-[#ff7a00]">{calculated.totalTarget}</div></div>
             </section>
             <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] space-y-10 shadow-2xl">
                <div className="space-y-8 px-2">
                    {[{l:'Waga', k:'weight', u:'kg', min:40, max:150, s:0.5}, {l:'Wzrost', k:'height', u:'cm', min:140, max:220, s:1}, {l:'Wiek', k:'age', u:'lat', min:15, max:90, s:1}].map(i => (
                        <div key={i.k} className="space-y-3 text-left">
                            <div className="flex justify-between font-black uppercase text-[10px] text-stone-500 italic tracking-widest"><span>{i.l}</span><span className="text-white text-lg">{(profile.bio as any)[i.k]} {i.u}</span></div>
                            <input type="range" min={i.min} max={i.max} step={i.s} value={(profile.bio as any)[i.k]} onChange={e => setProfile({...profile, bio: {...profile.bio, [i.k]: parseFloat(e.target.value)}})} className="w-full h-1 accent-[#ff7a00] bg-[#0a0a0b] appearance-none cursor-pointer rounded-full" />
                        </div>
                    ))}
                </div>
                <div className="space-y-6 pt-4 border-t border-white/5">
                    <label className="text-[9px] font-black text-stone-500 uppercase block text-center tracking-widest">Strategia Wagowa</label>
                    <div className="flex bg-[#0a0a0b] p-1 rounded-2xl border border-white/5">
                        {[{l:'Redukcja',v:-300,m:'cut'},{l:'Utrzymanie',v:0,m:'maintain'},{l:'Masa',v:300,m:'bulk'}].map(s => (
                            <button key={s.m} onClick={() => setStrategy(s.m, s.v)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${profile.goals.currentGoal === s.m ? 'bg-[#ff7a00] text-black shadow-lg' : 'text-stone-600'}`}>{s.l}</button>
                        ))}
                    </div>
                </div>
             </section>
          </div>
        )}
        
        {/* ZAKŁADKA MAGAZYN */}
        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
            <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-2xl space-y-6 text-center">
              <div className="flex items-center gap-3 justify-center"><span className="text-2xl">🧊</span><h3 className="text-lg font-black italic uppercase tracking-widest">Lodówka</h3></div>
              <div className="flex gap-2">
                <input placeholder="Produkt..." value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="flex-[2] bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic text-center outline-none focus:border-[#ff7a00]" />
                <button onClick={addToInventory} className="bg-[#ff7a00] text-black w-12 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">+</button>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">{inventory.map((it, idx) => (<div key={idx} className="bg-[#0a0a0b] px-4 py-2 rounded-full border border-white/10 text-[9px] font-bold flex gap-2 items-center"><span className="text-stone-300">{it.name}</span><button onClick={() => setInventory(inventory.filter((_, i) => i !== idx))} className="text-red-500 ml-1">×</button></div>))}</div>
              <button onClick={generateFromStock} className="w-full bg-white text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-xl">Generuj z lodówki 👨‍🍳</button>
            </section>
            <div className="space-y-4">
              {savedRecipes.map((r, i) => (
                <details key={i} className="bg-[#161618] rounded-[2rem] border border-white/5 overflow-hidden group">
                  <summary className="p-6 flex items-center justify-between cursor-pointer list-none outline-none text-left"><div className="space-y-1 text-left flex-1"><h4 className="text-[9px] font-black uppercase text-[#ff7a00] italic">Przepis AI</h4><p className="font-black italic text-stone-200 text-lg leading-tight">{r.name}</p></div><span className="text-2xl group-open:rotate-180 transition-transform">📖</span></summary>
                  <div className="px-8 pb-8 space-y-4 border-t border-white/5 pt-4 text-[11px] text-stone-400 text-left leading-relaxed">
                    <p className="font-black text-stone-500 italic">Wykonanie:</p>{r.instructions?.map((s: string, idx: number) => <p key={idx} className="mb-1">{idx+1}. {s}</p>)}
                    <button onClick={() => setPlanModal({show: true, recipe: r})} className="w-full bg-[#ff7a00]/10 text-[#ff7a00] py-3 rounded-2xl font-black uppercase text-[10px] mt-4 border border-[#ff7a00]/20 tracking-widest hover:bg-[#ff7a00] hover:text-black transition-all">Dodaj do planu +</button>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* DOLNA NAWIGACJA */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 flex bg-[#161618]/95 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-3 shadow-2xl z-50">
        {[ { id: 'meals', icon: '🍴', label: 'PLAN' }, { id: 'scanner', icon: '📷', label: 'SKAN' }, { id: 'body', icon: '⚖️', label: 'BIO' }, { id: 'inventory', icon: '📦', label: 'MAGAZYN' } ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-10 py-5 rounded-[3rem] flex flex-col items-center gap-1 transition-all ${activeTab === t.id ? 'bg-[#ff7a00] text-black scale-105 shadow-xl shadow-orange-500/10' : 'text-stone-700 hover:text-stone-400'}`}>
            <span className="text-xl">{t.icon}</span>
            <span className="text-[7px] font-black uppercase tracking-widest text-center">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* MODAL I LOADER */}
      {planModal.show && (
          <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-[#161618] w-full max-w-sm rounded-[3rem] p-10 border border-[#ff7a00]/20 space-y-6 text-center shadow-2xl relative">
              <button onClick={() => setPlanModal({show:false, recipe:null})} className="absolute top-6 right-6 text-stone-600 text-2xl">×</button>
              <h3 className="text-xl font-black italic text-[#ff7a00] uppercase tracking-widest">Logistyka Planu</h3>
              <p className="text-stone-400 font-bold text-xs">{planModal.recipe.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleAddToPlan(getToday(), -1)} className="bg-[#0a0a0b] py-4 rounded-2xl border border-white/10 hover:border-[#ff7a00] text-[10px] font-black uppercase transition-all">Dziś</button>
                <button onClick={() => handleAddToPlan(getTomorrow(), -1)} className="bg-[#0a0a0b] py-4 rounded-2xl border border-white/10 hover:border-[#ff7a00] text-[10px] font-black uppercase transition-all">Jutro</button>
              </div>
            </div>
          </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex flex-col items-center justify-center p-12 text-center">
          <div className="w-12 h-12 border-4 border-[#ff7a00] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#ff7a00] font-black italic uppercase tracking-widest animate-pulse mt-4">Analizuję dane...</p>
        </div>
      )}
    </div>
  );
}
