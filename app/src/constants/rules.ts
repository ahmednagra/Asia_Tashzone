/**
 * Rules reference copy (English). Source of truth: Docs/specs/01_GAME_RULES.md (profiles callbreak.np@1,
 * callbridge.bd@1, courtpiece.tz@1, bhabhi.tz@1 and the v1 addendum). Kept as typed data so it can be
 * translated and unit-tested; the UI only renders it.
 */
import { GAMES, SETUP } from "./games";

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

/** Presets are player-facing hints from the setup catalogue, so the two never drift apart. */
function presets(profile: string): RuleSection {
  const info = SETUP[profile];
  return { id: "styles", title: "Styles you can pick", body: (info?.presets ?? []).map((p) => `${p.label}: ${p.hint}.`) };
}

const CALLBREAK_DEAL = "Each player gets 13 cards, dealt one at a time.";
const CALLBREAK_REDEAL = "A player with no spade, or with no ace, king, queen or jack, may show their hand and ask for a redeal by the same dealer. After three redeals in a row the next deal is played as dealt.";

export const RULES: Record<string, GameRules> = {
  callbreak: {
    gameId: "callbreak",
    players: "4 players, each on their own",
    goal: "Call how many tricks you will win, then win at least that many. Spades are always trump.",
    sections: [
      { id: "deal", title: "The deal", body: [CALLBREAK_DEAL, CALLBREAK_REDEAL] },
      { id: "call", title: "Calling", body: ["Starting with the player after the dealer, everyone calls once, from 1 to 13 tricks.", "There is no passing: you must name a number."] },
      { id: "play", title: "Playing a trick", body: [
        "The player after the dealer leads. Play goes counter-clockwise.",
        "Follow the led suit if you can, and play a higher card than the one currently winning if you are able.",
        "If you have no card of the led suit, you must play a spade when it would win the trick. Otherwise play any card.",
        "Once a spade is in the trick, cards of the led suit no longer have to beat anything.",
      ] },
      { id: "score", title: "Scoring", body: ["Make your call: you score the number you called, plus 0.1 for each extra trick.", "Miss your call: you lose the number you called."] },
      { id: "win", title: "Winning", body: ["The highest total after the chosen number of rounds wins.", "Players with equal totals share the same place."] },
      presets("callbreak.np@1"),
    ],
    terms: [
      { term: "Call", meaning: "The number of tricks you promise to win." },
      { term: "Trump", meaning: "Spades. A spade beats any card of another suit." },
      { term: "Redeal", meaning: "A fresh deal by the same dealer, allowed for a very weak hand." },
      { term: "Extra trick", meaning: "A trick won beyond your call. Each adds 0.1." },
    ],
    varies: ["Whether you must beat the winning card when you can differs by region. Easy follow drops it; every table shows which style is on."],
  },

  callbridge: {
    gameId: "callbridge",
    players: "4 players, each on their own",
    goal: "Call how many tricks you will win, and take exactly that many or one more.",
    sections: [
      { id: "deal", title: "The deal", body: [CALLBREAK_DEAL, CALLBREAK_REDEAL] },
      { id: "call", title: "Calling", body: ["Everyone calls once, from 2 to 12 tricks. There is no passing."] },
      { id: "play", title: "Playing a trick", body: [
        "Spades are trump. Play goes counter-clockwise from the player after the dealer.",
        "Follow the led suit if you can. You do not have to beat the winning card.",
        "If you have no card of the led suit, you must play a spade when it would win the trick. Otherwise play any card.",
      ] },
      { id: "score", title: "Scoring", body: [
        "Your call is made if you win exactly that many tricks, or one more. You score the number you called.",
        "A made call of 8 or more scores a flat 13 points instead of the number you called.",
        "Win fewer tricks, or two or more extra, and you lose the number you called.",
      ] },
      { id: "win", title: "Winning", body: ["The highest total after the chosen number of hands wins.", "Players with equal totals share the same place."] },
      presets("callbridge.bd@1"),
    ],
    terms: [
      { term: "Call", meaning: "The number of tricks you promise to win." },
      { term: "Trump", meaning: "Spades. A spade beats any card of another suit." },
      { term: "Bonus", meaning: "A flat 13 points, instead of the call, for a made call of 8 or more." },
    ],
    varies: [],
  },

  courtpiece: {
    gameId: "courtpiece",
    players: "4 players in 2 teams of 2",
    goal: "Win tricks with your partner. Your team scores a point for each hand it wins, and three for a court.",
    sections: [
      { id: "teams", title: "Teams", body: ["Partners sit opposite each other: seats 1 and 3 against seats 2 and 4."] },
      { id: "deal", title: "The deal and the rung", body: [
        "The player after the dealer gets 5 cards and names the trump suit, called the rung.",
        "Everyone then gets 8 more cards, 4 and then 4. The player who named the rung leads.",
      ] },
      { id: "play", title: "Playing a trick", body: ["Follow the led suit if you can. If you cannot, play any card.", "There is no rule to beat the winning card or to play trump."] },
      { id: "single", title: "Single Sir", body: ["A hand ends as soon as a team has won 7 tricks.", "Winning all 7 tricks to none is a court."] },
      { id: "double", title: "Double Sir", body: [
        "Tricks pile up. When the same player wins two tricks in a row, their team collects the pile.",
        "The last trick collects whatever is left in the pile. Collecting all 13 tricks is a court.",
        "In Double Sir with Ace, two aces in a row do not collect the pile.",
      ] },
      { id: "score", title: "Scoring", body: ["A hand won is 1 point. A court is 3 points.", "The first team to the chosen number of points wins the match."] },
      { id: "dealer", title: "Who deals next", body: [
        "The dealer deals again when the team that named the rung wins the hand. Otherwise the deal moves to the next seat.",
        "After a court the deal moves across to the dealer's partner.",
      ] },
      presets("courtpiece.tz@1"),
    ],
    terms: [
      { term: "Rung", meaning: "The trump suit, named after the first 5 cards." },
      { term: "Sir", meaning: "A trick." },
      { term: "Court", meaning: "A sweep: 7 tricks to none in Single Sir, or all 13 collected in Double Sir." },
    ],
    varies: [],
  },

  bhabhi: {
    gameId: "bhabhi",
    players: "3 to 8 players, each on their own",
    goal: "Get rid of all your cards. The last player still holding cards is the Bhabhi.",
    sections: [
      { id: "deal", title: "The deal", body: [
        "The whole deck is dealt out. 3 to 6 players use one deck; 4 to 8 use two, and 7 or 8 always do.",
        "The player holding the first ace of spades leads it.",
      ] },
      { id: "play", title: "Playing a trick", body: [
        "Follow the led suit if you can.",
        "If you cannot, any card you play is a thulla. It ends the trick at once.",
        "The player with the highest card of the led suit picks up every card in the trick and leads next.",
        "If nobody plays a thulla, the trick is set aside and the highest card of the led suit leads next.",
        "The first trick is always set aside, unless the house rule is changed.",
      ] },
      { id: "away", title: "Getting away", body: [
        "Empty your hand and you are away, safe from being the Bhabhi.",
        "If the player about to lead has just emptied their hand, they draw one random card from the set-aside pile, as it was before this trick, and lead it.",
        "Other styles change how that case is handled: see the styles below.",
      ] },
      { id: "win", title: "Ending and matches", body: [
        "A hand ends when one player is left holding cards. That player is the Bhabhi.",
        "A match lasts a chosen number of hands, or until someone has been Bhabhi three times.",
        "Players are ranked by fewest times as Bhabhi, then by the lower total of finishing places.",
      ] },
      { id: "handicap", title: "Playing against bots", body: ["Against bots you can give yourself 3 or 6 extra cards as a challenge. Online and Wi-Fi tables never use it."] },
      presets("bhabhi.tz@1"),
    ],
    terms: [
      { term: "Thulla", meaning: "A card of another suit that interrupts the trick." },
      { term: "Bhabhi", meaning: "The last player still holding cards." },
      { term: "Get away", meaning: "Play your last card and leave the hand." },
    ],
    varies: [],
  },
};

