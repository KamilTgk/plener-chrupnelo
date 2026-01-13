import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { generateMealPlan, analyzeMealScan, generateRecipeFromInventory } from './geminiService';
import { DayPlan, BioProfile } from './types';

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

  // --- STANY MAGAZYNU ---
  const [inventory, setInventory] = useState<{name: string, weight: string}[]>([]);
  const [newItem, setNewItem] = useState({ name: '', weight: '' });
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [inventoryFilter, setInventoryFilter] = useState("Wszystkie");
  const [planModal, setPlanModal] = useState<{show: boolean, recipe: any | null}>({show: false, recipe: null});

  // --- STANY SKANERA ---
  const [scanResult, setScanResult] = useState<any>(null);
  const [manualFood, setManualFood] = useState("");
  const [manualWeight, setManualWeight] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // --- KONFIGURACJA AI ---
  const [cuisine, setCuisine] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [mealCount, setMealCount] = useState(4);

  // --- STANY DANYCH ---
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

  const handleAuth = () => signInWithEmailAndPassword(auth, "tester1@chrupnelo.pl", pass).catch(() => alert("Błąd!"));

  // --- PERSYSTENCJA I CZYSZCZENIE ---
  useEffect(() => {
    const d = { 
      p: localStorage.getItem('pl_p'), pr: localStorage.getItem('pl_pr'), 
      w: localStorage.getItem('pl_w'), s: localStorage.getItem('pl_s'), 
      i: localStorage.getItem('pl_i'), r: localStorage.getItem('pl_r') 
    };
    if (d.p) {
        const loadedPlans = JSON.parse(d.p);
        const today = new Date();
        const cutoff = new Date(today);
        cutoff.setDate(today.getDate() - 30);
        const cleanedPlans: Record<string, any> = {};
        Object.keys(loadedPlans).forEach(dateStr => {
          if (new Date(dateStr) >= cutoff) cleanedPlans[dateStr] = loadedPlans[dateStr];
        });
        setPlans(cleanedPlans);
    }
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

  // --- LOGIKA OBLICZENIOWA ---
  const calculated = useMemo(() => {
    const { weight, height, age, gender, activity } = profile.bio;
    const { proteinPct, fatPct, carbsPct, correction } = profile.goals;
    const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
    let bmiColor = '#3b82f6'; let bmiLabel = 'NIEDOWAGA';
    if (bmi >= 18.5 && bmi < 25) { bmiColor = '#10b981'; bmiLabel = 'NORMA'; } 
    else if (bmi >= 25 && bmi < 30) { bmiColor = '#f59e0b'; bmiLabel = 'NADWAGA'; } 
    else if (bmi >= 30) { bmiColor = '#ef4444'; bmiLabel = 'OTYŁOŚĆ'; }
    const s = gender === 'male' ? 5 : -161;
    const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + s);
    const tdee = Math.round(bmr * activity);
    const totalTarget = tdee + correction;
    return { bmi, bmiLabel, bmiColor, totalTarget, bmr, tdee, proteinG: Math.round((totalTarget * (proteinPct / 100)) / 4), fatG: Math.round((totalTarget * (fatPct / 100)) / 9), carbsG: Math.round((totalTarget * (carbsPct / 100)) / 4), isPctValid: (proteinPct + fatPct + carbsPct) === 100, pctSum: proteinPct + fatPct + carbsPct };
  }, [profile]);

  const currentPlan = plans[selectedDate] || { meals: [], totalKcal: 0 };
  const consumedStats = (currentPlan.meals || []).reduce((acc: any, meal: any) => {
    if (meal.completed) {
      return { kcal: acc.kcal + (meal.kcal || 0), p: acc.p + (meal.protein || 0), f: acc.f + (meal.fat || 0), c: acc.c + (meal.carbs || 0) };
    }
    return acc;
  }, { kcal: 0, p: 0, f: 0, c: 0 });

  const shoppingList = Array.from(new Set((currentPlan.meals || []).flatMap((m: any) => m.ingredients || [])));

  const monthHistory = Object.keys(plans).map(date => {
      const p = plans[date];
      const consumed = (p.meals || []).filter((m: any) => m.completed).reduce((s: number, m: any) => s + (m.kcal || 0), 0);
      return { date, plan: p, consumed };
  }).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 30);

  // --- HANDLERY ---
  const handleAddToPlan = (targetDate: string, mealIndex: number) => {
    const recipe = planModal.recipe; if (!recipe) return;
    setPlans(prev => {
        const currentMeals = prev[targetDate]?.meals || Array(mealCount).fill(null).map((_, i) => ({ name: `Pusty ${i+1}`, kcal: 0, protein: 0, fat: 0, carbs: 0, completed: false }));
        const updated = [...currentMeals];
        if (mealIndex >= 0) updated[mealIndex] = { ...recipe, completed: false };
        else updated.push({ ...recipe, completed: false });
        return { ...prev, [targetDate]: { ...prev[targetDate], meals: updated } };
    });
    setPlanModal({show: false, recipe: null});
  };

  const handleGenerate = async () => {
    if (!calculated.isPctValid) return alert("Suma makro musi wynosić 100%!");
    setLoading(true);
    try {
      const plan = await generateMealPlan({ targetCalories: calculated.totalTarget, goalMode: profile.goals.currentGoal, proteinPct: profile.goals.proteinPct, fatPct: profile.goals.fatPct, carbsPct: profile.goals.carbsPct, cuisine, exclusions, mealCount });
      if (plan) setPlans(prev => ({ ...prev, [selectedDate]: plan }));
    } catch (e) { alert("Błąd AI"); } finally { setLoading(false); }
  };

  const toggleMealCompletion = (idx: number) => {
    const updatedMeals = [...currentPlan.meals]; updatedMeals[idx].completed = !updatedMeals[idx].completed;
    setPlans(prev => ({ ...prev, [selectedDate]: { ...currentPlan, meals: updatedMeals } }));
  };

  const setStrategy = (mode: string, val: number) => {
    setProfile(prev => ({ ...prev, goals: { ...prev.goals, currentGoal: mode as any, correction: val } }));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl italic font-black mb-8 uppercase tracking-tighter">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <input type="password" placeholder="Hasło" className="bg-[#161618] p-5 rounded-2xl mb-4 text-center border border-white/5 outline-none focus:border-[#ff7a00]" value={pass} onChange={e => setPass(e.target.value)} />
        <button onClick={handleAuth} className="bg-[#ff7a00] text-black w-full max-w-xs py-5 rounded-2xl font-black uppercase tracking-widest">Wjedź 🚀</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col max-w-xl mx-auto pb-44 text-center relative selection:bg-[#ff7a00]/30">
      <header className="p-10 flex flex-col items-center sticky top-0 bg-[#0a0a0b]/90 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <button onClick={() => signOut(auth)} className="absolute right-6 top-10 text-[8px] text-stone-600 font-bold uppercase tracking-widest">Logout</button>
      </header>

      <main className="p-6 space-y-6">
        {/* ZAKŁADKA PLAN */}
        {activeTab === 'meals' && (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
             <div className="flex bg-[#161618] p-1 rounded-2xl border border-white/5">
                {['day', 'month'].map(m => <button key={m} onClick={() => setPlanViewMode(m as any)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${planViewMode === m ? 'bg-[#ff7a00] text-black shadow-lg' : 'text-stone-600'}`}>{m === 'day' ? 'Dzień' : 'Archiwum'}</button>)}
             </div>

             {planViewMode === 'day' && (
                <>
                  <div className="flex items-center justify-between bg-[#161618] p-4 rounded-3xl border border-white/5">
                    <button onClick={() => { const x = new Date(selectedDate); x.setDate(x.getDate()-1); setSelectedDate(x.toISOString().split('T')[0]); }} className="text-stone-500 hover:text-white px-4">←</button>
                    <span className="font-black italic text-[#ff7a00] uppercase tracking-widest">{selectedDate}</span>
                    <button onClick={() => { const x = new Date(selectedDate); x.setDate(x.getDate()+1); setSelectedDate(x.toISOString().split('T')[0]); }} className="text-stone-500 hover:text-white px-4">→</button>
                  </div>
                  <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-2xl space-y-6">
                    <div className="relative">
                      <input placeholder="Kuchnia świata..." value={cuisine} onChange={e => setCuisine(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic text-center outline-none focus:border-[#ff7a00]" />
                      <button onClick={() => setCuisine(WORLD_CUISINES[Math.floor(Math.random()*WORLD_CUISINES.length)])} className="absolute right-3 top-1/2 -translate-y-1/2">🎲</button>
                    </div>
                    <button onClick={handleGenerate} className="w-full bg-[#ff7a00] text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Generuj Jadłospis AI 🚀</button>
                  </section>
                  <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] space-y-6 text-left relative overflow-hidden">
                    <div className="flex justify-between items-end px-2">
                        <div>
                            <span className="text-[9px] font-black text-stone-500 uppercase italic">Spożycie (Realne)</span>
                            <div className="text-4xl text-[#ff7a00] font-black italic">{Math.round(consumedStats.kcal)} / {calculated.totalTarget} <small className="text-xs">kcal</small></div>
                        </div>
                        <div className="text-right"><span className="text-stone-300 font-bold text-[10px] uppercase">{Math.round((consumedStats.kcal/calculated.totalTarget)*100)}% celu</span></div>
                    </div>
                    <div className="flex gap-4">
                      <MacroBar label="BIAŁKO" current={consumedStats.p} target={calculated.proteinG} color="#3b82f6" />
                      <MacroBar label="TŁUSZCZ" current={consumedStats.f} target={calculated.fatG} color="#f59e0b" />
                      <MacroBar label="WĘGLE" current={consumedStats.c} target={calculated.carbsG} color="#10b981" />
                    </div>
                  </section>
                  {currentPlan.meals.map((m: any, i: number) => (
                    <div key={i} className={`bg-[#161618] p-6 rounded-[2.5rem] border transition-all duration-500 ${m.completed ? 'border-emerald-500/40 opacity-60' : 'border-[#27272a]'}`}>
                      <div className="flex justify-between items-center">
                        <div><h4 className="text-[9px] font-black uppercase text-stone-500">Posiłek {i+1}</h4><h4 className={`font-black italic text-lg ${m.completed ? 'text-emerald-400 line-through' : 'text-stone-200'}`}>{m.name}</h4></div>
                        <button onClick={() => toggleMealCompletion(i)} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black transition-all ${m.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-stone-700 text-transparent hover:border-[#ff7a00]'}`}>✓</button>
                      </div>
                      <p className="text-[9px] text-stone-600 font-bold uppercase mt-1 tracking-widest">{m.kcal} kcal | B:{m.protein} T:{m.fat} W:{m.carbs}</p>
                    </div>
                  ))}
                  {shoppingList.length > 0 && (
                      <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-white/5 text-left"><h3 className="text-[9px] font-black text-[#ff7a00] uppercase mb-6 text-center tracking-[0.2em] italic">Lista Zakupów</h3><div className="grid grid-cols-2 gap-3">{shoppingList.map((it, i) => <div key={i} className="text-[10px] text-stone-400 flex gap-2 items-start"><div className="w-3 h-3 border border-stone-700 rounded-sm mt-0.5 shrink-0"/><span>{it}</span></div>)}</div></section>
                  )}
                </>
             )}

             {planViewMode === 'month' && (
                <div className="space-y-4">
                  {monthHistory.map(day => (
                    <div key={day.date} className="bg-[#161618] p-5 rounded-[2rem] border border-white/5 flex justify-between items-center transition-all hover:border-[#ff7a00]/30">
                        <div className="text-left"><p className="text-[10px] font-black uppercase text-stone-600">{day.date}</p><p className="text-stone-300 font-bold text-xs">{day.plan.meals?.length} posiłków</p></div>
                        <div className="text-right"><span className="block text-[#ff7a00] font-black italic">{day.consumed} kcal</span><span className="text-[8px] uppercase text-stone-600 font-black">Zjedzone</span></div>
                    </div>
                  ))}
                </div>
             )}
          </div>
        )}

        {/* ZAKŁADKA SKAN */}
        {activeTab === 'scanner' && (
          <div className="space-y-6 animate-in zoom-in duration-500">
             <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] shadow-2xl space-y-8 text-center">
                <div className="w-40 h-40 bg-black rounded-full mx-auto flex items-center justify-center border-2 border-dashed border-[#ff7a00]/30 relative overflow-hidden group">
                   {selectedImage ? <img src={selectedImage} className="w-full h-full object-cover" /> : <span className="text-5xl">📷</span>}
                   <input type="file" accept="image/*" onChange={e => { const r = new FileReader(); r.onload = () => setSelectedImage(r.result as string); if(e.target.files?.[0]) r.readAsDataURL(e.target.files[0]); }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                </div>
                <div className="space-y-4">
                    <input placeholder="Co jesz?" value={manualFood} onChange={e => setManualFood(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic text-center outline-none focus:border-[#ff7a00]" />
                    <input type="number" placeholder="Waga (g)" value={manualWeight} onChange={e => setManualWeight(e.target.value)} className="w-full bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic text-center outline-none focus:border-[#ff7a00]" />
                </div>
                <button onClick={async () => { setLoading(true); try { const r = await analyzeMealScan(selectedImage || "", manualFood, manualWeight); setScanResult(r); } catch(e) { alert("Błąd Skanera"); } finally { setLoading(false); } }} className="w-full bg-[#ff7a00] text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Analizuj AI ⚙️</button>
                {scanResult && (
                    <div className="bg-black p-8 rounded-[3rem] border border-[#ff7a00]/20 animate-in slide-in-from-top"><h3 className="text-[#ff7a00] font-black italic text-xl uppercase mb-4">{scanResult.name}</h3><div className="text-4xl font-black italic mb-4">{scanResult.kcal} <small className="text-xs">kcal</small></div><div className="grid grid-cols-3 gap-2">{[{l:'B',v:scanResult.protein,c:'text-blue-400'},{l:'T',v:scanResult.fat,c:'text-orange-400'},{l:'W',v:scanResult.carbs,c:'text-green-400'}].map(m=><div key={m.l} className="bg-[#161618] p-3 rounded-xl text-[10px] font-black uppercase"><span className={m.c}>{m.l}</span>: {m.v}g</div>)}</div></div>
                )}
             </section>
          </div>
        )}

        {/* ZAKŁADKA BIO */}
        {activeTab === 'body' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
             <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] flex justify-around shadow-2xl">
                <div className="text-center"><span className="text-[8px] text-stone-600 font-black uppercase block mb-1">BMI</span><div className="text-4xl font-black italic" style={{ color: calculated.bmiColor }}>{calculated.bmi}</div><span className="text-[9px] font-black uppercase tracking-widest" style={{ color: calculated.bmiColor }}>{calculated.bmiLabel}</span></div>
                <div className="h-12 w-px bg-white/5"></div>
                <div className="text-center"><span className="text-[8px] text-stone-600 font-black uppercase block mb-1">Cel Kcal</span><div className="text-4xl font-black italic text-[#ff7a00]">{calculated.totalTarget}</div><span className="text-[8px] text-stone-500 font-black uppercase tracking-widest">Paliwo / dzień</span></div>
             </section>
             <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] space-y-10 shadow-2xl">
                <div className="flex bg-[#0a0a0b] p-1 rounded-2xl border border-white/5">
                    {['male', 'female'].map(g => <button key={g} onClick={() => setProfile({...profile, bio: {...profile.bio, gender: g as any}})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${profile.bio.gender === g ? 'bg-[#ff7a00] text-black shadow-lg' : 'text-stone-600'}`}>{g === 'male' ? 'Mężczyzna' : 'Kobieta'}</button>)}
                </div>
                <div className="space-y-8 px-2">
                    {[{l:'Waga', k:'weight', u:'kg', min:40, max:150}, {l:'Wzrost', k:'height', u:'cm', min:140, max:220}, {l:'Wiek', k:'age', u:'lat', min:15, max:90}].map(i => (
                        <div key={i.k} className="space-y-3 text-left"><div className="flex justify-between font-black uppercase text-[10px] text-stone-500 italic"><span>{i.l}</span><span className="text-white text-lg">{(profile.bio as any)[i.k]} {i.u}</span></div><input type="range" min={i.min} max={i.max} step={i.k==='weight'?0.5:1} value={(profile.bio as any)[i.k]} onChange={e => setProfile({...profile, bio: {...profile.bio, [i.k]: parseFloat(e.target.value)}})} className="w-full h-1 accent-[#ff7a00] bg-[#0a0a0b] appearance-none cursor-pointer rounded-full" /></div>
                    ))}
                    <div className="space-y-4 pt-2 text-center">
                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest">Poziom Aktywności</label>
                        <div className="grid grid-cols-5 gap-2">
                            {[1.2, 1.375, 1.55, 1.725, 1.9].map((val, idx) => (
                                <button key={val} onClick={() => setProfile({...profile, bio: {...profile.bio, activity: val}})} className={`py-4 rounded-xl text-[10px] font-black transition-all ${profile.bio.activity === val ? 'bg-[#ff7a00] text-black shadow-lg scale-105' : 'bg-[#0a0a0b] text-stone-700 border border-white/5'}`}>{idx}</button>
                            ))}
                        </div>
                    </div>
                </div>
             </section>
             <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] space-y-6 shadow-2xl">
                <h3 className="text-[9px] font-black text-stone-500 uppercase italic tracking-widest">Strategia Wagowa</h3>
                <div className="flex bg-[#0a0a0b] p-1 rounded-2xl border border-white/5">
                    {[{l:'Redukcja',v:-300,m:'cut'},{l:'Utrzymanie',v:0,m:'maintain'},{l:'Masa',v:300,m:'bulk'}].map(s => <button key={s.m} onClick={() => setStrategy(s.m, s.v)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${profile.goals.currentGoal === s.m ? 'bg-[#ff7a00] text-black shadow-lg' : 'text-stone-600'}`}>{s.l}</button>)}
                </div>
                <div className="px-2 space-y-2">
                    <div className="flex justify-between items-end"><span className="text-[8px] font-black text-stone-500 uppercase">Korekta Manualna</span><span className="text-[#ff7a00] font-black italic">{profile.goals.correction > 0 ? '+' : ''}{profile.goals.correction} kcal</span></div>
                    <input type="range" min="-1000" max="1000" step="50" value={profile.goals.correction} onChange={e => setStrategy('custom', parseInt(e.target.value))} className="w-full h-1 bg-[#0a0a0b] appearance-none accent-[#ff7a00] rounded-full" />
                </div>
             </section>
             <section className="bg-[#161618] p-8 rounded-[4rem] border border-[#27272a] space-y-6 text-center">
                <h3 className="text-[10px] font-black text-stone-500 uppercase italic tracking-widest">Strategia Makro (%)</h3>
                <div className="grid grid-cols-3 gap-3">
                    {[{k:'proteinPct',l:'BIAŁKO',c:'text-blue-400',g:calculated.proteinG},{k:'fatPct',l:'TŁUSZCZ',c:'text-orange-400',g:calculated.fatG},{k:'carbsPct',l:'WĘGLE',c:'text-green-400',g:calculated.carbsG}].map(m => (
                        <div key={m.k} className="bg-[#0a0a0b] p-4 rounded-3xl border border-white/5">
                            <span className="text-[7px] font-black text-stone-600 uppercase block mb-1">{m.l}</span>
                            <input type="number" value={(profile.goals as any)[m.k]} onChange={e => setProfile({...profile, goals: {...profile.goals, [m.k]: parseInt(e.target.value) || 0}})} className={`w-full bg-transparent text-center font-black italic text-xl outline-none ${m.c}`} />
                            <span className="text-[8px] font-bold text-stone-500">{m.g}g</span>
                        </div>
                    ))}
                </div>
                {!calculated.isPctValid && <p className="text-red-500 text-[8px] font-black uppercase animate-pulse">Błąd: Suma musi wynosić 100% (Obecnie: {calculated.pctSum}%)</p>}
             </section>
          </div>
        )}
        
        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
            <section className="bg-[#161618] p-8 rounded-[3.5rem] border border-[#27272a] shadow-2xl space-y-6 text-center">
              <div className="flex items-center gap-3 justify-center"><span className="text-2xl">🧊</span><h3 className="text-lg font-black italic uppercase tracking-widest">Lodówka</h3></div>
              <div className="flex gap-2">
                <input placeholder="Produkt..." value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="flex-[2] bg-[#0a0a0b] border border-white/5 p-4 rounded-2xl text-[10px] font-black italic text-center outline-none focus:border-[#ff7a00]" />
                <button onClick={addToInventory} className="bg-[#ff7a00] text-black w-12 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">+</button>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {inventory.map((item, idx) => (
                  <div key={idx} className="bg-[#0a0a0b] px-4 py-2 rounded-full border border-white/10 text-[9px] font-bold flex gap-2 items-center"><span className="text-stone-300">{item.name}</span><button onClick={() => setInventory(inventory.filter((_, i) => i !== idx))} className="text-red-500 ml-1">×</button></div>
                ))}
              </div>
              <button onClick={async () => { if(inventory.length===0) return alert("Pusta lodówka!"); setLoading(true); try { const r = await generateRecipeFromInventory(inventory); setSavedRecipes([r, ...savedRecipes]); } catch(e) { alert("Błąd AI"); } finally { setLoading(false); } }} className="w-full bg-white text-black py-5 rounded-3xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-xl">Generuj z lodówki 👨‍🍳</button>
            </section>
            <div className="space-y-4">
              {savedRecipes.map((r, i) => (
                <details key={i} className="bg-[#161618] rounded-[2.5rem] border border-white/5 overflow-hidden group">
                  <summary className="p-6 flex items-center justify-between cursor-pointer list-none outline-none text-left"><div className="space-y-1 text-left flex-1 mr-4"><div className="flex items-center gap-2 mb-1"><span className="text-[8px] font-black uppercase bg-black px-2 py-1 rounded text-stone-500 border border-white/5">{r.category || "Danie"}</span><span className="text-[9px] font-black uppercase text-[#ff7a00] italic">Przepis AI</span></div><p className="font-black italic text-stone-200 text-lg">{r.name}</p></div><span className="text-2xl group-open:rotate-180 transition-transform">📖</span></summary>
                  <div className="px-8 pb-8 space-y-4 border-t border-white/5 pt-4 text-[11px] text-stone-400 text-left leading-relaxed">
                    <div className="grid grid-cols-4 gap-2 mb-2">{[{l:'KCAL',v:r.kcal},{l:'B',v:r.protein},{l:'T',v:r.fat},{l:'W',v:r.carbs}].map(m=><div key={m.l} className="bg-black p-2 rounded-xl text-center border border-white/5"><span className="block text-[7px] text-stone-600 font-black">{m.l}</span><span className="text-white font-black">{m.v}</span></div>)}</div>
                    <p className="font-black text-stone-500 italic">Składniki:</p><ul className="list-disc pl-4 mb-2">{r.ingredients?.map((ing: string, idx: number) => <li key={idx}>{ing}</li>)}</ul>
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

      {/* MODAL DODAWANIA DO PLANU */}
      {planModal.show && (
          <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-[#161618] w-full max-w-sm rounded-[3rem] p-10 border border-[#ff7a00]/20 space-y-6 text-center shadow-2xl relative">
              <button onClick={() => setPlanModal({show:false, recipe:null})} className="absolute top-6 right-6 text-stone-600 text-2xl">×</button>
              <h3 className="text-xl font-black italic text-[#ff7a00] uppercase tracking-widest">Logistyka Planu</h3>
              <p className="text-stone-400 font-bold text-xs">{planModal.recipe.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleAddToPlan(getToday(), -1)} className="bg-[#0a0a0b] py-4 rounded-2xl border border-white/10 hover:border-[#ff7a00] text-[10px] font-black uppercase transition-all">Dziś</button>
                <button onClick={() => handleAddToPlan(getTomorrow(), -1)} className="bg-[#0a0a0b] py-4 rounded-2xl border border-white/10 hover:border-[#ff7a00] text-[10px] font-black uppercase transition-all">Jutro</button>
              </div>
              <p className="text-[8px] text-stone-600 font-black uppercase">Wybierz slot lub dodaj na koniec</p>
            </div>
          </div>
      )}

      {/* LOADER */}
      {loading && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex flex-col items-center justify-center p-12 space-y-6 text-center">
          <div className="w-12 h-12 border-4 border-[#ff7a00] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#ff7a00] font-black italic uppercase tracking-widest animate-pulse">System AI Plener Analizuje Dane...</p>
        </div>
      )}
    </div>
  );
}
