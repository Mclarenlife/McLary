import assert from "node:assert/strict";
import { WaterVeilState, BUBBLE_COUNT, bubbleAt } from "../src/water-veil.js";
import { ScenePush } from "../src/scene-push.js";
const veil = new WaterVeilState();
assert(BUBBLE_COUNT >= 30, "A substantial entry burst");
for (let i = 0; i < BUBBLE_COUNT; i++) {
  let previous = bubbleAt(i, 0);
  for (let frame = 1; frame <= 600; frame++) {
    const current = bubbleAt(i, frame / 10);
    assert(current.every(Number.isFinite));
    assert(current[1] >= previous[1], "Bubbles rise once and never recycle");
    assert(current[0] > 0 && current[0] < 1);
    previous = current;
  }
  assert(
    bubbleAt(i, 0)[1] + bubbleAt(i, 0)[2] < 0,
    "Every bubble starts below the screen",
  );
  assert(
    bubbleAt(i, 5.8)[1] - bubbleAt(i, 5.8)[2] > 1,
    "All bubbles have exited before shutdown",
  );
}
const frozenBubbles = veil.uniforms.waterBubbles.value.slice();
veil.update(1, true);
assert.deepEqual(
  veil.uniforms.waterBubbles.value,
  frozenBubbles,
  "Reduced motion freezes bubble positions",
);
const cover = () => veil.uniforms.waterCover.value;
veil.settle("work");
assert.equal(cover(), 1, "Direct Work entry is already underwater");
veil.cross(-1);
veil.update(0.38, false);
assert.equal(cover(), 1, "Anticipation keeps the water layer intact");
let previous = 1;
for (let i = 0; i < 60; i++) {
  veil.update(0.05, false);
  assert(cover() <= previous, "Waterline only recedes downward on emergence");
  previous = cover();
}
assert.equal(cover(), 0);
veil.cross(1);
previous = 0;
for (let i = 0; i < 64; i++) {
  veil.update(0.05, false);
  assert(
    cover() >= previous,
    "Entry water coverage increases without bouncing",
  );
  previous = cover();
}
assert.equal(cover(), 1);
assert.equal(veil.uniforms.waterStrength.value, 1);
veil.update(5, false);
assert.equal(
  veil.uniforms.bubblePresence.value,
  0,
  "Entry burst finishes while Work remains open",
);
veil.settle("work");
assert.equal(
  veil.uniforms.bubblePresence.value,
  0,
  "Settling or resizing Work must not restart bubbles",
);
veil.burst();
assert.equal(
  veil.uniforms.bubblePresence.value,
  1,
  "Dismissing the preload screen can start the direct-entry burst",
);
veil.cross(-1);
veil.update(0.7, false);
veil.settle("gallery");
assert.equal(cover(), 0, "Interrupted navigation leaves no water over Gallery");
veil.cross(1);
const time = veil.uniforms.waterTime.value;
veil.update(0.1, true);
assert.equal(cover(), 1);
assert.equal(
  veil.uniforms.waterTime.value,
  time,
  "Reduced motion freezes the optical field",
);

const renderer = {
  getDrawingBufferSize: (v) => v.set(804, 1560),
  getRenderTarget: () => null,
  setRenderTarget() {},
};
const push = new ScenePush(renderer);
const veilPass = { enabled: true },
  output = { enabled: true };
const composer = {
  renderToScreen: true,
  render() {
    assert(
      !veilPass.enabled,
      "Previous scene is captured without double water filtering",
    );
    throw new Error("capture failure");
  },
};
assert.throws(
  () => push.capture(composer, output, 1, veilPass),
  /capture failure/,
);
assert(
  veilPass.enabled && output.enabled && composer.renderToScreen,
  "Capture failure restores render state",
);
push.target.dispose();
console.log(
  "Bubble checks passed: finite entry burst, no recycling, restart rules, reduced motion and capture cleanup.",
);
