import assert from "node:assert/strict";
import {
  SingularityTransition,
  gravityOffset,
  blackHoleLens,
} from "../src/singularity-transition.js";
const classes = () => {
  const values = new Set();
  return {
    add: (v) => values.add(v),
    remove: (v) => values.delete(v),
    contains: (v) => values.has(v),
  };
};
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
globalThis.document = { documentElement: { classList: classes() } };
const effect = Object.create(SingularityTransition.prototype);
effect.stage = { classList: classes(), dataset: {} };
effect.world = {
  style: {},
  inert: false,
  removeAttribute: () => {
    effect.world.style = {};
  },
};
effect.renderer = { setSize() {}, render() {} };
effect.uniforms = Object.fromEntries(
  ["resolution", "direction", "pull", "warp", "split", "hidden"].map((key) => [
    key,
    { value: key === "resolution" ? { set() {} } : 0 },
  ]),
);
let captures = 0;
effect.capture = () => {
  captures++;
  effect.world.style.visibility = "hidden";
};
let swaps = 0,
  completions = 0;
const begin = () =>
  effect
    .start(
      () => {
        swaps++;
        assert.equal(effect.world.style.visibility, "hidden");
        assert.equal(
          effect.state.progress,
          1,
          "Swap only at the invisible singularity",
        );
      },
      () => completions++,
    )
    .pause();
const clean = () => {
  assert.equal(effect.world.inert, false);
  assert.equal(effect.world.style.visibility, undefined);
  assert.equal(effect.stage.dataset.phase, undefined);
  assert.equal(
    document.documentElement.classList.contains("singularity-active"),
    false,
  );
  assert.equal(effect.timeline, null);
};
let timeline = begin();
timeline.totalTime(0.05, false);
assert(effect.state.progress > 0, "Begin moving immediately");
assert.equal(
  effect.world.style.transform,
  undefined,
  "Never scale or rotate the rectangular page",
);
assert.equal(
  effect.world.style.borderRadius,
  undefined,
  "Never shrink a rounded rectangular frame",
);
timeline.totalTime(1.29, false);
assert.equal(swaps, 0);
timeline.totalTime(1.3, false);
assert.equal(swaps, 1);
assert.equal(effect.world.style.visibility, "hidden");
assert.equal(effect.stage.dataset.phase, "burst");
timeline.totalTime(1.31, false);
assert(effect.state.progress < 1, "No pause at the singularity");
assert.equal(effect.world.style.visibility, "hidden");
assert.equal(captures, 2, "Capture only at endpoints");
timeline.totalTime(2.55, false);
assert(effect.state.progress > 0.01, "No stationary settling tail");
timeline.totalTime(timeline.duration(), false);
assert.equal(completions, 1);
assert.equal(effect.state.progress, 0);
assert.deepEqual(blackHoleLens(0), {
  pull: 0,
  warp: 0,
  split: 0,
  hidden: false,
});
assert(blackHoleLens(1).hidden);
clean();

// Invert the actual two-stage gravitational sampling field to track content.
// Different radii must fall at different rates: uniform page scaling fails this.
function projectedRadius(source, progress) {
  const strength = blackHoleLens(progress).pull;
  let lo = 0,
    hi = source;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    let sample = mid;
    for (let pass = 0; pass < 2; pass++)
      sample += gravityOffset(sample, 0)[0] * strength;
    if (sample > source) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
const inner = projectedRadius(0.25, 0.65) / 0.25;
const rim = projectedRadius(1.4, 0.65) / 1.4;
assert(
  inner < rim * 0.7,
  "Centre falls faster than the rim, stretching the picture radially",
);
let previous = 1;
for (let p = 0; p < 1; p += 0.01) {
  const position = projectedRadius(1, p);
  assert(
    position <= previous + 1e-8,
    "Content must fall continuously inward without folds or duplicates",
  );
  previous = position;
}
assert(
  projectedRadius(1, 0.999) * 900 < 1,
  "Collapse the content below one pixel before hiding",
);
assert(Math.hypot(...gravityOffset(0, 0)) === 0, "The sink remains centred");

timeline = begin();
timeline.totalTime(0.4, false);
effect.cancel();
timeline.totalTime(timeline.duration(), false);
assert.equal(swaps, 1);
clean();
timeline = effect
  .start(
    () => swaps++,
    () => completions++,
  )
  .pause();
timeline.totalTime(0.4, false);
effect.complete();
effect.complete();
assert.equal(swaps, 2);
assert.equal(completions, 2);
clean();
timeline = begin();
timeline.totalTime(1.5, false);
effect.complete();
assert.equal(swaps, 3);
assert.equal(completions, 3);
clean();
console.log(
  "Black-hole checks passed: pixel-space differential gravity, continuous inward pull, subpixel singularity, no document scale/rotation, immediate nonlinear start/release, route swap and interruption cleanup.",
);
