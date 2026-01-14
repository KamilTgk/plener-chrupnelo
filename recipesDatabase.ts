// src/recipesDatabase.ts

export type CategoryType = 'sniadanie' | 'drugie_sniadanie' | 'obiad' | 'podwieczorek' | 'kolacja' | 'przekaska';

export interface Recipe {
  name: string;
  category: CategoryType;
  cuisine: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
}

// --- GENERATOR LOGISTYCZNY (TO TWORZY TYSIĄCE KOMBINACJI) ---

const createVariations = (
  baseName: string,
  category: CategoryType,
  baseCuisine: string,
  baseKcal: number,
  baseMacro: { p: number, f: number, c: number },
  baseIngs: string[],
  baseInstr: string[],
  variations: { suffix: string, extraIng: string[], kcalMod: number, cuisineMod?: string }[]
): Recipe[] => {
  return variations.map(v => ({
    name: `${baseName} ${v.suffix}`,
    category,
    cuisine: v.cuisineMod || baseCuisine,
    kcal: baseKcal + v.kcalMod,
    protein: baseMacro.p + (v.kcalMod > 50 ? 5 : 0), // Prosta heurystyka
    fat: baseMacro.f + (v.kcalMod > 50 ? 5 : 0),
    carbs: baseMacro.c + (v.kcalMod > 50 ? 10 : 0),
    ingredients: [...baseIngs, ...v.extraIng],
    instructions: [...baseInstr, `Dodaj: ${v.extraIng.join(", ")}.`]
  }));
};

// --- BAZY DANYCH ---

const sniadania = createVariations(
  "Owsianka Królewska", "sniadanie", "Polska", 400, { p: 15, f: 10, c: 60 },
  ["Płatki owsiane 50g", "Mleko 200ml"],
  ["Zagotuj mleko z płatkami."],
  [
    { suffix: "z jabłkiem i cynamonem", extraIng: ["1 Jabłko", "Cynamon"], kcalMod: 50 },
    { suffix: "z bananem i orzechami", extraIng: ["1 Banan", "Orzechy włoskie"], kcalMod: 150 },
    { suffix: "z borówkami", extraIng: ["Garść borówek"], kcalMod: 30 },
    { suffix: "z masłem orzechowym", extraIng: ["Łyżka masła orzechowego"], kcalMod: 100, cuisineMod: "Amerykańska" },
    { suffix: "z malinami i chia", extraIng: ["Maliny", "Nasiona Chia"], kcalMod: 60, cuisineMod: "Fit" },
    { suffix: "czekoladowa", extraIng: ["Kakao", "Kawałki czekolady"], kcalMod: 120 },
    { suffix: "proteinowa", extraIng: ["Odżywka białkowa"], kcalMod: 100, cuisineMod: "Fit" },
    { suffix: "z gruszką i miodem", extraIng: ["Gruszka", "Łyżeczka miodu"], kcalMod: 80 },
    { suffix: "egzotyczna", extraIng: ["Mango", "Wiórki kokosowe"], kcalMod: 110, cuisineMod: "Azjatycka" }
  ]
);

const jajecznice = createVariations(
  "Jajecznica", "sniadanie", "Polska", 350, { p: 20, f: 25, c: 2 },
  ["3 Jajka", "Masło"],
  ["Rozpuść masło, wbij jajka, smaż do ścięcia."],
  [
    { suffix: "na szczypiorku", extraIng: ["Pęczek szczypiorku"], kcalMod: 10 },
    { suffix: "z boczkiem", extraIng: ["Boczek 30g"], kcalMod: 150 },
    { suffix: "z pomidorami", extraIng: ["1 Pomidor"], kcalMod: 20 },
    { suffix: "z szynką i serem", extraIng: ["Szynka", "Ser żółty"], kcalMod: 120 },
    { suffix: "z pieczarkami", extraIng: ["Pieczarki 100g"], kcalMod: 30 },
    { suffix: "z cebulką", extraIng: ["Cebula"], kcalMod: 20 },
    { suffix: "z łososiem", extraIng: ["Łosoś wędzony"], kcalMod: 80, cuisineMod: "Fit" },
    { suffix: "z kiełbasą", extraIng: ["Kiełbasa śląska"], kcalMod: 180 },
    { suffix: "z papryką chili", extraIng: ["Papryczka chili"], kcalMod: 5, cuisineMod: "Meksykańska" },
    { suffix: "ze szpinakiem", extraIng: ["Szpinak świeży"], kcalMod: 15, cuisineMod: "Fit" }
  ]
);

