import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import * as THREE from "three";
import { RibbonGrid, ribbonPoint, galleryBend } from "../src/paper-geometry.js";
import { FrameBudget, renderSettings } from "../src/render-budget.js";

const geometry = new THREE.PlaneGeometry(1, 1, 48, 192);
const uv = geometry.attributes.uv;
const output = new Float32Array(geometry.attributes.position.array.length);
const grid = new RibbonGrid(uv.array, 49);
let maxError = 0;
for (const width of [346, 860, 1190]) for (const scroll of [0, 120, 600, 2100]) {
  const mobile = width < 500;
  const options = { minimum: -2600, maximum: mobile ? 1104 : 980, width,
    bend: galleryBend(mobile ? 258 : 330, mobile, scroll), radius: mobile ? 160 : 210,
    horizon: mobile ? 188 : 238, time: scroll / 19, flutter: mobile ? .6 : 1.5 };
  grid.update(output, options);
  for (let i = 0; i < uv.count; i++) {
    const expected = ribbonPoint((uv.getX(i) - .5) * width,
      options.maximum + (options.minimum - options.maximum) * uv.getY(i),
      options.bend, options.radius, options.horizon, options.time, options.flutter, width);
    for (let axis = 0; axis < 3; axis++) maxError = Math.max(maxError, Math.abs(expected[axis] - output[i * 3 + axis]));
  }
}
assert(maxError < .001, "Optimized fold/flutter must match the original to under .001 CSS units");
assert.equal(renderSettings(390, 844, 3, true).dpr, 1.35);
assert.equal(renderSettings(1280, 720, 1.25, false).dpr, 1.25);
assert(renderSettings(3840, 2160, 2).dpr ** 2 * 3840 * 2160 <= 4_500_001);
const budget = new FrameBudget();
let time = 1000;
for (let i = 0; i < 900; i++) budget.sample(time += 1000 / 60);
assert.equal(budget.scale, 1, "Smooth rendering retains full quality");
budget.sample(time += 5000);
assert.equal(budget.scale, 1, "A background-tab pause must not lower quality");
for (let i = 0; i < 400; i++) budget.sample(time += 40);
assert.equal(budget.scale, .75, "Sustained slow frames reduce resolution within the bounded floor");
for (let i = 0; i < 900; i++) budget.sample(time += 16);
assert.equal(budget.scale, .75, "Quality must not oscillate during the visit");

const options = { minimum:-2600, maximum:980, width:1190, bend:535, radius:210, horizon:238, time:12, flutter:1 };
const baseline = () => {
  for (let i=0;i<uv.count;i++) output.set(ribbonPoint((uv.getX(i)-.5)*options.width,
    options.maximum+(options.minimum-options.maximum)*uv.getY(i),options.bend,options.radius,options.horizon,
    options.time,options.flutter,options.width),i*3);
};
const optimized = () => grid.update(output, options);
for (let i=0;i<30;i++) { baseline(); optimized(); }
const measure = fn => { const start=performance.now();for(let i=0;i<300;i++)fn();return (performance.now()-start)/300; };
console.log(JSON.stringify({ vertices:uv.count,maxPositionError:maxError,baselineMs:measure(baseline),optimizedMs:measure(optimized) },null,2));
console.log("Performance checks passed: unchanged ribbon geometry, responsive budgets, stable frame-rate adaptation.");
