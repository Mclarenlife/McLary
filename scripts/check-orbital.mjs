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
    assert(pose.natural >= 0 && pose.natural <= 1);
    previous = pose.altitude;
  }
  const end = orbitalPose(1, mobile);
  assert(
    end.position.distanceTo(new THREE.Vector3(0, 3.5, mobile ? 21.5 : 13)) <
      1e-8,
  );
  assert(end.target.distanceTo(center) < 1e-8);
  assert.equal(end.natural, 0);
  assert.equal(end.interface, 1);
}
// The tangent patch must initially cover the camera exactly, including tall phones.
for (const aspect of [390 / 844, 1440 / 900]) {
  const camera = new THREE.PerspectiveCamera(46, aspect, 0.0001, 80);
  camera.position.copy(start.position);
  camera.lookAt(start.target);
  camera.updateMatrixWorld();
  const height = 2 * (0.006 - 0.0001) * Math.tan(THREE.MathUtils.degToRad(23));
  const corner = new THREE.Vector3((height * aspect) / 2, height / 2, 0)
    .applyQuaternion(camera.quaternion)
    .add(start.anchor)
    .addScaledVector(start.normal, 0.0001)
    .project(camera);
  assert(
    Math.abs(corner.x - 1) < 1e-7 && Math.abs(corner.y - 1) < 1e-7,
    "No jump in initial framing",
  );
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
effect.texture = {
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
assert.equal(settled, 1);
assert.equal(effect.app.inert, false);
assert.equal(effect.patch.visible, false);
assert.equal(effect.scene.orbitalFlight, null);
assert.equal(effect.scene.photoGallery.material.uniforms.flight.value, 0);
assert.equal(effect.app.dataset.flight, undefined);
console.log(
  "Orbital checks passed: geographic anchor, continuous ascent, perspective framing, desktop/mobile endpoints and exactly-once cleanup.",
);
