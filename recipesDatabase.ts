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

// =================================================================
// 🏭 FABRYKA PRZEPISÓW (SMART BUILDERS)
// Te funkcje generują setki wariantów, ale z logicznymi instrukcjami.
// =================================================================

// --- 1. GENERATOR OWSIANEK (Jakość Premium) ---
const createOatmeal = (fruit: string, topping: string, liquid: string, kcalAdd: number, cuisine: string): Recipe => ({
  name: `Owsianka Królewska z dodatkiem: ${fruit} i ${topping}`,
  category: 'sniadanie',
  cuisine: cuisine,
  kcal: 400 + kcalAdd,
  protein: 20, fat: 15, carbs: 60,
  ingredients: [
    "Płatki owsiane górskie - 60g",
    "Odżywka białkowa (lub jogurt grecki) - 20g",
    `${liquid} - 200ml`,
    `${fruit} - 100g`,
    `${topping} - 15g`
  ],
  instructions: [
    `Płatki owsiane wsyp do garnka, zalej produktem: ${liquid}.`,
    "Gotuj na małym ogniu przez około 5-7 minut, często mieszając, aż owsianka zgęstnieje.",
    "W międzyczasie przygotuj owoce: umyj je, obierz i pokrój w drobną kostkę lub plasterki.",
    "Gdy owsianka lekko przestygnie, dodaj odżywkę białkową i energicznie wymieszaj, aby nie było grudek.",
    `Przełóż do miseczki. Na wierzchu ułóż przygotowany: ${fruit}.`,
    `Całość posyp dodatkiem: ${topping}, aby nadać chrupkości.`
  ]
});

// --- 2. GENERATOR JAJECZNIC ---
const createScramble = (extra: string, veg: string, kcalAdd: number, cuisine: string): Recipe => ({
  name: `Jajecznica Maślana z: ${extra} i ${veg}`,
  category: 'sniadanie',
  cuisine: cuisine,
  kcal: 350 + kcalAdd,
  protein: 25, fat: 28, carbs: 5,
  ingredients: [
    "3 jajka (rozmiar L)",
    "Masło klarowane - 10g",
    `${extra} - 40g`,
    `${veg} - garść`,
    "Sól, pieprz, szczypiorek"
  ],
  instructions: [
    `Na patelni rozgrzej masło. Jeśli używasz składnika: ${extra}, podsmaż go najpierw przez 2 minuty na złoto.`,
    "Wbij jajka bezpośrednio na patelnię (nie roztrzepuj ich wcześniej - to sekret kremowej konsystencji).",
    "Zmniejsz ogień na minimalny. Mieszaj powoli szpatułką, łącząc białka z żółtkami.",
    `Gdy jajka zaczną się ścinać, dorzuć posiekany: ${veg}.`,
    "Zdejmij z ognia, gdy jajecznica jest jeszcze lekko wilgotna (dojdzie na talerzu).",
    "Posyp świeżym szczypiorkiem i dopraw solą oraz pieprzem."
  ]
});

// --- 3. GENERATOR OBIADÓW (Ryż/Kasza + Mięso + Warzywa) ---
const createLunchBowl = (base: string, protein: string, veg: string, sauce: string, cuisine: string): Recipe => ({
  name: `Bowl Obiadowy: ${protein} z ${base} i sosem ${sauce}`,
  category: 'obiad',
  cuisine: cuisine,
  kcal: 600, protein: 40, fat: 20, carbs: 70,
  ingredients: [
    `${base} - 80g (waga przed ugotowaniem)`,
    `${protein} - 150g`,
    `${veg} - 200g`,
    `Sos/Przyprawa: ${sauce}`,
    "Oliwa z oliwek - 10ml"
  ],
  instructions: [
    `Ugotuj produkt: ${base} w osolonej wodzie zgodnie z czasem na opakowaniu (zwykle 12-15 min).`,
    `Mięso/Białko (${protein}) pokrój w równą kostkę ok. 2cm. Dopraw solą i pieprzem.`,
    "Na patelni rozgrzej oliwę. Wrzuć pokrojone białko i smaż na średnim ogniu przez 4-5 minut.",
    `Dorzuć na patelnię: ${veg} (jeśli mrożone, smaż dłużej aż woda odparuje).`,
    `Pod koniec dodaj składnik: ${sauce}, wymieszaj dokładnie i duś pod przykryciem jeszcze 2 minuty.`,
    `Na talerz wyłóż ugotowany ${base}, a obok aromatyczny gulasz z patelni.`
  ]
});

