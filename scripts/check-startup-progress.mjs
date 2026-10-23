import assert from "node:assert/strict";
import { StartupProgress, STARTUP_STAGES } from "../src/startup-progress.js";
let now = 0;
const frames = [];
const progress = new StartupProgress(
  (state) => frames.push(state),
  () => now,
);
assert.equal(
  Object.values(STARTUP_STAGES).reduce((n, s) => n + s[0], 0),
  100,
);
progress.update("work", 1);
assert.equal(
  progress.snapshot().value,
  0.1,
  "Finished cards cannot jump to 92%",
);
let release;
const compilation = progress.run(
  "shaders",
  () => new Promise((resolve) => (release = resolve)),
);
now = 15000;
progress.emit();
assert.equal(
  progress.snapshot().value,
  0.1,
  "Elapsed time never manufactures progress",
);
assert.equal(progress.snapshot().label, "Compiling scene materials");
assert.equal(progress.snapshot().elapsed, 15);
progress.update("maps", 0.8);
progress.update("maps", 0.3);
assert.equal(
  progress.stages.maps.value,
  0.8,
  "Out-of-order callbacks cannot reverse progress",
);
release();
await compilation;
await assert.rejects(
  progress.run("audio", () => Promise.reject(Error("offline"))),
);
assert.equal(progress.stages.audio.state, "fallback");
for (const id of Object.keys(STARTUP_STAGES))
  if (id !== "audio") progress.update(id, 1);
assert(
  progress.snapshot().value < 1,
  "Entry stays gated until final preparation completes",
);
const report = progress.finish();
assert.equal(progress.snapshot().value, 1);
assert.equal(report.stages.shaders.durationMs, 15000);
assert.equal(report.stages.audio.state, "fallback");
assert(
  frames.every((frame, i) => i === 0 || frame.value >= frames[i - 1].value),
);
console.log(
  "Startup progress: weighted stages, stalled GPU stage, monotonic callbacks, failure reporting and final gate passed.",
);
