import { applyCameraView } from "../src/camera-pose.js";
import { oceanView } from "../src/ocean-scene.js";
globalThis.innerWidth = 1440;
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  orbitalPose,
  DEPARTURE,
  OrbitalTransition,
} from "../src/orbital-transition.js";
import { EARTH_RADIUS, globeOrientation } from "../src/photo-globe.js";
const center = new THREE.Vector3(0, 3.5, 0);
const start = orbitalPose(0);
const geo = start.normal
  .clone()
  .applyQuaternion(globeOrientation(35, 105).invert());
assert(
  Math.abs(THREE.MathUtils.radToDeg(Math.asin(geo.y)) - DEPARTURE.lat) < 1e-8,
);
assert(
  Math.abs(
    THREE.MathUtils.radToDeg(Math.atan2(-geo.z, geo.x)) - DEPARTURE.lon,
  ) < 1e-8,
);
assert(Math.abs(start.position.distanceTo(start.anchor) - 0.006) < 1e-8);
for (const mobile of [false, true]) {
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const pose = orbitalPose(i / 1000, mobile);
    assert(
      pose.altitude > previous,
      "Camera must keep rising through every scale",
    );
    assert(
      pose.position.distanceTo(center) > EARTH_RADIUS,
      "Camera must stay above the sphere",
    );
    assert(
      pose.position.distanceTo(pose.target) > 0,
      "Valid camera direction throughout",
    );
    previous = pose.altitude;
  }
  const end = orbitalPose(1, mobile);
  assert(
    end.position.distanceTo(new THREE.Vector3(0, 3.5, mobile ? 21.5 : 13)) <
      1e-8,
  );
  assert(end.target.distanceTo(center) < 1e-8);
  assert.equal(end.interface, 1);
}
const rootClasses = new Set();
globalThis.document = {
  documentElement: { classList: { remove: (x) => rootClasses.delete(x) } },
};
const effect = Object.create(OrbitalTransition.prototype);
let killed = 0,
  disposed = 0,
  done = 0,
  settled = 0;
effect.app = {
  inert: true,
  style: { opacity: 0 },
  dataset: { flight: ".5" },
  querySelectorAll: () => [],
};
effect.patch = { visible: true };
effect.material = { uniforms: { frame: { value: {} } } };
effect.target = {
  dispose() {
    disposed++;
  },
};
effect.timeline = {
  kill() {
    killed++;
  },
};
effect.scene = {
  orbitalFlight: effect,
  orbitalActive: true,
  photoGallery: {
    material: { uniforms: { flight: { value: 1 } } },
    decor: { group: { visible: false } },
  },
  setPage() {
    settled++;
  },
  render() {},
};
effect.destination = "gallery";
effect.onComplete = () => done++;
effect.complete();
effect.complete();
assert.equal(killed, 1);
assert.equal(disposed, 1);
assert.equal(done, 1);
assert.equal(settled, 2);
assert.equal(effect.app.inert, false);
assert.equal(effect.patch.visible, false);
assert.equal(effect.scene.orbitalFlight, null);
assert.equal(effect.app.dataset.flight, undefined);

// Render two different live times, while preserving the gallery render state.
const live = Object.create(OrbitalTransition.prototype);
const stateScene = new THREE.Scene();
stateScene.background = new THREE.Color("#050709");
stateScene.fog = new THREE.Fog("#e1e1e5", 65, 260);
let draws = 0,
  animated = [];
const savedTarget = { saved: true };
let currentTarget = savedTarget;
live.state = { progress: 0.1 };
live.patch = { visible: true };
live.app = { dataset: {} };
live.entering = true;
live.surfaceWaterColor = new THREE.Color("#5798a8");
live.surfacePage = "index";
live.surfaceCamera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 1200);
live.surfaceStart = new THREE.Vector3(0, 8.4, 22);
live.surfaceCamera.position.copy(live.surfaceStart);
live.surfaceCamera.lookAt(0, 4.5, -32);
live.surfaceRotation = live.surfaceCamera.quaternion.clone();
live.target = {};
live.scene = {
  day: {
    uniforms: {
      fog: { value: new THREE.Color("#d7e3e1") },
      water: { value: new THREE.Color("#5798a8") },
    },
  },
  applyDayLighting() {},
  scene: stateScene,
  reduced: false,
  smoothPointer: new THREE.Vector2(0.35, -0.22),
  water: {
    visible: false,
    material: {
      uniforms: { waterColor: { value: new THREE.Color("#8c839d") } },
    },
  },
  ocean: {
    group: { visible: false },
    reveal: { value: 0 },
    update: (t) => animated.push(t),
  },
  underwater: { group: { visible: false } },
  photoGallery: { group: { visible: true } },
  waterMotion: { time: 10 },
  renderer: {
    getRenderTarget: () => currentTarget,
    setRenderTarget: (t) => (currentTarget = t),
    render: (_scene, camera) => {
      draws++;
      assert(camera === live.surfaceCamera);
      assert(live.scene.water.visible);
      assert(!live.scene.photoGallery.group.visible);
    },
  },
};
live.renderSurface();
const firstY = live.surfaceCamera.position.y;
live.scene.waterMotion.time = 10.016;
live.state.progress = 0.2;
live.renderSurface();
assert.equal(
  draws,
  2,
  "Each frame redraws live geometry instead of sampling a screenshot",
);
assert.deepEqual(animated, [10, 10.016], "Ocean animation keeps advancing");
assert(
  live.surfaceCamera.position.y > firstY,
  "The actual perspective camera rises",
);
assert.equal(currentTarget, savedTarget);
assert(live.scene.photoGallery.group.visible);
assert(!live.scene.water.visible);
assert.equal(stateScene.background.getHexString(), "050709");
// A moving pointer must not change the optical pose when handing off from flight.
for (const page of ["index", "contact"])
  for (const pointer of [
    new THREE.Vector2(0.45, -0.3),
    new THREE.Vector2(-0.4, 0.25),
  ]) {
    live.entering = false;
    live.surfacePage = page;
    live.state.progress = 0;
    live.scene.smoothPointer.copy(pointer);
    live.renderSurface();
    const normal = new THREE.PerspectiveCamera(46, 1.6, 0.1, 800);
    applyCameraView(
      normal,
      oceanView(page === "contact", false),
      page,
      pointer,
      { contact: page === "contact" ? 1 : 0 },
    );
    assert(
      live.surfaceCamera.position.distanceTo(normal.position) < 1e-10,
      "No return-position jump",
    );
    assert(
      live.surfaceCamera.quaternion.angleTo(normal.quaternion) < 1e-7,
      "No return-angle snap",
    );
  }
assert.equal(
  live.scene.water.material.uniforms.waterColor.value.getHexString(),
  "8c839d",
  "Offscreen ocean restores gallery render state",
);
console.log(
  "Orbital checks passed: geographic anchor, continuous ascent, live ocean rendering, renderer state restoration, endpoints and cleanup.",
);
