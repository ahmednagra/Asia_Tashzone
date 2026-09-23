import { describe, expect, it } from "vitest";
import { bhabhi, compile, sha256Hex } from "@tashzone/engine";
import { fanLayout, trickOffset } from "./logic";
import { breakWarning, goneCards, hintText, houseRules, instructionLine, lastTrick, phaseWord, pickupVictim, sortHand, statusLine, timeLeftFraction, trackerRow, voidTags } from "./insights";

const NAMES = ["You", "Anaar", "Kulfi", "Chai"];
const seat0 = { kind: "seat", seat: 0 };

/* eslint-disable @typescript-eslint/no-explicit-any */
const view = (game: string, hand: any, extra: any = {}): any => ({ game, viewer: seat0, match: { over: false }, legal: [], hand, rules: {}, ...extra });

describe("instruction and status", () => {
  const hand = (over: any) => ({ phase: "PLAY", turn: 0, trick: [], my_hand: ["AS", "KH", "2H"], ...over });
  it("leads, follows and cannot follow", () => {
    expect(instructionLine(view("callbreak", hand({})), NAMES)).toBe("Your lead: play any card");
    expect(instructionLine(view("callbreak", hand({ trick: [{ seat: 3, card: "5H" }] })), NAMES)).toBe("Follow ♥ Hearts");
    expect(instructionLine(view("callbreak", hand({ trick: [{ seat: 3, card: "5D" }] })), NAMES)).toBe("No ♦: play a trump or any card");
    expect(instructionLine(view("bhabhi", hand({ trick: [{ seat: 3, card: "5D" }] })), NAMES)).toContain("breaks the suit");
  });
  it("other seats, phases and match end", () => {
    expect(instructionLine(view("callbreak", hand({ turn: 2 })), NAMES)).toBe("Kulfi is playing");
    expect(instructionLine(view("callbreak", hand({ phase: "CALL", turn: 0 })), NAMES)).toContain("how many tricks");
    expect(instructionLine(view("courtpiece", hand({ phase: "TRUMP", turn: 1 })), NAMES)).toBe("Waiting for trump to be chosen");
    expect(instructionLine(view("callbreak", null), NAMES)).toBe("Shuffling and dealing");
    expect(instructionLine(view("callbreak", hand({}), { match: { over: true } }), NAMES)).toBe("Match over");
    expect(statusLine(view("callbreak", hand({ turn: 2 })), NAMES)).toEqual({ text: "Kulfi is playing", mine: false });
    expect(statusLine(view("callbreak", hand({})), NAMES)).toEqual({ text: "Your turn: play any card", mine: true });
    expect(phaseWord(view("callbreak", hand({ trick: [{ seat: 3, card: "5H" }] })))).toBe("following ♥");
    expect(phaseWord(view("callbreak", hand({})))).toBe("open lead");
  });
  it("the ace of spades opens Bhabhi", () => {
    const v = view("bhabhi", hand({ first_trick: true }), { legal: [{ t: "Play", card: "AS" }] });
    expect(instructionLine(v, NAMES)).toBe("Lead the Ace of Spades");
  });
  it("Bhabhi warns who picks up when you cannot follow", () => {
    const h = { phase: "PLAY", turn: 0, my_hand: ["2C"], trick: [{ seat: 1, card: "5H" }, { seat: 2, card: "QH" }] };
    expect(pickupVictim(h.trick)).toBe(2);
    expect(breakWarning(view("bhabhi", h), NAMES)).toBe("You have no ♥: whatever you play, Kulfi picks up 3 cards");
    expect(breakWarning(view("bhabhi", { ...h, my_hand: ["2H"] }), NAMES)).toBeNull();
    expect(breakWarning(view("callbreak", h), NAMES)).toBeNull();
    expect(voidTags(view("bhabhi", { voids: [[], ["S", "H"], [], []] }), 1)).toEqual(["no ♠", "no ♥"]);
  });
});

