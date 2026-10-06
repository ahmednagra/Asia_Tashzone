/**
 * Rules reference copy in every app language. Source of truth: Docs/specs/01_GAME_RULES.md (profiles callbreak.np@1,
 * callbridge.bd@1, courtpiece.tz@1, bhabhi.tz@1 and the v1 addendum). Kept as typed data so it can be
 * translated and unit-tested; the UI only renders it.
 */
import { localized, type Lang } from "../i18n";
import { GAMES, presetLines } from "./games";
import { ur } from "./lang/ur";
import { hi } from "./lang/hi";
import { ne } from "./lang/ne";
import { bn } from "./lang/bn";

export interface RuleSection { id: string; title: string; body: string[] }
export interface RuleTerm { term: string; meaning: string }
export interface GameRules {
  gameId: string;
  /** who sits at the table, e.g. "4 players, each on their own" */
  players: string;
  /** one-sentence objective */
  goal: string;
  sections: RuleSection[];
  terms: RuleTerm[];
  /** things regions play differently; empty when the game has one accepted form */
  varies: string[];
}
/** Short preview for games that are not playable yet: no rules are promised before they ship. */
export interface Teaser { gameId: string; goal: string; deal?: string; terms: RuleTerm[] }

const SECTION_IDS = {
  callbreak: ["deal", "call", "play", "score", "win"],
  callbridge: ["deal", "call", "play", "score", "win"],
  courtpiece: ["teams", "deal", "play", "single", "double", "score", "dealer"],
  bhabhi: ["deal", "play", "away", "win", "handicap"],
} as const;
const PROFILES = { callbreak: "callbreak.np@1", callbridge: "callbridge.bd@1", courtpiece: "courtpiece.tz@1", bhabhi: "bhabhi.tz@1" } as const;
type PlayableId = keyof typeof SECTION_IDS;
type TeaserId = "marriage" | "twentynine" | "seep" | "teenpatti";
const TEASER_IDS: TeaserId[] = ["marriage", "twentynine", "seep", "teenpatti"];

interface SectionText { title: string; body: string[] }
export interface RulesText {
  stylesTitle: string;
  styleLine: (label: string, hint: string) => string;
  rules: { [G in PlayableId]: { players: string; goal: string; sections: Record<(typeof SECTION_IDS)[G][number], SectionText>; terms: RuleTerm[]; varies: string[] } };
  teasers: Record<TeaserId, { goal: string; deal?: string; terms: RuleTerm[] }>;
}

const CALLBREAK_DEAL = "Each player gets 13 cards, one at a time.";
const CALLBREAK_REDEAL = "No spade, or no ace, king, queen or jack? Show your hand and ask the same dealer to redeal. After three redeals in a row, the next deal is played as dealt.";