const omlety = createVariations(
  "Omlet", "sniadanie", "Francuska", 400, { p: 22, f: 20, c: 30 },
  ["2 Jajka", "Mąka 20g", "Mleko"],
  ["Wymieszaj składniki i usmaż na patelni."],
  [
    { suffix: "na słodko z dżemem", extraIng: ["Dżem truskawkowy"], kcalMod: 80, cuisineMod: "Polska" },
    { suffix: "z serem feta i szpinakiem", extraIng: ["Feta", "Szpinak"], kcalMod: 100, cuisineMod: "Grecka" },
    { suffix: "z warzywami", extraIng: ["Papryka", "Kukurydza"], kcalMod: 40, cuisineMod: "Fit" },
    { suffix: "z nutellą", extraIng: ["Krem czekoladowy"], kcalMod: 200, cuisineMod: "Amerykańska" },
    { suffix: "białkowy", extraIng: ["Dodatkowe białko jaj"], kcalMod: 20, cuisineMod: "Fit" }
  ]
);

const makarony = createVariations(
  "Makaron", "obiad", "Włoska", 600, { p: 25, f: 20, c: 80 },
  ["Makaron 100g"],
  ["Ugotuj makaron al dente."],
  [
    { suffix: "Bolognese", extraIng: ["Mięso mielone", "Sos pomidorowy"], kcalMod: 150 },
    { suffix: "Carbonara (śmietanowa)", extraIng: ["Boczek", "Śmietana", "Jajko"], kcalMod: 250 },
    { suffix: "z pesto i kurczakiem", extraIng: ["Pesto bazyliowe", "Pierś z kurczaka"], kcalMod: 180 },
    { suffix: "Aglio e Olio", extraIng: ["Dużo czosnku", "Oliwa z oliwek", "Chili"], kcalMod: 100 },
    { suffix: "ze szpinakiem i fetą", extraIng: ["Szpinak", "Ser feta"], kcalMod: 120, cuisineMod: "Grecka" },
    { suffix: "z tuńczykiem", extraIng: ["Tuńczyk w sosie własnym", "Kukurydza"], kcalMod: 80, cuisineMod: "Standard" },
    { suffix: "z łososiem i brokułami", extraIng: ["Łosoś", "Brokuły", "Śmietanka"], kcalMod: 200 },
    { suffix: "z kurczakiem curry", extraIng: ["Kurczak", "Przyprawa Curry", "Warzywa"], kcalMod: 150, cuisineMod: "Azjatycka" },
    { suffix: "Arrabbiata (ostry)", extraIng: ["Sos pomidorowy", "Chili"], kcalMod: 50 },
    { suffix: "z twarogiem i boczkiem", extraIng: ["Twaróg", "Boczek"], kcalMod: 180, cuisineMod: "Polska" }
  ]
);