// --- 4. GENERATOR MAKARONÓW ---
const createPasta = (shape: string, sauceName: string, addOn: string, cuisine: string): Recipe => ({
  name: `Włoska uczta: ${shape} ${sauceName} z dodatkiem ${addOn}`,
  category: 'obiad',
  cuisine: cuisine,
  kcal: 650, protein: 30, fat: 25, carbs: 80,
  ingredients: [
    `Makaron ${shape} - 100g`,
    `Sos/Baza: ${sauceName} - 150g`,
    `Dodatek: ${addOn} - 100g`,
    "Parmezan lub inny ser twardy - 10g",
    "Ząbek czosnku"
  ],
  instructions: [
    `W dużym garnku zagotuj wodę, posól obficie. Wrzuć makaron (${shape}) i gotuj al dente (1 min krócej niż na opakowaniu).`,
    "W międzyczasie na patelni podsmaż posiekany czosnek.",
    `Dodaj na patelnię składnik: ${addOn} i smaż przez 3 minuty.`,
    `Wlej/Dodaj: ${sauceName}. Duś na wolnym ogniu.`,
    "Makaron przełóż łyżką cedzakową bezpośrednio z wody na patelnię z sosem (nie odcedzaj całkowicie - woda z makaronu zagęści sos).",
    "Wymieszaj energicznie na patelni przez minutę. Podawaj posypane serem."
  ]
});

// --- 5. GENERATOR KOLACJI (Kanapki/Sałatki) ---
const createSupper = (base: string, main: string, side: string, cuisine: string): Recipe => ({
  name: `Lekka Kolacja: ${base} z ${main}`,
  category: 'kolacja',
  cuisine: cuisine,
  kcal: 350, protein: 20, fat: 15, carbs: 40,
  ingredients: [
    `${base} - porcja standardowa`,
    `${main} - 100g`,
    `${side} - bez limitu`,
    "Masło/Oliwa - 5g"
  ],
  instructions: [
    "To szybki posiłek. Skup się na świeżości produktów.",
    `Przygotuj bazę: ${base}. Jeśli to pieczywo, możesz je zrumienić w tosterze.`,
    `Przygotuj główny składnik: ${main}. Pokrój, wymieszaj lub usmaż (zależnie od produktu).`,
    `Na talerzu ułóż dużą porcję warzywa: ${side}.`,
    "Połącz wszystko i dopraw do smaku ziołami."
  ]
});

// =================================================================
// 📦 BAZA DANYCH (Wygenerowana + Statyczna)
// =================================================================

const sniadania: Recipe[] = [
  // Owsianki
  createOatmeal("Jabłko i Cynamon", "Orzechy Włoskie", "Mleko 1.5%", 50, "Polska"),
  createOatmeal("Banan", "Masło Orzechowe", "Napój Migdałowy", 100, "Amerykańska"),
  createOatmeal("Mrożone Owoce Leśne", "Wiórki Kokosowe", "Mleko", 40, "Fit"),
  createOatmeal("Gruszka", "Migdały", "Woda", 30, "Fit"),
  createOatmeal("Mango", "Chia", "Mleczko kokosowe light", 80, "Azjatycka"),
  createOatmeal("Starta Marchewka (a'la ciasto)", "Rodzynki", "Mleko", 60, "Amerykańska"),
  
  // Jajecznice
  createScramble("Szynka Chuda", "Pomidor", 50, "Polska"),
  createScramble("Boczek Wędzony", "Cebulka", 150, "Polska"),
  createScramble("Łosoś Wędzony", "Szpinak", 80, "Fit"),
  createScramble("Pieczarki", "Szczypiorek", 20, "Polska"),
  createScramble("Chorizo", "Papryka", 120, "Hiszpańska"),
  createScramble("Feta", "Oliwki", 90, "Grecka"),

  // Inne
  {
    name: "Szakszuka Klasyczna (Jajka w pomidorach)",
    category: "sniadanie",
    cuisine: "Bliskowschodnia",
    kcal: 400, protein: 18, fat: 20, carbs: 30,
    ingredients: ["2 jajka", "Puszka pomidorów krojonych", "1/2 Cebuli", "Ząbek czosnku", "Kmin rzymski (kumin)", "Oliwa"],
    instructions: ["Cebulę i czosnek posiekaj, zeszklij na oliwie.", "Dodaj pomidory i przyprawy (kumin, sól, pieprz). Duś 5 minut aż sos zgęstnieje.", "Zrób wgłębienia w sosie i wbij w nie jajka.", "Przykryj patelnię i duś 3-4 minuty, aż białka się zetną, a żółtka pozostaną płynne."]
  },
  {
    name: "Omlet 'Czysty' z serkiem wiejskim",
    category: "sniadanie",
    cuisine: "Fit",
    kcal: 450, protein: 35, fat: 20, carbs: 10,
    ingredients: ["2 jajka", "Serek wiejski lekki 150g", "Mąka pełnoziarnista 1 łyżka", "Szczypiorek"],
    instructions: ["Jajka roztrzep z mąką.", "Dodaj odsączony serek wiejski i wymieszaj.", "Wylej na rozgrzaną patelnię.", "Smaż pod przykryciem na małym ogniu, aż góra się zetnie."]
  }
];

