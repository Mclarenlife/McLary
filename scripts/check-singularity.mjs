import assert from "node:assert/strict";
import {
  SingularityTransition,
  vortexOffset,
} from "../src/singularity-transition.js";

// Exercise the actual GSAP route lifecycle without a GPU or a browser clock.
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
globalThis.devicePixelRatio = 2;
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
effect.light = {};
effect.context = { setTransform() {} };
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
        assert.equal(
          effect.world.style.visibility,
          "hidden",
          "Route content changes only behind the singularity",
        );
      },
      () => completions++,
    )
    .pause();
const cleaned = () => {
  assert.equal(
    effect.world.inert,
    false,
    "Navigation must be usable after interruption",
  );
  assert.equal(effect.world.style.visibility, undefined);
  assert.equal(effect.stage.dataset.phase, undefined);
  assert.equal(
    document.documentElement.classList.contains("singularity-active"),
    false,
  );
  assert.equal(effect.timeline, null);
};

let timeline = begin();
timeline.totalTime(1.3, false);
assert.equal(swaps, 0, "The old route remains mounted during collapse");
assert(effect.state.scale > 0.009 && effect.state.scale < 0.5);
timeline.totalTime(1.5, false);
assert.equal(swaps, 1);
assert.equal(effect.stage.dataset.phase, "singularity");
assert.equal(effect.state.scale, 0.009);
timeline.totalTime(2.1, false);
assert.equal(effect.stage.dataset.phase, "burst");
assert.equal(effect.world.style.visibility, "");
assert(effect.state.scale > 0.5);
timeline.totalTime(timeline.duration(), false);
assert.equal(completions, 1);
assert.equal(effect.state.scale, 1);
assert.equal(effect.state.warp, 0);
assert.equal(effect.state.split, 0);
cleaned();

// Track actual visible rotation after inverse sampling, not just the outer box.
// Both the collapse and release must move clockwise at every radial distance.
timeline = effect
  .start(
    () => {},
    () => {},
  )
  .pause();
const radii = [0.05, 0.3, 0.7, 1.2, 2];
const previousAngles = radii.map(() => 0);
for (let t = 0; t <= 3.4; t += 0.01) {
  timeline.totalTime(t, false);
  radii.forEach((radius, i) => {
    const [dx, dy] = vortexOffset(radius, 0);
    const angle =
      (effect.state.turn * Math.PI) / 180 -
      Math.atan2(dy * effect.state.warp, radius + dx * effect.state.warp);
    assert(
      angle >= previousAngles[i] - 0.00001,
      "The vortex must never reverse during collapse or burst",
    );
    previousAngles[i] = angle;
  });
}
effect.cancel();
assert.equal(
  Math.hypot(...vortexOffset(0, 0)),
  0,
  "The singularity stays centred",
);

timeline = begin();
timeline.totalTime(0.7, false);
effect.cancel();
assert.equal(
  swaps,
  1,
  "Back navigation before the singularity must not commit the abandoned route",
);
timeline.totalTime(timeline.duration(), false);
assert.equal(
  swaps,
  1,
  "A killed transition must never commit a stale destination",
);
cleaned();

// Resize/reduced-motion completion can happen before the route has changed.
timeline = effect
  .start(
    () => swaps++,
    () => completions++,
  )
  .pause();
timeline.totalTime(0.6, false);
effect.complete();
effect.complete();
assert.equal(swaps, 2);
assert.equal(completions, 2);
cleaned();

timeline = begin();
timeline.totalTime(1.7, false);
effect.complete();
assert.equal(
  swaps,
  3,
  "Completing an already swapped route must not add another history entry",
);
assert.equal(completions, 3);
cleaned();
console.log(
  "Singularity checks passed: hidden route swap, ordered collapse/hold/burst, identity endpoint, cancellation, resize/reduced-motion completion, exactly-once history and interaction cleanup.",
);
