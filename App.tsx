import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { 
  generateMealPlan, 
  sanitizeForFirestore, 
  analyzeMealScan 
} from './geminiService';
import { DayPlan, BioProfile, Meal } from './types';

// --- KONFIGURACJA LOGISTYCZNA ---
const firebaseConfig = {
  apiKey: "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c",
  authDomain: "panel-chrupnelo.firebaseapp.com",
  projectId: "panel-chrupnelo",
  storageBucket: "panel-chrupnelo.firebasestorage.app",
  messagingSenderId: "695554422212",
  appId: "1:695554422212:web:b4ea9a37c62177748de091"
};

const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

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
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [activeTab, setActiveTab] = useState<'meals' | 'body' | 'ingredients' | 'scanner'>('meals');
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [plans, setPlans] = useState<Record<string, DayPlan>>({});
  const [profile, setProfile] = useState<BioProfile>({
    bio: { gender: 'male', age: 30, weight: 85, height: 185, activity: 1.4 },
    stats: { bmi: 0, bmr: 0, tdee: 0 },
    goals: { targetKcal: 2605, protein: 195, fat: 72, carbs: 293, proteinPct: 30, fatPct: 25, carbsPct: 45, currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 }
  });

  const [scannerName, setScannerName] = useState("");
  const [scannerWeight, setScannerWeight] = useState("");
  const [scannerImage, setScannerImage] = useState<string | null>(null);
  const [scannerResult, setScannerResult] = useState<Partial<Meal> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const profileSnap = await getDoc(doc(db, "users", u.uid, "data", "profile"));
        if (profileSnap.exists()) setProfile(profileSnap.data() as BioProfile);
        const plansSnap = await getDoc(doc(db, "users", u.uid, "data", "plans"));
        if (plansSnap.exists()) setPlans(plansSnap.data().data as Record<string, DayPlan>);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const calculated = useMemo(() => {
    const { gender, age, weight, height, activity } = profile.bio;
    const { correction, proteinPct, fatPct, carbsPct } = profile.goals;
    const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161));
    const tdee = Math.round(bmr * activity);
    const targetKcal = tdee + (correction || 0);
    return { 
      targetKcal, 
      protein: Math.round((targetKcal * (proteinPct / 100)) / 4),
      fat: Math.round((targetKcal * (fatPct / 100)) / 9),
      carbs: Math.round((targetKcal * (carbsPct / 100)) / 4)
    };
  }, [profile.bio, profile.goals]);

  const currentPlan = plans[selectedDate] || { 
    date: selectedDate, totalKcal: 0, meals: [], waterCurrent: 0, stepsCurrent: 0, 
    dailyActivity: { water: { goalMl: 2500 }, steps: { goal: 10000 } } 
  };

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const plan = await generateMealPlan({ 
        targetCalories: calculated.targetKcal, mealCount: 4, proteinPct: profile.goals.proteinPct, fatPct: profile.goals.fatPct, carbsPct: profile.goals.carbsPct, selectedDate
      });
      const newPlans = { ...plans, [selectedDate]: plan };
      setPlans(newPlans);
      await setDoc(doc(db, "users", user.uid, "data", "plans"), { data: sanitizeForFirestore(newPlans) }, { merge: true });
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
        setError("Błąd logowania.");
      }
    } finally { setLoading(false); }
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-[#ff7a00] logistic-font italic text-xl">Inicjalizacja Logistyki...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-stone-100 flex flex-col items-center justify-center p-8 space-y-12">
        <h1 className="text-5xl logistic-font italic tracking-tighter">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <div className="bg-[#161618] p-10 rounded-[3rem] border border-[#27272a] shadow-2xl w-full max-w-sm space-y-8">
           <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full bg-[#0a0a0b] border border-[#27272a] p-5 rounded-2xl text-sm outline-none focus:border-[#ff7a00] font-bold italic" />
           <input type="password" placeholder="Hasło" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full bg-[#0a0a0b] border border-[#27272a] p-5 rounded-2xl text-sm outline-none focus:border-[#ff7a00] font-bold italic" />
           <button onClick={handleLogin} className="w-full bg-[#ff7a00] text-black py-5 rounded-2xl font-black uppercase text-[12px] tracking-widest active:scale-95 transition-all">Autoryzuj 🚀</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100 flex flex-col max-w-xl mx-auto pb-40">
      <header className="py-12 text-center sticky top-0 bg-[#0a0a0b]/90 backdrop-blur-xl z-50 border-b border-white/5 px-6 flex justify-between items-center">
          <span className="text-[8px] font-black uppercase text-stone-600">{user.email?.split('@')[0]}</span>
          <h1 className="text-4xl logistic-font italic tracking-tighter">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
          <button onClick={() => signOut(auth)} className="text-stone-700 text-xl">🚪</button>
      </header>

      <main className="flex-1 p-6 space-y-8">
        {activeTab === 'meals' && (
          <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
            <section className="bg-[#161618] p-10 rounded-[4rem] border border-[#27272a] shadow-2xl">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em] italic">Cel Dzienny</span>
                <div className="logistic-font text-5xl text-[#ff7a00]">{calculated.targetKcal} <small className="text-lg text-stone-600">kcal</small></div>
              </div>
              <div className="flex gap-6 mt-8">
                <MacroBar label="B" current={0} target={calculated.protein} color="#3b82f6" />
                <MacroBar label="T" current={0} target={calculated.fat} color="#f59e0b" />
                <MacroBar label="W" current={0} target={calculated.carbs} color="#10b981" />
              </div>
              <button onClick={handleGenerate} className="w-full bg-[#ff7a00] text-black py-4 rounded-xl logistic-font text-sm mt-10 active:scale-95 transition-all">LOGUJ PLAN 🚀</button>
            </section>
          </div>
        )}
      </main>

      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 flex bg-[#161618]/95 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-3 shadow-2xl z-50">
        {[{ id: 'meals', icon: '🍴', label: 'PLAN' }, { id: 'scanner', icon: '📷', label: 'SKAN' }, { id: 'body', icon: '⚖️', label: 'BIO' }, { id: 'ingredients', icon: '📦', label: 'SKŁAD' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-8 py-5 flex flex-col items-center gap-2 rounded-[3.5rem] ${activeTab === t.id ? 'bg-[#ff7a00] text-black scale-[1.1]' : 'text-stone-700'}`}>
            <span className="text-2xl">{t.icon}</span>
            <span className="text-[8px] font-black uppercase tracking-widest italic">{t.label}</span>
          </button>
        ))}
      </nav>

      {loading && (
        <div className="fixed inset-0 bg-black/98 flex flex-col items-center justify-center p-12 z-[300]">
          <div className="w-20 h-20 border-4 border-[#ff7a00] border-t-transparent rounded-full animate-spin" />
          <h3 className="logistic-font text-3xl italic text-[#ff7a00] mt-8 animate-pulse">Analiza AI...</h3>
        </div>
      )}
      {error && <div className="fixed top-12 left-1/2 -translate-x-1/2 bg-[#ff7a00] text-black px-12 py-6 rounded-full font-black text-[11px] z-[400] shadow-2xl">{error}</div>}
    </div>
  );
}
