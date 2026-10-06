import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 22050;
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/sounds");
fs.mkdirSync(out, { recursive: true });

let seed = 7;
const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
const square = (ph) => (Math.sin(ph) >= 0 ? 1 : -1);

function render(seconds, fn) {
  const n = Math.round(seconds * RATE);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = fn(i / RATE);
  return buf;
}
function mix(...parts) {
  const n = Math.max(...parts.map(([b, at]) => b.length + Math.round(at * RATE)));
  const m = new Float32Array(n);
  for (const [b, at] of parts) { const o = Math.round(at * RATE); for (let i = 0; i < b.length; i++) m[o + i] += b[i]; }
  return m;
}
function write(name, buf, gain = 0.8) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? gain / peak : 0;
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * k)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.concat([h, data]));
}

const tabla = (f0, len = 0.22) => render(len, (t) => {
  const f = f0 * (1 + 0.6 * Math.exp(-t / 0.02));
  return env(t, 0.002, 0.06) * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * 2.7 * f0 * t) * Math.exp(-t / 0.02));
});
const slide = (len, bright) => {
  let lp = 0;
  return render(len, (t) => { lp += bright * (noise() - lp); return env(t, 0.01, len / 3) * lp; });
};
const bell = (f0, len = 0.6) => render(len, (t) =>
  env(t, 0.002, 0.18) * (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * f0 * 2.76 * t) * Math.exp(-t / 0.08) + 0.25 * Math.sin(2 * Math.PI * f0 * 5.4 * t) * Math.exp(-t / 0.04)));
const blip = (f0, f1, len = 0.08) => render(len, (t) => env(t, 0.002, len / 2.5) * 0.5 * square(2 * Math.PI * (f0 + (f1 - f0) * (t / len)) * t));

const sets = {
  emerald: {
    tap: tabla(190, 0.16),
    play: mix([slide(0.12, 0.25), 0], [tabla(150, 0.12), 0.05]),
    trick: mix([slide(0.18, 0.2), 0], [tabla(170), 0.08]),
    turn: mix([tabla(220, 0.14), 0], [tabla(300, 0.18), 0.1]),
    win: mix([tabla(200), 0], [tabla(260), 0.12], [tabla(330), 0.24], [tabla(400, 0.4), 0.36]),
    switch: mix([tabla(180), 0], [tabla(240, 0.3), 0.09]),
  },
  gold: {
    tap: bell(1320, 0.25),
    play: mix([slide(0.1, 0.12), 0], [bell(1760, 0.2), 0.03]),
    trick: mix([slide(0.16, 0.1), 0], [bell(990, 0.35), 0.06]),
    turn: bell(1175, 0.45),
    win: mix([bell(784), 0], [bell(988), 0.14], [bell(1175), 0.28], [bell(1568, 0.9), 0.42]),
    switch: mix([bell(880, 0.5), 0], [bell(1320, 0.5), 0.08]),
  },
  arcade: {
    tap: blip(880, 1320, 0.05),
    play: mix([blip(440, 660, 0.06), 0], [slide(0.05, 0.6), 0]),
    trick: mix([blip(523, 784, 0.07), 0], [blip(784, 1046, 0.07), 0.07]),
    turn: mix([blip(660, 660, 0.06), 0], [blip(990, 990, 0.08), 0.08]),
    win: mix([blip(523, 523, 0.09), 0], [blip(659, 659, 0.09), 0.1], [blip(784, 784, 0.09), 0.2], [blip(1046, 1046, 0.25), 0.3]),
    switch: mix([blip(330, 990, 0.14), 0]),
  },
};

for (const [theme, cues] of Object.entries(sets)) for (const [cue, buf] of Object.entries(cues)) write(`${theme}-${cue}`, buf, cue === "win" ? 0.7 : 0.6);
console.log(`wrote ${Object.keys(sets).length * 6} sounds to ${out}`);
