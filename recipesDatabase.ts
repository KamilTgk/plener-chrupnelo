// src/recipesDatabase.ts

export type CategoryType = 'sniadanie' | 'drugie_sniadanie' | 'obiad' | 'podwieczorek' | 'kolacja' | 'przekaska';

export interface Recipe {
  name: string;
  category: CategoryType;
  cuisine: string; // <-- NOWE POLE: np. 'Polska', 'Włoska', 'Azjatycka'
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  ingredients: string[];
  instructions: string[];
}

export const RECIPES_DB: Recipe[] = [
  // --- ŚNIADANIA ---
  {
    name: "Jajecznica z pomidorami i szczypiorkiem",
    category: "sniadanie",
    cuisine: "Polska",
    kcal: 350, protein: 20, fat: 25, carbs: 5,
    ingredients: ["3 jajka", "1 pomidor", "Szczypiorek", "Masło 10g", "Sól, pieprz"],
    instructions: ["Rozpuść masło na patelni.", "Dodaj pokrojonego pomidora, podsmaż chwilę.", "Wbij jajka, dopraw i smaż do ścięcia."]
  },
  {
    name: "Owsianka z masłem orzechowym i bananem",
    category: "sniadanie",
    cuisine: "Amerykańska",
    kcal: 450, protein: 15, fat: 18, carbs: 60,
    ingredients: ["Płatki owsiane 50g", "Mleko 200ml", "1 Banan", "Masło orzechowe 20g"],
    instructions: ["Zagotuj płatki na mleku.", "Dodaj pokrojonego banana.", "Wymieszaj z masłem orzechowym."]
  },
  {
    name: "Tosty z awokado i jajkiem w koszulce",
    category: "sniadanie",
    cuisine: "Nowoczesna",
    kcal: 400, protein: 18, fat: 22, carbs: 35,
    ingredients: ["2 kromki chleba pełnoziarnistego", "1/2 awokado", "2 jajka", "Sok z cytryny"],
    instructions: ["Opiecz pieczywo.", "Rozgnieć awokado z sokiem z cytryny i nałóż na chleb.", "Ugotuj jajka w koszulce i połóż na wierzch."]
  },

  // --- DRUGIE ŚNIADANIE ---
  {
    name: "Serek wiejski z rzodkiewką",
    category: "drugie_sniadanie",
    cuisine: "Polska",
    kcal: 200, protein: 22, fat: 8, carbs: 5,
    ingredients: ["Serek wiejski 200g", "Pęczek rzodkiewki", "Szczypiorek"],
    instructions: ["Pokrój rzodkiewkę i szczypiorek.", "Wymieszaj z serkiem.", "Dopraw pieprzem."]
  },
  {
    name: "Koktajl bananowo-szpinakowy",
    category: "drugie_sniadanie",
    cuisine: "Fit",
    kcal: 250, protein: 5, fat: 2, carbs: 50,
    ingredients: ["1 Banan", "Garść szpinaku", "Jabłko", "Woda 100ml"],
    instructions: ["Zblenduj wszystkie składniki na gładką masę."]
  },

  // --- OBIADY ---
  {
    name: "Kurczak w sosie curry z ryżem",
    category: "obiad",
    cuisine: "Azjatycka", // lub Indyjska
    kcal: 600, protein: 45, fat: 15, carbs: 70,
    ingredients: ["Pierś z kurczaka 150g", "Ryż basmati 100g", "Mleczko kokosowe 50ml", "Przyprawa curry", "Cebula"],
    instructions: ["Ugotuj ryż.", "Kurczaka pokrój i podsmaż z cebulą.", "Dodaj mleczko i curry, duś 5 minut.", "Podawaj z ryżem."]
  },
  {
    name: "Makaron spaghetti bolognese (wersja light)",
    category: "obiad",
    cuisine: "Włoska",
    kcal: 550, protein: 35, fat: 15, carbs: 65,
    ingredients: ["Makaron pełnoziarnisty 100g", "Mięso mielone z indyka 150g", "Passata pomidorowa 200g", "Czosnek", "Bazylia"],
    instructions: ["Ugotuj makaron.", "Mięso podsmaż z czosnkiem.", "Dodaj passatę i duś 10 minut.", "Wymieszaj z makaronem."]
  },
  {
    name: "Łosoś pieczony z ziemniakami",
    category: "obiad",
    cuisine: "Śródziemnomorska",
    kcal: 650, protein: 40, fat: 30, carbs: 50,
    ingredients: ["Filet z łososia 150g", "Ziemniaki 200g", "Cytryna", "Koperek"],
    instructions: ["Ziemniaki pokrój w ćwiartki, łososia skrop cytryną.", "Piecz w 200°C przez 25 minut."]
  },
  {
    name: "Kotlet schabowy z mizerią",
    category: "obiad",
    cuisine: "Polska",
    kcal: 700, protein: 35, fat: 40, carbs: 50,
    ingredients: ["Schab 150g", "Bułka tarta", "Jajko", "Ogórek", "Śmietana/Jogurt", "Ziemniaki"],
    instructions: ["Rozbij schab, opanieruj i usmaż.", "Zrób mizerię z ogórka i śmietany.", "Podaj z gotowanymi ziemniakami."]
  },

  // --- PRZEKĄSKA ---
  {
    name: "Garść orzechów włoskich",
    category: "przekaska",
    cuisine: "Uniwersalna",
    kcal: 200, protein: 4, fat: 18, carbs: 3,
    ingredients: ["Orzechy włoskie 30g"],
    instructions: ["Zjedz ze smakiem :)"]
  },
  {
    name: "Jabłko i masło orzechowe",
    category: "przekaska",
    cuisine: "Amerykańska",
    kcal: 250, protein: 5, fat: 10, carbs: 30,
    ingredients: ["1 Jabłko", "Masło orzechowe 15g"],
    instructions: ["Pokrój jabłko i posmaruj masłem."]
  },

  // --- PODWIECZOREK ---
  {
    name: "Jogurt naturalny z owocami leśnymi",
    category: "podwieczorek",
    cuisine: "Fit",
    kcal: 200, protein: 10, fat: 5, carbs: 25,
    ingredients: ["Jogurt naturalny 150g", "Mrożone owoce leśne 100g"],
    instructions: ["Wymieszaj jogurt z owocami."]
  },
  {
    name: "Domowe ciastka owsiane",
    category: "podwieczorek",
    cuisine: "Domowa",
    kcal: 300, protein: 8, fat: 10, carbs: 45,
    ingredients: ["Płatki owsiane", "Banan", "Bakalie"],
    instructions: ["Zgnieć banana z płatkami, uformuj ciastka.", "Piecz 15 min w 180°C."]
  },

  // --- KOLACJA ---
  {
    name: "Sałatka grecka",
    category: "kolacja",
    cuisine: "Grecka",
    kcal: 350, protein: 12, fat: 25, carbs: 10,
    ingredients: ["Pomidor", "Ogórek", "Ser feta 50g", "Oliwki", "Oliwa z oliwek", "Oregano"],
    instructions: ["Pokrój warzywa i ser.", "Wymieszaj z oliwkami i oliwą."]
  },
  {
    name: "Twarożek ze szczypiorkiem i chlebem razowym",
    category: "kolacja",
    cuisine: "Polska",
    kcal: 300, protein: 25, fat: 5, carbs: 35,
    ingredients: ["Twaróg chudy 150g", "Jogurt naturalny", "Szczypiorek", "2 kromki chleba"],
    instructions: ["Rozgnieć twaróg z jogurtem i szczypiorkiem.", "Zjedz z pieczywem."]
  },
   {
    name: "Szakszuka",
    category: "kolacja",
    cuisine: "Bliskowschodnia",
    kcal: 400, protein: 18, fat: 20, carbs: 30,
    ingredients: ["2 jajka", "Puszka pomidorów", "Cebula", "Czosnek", "Kmin rzymski"],
    instructions: ["Podsmaż cebulę i czosnek.", "Dodaj pomidory, zrób wgłębienia.", "Wbij jajka i duś pod przykryciem."]
  }
];