describe("what has gone and the last trick", () => {
  it("counts only visible plays and marks the viewer's own cards", () => {
    const cb = view("callbreak", { played: ["AS", "2H"], trick: [{ seat: 1, card: "3H" }], my_hand: ["KH"] });
    expect([...goneCards(cb)].sort()).toEqual(["2H", "3H", "AS"]);
    const row = trackerRow(cb, "H");
    expect(row.map((x) => x.card).slice(0, 3)).toEqual(["AH", "KH", "QH"]);
    expect(row.find((x) => x.card === "KH")!.status).toBe("mine");
    expect(row.find((x) => x.card === "2H")!.status).toBe("gone");
    expect(row.find((x) => x.card === "AH")!.status).toBe("out");
    const cp = view("courtpiece", { history: [[{ seat: 0, card: "AH" }]], trick: [], my_hand: [] });
    expect(goneCards(cp).has("AH")).toBe(true);
    const bh = view("bhabhi", { discards: ["4C"], trick: [], my_hand: [] });
    expect(goneCards(bh).has("4C")).toBe(true);
  });
  it("names who took (or picked up) the last trick per game", () => {
    const plays = [{ seat: 0, card: "AH" }];
    expect(lastTrick(view("callbreak", { last_trick: plays, last_trick_winner: 2 }), NAMES)!.text).toBe("Kulfi took it.");
    expect(lastTrick(view("callbreak", { last_trick: null }), NAMES)).toBeNull();
    expect(lastTrick(view("courtpiece", { history: [plays], last_win: { seat: 1, card: "AH" } }), NAMES)!.text).toBe("Anaar took it.");
    expect(lastTrick(view("bhabhi", { last_trick: { plays, outcome: "pickedUp", seat: 3 } }), NAMES)!.text).toContain("Chai picked it up");
    expect(lastTrick(view("bhabhi", { last_trick: { plays, outcome: "discarded", seat: 3 } }), NAMES)!.text).toContain("Put aside");
  });
});

describe("hint, rules, sorting, clock", () => {
  it("explains the suggested move from the viewer's own view", () => {
    const v = view("callbreak", { trick: [{ seat: 3, card: "5H" }], my_hand: [] }, { rules: { trump: "S" } });
    expect(hintText(v, { t: "Play", card: "KH" })).toMatchObject({ card: "KH", title: "King of Hearts" });
    expect(hintText(v, { t: "Play", card: "2S" }).reason).toContain("trump");
    expect(hintText(v, null).card).toBeNull();
    expect(hintText(v, { t: "Call", n: 3 }).title).toBe("Call 3");
    expect(hintText(v, { t: "ChooseTrump", suit: "H" }).title).toBe("♥ Hearts as trump");
  });
  it("lists the compiled rules of a real match", () => {
    const c = compile("bhabhi.tz@1", { players: 5, rounds: 3 }, "take-hand");
    if (!c.ok) throw new Error(c.error);
    const s = bhabhi.initialState(c.rules);
    const r = bhabhi.step(s, { t: "BeginHand", actor: "system", hand_id: "h1", hand_seed: sha256Hex("x") });
    if (!r.ok) throw new Error(r.code);
    const rows = houseRules(bhabhi.project(r.state, seat0 as never));
    expect(rows.find((x) => x.title === "Take the hand")).toMatchObject({ on: true });
    expect(rows.find((x) => x.title === "Length")!.text).toBe("3 hands.");
    expect(houseRules({ game: "nope" })).toEqual([]);
  });
  it("sorts by suit or rank without changing the cards", () => {
    const cards = ["2S", "AH", "3D", "KC", "AS"];
    expect(sortHand(cards, "suit")).toEqual(["3D", "KC", "AH", "AS", "2S"]);
    expect(sortHand(cards, "rank")).toEqual(["AH", "AS", "KC", "3D", "2S"]);
    expect(sortHand(cards, "rank").slice().sort()).toEqual(cards.slice().sort());
    expect(cards[0]).toBe("2S");
  });
  it("spread layout never overlaps and wraps to fit", () => {
    const l = fanLayout(13, 320, 60, 1, "spread");
    expect(l.step).toBeGreaterThanOrEqual(60);
    expect(l.perRow * l.rows).toBeGreaterThanOrEqual(13);
    expect(60 + l.step * (l.perRow - 1)).toBeLessThanOrEqual(320);
  });
  it("played cards land toward the seat that played them", () => {
    expect(trickOffset("bottom", 0).y).toBeGreaterThan(0);
    expect(trickOffset("top", 0).y).toBeLessThan(0);
    expect(trickOffset("left", 0).x).toBeLessThan(0);
    expect(trickOffset("right", 0).x).toBeGreaterThan(0);
    expect(trickOffset("top", 0).x).not.toBe(trickOffset("top", 1).x);
  });
  it("turn clock fraction is clamped", () => {
    expect(timeLeftFraction(5000, 20000)).toBe(0.25);
    expect(timeLeftFraction(-5, 20000)).toBe(0);
    expect(timeLeftFraction(30000, 20000)).toBe(1);
    expect(timeLeftFraction(1, 0)).toBe(0);
  });
});
