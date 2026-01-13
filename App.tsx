import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { generateMealPlan, sanitizeForFirestore } from './geminiService';
import { DayPlan, BioProfile } from './types';

// TWOJA KONFIGURACJA ZGODNA Z FIREBASE
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

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("tester1@chrupnelo.pl");
  const [pass, setPass] = useState("");
  const [profile, setProfile] = useState<BioProfile>({
    bio: { gender: 'male', age: 30, weight: 85, height: 185, activity: 1.4 },
    stats: { bmi: 0, bmr: 0, tdee: 0 },
    goals: { targetKcal: 2605, protein: 195, fat: 72, carbs: 293, proteinPct: 30, fatPct: 25, carbsPct: 45, currentGoal: 'maintain', correction: 0, weightStart: 85, weightTarget: 80 }
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "users", u.uid, "data", "profile"));
        if (snap.exists()) setProfile(snap.data() as BioProfile);
      }
    });
  }, []);

  const handleAuth = async () => {
    setLoading(true); setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e: any) {
      // Jeśli użytkownik nie istnieje, spróbuj zarejestrować
      try {
        await createUserWithEmailAndPassword(auth, email, pass);
      } catch (e2: any) {
        setError("Błąd: Sprawdź dane lub uprawnienia w Google Cloud.");
      }
    } finally { setLoading(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl italic font-black mb-8">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <div className="w-full max-w-xs space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-[#161618] p-4 rounded-xl border border-white/10" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Hasło" className="w-full bg-[#161618] p-4 rounded-xl border border-white/10" value={pass} onChange={e => setPass(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-[#ff7a00] text-black py-4 rounded-xl font-bold uppercase">WJEDŹ DO PANELU 🚀</button>
          {error && <p className="text-red-500 text-xs text-center animate-bounce">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100 p-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl italic font-black">Plener <span className="text-[#ff7a00]">Chrupnęło</span></h1>
        <button onClick={() => signOut(auth)} className="text-stone-700">Logout 🚪</button>
      </header>
      <main className="mt-12 bg-[#161618] p-10 rounded-[3rem] border border-white/5">
        <div className="text-5xl font-black italic text-[#ff7a00]">{profile.goals.targetKcal} <small className="text-sm">kcal</small></div>
        <p className="text-stone-500 mt-2 uppercase text-[10px] font-black tracking-widest">Twoja logistyka paliwa</p>
      </main>
    </div>
  );
}
