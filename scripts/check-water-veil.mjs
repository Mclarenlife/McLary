import assert from "node:assert/strict";
import { WaterVeilState } from "../src/water-veil.js";
import { ScenePush } from "../src/scene-push.js";
const veil = new WaterVeilState();
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
  cover(),
  1,
  "Work retains its living water layer after the transition",
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
  "Water veil checks passed: entry, downward clearing, persistent focus, route cancellation, reduced motion and capture cleanup.",
);
