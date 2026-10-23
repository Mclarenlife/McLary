import assert from "node:assert/strict";
import { createRun, jump, advanceRun } from "../src/loading-game.js";

const idle = createRun();
advanceRun(idle, 0.1);
assert.equal(idle.distance, 0, "The idle game does not simulate or auto-start");
jump(idle);
advanceRun(idle, 0.1);
const velocity = idle.vy;
jump(idle);
assert.equal(idle.vy, velocity, "No air jumps from key repeat / repeated taps");

// Clearing a representative obstacle at maximum speed must be physically possible.
const clear = createRun();
clear.mode = "running";
clear.distance = 24000;
clear.obstacles = [{ x: 120, width: 29, height: 31, kind: "buoy" }];
clear.gap = 10000;
jump(clear);
for (let i = 0; i < 60; i++) advanceRun(clear, 1 / 60, () => 0.5);
assert.equal(clear.mode, "running");
assert.equal(clear.y, 0, "A jump lands before the next obstacle");

const hit = createRun();
hit.mode = "running";
for (let i = 0; i < 300; i++) advanceRun(hit, 1 / 60, () => 0.5);
assert.equal(hit.mode, "over", "Running into a rock ends the run");
assert(hit.score > 0 && hit.best === hit.score);
const best = hit.best;
jump(hit);
assert.equal(hit.mode, "running");
assert.equal(hit.score, 0);
assert.equal(hit.best, best, "Restart preserves this visit's high score");

const runs = [30, 60, 120].map((hz) => {
  const state = createRun();
  jump(state);
  for (let i = 0; i < hz; i++) advanceRun(state, 1 / hz, () => 0.5);
  return state;
});
for (const state of runs) {
  assert(Math.abs(state.distance - runs[0].distance) < 1e-8);
  assert.equal(state.y, runs[0].y);
}
const before = structuredClone(runs[0]);
advanceRun(runs[0], 5);
assert.deepEqual(
  runs[0],
  before,
  "Loading stalls / tab suspension cannot teleport into a rock",
);
console.log(
  "Loading game checks passed: opt-in play, collision, restart, jump clearance, refresh-rate independence and stall protection.",
);
