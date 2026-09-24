/** Strings in every app language and small pure helpers for the home, catalogue, game, ways and setup screens. */
import { localized } from "../../i18n";
import { GAMES, SETUP } from "../../constants/games";
import type { GameEntry } from "../../types/game";

export const T = localized("games", {
  en: {
    home: {
      title: "TashZone", sub: "A table for the games you grew up with.",
      level: (n: number) => `Level ${n}`,
      stats: ["Matches", "Wins", "Streak", "Bhabhi"] as [string, string, string, string],
      pick: "Pick a game", all: (n: number) => `All ${n} ›`,
      join: "Join a friend", joinNearby: "Nearby", joinCode: "Room code",
    },
    tile: {
      last: "last played", soon: "Coming soon", solo: "Solo",
      players: (n: string) => `${n} players`,
      play: (n: string) => `Deal ${n} now`, open: (n: string) => `${n}, open game page`,
    },
    difficulty: { Easy: "Easy", Medium: "Medium", Hard: "Hard" },
    games: {
      title: "Games", search: "Search games", placeholder: "Search: Bhabhi, Rung, Thulla…",
      count: (n: number, all: number) => (n === all ? `${all} ${all === 1 ? "game" : "games"}` : `${n} of ${all}`),
      filters: { all: "All", play: "Ready", soon: "Coming soon" },
      emptyTitle: (q: string) => `Nothing called “${q}”`, emptyHint: "Try a local name: Rung, Thulla, Get Away, Sweep.", showAll: "Show all",
      emptyFilterTitle: "No games here yet", emptyFilterHint: "Nothing matches this filter.",
      inDev: "In development",
    },
    detail: {
      rules: "Rules", tags: "Features", play: "Play", soon: "Coming soon", soonNote: "Still in development. You can't deal it yet.",
      notFound: "Game not found", notFoundBody: "This game isn't in the catalogue. It may be renamed or removed.", back: "Back to games",
      players: (a: string) => `${a} players`, pick: "Rules for this game are still being written.",
      aka: "Also called",
    },
    ways: {
      title: "Ways to play", rules: "Rules",
      bots: { t: "Play with bots", d: "Offline · saved after every move", b: "Offline" },
      pass: { t: "Pass and play", d: "One phone, hand it round", b: "One phone" },
      wifi: { t: "Same Wi-Fi", d: "Host a table for friends on one network", b: "No internet" },
      room: { t: "Private room", d: "Share a six-character code", b: "Online" },
      later: "Later", soonGame: "This game is still in development.", soonMode: "Coming soon",
    },
    setup: {
      title: "Play with bots", rules: "Rules in play", length: "Length", players: "Players", bots: "Bot skill", deal: "Deal",
      playersHint: "Bots fill empty seats.", start: "Deal the cards", notPlayable: "This game can't be dealt yet.",
      notFound: "There's no bot table for this game.",
      levels: [
        { id: "easy", label: "Easy", hint: "Plays a legal card, forgets the table." },
        { id: "medium", label: "Medium", hint: "Reads voids and holds its high cards back." },
        { id: "hard", label: "Professional", hint: "Counts every card and hunts for the trap." },
      ],
    },
  },
  ur: {
    home: {
      title: "TashZone", sub: "بچپن کے کھیلوں کی میز۔",
      level: (n: number) => `لیول ${n}`,
      stats: ["میچ", "جیت", "لگاتار", "بھابھی"],
      pick: "کھیل چنیں", all: (n: number) => `سب ${n} ‹`,
      join: "دوست کے ساتھ", joinNearby: "قریب", joinCode: "کمرے کا کوڈ",
    },
    tile: {
      last: "آخری کھیل", soon: "جلد آ رہا ہے", solo: "اکیلے",
      players: (n: string) => `${n} کھلاڑی`,
      play: (n: string) => `${n} ابھی بانٹیں`, open: (n: string) => `${n}، کھیل کا صفحہ کھولیں`,
    },
    difficulty: { Easy: "آسان", Medium: "درمیانہ", Hard: "مشکل" },
    games: {
      title: "کھیل", search: "کھیل تلاش کریں", placeholder: "تلاش: Bhabhi، رنگ، ٹھلا…",
      count: (n: number, all: number) => (n === all ? `${all} کھیل` : `${all} میں سے ${n}`),
      filters: { all: "سب", play: "تیار", soon: "جلد آ رہے ہیں" },
      emptyTitle: (q: string) => `"${q}" نہیں ملا`, emptyHint: "مقامی نام آزمائیں: رنگ، ٹھلا، سویپ۔", showAll: "سب دکھائیں",
      emptyFilterTitle: "یہاں ابھی کوئی کھیل نہیں", emptyFilterHint: "اس فلٹر سے کچھ نہیں ملا۔",
      inDev: "تیاری میں",
    },
    detail: {
      rules: "قوانین", tags: "خصوصیات", play: "کھیلیں", soon: "جلد آ رہا ہے", soonNote: "ابھی تیاری میں ہے، بانٹ نہیں سکتے۔",
      notFound: "کھیل نہیں ملا", notFoundBody: "یہ کھیل فہرست میں نہیں۔ شاید نام بدل گیا یا ہٹا دیا گیا۔", back: "کھیلوں پر واپس",
      players: (a: string) => `${a} کھلاڑی`, pick: "اس کھیل کے قوانین ابھی لکھے جا رہے ہیں۔",
      aka: "دوسرا نام",
    },
    ways: {
      title: "کھیلنے کے طریقے", rules: "قوانین",
      bots: { t: "بوٹس کے ساتھ", d: "آف لائن · ہر چال پر محفوظ", b: "آف لائن" },
      pass: { t: "باری باری", d: "ایک فون، ہاتھوں ہاتھ", b: "ایک فون" },
      wifi: { t: "ایک ہی Wi-Fi", d: "ایک نیٹ ورک پر دوستوں کے لیے میز لگائیں", b: "انٹرنیٹ نہیں" },
      room: { t: "نجی کمرہ", d: "چھ حرفی کوڈ بھیجیں", b: "آن لائن" },
      later: "بعد میں", soonGame: "یہ کھیل ابھی تیاری میں ہے۔", soonMode: "جلد آ رہا ہے",
    },
    setup: {
      title: "بوٹس کے ساتھ", rules: "قوانین", length: "لمبائی", players: "کھلاڑی", bots: "بوٹ کی مہارت", deal: "بانٹ",
      playersHint: "خالی سیٹوں پر بوٹ بیٹھیں گے۔", start: "پتے بانٹیں", notPlayable: "یہ کھیل ابھی بانٹا نہیں جا سکتا۔",
      notFound: "اس کھیل کی بوٹ میز نہیں ہے۔",
      levels: [
        { id: "easy", label: "آسان", hint: "درست پتا ڈالتا ہے، میز یاد نہیں رکھتا۔" },
        { id: "medium", label: "درمیانہ", hint: "خالی سوٹ پہچانتا ہے، بڑے پتے بچاتا ہے۔" },
        { id: "hard", label: "ماہر", hint: "ہر پتا گنتا ہے، جال ڈھونڈتا ہے۔" },
      ],
    },
  },
  hi: {
    home: {
      title: "TashZone", sub: "बचपन के खेलों की टेबल।",
      level: (n: number) => `लेवल ${n}`,
      stats: ["मैच", "जीत", "लगातार", "भाभी"],
      pick: "खेल चुनें", all: (n: number) => `सभी ${n} ›`,
      join: "दोस्त के साथ", joinNearby: "पास में", joinCode: "रूम कोड",
    },
    tile: {
      last: "पिछला खेल", soon: "जल्द आ रहा है", solo: "अकेले",
      players: (n: string) => `${n} खिलाड़ी`,
      play: (n: string) => `${n} अभी बाँटें`, open: (n: string) => `${n}, खेल का पेज खोलें`,
    },
    difficulty: { Easy: "आसान", Medium: "मध्यम", Hard: "मुश्किल" },
    games: {
      title: "खेल", search: "खेल खोजें", placeholder: "खोजें: Bhabhi, रंग, ठुल्ला…",
      count: (n: number, all: number) => (n === all ? `${all} खेल` : `${all} में से ${n}`),
      filters: { all: "सभी", play: "तैयार", soon: "जल्द आ रहे" },
      emptyTitle: (q: string) => `“${q}” नहीं मिला`, emptyHint: "स्थानीय नाम आज़माएँ: रंग, ठुल्ला, स्वीप।", showAll: "सब दिखाएँ",
      emptyFilterTitle: "यहाँ अभी कोई खेल नहीं", emptyFilterHint: "इस फ़िल्टर से कुछ नहीं मिला।",
      inDev: "तैयार हो रहा है",
    },
    detail: {
      rules: "नियम", tags: "ख़ासियतें", play: "खेलें", soon: "जल्द आ रहा है", soonNote: "अभी तैयार हो रहा है, बाँट नहीं सकते।",
      notFound: "खेल नहीं मिला", notFoundBody: "यह खेल सूची में नहीं। शायद नाम बदला या हटा दिया गया।", back: "खेलों पर लौटें",
      players: (a: string) => `${a} खिलाड़ी`, pick: "इस खेल के नियम अभी लिखे जा रहे हैं।",
      aka: "दूसरा नाम",
    },
    ways: {
      title: "खेलने के तरीके", rules: "नियम",
      bots: { t: "बॉट्स के साथ", d: "ऑफ़लाइन · हर चाल पर सेव", b: "ऑफ़लाइन" },
      pass: { t: "बारी-बारी", d: "एक फ़ोन, हाथों-हाथ", b: "एक फ़ोन" },
      wifi: { t: "एक ही Wi-Fi", d: "एक नेटवर्क पर दोस्तों के लिए टेबल लगाएँ", b: "बिना इंटरनेट" },
      room: { t: "निजी रूम", d: "छह अक्षरों का कोड भेजें", b: "ऑनलाइन" },
      later: "बाद में", soonGame: "यह खेल अभी तैयार हो रहा है।", soonMode: "जल्द आ रहा है",
    },
    setup: {
      title: "बॉट्स के साथ", rules: "नियम", length: "लंबाई", players: "खिलाड़ी", bots: "बॉट का स्तर", deal: "बँटाई",
      playersHint: "खाली सीटों पर बॉट बैठेंगे।", start: "पत्ते बाँटें", notPlayable: "यह खेल अभी बाँटा नहीं जा सकता।",
      notFound: "इस खेल की बॉट टेबल नहीं है।",
      levels: [
        { id: "easy", label: "आसान", hint: "सही पत्ता डालता है, टेबल याद नहीं रखता।" },
        { id: "medium", label: "मध्यम", hint: "खाली सूट पहचानता है, बड़े पत्ते बचाता है।" },
        { id: "hard", label: "माहिर", hint: "हर पत्ता गिनता है, जाल ढूँढता है।" },
      ],
    },
  },
  ne: {
    home: {
      title: "TashZone", sub: "सानैदेखि खेलेका खेलको टेबल।",
      level: (n: number) => `लेभल ${n}`,
      stats: ["म्याच", "जित", "लगातार", "भाभी"],
      pick: "खेल छान्नुहोस्", all: (n: number) => `सबै ${n} ›`,
      join: "साथीसँग", joinNearby: "नजिकै", joinCode: "कोठाको कोड",
    },
    tile: {
      last: "पछिल्लो खेल", soon: "छिट्टै आउँदै", solo: "एक्लै",
      players: (n: string) => `${n} खेलाडी`,
      play: (n: string) => `${n} अहिले बाँड्नुहोस्`, open: (n: string) => `${n}, खेलको पेज खोल्नुहोस्`,
    },
    difficulty: { Easy: "सजिलो", Medium: "मध्यम", Hard: "कठिन" },
    games: {
      title: "खेलहरू", search: "खेल खोज्नुहोस्", placeholder: "खोज्नुहोस्: Bhabhi, रङ, ठुल्ला…",
      count: (n: number, all: number) => (n === all ? `${all} खेल` : `${all} मध्ये ${n}`),
      filters: { all: "सबै", play: "तयार", soon: "छिट्टै आउँदै" },
      emptyTitle: (q: string) => `“${q}” भेटिएन`, emptyHint: "स्थानीय नाम खोज्नुहोस्: रङ, ठुल्ला, स्विप।", showAll: "सबै देखाउनुहोस्",
      emptyFilterTitle: "यहाँ अहिले कुनै खेल छैन", emptyFilterHint: "यो फिल्टरमा केही भेटिएन।",
      inDev: "तयार हुँदै",
    },
    detail: {
      rules: "नियम", tags: "विशेषता", play: "खेल्नुहोस्", soon: "छिट्टै आउँदै", soonNote: "अझै तयार हुँदैछ, बाँड्न मिल्दैन।",
      notFound: "खेल भेटिएन", notFoundBody: "यो खेल सूचीमा छैन। नाम फेरिएको वा हटाइएको हुन सक्छ।", back: "खेलहरूमा फर्कनुहोस्",
      players: (a: string) => `${a} खेलाडी`, pick: "यो खेलका नियम अझै लेखिँदैछन्।",
      aka: "अर्को नाम",
    },
    ways: {
      title: "खेल्ने तरिका", rules: "नियम",
      bots: { t: "बटसँग खेल्ने", d: "अफलाइन · हरेक चालपछि सेभ", b: "अफलाइन" },
      pass: { t: "पालैपालो", d: "एउटै फोन, हातहातै", b: "एउटा फोन" },
      wifi: { t: "एउटै Wi-Fi", d: "एउटै नेटवर्कमा साथीहरूका लागि टेबल खोल्नुहोस्", b: "इन्टरनेट चाहिँदैन" },
      room: { t: "निजी कोठा", d: "छ अक्षरको कोड पठाउनुहोस्", b: "अनलाइन" },
      later: "पछि", soonGame: "यो खेल अझै तयार हुँदैछ।", soonMode: "छिट्टै आउँदै",
    },
    setup: {
      title: "बटसँग खेल्ने", rules: "नियम", length: "अवधि", players: "खेलाडी", bots: "बटको सीप", deal: "बाँडाइ",
      playersHint: "खाली सिटमा बट बस्छन्।", start: "पत्ती बाँड्नुहोस्", notPlayable: "यो खेल अहिले बाँड्न मिल्दैन।",
      notFound: "यो खेलको बट टेबल छैन।",
      levels: [
        { id: "easy", label: "सजिलो", hint: "सही पत्ती फाल्छ, टेबल सम्झँदैन।" },
        { id: "medium", label: "मध्यम", hint: "कसको कुन रङ सकियो बुझ्छ, ठूला पत्ती जोगाउँछ।" },
        { id: "hard", label: "सिपालु", hint: "हरेक पत्ती गन्छ र पासो खोज्छ।" },
      ],
    },
  },
  bn: {
    home: {
      title: "TashZone", sub: "ছোটবেলার খেলাগুলোর টেবিল।",
      level: (n: number) => `লেভেল ${n}`,
      stats: ["ম্যাচ", "জয়", "টানা", "ভাবি"],
      pick: "খেলা বাছুন", all: (n: number) => `সব ${n} ›`,
      join: "বন্ধুর সঙ্গে", joinNearby: "কাছাকাছি", joinCode: "রুম কোড",
    },
    tile: {
      last: "শেষ খেলা", soon: "শিগগিরই আসছে", solo: "একা",
      players: (n: string) => `${n} জন`,
      play: (n: string) => `${n} এখনই বাঁটুন`, open: (n: string) => `${n}, খেলার পাতা খুলুন`,
    },
    difficulty: { Easy: "সহজ", Medium: "মাঝারি", Hard: "কঠিন" },
    games: {
      title: "খেলা", search: "খেলা খুঁজুন", placeholder: "খুঁজুন: Bhabhi, রং, ঠুল্লা…",
      count: (n: number, all: number) => (n === all ? `${all}টি খেলা` : `${all}টির মধ্যে ${n}টি`),
      filters: { all: "সব", play: "তৈরি", soon: "শিগগিরই" },
      emptyTitle: (q: string) => `“${q}” নামে কিছু নেই`, emptyHint: "স্থানীয় নাম লিখে দেখুন: রং, ঠুল্লা, সুইপ।", showAll: "সব দেখুন",
      emptyFilterTitle: "এখানে এখনো কোনো খেলা নেই", emptyFilterHint: "এই ফিল্টারে কিছু মেলেনি।",
      inDev: "তৈরি হচ্ছে",
    },
    detail: {
      rules: "নিয়ম", tags: "বৈশিষ্ট্য", play: "খেলুন", soon: "শিগগিরই আসছে", soonNote: "এখনো তৈরি হচ্ছে, বাঁটা যাবে না।",
      notFound: "খেলা পাওয়া যায়নি", notFoundBody: "এই খেলা তালিকায় নেই। হয়তো নাম বদলেছে বা সরানো হয়েছে।", back: "খেলায় ফিরুন",
      players: (a: string) => `${a} জন`, pick: "এই খেলার নিয়ম এখনো লেখা হচ্ছে।",
      aka: "অন্য নাম",
    },
    ways: {
      title: "খেলার উপায়", rules: "নিয়ম",
      bots: { t: "বটের সঙ্গে", d: "অফলাইন · প্রতি চালে সেভ", b: "অফলাইন" },
      pass: { t: "পালা করে", d: "এক ফোন, হাতে হাতে", b: "এক ফোন" },
      wifi: { t: "একই Wi-Fi", d: "এক নেটওয়ার্কে বন্ধুদের জন্য টেবিল খুলুন", b: "ইন্টারনেট ছাড়া" },
      room: { t: "প্রাইভেট রুম", d: "ছয় অক্ষরের কোড পাঠান", b: "অনলাইন" },
      later: "পরে", soonGame: "এই খেলা এখনো তৈরি হচ্ছে।", soonMode: "শিগগিরই আসছে",
    },
    setup: {
      title: "বটের সঙ্গে", rules: "নিয়ম", length: "দৈর্ঘ্য", players: "খেলোয়াড়", bots: "বটের দক্ষতা", deal: "বাঁটা",
      playersHint: "খালি আসনে বট বসবে।", start: "তাস বাঁটুন", notPlayable: "এই খেলা এখনো বাঁটা যাবে না।",
      notFound: "এই খেলার বট টেবিল নেই।",
      levels: [
        { id: "easy", label: "সহজ", hint: "নিয়মমতো তাস দেয়, টেবিল মনে রাখে না।" },
        { id: "medium", label: "মাঝারি", hint: "কার কোন রং নেই বোঝে, বড় তাস ধরে রাখে।" },
        { id: "hard", label: "দক্ষ", hint: "প্রতিটি তাস গোনে, ফাঁদ খোঁজে।" },
      ],
    },
  },
});

