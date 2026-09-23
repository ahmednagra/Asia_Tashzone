/** P-06 ring helpers. Seats are numbered 0..n-1 clockwise around the table. */
export type Direction = "clockwise" | "counter_clockwise";
export function nextSeat(seat: number, n: number, dir: Direction): number {
  return dir === "clockwise" ? (seat + 1) % n : (seat + n - 1) % n;
}
export function seatsFrom(start: number, n: number, dir: Direction): number[] {
  const out: number[] = [start];
  let s = start;
  for (let i = 1; i < n; i++) { s = nextSeat(s, n, dir); out.push(s); }
  return out;
}
