import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { generateMealPlan, sanitizeForFirestore } from './geminiService';
import { DayPlan, BioProfile } from './types';

// KONFIGURACJA FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyD82LdmA6ry5mqPUsbhKPlnHw3V5C5uEK4",
  authDomain: "panel-chrupnelo.firebaseapp.com",
  projectId: "panel-chrupnelo",
  storageBucket: "panel-chrupnelo.firebasestorage.app",
  messagingSenderId: "695554422212",
  appId: "1:695554422212:web:b4ea9a37c62177748de091"
};

const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

const MacroBar = ({ label, current, target, color }: any) => (
  <div className="flex-1 space-y-1">
    <div className="flex justify-between text-[8px] font-black uppercase text-stone-500">
      <span>{label}</span>
      <span>{Math.round(current)}G / {Math.round(target)}G</span>
    </div>
    <div className="h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
      <div className="h-full transition-all duration-700" style={{ width: `${Math.min(100, (current/target)*100)}%`, backgroundColor: color }} />
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('meals');
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [profile, setProfile] = useState<BioProfile>({
    bio: { gender: 'male', age: 30, weight: 85, height: 185, activity: 1.4 },
    stats: { bmi: 0, bmr: 0, tdee: 0 },
    goals: { targetKcal: 2605, protein: 195, fat: 72, carbs: 293, proteinPct: 30, fatPct: 25, carbsPct: 45, currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 }
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "users", u.uid, "data", "profile"));
        if (snap.exists()) setProfile(snap.data() as BioProfile);
      }
    });
    return () => unsub();
  }, []);

  const handleAuth = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch {
      try { await createUserWithEmailAndPassword(auth, email, pass); } 
      catch { setError("Błąd autoryzacji."); }
    } finally { setLoading(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl italic font-black mb-8 text-[#ff7a00]">Plener Chrupnęło</h1>
        <div className="w-full max-w-xs space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-[#161618] p-4 rounded-xl border border-white/10" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Hasło" className="w-full bg-[#161618] p-4 rounded-xl border border-white/10" value={pass} onChange={e => setPass(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-[#ff7a00] text-black py-4 rounded-xl font-bold uppercase tracking-widest">Wjedź do panelu 🚀</button>
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100 p-6 pb-32">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-2xl italic font-black">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <button onClick={() => signOut(auth)} className="text-stone-600">🚪</button>
      </header>

      {activeTab === 'meals' && (
        <section className="bg-[#161618] p-8 rounded-[3rem] border border-white/5 shadow-2xl">
          <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest italic">Twój Cel Dzienny</span>
          <div className="text-5xl font-black italic text-[#ff7a00] my-2">{profile.goals.targetKcal} <small className="text-sm text-stone-600 italic">kcal</small></div>
          <div className="flex gap-4 mt-6">
            <MacroBar label="B" current={0} target={profile.goals.protein} color="#3b82f6" />
            <MacroBar label="T" current={0} target={profile.goals.fat} color="#f59e0b" />
            <MacroBar label="W" current={0} target={profile.goals.carbs} color="#10b981" />
          </div>
        </section>
      )}

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#161618]/90 backdrop-blur-xl border border-white/10 rounded-full p-2 flex gap-2 shadow-2xl">
        {['PLAN', 'SKAN', 'BIO', 'SKŁAD'].map((label, idx) => (
          <button key={label} onClick={() => setActiveTab(['meals', 'scanner', 'body', 'ingredients'][idx])} 
            className={`px-6 py-3 rounded-full text-[10px] font-black transition-all ${activeTab === ['meals', 'scanner', 'body', 'ingredients'][idx] ? 'bg-[#ff7a00] text-black' : 'text-stone-500'}`}>
            {label}
          </button>
        ))}
      </nav>
      {loading && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 italic text-[#ff7a00]">Ładowanie logistyki...</div>}
    </div>
  );
}