/** Teasers for the 'soon' games, using the mockup's one-line summaries. */
export const TEASERS: Record<string, Teaser> = {
  marriage: {
    gameId: "marriage",
    goal: "Form sequences and sets, see the tiplu to unlock wild cards and maal.",
    deal: "21 cards each.",
    terms: [{ term: "Tiplu", meaning: "The joker." }, { term: "Maal", meaning: "Scoring cards." }],
  },
  twentynine: {
    gameId: "twentynine",
    goal: "Bid the points your side will win from J, 9, A and 10, then make your bid.",
    deal: "4 cards, an auction, then 4 more.",
    terms: [],
  },
  seep: {
    gameId: "seep",
    goal: "Capture cards from the floor by matching values, and build houses.",
    deal: "4 cards to the floor, 12 each in batches.",
    terms: [{ term: "Ghar", meaning: "A house." }, { term: "Baazi", meaning: "A game." }],
  },
  teenpatti: { gameId: "teenpatti", goal: "Coming to TashZone. Its rules will be added when the game is ready.", terms: [] },
};

export function rulesFor(gameId: string): GameRules | undefined { return RULES[gameId]; }
export function teaserFor(gameId: string): Teaser | undefined { return TEASERS[gameId]; }
/** Games that get a full rules page: exactly the ones the app can play. */
export function playableIds(): string[] { return GAMES.filter((g) => g.status === "play").map((g) => g.id); }
