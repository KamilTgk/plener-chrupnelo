import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, User, signOut } from "firebase/auth";
import { generateMealPlan, sanitizeForFirestore, analyzeMealScan } from './geminiService';
import { DayPlan, BioProfile, Meal } from './types';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAFryvqf0ktCil0QyjdHfjmN2ZFAhHHe7A",
  authDomain: "panel-chrupnelo.firebaseapp.com",
  projectId: "panel-chrupnelo",
  storageBucket: "panel-chrupnelo.firebasestorage.app",
  messagingSenderId: "695554422212",
  appId: "1:695554422212:web:b4ea9a37c62177748de091"
};

// Stabilna inicjalizacja logistyki
const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

const getToday = () => new Date().toISOString().split('T')[0];

const MacroBar = ({ label, current, target, color }: { label: string, current: number, target: number, color: string }) => {
  const pct = Math.min(100, (current / (target || 1)) * 100);
  return (
    <div className="flex-1 space-y-1">
      <div className="flex justify-between text-[8px] font-black uppercase text-stone-500 italic">
        <span>{label}</span>
        <span className="text-stone-300">{Math.round(current)}G / {Math.round(target)}G</span>
      </div>
      <div className="h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
        <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'meals' | 'scanner' | 'body' | 'ingredients'>('meals');
  const [selectedDate] = useState(getToday());
  const [loading, setLoading] = useState(false);

  // Żelazna Zasada: Twoje parametry 2605 kcal są bazą startową
  const [profile, setProfile] = useState<BioProfile>({
    bio: { gender: 'male', age: 30, weight: 85, height: 185, activity: 1.4 },
    stats: { bmi: 24.8, bmr: 0, tdee: 0 },
    goals: { targetKcal: 2605, protein: 195, fat: 72, carbs: 293, proteinPct: 30, fatPct: 25, carbsPct: 45, currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 }
  });

  const [plans, setPlans] = useState<Record<string, DayPlan>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && db) {
        const pSnap = await getDoc(doc(db, "users", u.uid, "data", "profile"));
        if (pSnap.exists()) setProfile(pSnap.data() as BioProfile);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const currentPlan = plans[selectedDate] || { 
    date: selectedDate, totalKcal: 0, meals: [], extraMeals: [], waterCurrent: 0, stepsCurrent: 0, 
    dailyActivity: { water: { goalMl: 2500 }, steps: { goal: 10000 } } 
  };

  const updateCurrentPlan = (updates: Partial<DayPlan>) => {
    const newPlan = { ...currentPlan, ...updates };
    setPlans(p => ({ ...p, [selectedDate]: newPlan }));
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-[#ff7a00] italic logistic-font">Logistyka...</div>;

  // Ekran logowania dla bezpieczeństwa Twoich danych
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl italic text-[#ff7a00] mb-10 font-bold">Plener Chrupnęło</h1>
        <div className="bg-[#161618] p-10 rounded-[3rem] border border-white/5 w-full max-w-sm space-y-6 text-center">
           <p className="text-stone-500 text-xs uppercase font-black">Zaloguj się, aby odblokować 2605 kcal</p>
           <button onClick={() => signInWithEmailAndPassword(auth, "admin@plener.pl", "twojehaslo")} className="w-full bg-[#ff7a00] text-black py-4 rounded-xl font-black">WEJDŹ DO PANELU</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100 flex flex-col max-w-xl mx-auto pb-32">
      <header className="p-8 text-center border-b border-white/5 sticky top-0 bg-[#0a0a0b]/80 backdrop-blur-md z-40">
        <h1 className="text-3xl italic font-bold">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
      </header>

      <main className="p-6 space-y-8 animate-in fade-in duration-700">
        {activeTab === 'meals' && (
          <div className="space-y-6">
            <section className="bg-[#161618] p-8 rounded-[3rem] border border-white/5 space-y-6 shadow-2xl">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] uppercase text-stone-500 font-black italic tracking-widest">Paliwo Dziś</span>
                  <div className="text-5xl text-[#ff7a00] italic font-bold">{currentPlan.totalKcal} <small className="text-sm">kcal</small></div>
                </div>
                <div className="text-right text-stone-500 text-xs font-bold uppercase italic">Cel: {profile.goals.targetKcal}</div>
              </div>
              <div className="h-3 bg-black rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-[#ff7a00] to-orange-400" style={{ width: `${Math.min(100, (currentPlan.totalKcal / profile.goals.targetKcal) * 100)}%` }} />
              </div>
              <div className="flex gap-4">
                <MacroBar label="B" current={0} target={profile.goals.protein} color="#3b82f6" />
                <MacroBar label="T" current={0} target={profile.goals.fat} color="#f59e0b" />
                <MacroBar label="W" current={0} target={profile.goals.carbs} color="#10b981" />
              </div>
            </section>

            <section className="bg-[#161618] p-8 rounded-[2.5rem] border border-white/5 space-y-4 shadow-xl">
              <h3 className="text-[#ff7a00] font-black uppercase text-[10px] tracking-widest italic">👟 Logistyka Kroków</h3>
              <div className="flex justify-between text-3xl italic font-bold">
                <span>{currentPlan.stepsCurrent}</span>
                <span className="text-stone-700">/ {currentPlan.dailyActivity.steps.goal}</span>
              </div>
              <div className="h-2 bg-black rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" 
                  style={{ width: `${Math.min(100, (currentPlan.stepsCurrent / currentPlan.dailyActivity.steps.goal) * 100)}%` }} 
                />
              </div>
              <input type="range" min="0" max="20000" value={currentPlan.stepsCurrent} onChange={e => updateCurrentPlan({ stepsCurrent: Number(e.target.value) })} className="w-full accent-[#ff7a00]" />
            </section>
            
            <button className="w-full bg-[#ff7a00] text-black py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">LOGUJ PLAN 🚀</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#161618]/90 backdrop-blur-2xl border border-white/10 rounded-full p-2 flex gap-1 z-50">
        {[
          { id: 'meals', icon: '🍴', label: 'PLAN' },
          { id: 'scanner', icon: '📷', label: 'SKAN' },
          { id: 'body', icon: '⚖️', label: 'BIO' },
          { id: 'ingredients', icon: '📦', label: 'SKŁAD' }
        ].map(t => (
          <button 
            key={t.id} onClick={() => setActiveTab(t.id as any)} 
            className={`px-6 py-4 rounded-full flex flex-col items-center gap-1 transition-all ${activeTab === t.id ? 'bg-[#ff7a00] text-black scale-110 shadow-lg' : 'text-stone-600'}`}
          >
            <span className="text-xl">{t.icon}</span>
            <span className="text-[7px] font-black uppercase tracking-tighter italic">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
