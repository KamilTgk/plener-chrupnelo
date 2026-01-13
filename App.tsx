import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { generateMealPlan } from './geminiService'; // Silnik Twoich przepisów
import { BioProfile } from './types';

const firebaseConfig = {
  apiKey: "AIzaSyC52O9u82wbIpYD1j3yYxNt1R0Yx0Wva4c",
  projectId: "panel-chrupnelo",
  authDomain: "panel-chrupnelo.firebaseapp.com",
  storageBucket: "panel-chrupnelo.firebasestorage.app",
  messagingSenderId: "695554422212",
  appId: "1:695554422212:web:b4ea9a37c62177748de091"
};

const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null); // Tu będą Twoje przepisy
  const [email, setEmail] = useState("tester1@chrupnelo.pl");
  const [pass, setPass] = useState("");
  const [profile] = useState<BioProfile>({
    bio: { gender: 'male', age: 30, weight: 85, height: 185, activity: 1.4 },
    stats: { bmi: 0, bmr: 0, tdee: 0 },
    goals: { targetKcal: 2605, protein: 195, fat: 72, carbs: 293, proteinPct: 30, fatPct: 25, carbsPct: 45, currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 }
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  // FUNKCJA GENEROWANIA PRZEPISÓW
  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const data = await generateMealPlan({ targetCalories: profile.goals.targetKcal });
      setPlan(data);
    } catch (e) {
      alert("AI jeszcze odpoczywa, spróbuj za chwilę.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      alert("Błąd logowania.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl italic font-black mb-8">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <div className="w-full max-w-xs space-y-4">
          <input type="password" placeholder="Hasło" className="w-full bg-[#161618] p-4 rounded-xl border border-white/10" value={pass} onChange={e => setPass(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-[#ff7a00] text-black py-4 rounded-xl font-bold uppercase">WJEDŹ DO PANELU 🚀</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100 p-6 pb-24">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-xl italic font-black">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <button onClick={() => signOut(auth)} className="text-[10px] text-stone-600 font-bold uppercase">Logout</button>
      </header>

      {/* NAGŁÓWEK Z KALORIAMI */}
      <div className="bg-[#161618] p-8 rounded-[2.5rem] border border-white/5 mb-6">
        <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Cel Dzienny</div>
        <div className="text-5xl font-black italic text-[#ff7a00]">{profile.goals.targetKcal} kcal</div>
      </div>

      {/* PRZYCISKI AKCJI */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button className="bg-[#1c1c1e] p-6 rounded-3xl border border-white/5 text-left active:scale-95 transition-all">
          <div className="text-2xl mb-2">📸</div>
          <div className="text-xs font-black uppercase italic">Skanuj</div>
        </button>
        <button onClick={handleGeneratePlan} disabled={loading} className="bg-[#1c1c1e] p-6 rounded-3xl border border-white/5 text-left active:scale-95 transition-all">
          <div className="text-2xl mb-2">🍳</div>
          <div className="text-xs font-black uppercase italic text-[#ff7a00]">
            {loading ? "Szef kuchni myśli..." : "Generuj Przepisy"}
          </div>
        </button>
      </div>

      {/* LISTA GENEROWANYCH PRZEPISÓW */}
      {plan && plan.meals && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-sm font-black uppercase tracking-widest text-stone-500 px-2">Twój jadłospis:</h2>
          {plan.meals.map((meal: any, i: number) => (
            <div key={i} className="bg-[#161618] p-6 rounded-[2rem] border border-white/5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-black italic text-lg">{meal.name}</h3>
                <span className="text-[#ff7a00] font-bold text-sm">{meal.calories} kcal</span>
              </div>
              <p className="text-stone-500 text-xs leading-relaxed">{meal.description || "Smacznego posiłku!"}</p>
            </div>
          ))}
        </div>
      )}

      <footer className="fixed bottom-8 left-0 right-0 flex justify-center px-6 pointer-events-none">
        <div className="bg-[#0a0a0b]/80 backdrop-blur-xl border border-white/5 px-8 py-3 rounded-full">
           <p className="text-[#ff7a00] text-[10px] font-black uppercase tracking-widest">Logistyka aktywna ✅</p>
        </div>
      </footer>
    </div>
  );
}
