import React from "react";
import { SeatRow } from "../../components/ui/SeatRow";

export interface SeatEntry { name: string | null; status: string; ok?: boolean }

/** Lobby seats in order; an entry with no name is an open seat. Shared by the room lobby and the Wi-Fi host screen. */
export function SeatList({ seats, openName }: { seats: readonly SeatEntry[]; openName: string }) {
  return <>{seats.map((s, i) => <SeatRow key={i} name={s.name ?? openName} status={s.status} filled={s.name !== null} ok={s.ok} />)}</>;
}
