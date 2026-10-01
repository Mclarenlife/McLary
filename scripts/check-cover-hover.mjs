import assert from "node:assert/strict";
import { CoverHover, coverAt } from "../src/cover-hover.js";
const regions = [
  { x: 0, y: 0, width: 500, height: 316 },
  { x: 530, y: 0, width: 500, height: 316 },
  { x: 0, y: 358, width: 500, height: 316 },
];
assert.deepEqual(coverAt(250, 125, regions, 250), { index: 0, u: 0.5, v: 0.5 });
assert.equal(coverAt(250, 280, regions, 250), null, "Captions never enlarge");
assert.equal(coverAt(515, 125, regions, 250), null, "Gutters never glow");
assert.equal(coverAt(250, 340, regions, 250), null, "Row gaps never glow");
assert.equal(coverAt(800, 125, regions, 250).index, 1);
assert.equal(coverAt(250, 480, regions, 250).index, 2);
const hover = new CoverHover();
const hit = coverAt(250, 125, regions, 250);
hover.update(1 / 60, hit);
assert(hover.values[2] > 0 && hover.values[2] < 0.2, "Hover eases in");
for (let i = 0; i < 60; i++) hover.update(1 / 60, hit);
assert(hover.values[2] > 0.99);
assert.equal(hover.values[6], 0, "Other cards stay unchanged");
hover.update(1 / 60, { index: 0, u: 0.8, v: 0.7 });
assert(
  hover.values[0] > 0.5 && hover.values[0] < 0.8,
  "Light follows smoothly",
);
assert(hover.values[3] > 0, "Moving the pointer spreads the halo");
for (let i = 0; i < 90; i++) hover.update(1 / 60, null);
assert(
  hover.values[2] < 0.00001,
  "Leaving, dragging or blocking clears the effect",
);
hover.reset();
assert.equal(hover.values[2], 0);
assert.equal(hover.values[0], 0.5);
console.log(
  "Cover hover checks passed: image-only hits, isolated zoom state, smooth glow and cleanup.",
);
