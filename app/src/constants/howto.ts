/**
 * "How to play" basics in every app language. Card ids are rank + suit ("AS", "TH" = ten of hearts) as used by the table.
 * Ranking is natural, ace high, as in every playable profile of Docs/specs/01_GAME_RULES.md.
 */
import { localized, type Lang } from "../i18n";
import { ur } from "./lang/ur";
import { hi } from "./lang/hi";
import { ne } from "./lang/ne";
import { bn } from "./lang/bn";

export interface CardExample {
  caption: string;
  cards: string[];
  /** index of the card that wins, highlighted */
  winner?: number;
}
export interface HowToSection { id: string; title: string; body: string[]; examples?: CardExample[] }

const LAYOUT: { id: "ranks" | "tricks" | "follow" | "trump" | "teams"; examples?: Omit<CardExample, "caption">[] }[] = [
  { id: "ranks", examples: [{ cards: ["2S", "5S", "TS", "JS", "QS", "KS", "AS"] }] },
  { id: "tricks", examples: [{ cards: ["7H", "KH", "3H", "9H"], winner: 1 }] },
  { id: "follow", examples: [{ cards: ["6H", "QD", "8H", "2S"], winner: 2 }] },
  { id: "trump", examples: [{ cards: ["7H", "KH", "4S", "9H"], winner: 2 }] },
  { id: "teams" },
];
type SectionId = (typeof LAYOUT)[number]["id"];

/** Everything a language supplies for the how-to page; captions line up with the examples above. */
export interface HowToText {
  intro: string;
  sections: Record<SectionId, { title: string; body: string[]; captions: string[] }>;
}

const EN: HowToText = {
  intro: "The basics that every game here builds on. Each game's own rules are one tap away.",
  sections: {
    ranks: {
      title: "Cards and ranks",
      body: ["One deck has 52 cards in four suits: spades, hearts, diamonds and clubs.", "Within a suit, cards rank from the 2 up to the ace. The ace is the highest."],
      captions: ["Low to high: 2, 5, 10, jack, queen, king, ace"],
    },
    tricks: {
      title: "Tricks",
      body: [
        "A trick is one round of play. The first player leads any card, and each player plays one card in turn.",
        "The highest card of the led suit wins the trick, and its winner leads the next one.",
      ],
      captions: ["Hearts are led. The king of hearts is highest and wins"],
    },
    follow: {
      title: "Following suit",
      body: ["If you hold a card of the led suit, you play one. If you do not, the game's own rules say what you may play instead."],
      captions: ["Hearts are led. With a heart in hand, you play a heart"],
    },
    trump: {
      title: "Trump",
      body: [
        "In games with a trump suit, any trump beats every card of the other suits.",
        "Callbreak and Call Bridge always use spades. In Court Piece a player names the trump after the first 5 cards. Bhabhi has no trump.",
      ],
      captions: ["Hearts are led, spades are trump. A small spade beats the king of hearts"],
    },
    teams: {
      title: "Solo and partners",
      body: ["Callbreak, Call Bridge and Bhabhi are every player for themselves.", "Court Piece is played in teams: partners sit opposite each other and win tricks together."],
      captions: [],
    },
  },
};

function build(text: HowToText): { intro: string; sections: HowToSection[] } {
  return {
    intro: text.intro,
    sections: LAYOUT.map((l) => {
      const s = text.sections[l.id];
      const sec: HowToSection = { id: l.id, title: s.title, body: s.body };
      if (l.examples) sec.examples = l.examples.map((ex, i) => ({ ...ex, caption: s.captions[i]! }));
      return sec;
    }),
  };
}

export const HOWTO_TEXTS: Record<Lang, HowToText> = { en: EN, ur: ur.howto, hi: hi.howto, ne: ne.howto, bn: bn.howto };

export const HOWTO = localized("howto", { en: build(EN), ur: build(ur.howto), hi: build(hi.howto), ne: build(ne.howto), bn: build(bn.howto) });
