/**
 * Offline table (03_PLATFORM.md §3: the phone is authoritative offline). Same engine and bots as the server,
 * for every game (Callbreak / Call Bridge, Court Piece, Bhabhi); a local shell drives hand starts, the
 * fixed-duration window and bot pacing. Pure TypeScript (no React Native import) so it is tested in Node.
 */
import {
  type Action, type BaseView, type EngineEvent, type GameModule, type RuleErrorCode, type SeatMove, gameOfProfile, getModule,
} from "@tashzone/engine";
import { type AsyncBotOptions, type BotLevel, chooseMove, chooseMoveAsync } from "@tashzone/engine";

export interface LocalTableOptions {
  readonly humanSeat?: number;
  /** 32 random bytes as hex from a CSPRNG (expo-crypto on device) */
  readonly randomSeed: () => string;
  readonly schedule?: (fn: () => void, ms: number) => () => void;
  readonly botDelayMs?: number;
  readonly interHandMs?: number;
  /** Bot strength for every other seat (v1: Easy / Medium / Hard). */
  readonly botLevel?: BotLevel;
  /** Hard bots think in slices against this clock so the UI stays responsive (optional). */
  readonly asyncBots?: Pick<AsyncBotOptions, "now" | "yieldToHost" | "maxMs" | "sliceMs">;
}

 
export type Listener = (view: any, events: readonly EngineEvent[]) => void;

export class LocalTable {
  readonly module: GameModule;
  readonly seats: number;
   
  state: any;
  private readonly human: number;
  private readonly listeners = new Set<Listener>();
  private cancel: (() => void) | null = null;
  private handNo = 0;
  private generation = 0;
  private readonly undoStack: unknown[] = [];
  private readonly schedule: (fn: () => void, ms: number) => () => void;

   
  constructor(readonly rules: any, private readonly opts: LocalTableOptions) {
    this.module = getModule(gameOfProfile(rules.profile_id));
    this.seats = this.module.seatCount(rules);
    this.state = this.module.initialState(rules);
    this.human = opts.humanSeat ?? 0;
    this.schedule = opts.schedule ?? ((fn, ms) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); });
  }

  subscribe(l: Listener): () => void { this.listeners.add(l); l(this.view(), []); return () => this.listeners.delete(l); }
   
  view(): any { return this.module.project(this.state, { kind: "seat", seat: this.human }); }
  start(): void { this.advance([]); }
  dispose(): void { this.generation++; this.cancel?.(); this.listeners.clear(); }

  /** Human move. Returns false when the engine rejects it (use `explain` for the reason). */
  play(move: SeatMove): boolean {
    const info = this.module.handInfo(this.state);
    if (!info) return false;
    const before = this.state;
    if (!this.apply(this.module.toAction(move, this.human, info.hand_id))) return false;
    if (move.t === "Play" || move.t === "Call" || move.t === "ChooseTrump") this.undoStack.push(before);
    return true;
  }

  /** Why a move is not allowed right now, from the human's own view ("MUST_FOLLOW_SUIT"…). */
  explain(move: SeatMove): RuleErrorCode | null { return this.module.explain(this.view(), move); }

  /** Offline-only undo: back to before the human's last move; bots re-play deterministically. */
  canUndo(): boolean { return this.undoStack.length > 0 && !this.module.summary(this.state).over; }
  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.generation++;
    this.cancel?.();
    this.state = prev;
    this.emit([]);
    this.advance([]);
    return true;
  }

  /** Hint (offline): what the Medium bot would play from the human's own view. */
  hint(): SeatMove | null { return chooseMove(this.module, this.view() as BaseView, "medium", `hint/${this.handNo}`); }

  private apply(action: Action): boolean {
    const r = this.module.step(this.state, action);
    if (!r.ok) return false;
    this.state = r.state;
    this.emit(r.events);
    this.advance(r.events);
    return true;
  }

  private emit(events: readonly EngineEvent[]): void {
    const v = this.view();
    const mine = this.module.projectEvents(events, { kind: "seat", seat: this.human });
    for (const l of this.listeners) l(v, mine);
  }

  private botView(seat: number): BaseView { return this.module.project(this.state, { kind: "seat", seat }) as BaseView; }

  private advance(events: readonly EngineEvent[]): void {
    const w = this.module.waitingOn(this.state);
    const later = (fn: () => void, ms: number) => { this.cancel?.(); this.cancel = this.schedule(fn, ms); };
    if (w.mode === "NONE") return;
    if (w.mode === "AUTO") {
      later(() => {
        this.handNo += 1;
        this.undoStack.length = 0;
        this.apply({ t: "BeginHand", actor: "system", hand_id: `local-${this.handNo}`, hand_seed: this.opts.randomSeed() });
      }, this.handNo === 0 ? 0 : this.opts.interHandMs ?? 1500);
      return;
    }
    const handId = this.module.handInfo(this.state)!.hand_id;
    if (w.mode === "WINDOW") {
      if (!events.some((e) => e.t === "WindowOpened")) return; // fixed duration: never closes early
      for (let seat = 0; seat < this.seats; seat++) {
        if (seat === this.human) continue;
        const m = chooseMove(this.module, this.botView(seat), "medium", `w/${handId}/${seat}`);
        if (m?.t === "RequestRedeal") { const r = this.module.step(this.state, this.module.toAction(m, seat, handId)); if (r.ok) this.state = r.state; }
      }
      later(() => this.apply({ t: "CloseWindow", actor: "system", hand_id: handId }), this.rules.window_ms);
      return;
    }
    const seat = w.seats[0]!;
    if (seat === this.human) return; // offline: no turn timer by default
    const level = this.opts.botLevel ?? "medium";
    const seed = `${handId}/${this.handNo}/${seat}/${JSON.stringify(this.botView(seat).legal).length}`;
    const gen = this.generation;
    later(() => {
      const view = this.botView(seat);
      if (level === "hard" && this.opts.asyncBots?.now && this.opts.asyncBots.yieldToHost) {
        void chooseMoveAsync(this.module, view, level, seed, this.opts.asyncBots).then((m) => {
          if (m && gen === this.generation) this.apply(this.module.toAction(m, seat, handId));
        });
        return;
      }
      const m = chooseMove(this.module, view, level, seed);
      if (m) this.apply(this.module.toAction(m, seat, handId));
    }, this.opts.botDelayMs ?? 700);
  }
}
