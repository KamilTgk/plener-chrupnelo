import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, User, signOut } from "firebase/auth";
// Importy z Twojego geminiService (logika skanera i przepisów)
import { generateMealPlan, sanitizeForFirestore, analyzeMealScan } from './geminiService';
import { DayPlan, BioProfile, Meal } from './types';

// --- FIREBASE CONFIG (Twoja infrastruktura) ---
const firebaseConfig = {
  apiKey: "AIzaSyAFryvqf0ktCil0QyjdHfjmN2ZFAhHHe7A",
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'meals' | 'scanner' | 'body' | 'ingredients'>('meals');
  const [selectedDate] = useState(getToday());
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<BioProfile>({
    bio: { gender: 'male', age: 30, weight: 85, height: 185, activity: 1.4 },
    stats: { bmi: 24.8, bmr: 0, tdee: 0 },
    goals: { targetKcal: 2605, protein: 195, fat: 72, carbs: 293, proteinPct: 30, fatPct: 25, carbsPct: 45, currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 }
  });
  const [plans, setPlans] = useState<Record<string, DayPlan>>({});

  // SYNC Z BAZĄ (Żelazna Zasada: Nic nie ginie)
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

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-[#ff7a00] italic">Logistyka Pleneru...</div>;

  // PANEL LOGOWANIA DLA CIEBIE I TESTERÓW
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl italic text-[#ff7a00] mb-8 font-bold">Plener Chrupnęło</h1>
        <div className="bg-[#161618] p-10 rounded-[3rem] border border-white/5 w-full max-w-sm space-y-6">
           <button onClick={() => signInWithEmailAndPassword(auth, "admin@plener.pl", "twoje_haslo")} className="w-full bg-[#ff7a00] text-black py-4 rounded-xl font-black">ZALOGUJ DO BAZY 🚀</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100 flex flex-col max-w-xl mx-auto pb-32">
      <header className="p-8 text-center border-b border-white/5">
        <h1 className="text-3xl italic font-bold">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
      </header>

      <main className="p-6">
        {/* Tu znajdą się Twoje zakładki: PLAN, SKAN, BIO, SKŁAD */}
        {activeTab === 'meals' && (
           <div className="text-center p-10 bg-[#161618] rounded-[3rem] border border-white/5">
              <div className="text-5xl text-[#ff7a00] font-bold mb-2">2605 <small className="text-sm">kcal</small></div>
              <p className="text-stone-500 uppercase text-xs font-black italic">Twoje Zapotrzebowanie Aktywne</p>
           </div>
        )}
      </main>

      {/* Nawigacja Dolna - Klucz do zakładek */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#161618]/90 backdrop-blur-2xl border border-white/10 rounded-full p-2 flex gap-1 z-50 shadow-2xl">
        {['meals', 'scanner', 'body', 'ingredients'].map(t => (
          <button 
            key={t} onClick={() => setActiveTab(t as any)} 
            className={`px-6 py-4 rounded-full text-[10px] font-black ${activeTab === t ? 'bg-[#ff7a00] text-black' : 'text-stone-600'}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </nav>
    </div>
  );
}