const drugieSniadania: Recipe[] = [
  {
    name: "Serek Wiejski 'Na Wypasie'",
    category: "drugie_sniadanie",
    cuisine: "Polska",
    kcal: 250, protein: 22, fat: 10, carbs: 8,
    ingredients: ["Serek wiejski 200g", "Rzodkiewka 5 szt", "Ogórek zielony", "Szczypiorek", "Pestki dyni 10g"],
    instructions: ["Warzywa pokrój w drobną kostkę.", "Wymieszaj z serkiem.", "Posyp prażonymi pestkami dyni."]
  },
  {
    name: "Koktajl 'Zielony Potwór'",
    category: "drugie_sniadanie",
    cuisine: "Fit",
    kcal: 300, protein: 25, fat: 5, carbs: 40,
    ingredients: ["Szpinak świeży - garść", "1 Banan", "Odżywka białkowa 20g", "Woda 200ml", "Sok z cytryny"],
    instructions: ["Wszystkie składniki wrzuć do blendera.", "Miksuj 30 sekund na najwyższych obrotach.", "Pij schłodzone."]
  },
  {
    name: "Jogurt z Granolą",
    category: "drugie_sniadanie",
    cuisine: "Standard",
    kcal: 350, protein: 12, fat: 10, carbs: 50,
    ingredients: ["Jogurt naturalny gęsty 180g", "Granola owocowa 40g", "Borówki amerykańskie"],
    instructions: ["Przełóż jogurt do miseczki.", "Posyp granolą i owocami tuż przed zjedzeniem, aby granola nie namokła."]
  }
];

const obiady: Recipe[] = [
  // Generowane Bowle (Ryż/Kasza)
  createLunchBowl("Ryż Basmati", "Pierś z Kurczaka", "Warzywa Chińskie", "Sos Sojowy i Imbir", "Azjatycka"),
  createLunchBowl("Kasza Gryczana", "Gulasz Wołowy", "Ogórek Kiszony", "Sos Własny Ciemny", "Polska"),
  createLunchBowl("Ziemniaki Gotowane", "Kotlet Schabowy (pieczony)", "Mizeria z jogurtem", "Koperek", "Polska"),
  createLunchBowl("Ryż Jaśminowy", "Krewetki", "Cukinia i Papryka", "Mleczko Kokosowe + Curry", "Tajska"),
  createLunchBowl("Kasza Pęczak", "Pieczarki Duszone", "Natka Pietruszki", "Sos Śmietanowy", "Polska"),
  createLunchBowl("Makaron Ryżowy", "Tofu Wędzone", "Kiełki Fasoli Mung", "Sos Orzechowy (Satay)", "Wietnamska"),
  createLunchBowl("Bataty Pieczone", "Łosoś Pieczony", "Brokuły na parze", "Sok z cytryny", "Fit"),
  createLunchBowl("Ryż Brązowy", "Indyk Mielony", "Fasola Czerwona i Kukurydza", "Przecier Pomidorowy (Chili)", "Meksykańska"),

  // Generowane Makarony
  createPasta("Spaghetti", "Sos Bolognese (mięso wołowe)", "Bazylia świeża", "Włoska"),
  createPasta("Penne", "Sos Carbonara (boczek, żółtka)", "Pieprz świeżo mielony", "Włoska"),
  createPasta("Fusilli (Świdry)", "Pesto Zielone", "Kurczak Grillowany", "Włoska"),
  createPasta("Tagliatelle", "Sos Śmietanowy z Łososiem", "Koperek", "Śródziemnomorska"),
  createPasta("Rurki", "Sos Pomidorowy Arrabbiata (ostry)", "Oliwki czarne", "Włoska"),
  createPasta("Pełnoziarnisty", "Twaróg chudy i Boczek", "Cebulka zeszklona", "Polska"),

  // Klasyki manualne
  {
    name: "Tradycyjne Pierogi Ruskie (Gotowe)",
    category: "obiad",
    cuisine: "Polska",
    kcal: 600, protein: 18, fat: 20, carbs: 80,
    ingredients: ["Pierogi Ruskie - 10-12 sztuk", "Cebula - 1 szt", "Masło - 10g", "Śmietana do polania (opcja)"],
    instructions: ["Pierogi wrzuć na wrzącą, osoloną wodę.", "Gotuj 2 minuty od wypłynięcia.", "Cebulę pokrój w kostkę i zeszklij na maśle.", "Podawaj pierogi okraszone cebulką."]
  },
  {
    name: "Burger Domowy Wołowy",
    category: "obiad",
    cuisine: "Amerykańska",
    kcal: 750, protein: 45, fat: 35, carbs: 60,
    ingredients: ["Bułka do burgera", "Mięso wołowe mielone 150g", "Ser Cheddar plaster", "Pomidor, Sałata, Ogórek", "Sos musztardowy"],
    instructions: ["Mięso uformuj w płaski kotlet, dopraw solą i pieprzem tylko z wierzchu.", "Smaż na mocno rozgrzanej patelni po 3 minuty z każdej strony.", "Pod koniec połóż ser na mięsie, by się stopił.", "Bułkę podpiecz. Złóż burgera: bułka, sos, sałata, mięso, warzywa, bułka."]
  }
];