const EN: RulesText = {
  stylesTitle: "Styles you can pick",
  styleLine: (label, hint) => `${label}: ${hint}.`,
  rules: {
    callbreak: {
      players: "4 players, each on their own",
      goal: "Call how many tricks you'll win, then win at least that many. Spades are always trump.",
      sections: {
        deal: { title: "The deal", body: [CALLBREAK_DEAL, CALLBREAK_REDEAL] },
        call: { title: "Calling", body: ["From the player after the dealer, everyone calls once: 1 to 13 tricks.", "No passing: you must name a number."] },
        play: { title: "Playing a trick", body: [
          "The player after the dealer leads. Play goes counter-clockwise.",
          "Follow the led suit if you can, and beat the winning card if you're able.",
          "Out of the led suit? You must play a spade if it would win the trick. Otherwise play any card.",
          "Once a spade is in the trick, led-suit cards no longer have to beat anything.",
        ] },
        score: { title: "Scoring", body: ["Make your call: score what you called, plus 0.1 per extra trick.", "Miss your call: lose what you called."] },
        win: { title: "Winning", body: ["Highest total after the chosen rounds wins.", "Equal totals share a place."] },
      },
      terms: [
        { term: "Call", meaning: "The number of tricks you promise to win." },
        { term: "Trump", meaning: "Spades. A spade beats any card of another suit." },
        { term: "Redeal", meaning: "A fresh deal by the same dealer, allowed for a very weak hand." },
        { term: "Extra trick", meaning: "A trick won beyond your call. Each adds 0.1." },
      ],
      varies: ["Whether you must beat the winning card differs by region. Easy follow drops it; every table shows which style is on."],
    },
    callbridge: {
      players: "4 players, each on their own",
      goal: "Call how many tricks you'll win, then take exactly that many or one more.",
      sections: {
        deal: { title: "The deal", body: [CALLBREAK_DEAL, CALLBREAK_REDEAL] },
        call: { title: "Calling", body: ["Everyone calls once: 2 to 12 tricks. No passing."] },
        play: { title: "Playing a trick", body: [
          "Spades are trump. Play goes counter-clockwise from the player after the dealer.",
          "Follow the led suit if you can. You don't have to beat the winning card.",
          "Out of the led suit? You must play a spade if it would win the trick. Otherwise play any card.",
        ] },
        score: { title: "Scoring", body: [
          "Win exactly your call, or one more, and you score what you called.",
          "A made call of 8 or more scores a flat 13 instead.",
          "Win fewer, or two or more extra, and you lose what you called.",
        ] },
        win: { title: "Winning", body: ["Highest total after the chosen hands wins.", "Equal totals share a place."] },
      },
      terms: [
        { term: "Call", meaning: "The number of tricks you promise to win." },
        { term: "Trump", meaning: "Spades. A spade beats any card of another suit." },
        { term: "Bonus", meaning: "A flat 13 points, instead of the call, for a made call of 8 or more." },
      ],
      varies: [],
    },
    courtpiece: {
      players: "4 players in 2 teams of 2",
      goal: "Win tricks with your partner. A hand won scores 1 point; a court scores 3.",
      sections: {
        teams: { title: "Teams", body: ["Partners sit opposite: seats 1 and 3 against seats 2 and 4."] },
        deal: { title: "The deal and the rung", body: [
          "The player after the dealer gets 5 cards and names trump, called the rung.",
          "Everyone then gets 8 more, 4 and 4. Whoever named the rung leads.",
        ] },
        play: { title: "Playing a trick", body: ["Follow the led suit if you can. If not, play any card.", "You never have to beat the winning card or play trump."] },
        single: { title: "Single Sir", body: ["A hand ends once a team has 7 tricks.", "Winning 7 tricks to none is a court."] },
        double: { title: "Double Sir", body: [
          "Tricks pile up. When the same player wins two in a row, their team takes the pile.",
          "The last trick takes whatever is left. Taking all 13 is a court.",
          "In Double Sir with Ace, two aces in a row don't take the pile.",
        ] },
        score: { title: "Scoring", body: ["A hand won is 1 point; a court is 3.", "First team to the chosen points wins the match."] },
        dealer: { title: "Who deals next", body: [
          "If the rung caller's team wins the hand, the same dealer deals again. Otherwise the deal moves to the next seat.",
          "After a court, the deal moves across to the dealer's partner.",
        ] },
      },
      terms: [
        { term: "Rung", meaning: "The trump suit, named after the first 5 cards." },
        { term: "Sir", meaning: "A trick." },
        { term: "Court", meaning: "A sweep: 7 tricks to none in Single Sir, or all 13 taken in Double Sir." },
      ],
      varies: [],
    },
    bhabhi: {
      players: "3 to 8 players, each on their own",
      goal: "Get rid of all your cards. The last one holding cards is the Bhabhi.",
      sections: {
        deal: { title: "The deal", body: [
          "The whole deck is dealt. 3 to 6 players use one deck, 4 to 8 use two; 7 or 8 always use two.",
          "Whoever holds the first ace of spades leads it.",
        ] },
        play: { title: "Playing a trick", body: [
          "Follow the led suit if you can.",
          "If you can't, any card you play is a thulla. It ends the trick at once.",
          "The highest card of the led suit picks up the whole trick and leads next.",
          "With no thulla, the trick is set aside and the highest card of the led suit leads next.",
          "The first trick is always set aside, unless the house rule is changed.",
        ] },
        away: { title: "Getting away", body: [
          "Empty your hand and you're away, safe from being the Bhabhi.",
          "If the next leader has just emptied their hand, they draw one random card from the set-aside pile (as it was before this trick) and lead it.",
          "Other styles handle this differently: see the styles below.",
        ] },
        win: { title: "Ending and matches", body: [
          "A hand ends when only one player holds cards. That player is the Bhabhi.",
          "A match lasts the chosen number of hands, or until someone is Bhabhi three times.",
          "Ranking: fewest times Bhabhi first, then the lower total of finishing places.",
        ] },
        handicap: { title: "Playing against bots", body: ["Against bots, you can give yourself 3 or 6 extra cards as a challenge. Online and Wi-Fi tables never use it."] },
      },
      terms: [
        { term: "Thulla", meaning: "A card of another suit that stops the trick." },
        { term: "Bhabhi", meaning: "The last player still holding cards." },
        { term: "Get away", meaning: "Play your last card and leave the hand." },
      ],
      varies: [],
    },
  },
  teasers: {
    marriage: {
      goal: "Form sequences and sets; see the tiplu to unlock wild cards and maal.",
      deal: "21 cards each.",
      terms: [{ term: "Tiplu", meaning: "The joker." }, { term: "Maal", meaning: "Scoring cards." }],
    },
    twentynine: {
      goal: "Bid the points your side will take from J, 9, A and 10, then make your bid.",
      deal: "4 cards, an auction, then 4 more.",
      terms: [],
    },
    seep: {
      goal: "Capture floor cards by matching values, and build houses.",
      deal: "4 cards to the floor, 12 each in batches.",
      terms: [{ term: "Ghar", meaning: "A house." }, { term: "Baazi", meaning: "A game." }],
    },
    teenpatti: { goal: "Coming to TashZone. Rules arrive when the game is ready.", terms: [] },
  },
};

