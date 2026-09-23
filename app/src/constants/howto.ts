/**
 * "How to play" basics (English). Card ids are rank + suit ("AS", "TH" = ten of hearts) as used by the table.
 * Ranking is natural, ace high, as in every playable profile of Docs/specs/01_GAME_RULES.md.
 */
export interface CardExample {
  caption: string;
  cards: string[];
  /** index of the card that wins, highlighted */
  winner?: number;
}
export interface HowToSection { id: string; title: string; body: string[]; examples?: CardExample[] }

export const HOWTO_INTRO = "The basics that every game here builds on. Each game's own rules are one tap away.";

export const HOWTO_SECTIONS: HowToSection[] = [
  {
    id: "ranks", title: "Cards and ranks",
    body: ["One deck has 52 cards in four suits: spades, hearts, diamonds and clubs.", "Within a suit, cards rank from the 2 up to the ace. The ace is the highest."],
    examples: [{ caption: "Low to high: 2, 5, 10, jack, queen, king, ace", cards: ["2S", "5S", "TS", "JS", "QS", "KS", "AS"] }],
  },
  {
    id: "tricks", title: "Tricks",
    body: [
      "A trick is one round of play. The first player leads any card, and each player plays one card in turn.",
      "The highest card of the led suit wins the trick, and its winner leads the next one.",
    ],
    examples: [{ caption: "Hearts are led. The king of hearts is highest and wins", cards: ["7H", "KH", "3H", "9H"], winner: 1 }],
  },
  {
    id: "follow", title: "Following suit",
    body: ["If you hold a card of the led suit, you play one. If you do not, the game's own rules say what you may play instead."],
    examples: [{ caption: "Hearts are led. With a heart in hand, you play a heart", cards: ["6H", "QD", "8H", "2S"], winner: 2 }],
  },
  {
    id: "trump", title: "Trump",
    body: [
      "In games with a trump suit, any trump beats every card of the other suits.",
      "Callbreak and Call Bridge always use spades. In Court Piece a player names the trump after the first 5 cards. Bhabhi has no trump.",
    ],
    examples: [{ caption: "Hearts are led, spades are trump. A small spade beats the king of hearts", cards: ["7H", "KH", "4S", "9H"], winner: 2 }],
  },
  {
    id: "teams", title: "Solo and partners",
    body: ["Callbreak, Call Bridge and Bhabhi are every player for themselves.", "Court Piece is played in teams: partners sit opposite each other and win tricks together."],
  },
];
