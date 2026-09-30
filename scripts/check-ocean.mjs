import assert from "node:assert/strict";
import * as THREE from "three";
import { BOAT_SCALE, boatPosition, oceanView } from "../src/ocean-scene.js";
import { DayCycle } from "../src/day-cycle.js";
import { applyCameraView } from "../src/camera-pose.js";

for (const [width, height] of [
  [1239, 950],
  [390, 844],
]) {
  const mobile = width < 650;
  const boat = boatPosition(mobile);
  const bounds = (contact) => {
    const view = oceanView(contact, mobile);
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 800);
    camera.position.set(view.x, view.y, view.z);
    camera.lookAt(view.tx, view.ty, view.tz);
    camera.updateMatrixWorld();
    return [
      [-2.1, 0.1],
      [2.2, 0.1],
      [-0.7, 5],
    ].map(([x, y]) => {
      const p = new THREE.Vector3(
        boat.x + x * BOAT_SCALE,
        0.16 + y * BOAT_SCALE,
        boat.z,
      ).project(camera);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
    });
  };
  const home = bounds(false),
    contact = bounds(true);
  assert(
    home[0].x >= 0.49 && home[1].x < 0.95,
    "The home boat must sit to the right and stay inside the viewport",
  );
  assert(
    home[2].y > 0.52 && home[0].y < 0.85,
    "The home boat must sit below the title and above the footer",
  );
  assert(
    contact.every((p) => p.x > 0.06 && p.x < 0.94 && p.y > 0.1 && p.y < 0.84),
    "The contact close-up must keep the mast and hull in view",
  );
  assert(
    (contact[1].x - contact[0].x) / (home[1].x - home[0].x) > 1.7,
    "Contact must move the perspective camera significantly closer to the same boat",
  );
}
console.log(
  "Ocean view checks passed: desktop/mobile boat placement, contact framing, perspective zoom.",
);
for (const [width, height] of [
  [320, 1000],
  [390, 844],
  [768, 1024],
  [1440, 900],
  [2560, 1080],
]) {
  for (const mode of ["morning", "noon", "afternoon"]) {
    const direction = new DayCycle(mode).uniforms.direction.value;
    for (const [x, y] of [
      [0, 0],
      [-0.5, -0.5],
      [0.5, 0.5],
    ]) {
      const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 800);
      applyCameraView(
        camera,
        oceanView(false, width < 650),
        "index",
        new THREE.Vector2(x, y),
        { mobile: width < 650 },
      );
      camera.updateMatrixWorld();
      const p = direction.clone().multiplyScalar(380).project(camera);
      const screen = { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      assert(
        screen.x > 0.12 && screen.x < 0.88 && screen.y > 0.1 && screen.y < 0.35,
        `${mode} sun must remain visible above the title at ${width}x${height}`,
      );
    }
  }
}
console.log(
  "Sun framing checks passed: three daylight states, five aspect ratios and pointer extremes.",
);