function buildRules(text: RulesText, lang: Lang): Record<string, GameRules> {
  const out: Record<string, GameRules> = {};
  for (const id of Object.keys(SECTION_IDS) as PlayableId[]) {
    const r = text.rules[id];
    const sections = r.sections as Record<string, SectionText>;
    out[id] = {
      gameId: id,
      players: r.players,
      goal: r.goal,
      sections: [
        ...SECTION_IDS[id].map((sid) => ({ id: sid, ...sections[sid]! })),
        { id: "styles", title: text.stylesTitle, body: presetLines(PROFILES[id], lang).map((p) => text.styleLine(p.label, p.hint)) },
      ],
      terms: r.terms,
      varies: r.varies,
    };
  }
  return out;
}

function buildTeasers(text: RulesText): Record<string, Teaser> {
  const out: Record<string, Teaser> = {};
  for (const id of TEASER_IDS) {
    const t = text.teasers[id];
    out[id] = { gameId: id, goal: t.goal, ...(t.deal !== undefined ? { deal: t.deal } : {}), terms: t.terms };
  }
  return out;
}

export const RULE_TEXTS: Record<Lang, RulesText> = { en: EN, ur: ur.rules, hi: hi.rules, ne: ne.rules, bn: bn.rules };

export const RULES: Record<string, GameRules> = localized<Record<string, GameRules>>("rules", {
  en: buildRules(EN, "en"), ur: buildRules(ur.rules, "ur"), hi: buildRules(hi.rules, "hi"), ne: buildRules(ne.rules, "ne"), bn: buildRules(bn.rules, "bn"),
});

/** Teasers for the 'soon' games, using the mockup's one-line summaries. */
export const TEASERS: Record<string, Teaser> = localized<Record<string, Teaser>>("rule-teasers", {
  en: buildTeasers(EN), ur: buildTeasers(ur.rules), hi: buildTeasers(hi.rules), ne: buildTeasers(ne.rules), bn: buildTeasers(bn.rules),
});

export function rulesFor(gameId: string): GameRules | undefined { return RULES[gameId]; }
export function teaserFor(gameId: string): Teaser | undefined { return TEASERS[gameId]; }
/** Games that get a full rules page: exactly the ones the app can play. */
export function playableIds(): string[] { return GAMES.filter((g) => g.status === "play").map((g) => g.id); }
