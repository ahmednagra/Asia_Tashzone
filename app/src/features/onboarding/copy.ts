/** All onboarding strings in one place (translate later). */
export const T = {
  tagline: "Card games from the subcontinent, on one table. Real rules, fair deals.",
  start: "Start playing",
  continueAs: (n: string) => `Continue as ${n}`,
  privacy: "No sign-up. Everything stays on this phone.",
  langTitle: "Language",
  langNote: "Each language is shown in its own script. You can change this later in Settings.",
  cont: "Continue",
  yearTitle: "Birth year",
  yearBody: "What year were you born? This stays on your phone and is never sent anywhere.",
  pickYear: "Pick your birth year",
  pickHint: "Tap a year, or jump by 1 or 10 years.",
  noYear: "Birth year, not chosen",
  yearLabel: (y: number) => `Birth year ${y}`,
  protect: "Skip this and TashZone uses Protected Mode: no typing to other players, and online rooms stay off until a parent turns them on.",
  bornIn: (y: number) => `I was born in ${y}`,
  skip: "Skip for now",
  modeTitle: "How do you like to play?",
  easyT: "Easy", easyB: "Bigger cards and letters, four colours for the suits, a Hint button, no turn clock, slower dealing.",
  stdT: "Standard", stdB: "Regular cards, a 14-second turn clock, hints off. Any of this can change later in Settings.",
  chosen: "Chosen",
  modeNote: "Nothing here is permanent. Settings holds every switch on this screen.",
  nameTitle: "Your table name",
  nameLabel: "Your name", namePh: "Type a name", suggest: "Suggest another", clear: "Clear",
  pickAvatar: "Pick an avatar",
  nameNote: "Any name you like. Avatars are drawn, never photographs.",
} as const;

export const LANGS = [
  { k: "en", native: "English", en: "English" }, { k: "ur", native: "اردو", en: "Urdu" }, { k: "hi", native: "हिन्दी", en: "Hindi" },
  { k: "ne", native: "नेपाली", en: "Nepali" }, { k: "bn", native: "বাংলা", en: "Bengali" },
] as const;

export const NICKS = ["Calm Sparrow", "Quiet Falcon", "Steady Heron", "Bright Koel", "Patient Crane", "Swift Bulbul", "Clever Myna", "Warm Lantern", "Still River", "Night Jasmine"];
export const MIN_YEAR = 1930;
export const clampYear = (y: number, now = new Date().getFullYear()) => Math.max(MIN_YEAR, Math.min(now, y));
export const isProtectedForBirth = (born: number, now = new Date().getFullYear()) => now - born < 13;
