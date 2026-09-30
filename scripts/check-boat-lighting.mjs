import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BoatLighting } from "../src/boat-lighting.js";
import { DayCycle } from "../src/day-cycle.js";

const file = await fs.readFile("public/models/boat-hull.glb");
const { scene: hull } = await new GLTFLoader().parseAsync(
  file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
  "",
);
const day = new DayCycle("noon");
const lights = new BoatLighting(new THREE.Group(), day);
lights.bindHull(hull);
assert(lights.windows.length > 0, "Bind the actual exported cabin glass");
lights.update(0, 1);
assert.equal(lights.deck.intensity, 0);
assert(
  lights.windows.every(({ material }) => material.emissiveIntensity === 0),
);
assert(lights.fixtures.every(({ core }) => core.material.opacity === 0));
day.setMode("night");
day.update(0.25);
lights.update(0, 1);
assert(
  lights.deck.intensity > 0 && lights.deck.intensity < 0.95,
  "Lights fade with twilight",
);
day.setMode("night", true);
lights.update(0, 1);
assert(lights.windows.every(({ material }) => material.emissiveIntensity > 1));
assert(lights.deck.intensity > 0 && lights.cabin.intensity > 0);
const beacon = lights.fixtures.find(({ flash }) => flash);
const peak = beacon.core.material.opacity;
lights.update(2.4, 1);
assert(beacon.core.material.opacity < peak, "The mast beacon pulses gently");
lights.update(0, 0);
const still = beacon.core.material.opacity;
lights.update(2.4, 0);
assert.equal(
  beacon.core.material.opacity,
  still,
  "Reduced motion keeps the beacon steady",
);
day.setMode("morning", true);
lights.update(0, 1);
assert.equal(lights.deck.intensity, 0);
assert(
  lights.windows.every(({ material, base }) => material.color.equals(base)),
);
console.log(
  "Boat lighting checks passed: real GLB windows, twilight fade, night illumination and reduced motion.",
);