const ryze = createVariations(
  "Ryż", "obiad", "Azjatycka", 550, { p: 30, f: 15, c: 75 },
  ["Ryż 100g", "Warzywa mrożone"],
  ["Ugotuj ryż, podsmaż z dodatkami."],
  [
    { suffix: "z kurczakiem słodko-kwaśnym", extraIng: ["Kurczak", "Sos słodko-kwaśny"], kcalMod: 100, cuisineMod: "Chińska" },
    { suffix: "smażony z jajkiem", extraIng: ["2 Jajka", "Sos sojowy", "Szczypiorek"], kcalMod: 120, cuisineMod: "Chińska" },
    { suffix: "Curry z ciecierzycą", extraIng: ["Ciecierzyca", "Mleczko kokosowe", "Curry"], kcalMod: 150, cuisineMod: "Indyjska" },
    { suffix: "z wołowiną po seczuańsku", extraIng: ["Wołowina paski", "Chili", "Czosnek"], kcalMod: 180, cuisineMod: "Chińska" },
    { suffix: "Pad Thai (wersja z ryżem)", extraIng: ["Kurczak", "Orzeszki ziemne", "Sos rybny"], kcalMod: 200, cuisineMod: "Tajska" },
    { suffix: "meksykański z fasolą", extraIng: ["Fasola czerwona", "Kukurydza", "Mięso mielone"], kcalMod: 200, cuisineMod: "Meksykańska" },
    { suffix: "z warzywami na parze", extraIng: ["Brokuł", "Marchew"], kcalMod: 0, cuisineMod: "Fit" },
    { suffix: "z krewetkami", extraIng: ["Krewetki", "Czosnek", "Masło"], kcalMod: 120, cuisineMod: "Śródziemnomorska" }
  ]
);

const polskieKlasyki = createVariations(
  "Polski Obiad:", "obiad", "Polska", 700, { p: 35, f: 40, c: 55 },
  ["Ziemniaki gotowane"],
  ["Ugotuj ziemniaki."],
  [
    { suffix: "Schabowy z mizerią", extraIng: ["Schab panierowany", "Ogórki", "Śmietana"], kcalMod: 200 },
    { suffix: "Mielony z buraczkami", extraIng: ["Kotlet mielony", "Buraczki zasmażane"], kcalMod: 150 },
    { suffix: "Gulasz wieprzowy", extraIng: ["Łopatka duszona", "Sos własny"], kcalMod: 100 },
    { suffix: "Jajko sadzone i kefir", extraIng: ["2 Jajka sadzone", "Szklanka kefiru"], kcalMod: -100 },
    { suffix: "Ryba smażona z surówką", extraIng: ["Filet rybny w panierce", "Surówka z kapusty"], kcalMod: 100 },
    { suffix: "Wątróbka z cebulką", extraIng: ["Wątróbka drobiowa", "Dużo cebuli", "Jabłko"], kcalMod: -50 },
    { suffix: "Gołąbki w sosie pomidorowym", extraIng: ["Gołąbki (mięso i ryż)", "Sos pomidorowy"], kcalMod: -80 },
    { suffix: "Bigos staropolski", extraIng: ["Kapusta kiszona", "Kiełbasa", "Mięso"], kcalMod: 100 },
    { suffix: "Pierogi Ruskie (10 szt)", extraIng: ["Pierogi z ziemniakami i serem", "Cebulka"], kcalMod: 50 },
    { suffix: "Kiełbasa z grilla z cebulą", extraIng: ["Kiełbasa podwawelska", "Musztarda"], kcalMod: 250 }
  ]
);

const kolacje = createVariations(
  "Kolacja:", "kolacja", "Standard", 350, { p: 15, f: 15, c: 40 },
  ["Pieczywo lub baza sałatkowa"],
  ["Przygotuj składniki."],
  [
    { suffix: "Kanapki z szynką i pomidorem", extraIng: ["Chleb razowy", "Masło", "Szynka", "Pomidor"], kcalMod: 50, cuisineMod: "Polska" },
    { suffix: "Kanapki z serem żółtym i ogórkiem", extraIng: ["Chleb", "Ser gouda", "Ogórek kiszony"], kcalMod: 80, cuisineMod: "Polska" },
    { suffix: "Sałatka Grecka", extraIng: ["Feta", "Oliwki", "Pomidor", "Ogórek", "Oliwa"], kcalMod: 0, cuisineMod: "Grecka" },
    { suffix: "Sałatka z tuńczykiem", extraIng: ["Tuńczyk", "Kukurydza", "Majonez light", "Ryż"], kcalMod: 100 },
    { suffix: "Caprese", extraIng: ["Mozzarella", "Pomidor", "Bazylia", "Oliwa"], kcalMod: 50, cuisineMod: "Włoska" },
    { suffix: "Twarożek ze szczypiorkiem", extraIng: ["Twaróg chudy", "Jogurt", "Rzodkiewka"], kcalMod: -50, cuisineMod: "Polska" },
    { suffix: "Jajka na twardo z majonezem", extraIng: ["2 Jajka", "Majonez", "Szczypiorek"], kcalMod: 80, cuisineMod: "Polska" },
    { suffix: "Wrap z kurczakiem", extraIng: ["Tortilla", "Kurczak", "Warzywa", "Sos"], kcalMod: 150, cuisineMod: "Meksykańska" },
    { suffix: "Zapiekanki z pieczarkami", extraIng: ["Bułka", "Pieczarki", "Ser żółty", "Keczup"], kcalMod: 150, cuisineMod: "Polska" },
    { suffix: "Śledzie w śmietanie", extraIng: ["Filety śledziowe", "Śmietana", "Cebula", "Ziemniak"], kcalMod: 100, cuisineMod: "Polska" }
  ]
);

