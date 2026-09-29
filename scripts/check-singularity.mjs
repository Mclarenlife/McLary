import assert from "node:assert/strict";
import {
  SingularityTransition,
  vortexOffset,
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
effect.filters = { querySelector: () => ({ setAttribute() {} }) };
effect.update = () => {};
effect.makeField = () => {};
let swaps = 0,
  completions = 0;
const begin = () =>
  effect
    .start(
      () => {
        swaps++;
        assert.equal(effect.world.style.visibility, "hidden");
        assert.equal(
          effect.state.scale,
          0,
          "Swap only at a truly invisible point",
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
timeline.totalTime(0.04, false);
assert(
  effect.state.scale < 0.99 && effect.state.warp > 0,
  "Movement starts immediately, with no anticipation",
);
timeline.totalTime(1.09, false);
assert.equal(swaps, 0);
assert(effect.state.scale < 0.015);
timeline.totalTime(1.1, false);
assert.equal(swaps, 1);
assert.equal(effect.state.scale, 0);
assert.equal(effect.stage.dataset.phase, "burst");
timeline.totalTime(1.11, false);
assert(
  effect.state.scale > 0.01,
  "Release begins immediately with no singularity hold",
);
timeline.totalTime(2.16, false);
assert(
  effect.state.scale < 0.985,
  "No nearly stationary tail before completion",
);
timeline.totalTime(timeline.duration(), false);
assert.equal(completions, 1);
assert.equal(effect.state.scale, 1);
assert.equal(effect.state.warp, 0);
assert.equal(effect.state.split, 0);
clean();

// Follow inverse samples through all three real filter stages, including the
// radius changes between stages. Both halves must continue clockwise.
timeline = effect
  .start(
    () => {},
    () => {},
  )
  .pause();
const radii = [0.05, 0.3, 0.7, 1.2, 2];
const previous = radii.map(() => 0);
let strongestTwist = 0;
for (let t = 0; t <= 2.2; t += 0.005) {
  timeline.totalTime(t, false);
  radii.forEach((radius, i) => {
    let x = radius,
      y = 0,
      twist = 0;
    for (let layer = 0; layer < 3; layer++) {
      const [dx, dy] = vortexOffset(x, y);
      const nx = x + dx * effect.state.warp,
        ny = y + dy * effect.state.warp;
      twist += Math.atan2(x * ny - y * nx, x * nx + y * ny);
      x = nx;
      y = ny;
    }
    strongestTwist = Math.max(strongestTwist, -twist);
    const visible = (effect.state.turn * Math.PI) / 180 - twist;
    assert(
      visible >= previous[i] - 0.00001,
      "The composed spiral must not reverse",
    );
    previous[i] = visible;
  });
}
assert(
  strongestTwist > 4.8,
  "Centre deformation must exceed 275 degrees, not just rigid rotation",
);
effect.cancel();
assert.equal(Math.hypot(...vortexOffset(0, 0)), 0);
timeline = begin();
timeline.totalTime(0.4, false);
effect.cancel();
timeline.totalTime(timeline.duration(), false);
assert.equal(swaps, 1, "Cancellation must not commit an abandoned route");
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
timeline.totalTime(1.3, false);
effect.complete();
assert.equal(swaps, 3, "Resize after the swap must not push history twice");
assert.equal(completions, 3);
clean();
console.log(
  "Singularity checks passed: immediate start/release, zero-area swap, no tail, >275-degree spatial twist, clockwise motion, clean endpoint and interruption handling.",
);
