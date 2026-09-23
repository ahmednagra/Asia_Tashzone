/**
 * Ports for durable state. The interfaces and in-memory implementations live in @tashzone/match (shared with the
 * phone's same-Wi-Fi host table); PostgreSQL implementations are in pg.ts and the stdout incident log is here.
 */
export {
  type HandSealRecord, type IncidentKind, type IncidentLog, type JournalStore, type RoomDirectory,
  MemoryDirectory, MemoryIncidentLog, MemoryJournal, StaleEpochError,
} from "@tashzone/match";
import type { IncidentKind, IncidentLog } from "@tashzone/match";

export class JsonIncidentLog implements IncidentLog {
  constructor(private readonly sink: (line: string) => void = (l) => process.stdout.write(l + "\n")) {}
  record(kind: IncidentKind, meta: Readonly<Record<string, string | number | boolean>>) {
    this.sink(JSON.stringify({ incident: kind, ...meta }));
  }
}