const przekaski = createVariations(
  "Przekąska:", "przekaska", "Uniwersalna", 200, { p: 5, f: 10, c: 20 },
  [],
  ["Zjedz ze smakiem."],
  [
    { suffix: "Garść orzechów włoskich", extraIng: ["Orzechy włoskie 30g"], kcalMod: 0 },
    { suffix: "Migdały", extraIng: ["Migdały 30g"], kcalMod: 0 },
    { suffix: "Jabłko", extraIng: ["1 duże jabłko"], kcalMod: -50 },
    { suffix: "Banan", extraIng: ["1 Banan"], kcalMod: -20 },
    { suffix: "Jogurt naturalny", extraIng: ["Kubeczek jogurtu"], kcalMod: -50 },
    { suffix: "Kefir", extraIng: ["Szklanka kefiru"], kcalMod: -60 },
    { suffix: "Wafle ryżowe z masłem orzechowym", extraIng: ["2 wafle", "Masło orzechowe"], kcalMod: 100 },
    { suffix: "Marchewki z hummusem", extraIng: ["Marchewki", "Hummus"], kcalMod: 50, cuisineMod: "Fit" },
    { suffix: "Baton proteinowy", extraIng: ["Batonik"], kcalMod: 50, cuisineMod: "Fit" },
    { suffix: "Kabanosy", extraIng: ["Kabanosy drobiowe"], kcalMod: 80, cuisineMod: "Polska" },
    { suffix: "Gorzka czekolada", extraIng: ["3 kostki 70%"], kcalMod: 50 }
  ]
);

// --- AGREGACJA WSZYSTKIEGO DO JEDNEJ WIELKIEJ BAZY ---

export const RECIPES_DB: Recipe[] = [
  ...sniadania,
  ...jajecznice,
  ...omlety,
  ...makarony,
  ...ryze,
  ...polskieKlasyki,
  ...kolacje,
  ...przekaski,
  // Możesz tu łatwo dodać kolejne bloki!
  // Dodajemy jeszcze kilka "singli" dla pewności
  {
    name: "Pizza Margherita (Domowa)",
    category: "obiad",
    cuisine: "Włoska",
    kcal: 800, protein: 30, fat: 30, carbs: 100,
    ingredients: ["Ciasto na pizzę", "Sos pomidorowy", "Mozzarella"],
    instructions: ["Rozwałkuj ciasto, nałóż sos i ser, piecz w max temp."]
  },
  {
    name: "Sushi Zestaw (Maki)",
    category: "obiad",
    cuisine: "Japońska",
    kcal: 500, protein: 20, fat: 10, carbs: 80,
    ingredients: ["Ryż do sushi", "Nori", "Łosoś", "Ogórek", "Awokado"],
    instructions: ["Zwiń składniki w rolowane sushi."]
  },
  {
    name: "Burger Wołowy",
    category: "obiad",
    cuisine: "Amerykańska",
    kcal: 800, protein: 45, fat: 40, carbs: 60,
    ingredients: ["Bułka", "Wołowina 200g", "Sałata", "Pomidor", "Sos"],
    instructions: ["Usmaż mięso, złóż burgera."]
  }
];
