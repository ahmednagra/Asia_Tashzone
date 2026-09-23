/** DR-01 (partial): the exact engine bundle replays identically on Node.js (V8) and QuickJS-WebAssembly. Hermes: device CI. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getQuickJS } from "quickjs-emscripten";
import { compile } from "../src/index.js";
import { callbreak, replay, stateHash } from "../src/index.js";
import { driveMatch, hashChooser } from "../src/index.js";

const bundlePath = new URL("../../engine/dist/bundle/engine.mjs", import.meta.url);

describe("three-engine replay (Node + QuickJS here)", () => {
  it("final state hash from QuickJS equals Node for a recorded match", async () => {
    const c = compile("callbreak.np@1", { rounds: 3 }); if (!c.ok) throw new Error(); const cbRules = c.rules as import("@tashzone/engine").CallbreakRules;
    const d = driveMatch(callbreak, cbRules, "xq", hashChooser("xq"));
    const nodeHash = stateHash(replay(cbRules, d.actions).state);
    const QuickJS = await getQuickJS();
    const rt = QuickJS.newRuntime();
    rt.setMemoryLimit(256 * 1024 * 1024);
    rt.setModuleLoader((name) => (name === "engine" ? readFileSync(bundlePath, "utf8") : { error: new Error("no module " + name) }));
    const vm = rt.newContext();
    const src = `import * as E from "engine";
      if (typeof TextEncoder !== "undefined") throw new Error("host has TextEncoder");
      const out = E.replay(${JSON.stringify(cbRules)}, ${JSON.stringify(d.actions)});
      globalThis.__hash = E.stateHash(out.state);`;
    const res = vm.evalCode(src, "main.mjs", { type: "module" });
    const h = vm.unwrapResult(res); h.dispose();
    rt.executePendingJobs();
    const qh = vm.getProp(vm.global, "__hash");
    const quickHash = vm.dump(qh); qh.dispose();
    vm.dispose(); rt.dispose();
    expect(quickHash).toBe(nodeHash);
  });
});
