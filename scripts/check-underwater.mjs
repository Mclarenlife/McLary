import assert from "node:assert/strict";
import * as THREE from "three";
import { UnderwaterScene } from "../src/underwater-scene.js";

// Exercise resource bounds and route lifecycle without creating a WebGL context.
globalThis.innerWidth = 1239;
globalThis.innerHeight = 950;
globalThis.devicePixelRatio = 2;
const gradient = { addColorStop() {} };
const context = new Proxy(
  {},
  {
    get: (_, key) =>
      key === "createRadialGradient" ? () => gradient : () => {},
  },
);
globalThis.document = {
  createElement: () => ({ setAttribute() {}, getContext: () => context }),
  body: { append() {} },
};

const scene = new UnderwaterScene();
assert.equal(scene.group.visible, false);
assert.equal(scene.bubbles.canvas.hidden, true);
scene.setActive(true);
scene.bubbles.setActive(true);
for (let i = 0; i < 1000; i++)
  scene.bubbles.emit(100 + (i % 100) * 4, 600, i * 0.08);
assert.equal(
  scene.bubbles.items.length,
  48,
  "Continuous movement must keep a bounded bubble pool",
);
const first = { ...scene.bubbles.items[0] };
scene.bubbles.update(0.25);
assert(scene.bubbles.items[0].y < first.y, "Bubbles must float upward");
for (let i = 0; i < 80; i++) scene.bubbles.update(0.05);
assert.equal(
  scene.bubbles.items.length,
  0,
  "All bubbles must expire after input stops",
);
scene.bubbles.emit(500, 500, 200);
scene.setActive(false);
assert.equal(
  scene.bubbles.items.length,
  0,
  "Leaving Work must clear its bubbles",
);
assert.equal(scene.bubbles.canvas.hidden, true);
const before = Array.from(scene.fish.instanceMatrix.array);
scene.update(5, 0.016, new THREE.Vector2(0.25, -0.25));
assert.notDeepEqual(
  Array.from(scene.fish.instanceMatrix.array),
  before,
  "Fish must swim through the scene",
);
assert(Array.from(scene.fish.instanceMatrix.array).every(Number.isFinite));
innerWidth = 390;
innerHeight = 844;
scene.resize();
assert.equal(
  scene.bubbles.canvas.width,
  585,
  "Mobile bubbles use capped rendering resolution",
);
assert.equal(scene.backdrop.material.uniforms.aspect.value, 390 / 844);
console.log(
  "Underwater checks passed: bounded bubbles, buoyancy, expiry, route cleanup, swimming fish and responsive sizing.",
);