export const SUIT_GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;

export const difficultyText = (g: GameEntry): string | undefined => (g.difficulty ? T.difficulty[g.difficulty] : undefined);
export const playable = (g: GameEntry): boolean => g.status === "play" && !!g.profile && !!SETUP[g.profile];
export const findGame = (id: string | undefined): GameEntry | undefined => GAMES.find((g) => g.id === id);
export const playersText = (g: GameEntry): string => {
  const [a, b] = g.seats ?? [4, 4];
  return a === b ? String(a) : `${a}–${b}`;
};

export interface BotSetup { preset: string; length: number; players: number; level: "easy" | "medium" | "hard"; handicap: number }

/** Defaults for a bot table of this game (same defaults the setup screen opens with). */
export function defaultSetup(g: GameEntry): BotSetup | undefined {
  const info = g.profile ? SETUP[g.profile] : undefined;
  if (!info) return undefined;
  const [lo, hi] = g.seats ?? [4, 4];
  const want = Math.min(Math.max(4, lo), hi);
  const players = info.players ? (info.players.includes(want) ? want : info.players[0]!) : want;
  return { preset: info.presets[0]!.id, length: info.defaultLength, players, level: "medium", handicap: 0 };
}

/** Route params for /play/[game]: all strings; `length` is the index into SETUP.lengths. */
export function playParams(g: GameEntry, c: BotSetup): Record<string, string> {
  return { game: g.id, preset: c.preset, length: String(c.length), players: String(c.players), level: c.level, handicap: String(c.handicap) };
}