const kolacje: Recipe[] = [
  // Generowane
  createSupper("Chleb Żytni (2 kromki)", "Szynka z Indyka", "Pomidor z cebulką", "Polska"),
  createSupper("Chleb Razowy (2 kromki)", "Ser Żółty Gouda", "Ogórek Kiszony", "Polska"),
  createSupper("Bułka Grahamka", "Pasta z Tuńczyka i Jajka", "Sałata Lodowa", "Standard"),
  createSupper("Mix Sałat", "Ser Feta i Oliwki", "Pomidor i Ogórek (Sałatka Grecka)", "Grecka"),
  createSupper("Tortilla Pełnoziarnista", "Grillowany Kurczak", "Warzywa i Sos Czosnkowy (Wrap)", "Meksykańska"),
  createSupper("Chleb Tostowy", "Mozzarella i Pesto (Tosty)", "Rukola", "Włoska"),
  createSupper("Wafle Ryżowe (4 szt)", "Serek Grani", "Rzodkiewka", "Fit"),
  
  // Manualne
  {
    name: "Carpaccio z Pieczonego Buraka",
    category: "kolacja",
    cuisine: "Fit",
    kcal: 250, protein: 8, fat: 15, carbs: 20,
    ingredients: ["Burak pieczony/gotowany - 2 szt", "Ser Feta - 30g", "Rukola - garść", "Orzechy włoskie - 10g", "Oliwa, ocet balsamiczny"],
    instructions: ["Buraki pokrój w bardzo cienkie, niemal przezroczyste plastry.", "Ułóż na talerzu na rukoli.", "Posyp pokruszoną fetą i orzechami.", "Skrop oliwą i octem."]
  }
];

const przekaski: Recipe[] = [
  { name: "Jabłko", category: "przekaska", cuisine: "Uniwersalna", kcal: 80, protein: 0, fat: 0, carbs: 20, ingredients: ["1 Jabłko"], instructions: ["Umyj i zjedz."] },
  { name: "Banan", category: "przekaska", cuisine: "Uniwersalna", kcal: 100, protein: 1, fat: 0, carbs: 25, ingredients: ["1 Banan"], instructions: ["Obierz i zjedz."] },
  { name: "Orzechy Włoskie", category: "przekaska", cuisine: "Uniwersalna", kcal: 200, protein: 4, fat: 18, carbs: 3, ingredients: ["Orzechy 30g"], instructions: ["Chrup na zdrowie."] },
  { name: "Skyr Owocowy", category: "przekaska", cuisine: "Fit", kcal: 150, protein: 15, fat: 0, carbs: 20, ingredients: ["Skyr 150g"], instructions: ["Zjedz łyżeczką."] },
  { name: "Kabanosy", category: "przekaska", cuisine: "Polska", kcal: 180, protein: 10, fat: 15, carbs: 1, ingredients: ["Kabanosy drobiowe 50g"], instructions: ["Zjedz."] }
];

// --- GŁÓWNY EKSPORT (Łączymy wszystko) ---
export const RECIPES_DB: Recipe[] = [
  ...sniadania,
  ...drugieSniadania,
  ...obiady,
  ...kolacje,
  ...przekaski
];
