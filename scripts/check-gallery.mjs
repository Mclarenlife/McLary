import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as THREE from "three";
import {
  PhotoGlobe,
  geoPoint,
  globeOrientation,
  orbitPose,
  regionMagnification,
  EARTH_RADIUS,
  ORBIT_RADIUS,
  PHOTO_WIDTH,
} from "../src/photo-globe.js";
import { polygonsOf } from "../src/globe-surface.js";
import { places, photographs } from "../src/photography.js";

for (const p of places)
  assert(
    geoPoint(p.lat, p.lon, 1)
      .applyQuaternion(globeOrientation(p.lat, p.lon))
      .distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-10,
  );
const globe = new PhotoGlobe();
const data = JSON.parse(await fs.readFile("public/earth/regions.json", "utf8"));
const atlas = JSON.parse(
  await fs.readFile("public/earth/countries.json", "utf8"),
);
assert(atlas.countries.length > 200, "World boundaries must cover the globe");
for (const id of ["guangdong", "macau", "shanxi"])
  assert(
    atlas.contexts.find((c) => c.id === id)?.polygons.length > 0,
    "Every region needs a detailed local coastline",
  );
for (const feature of data.features) globe.addRegion(feature);
for (const [width, height] of [
  [1239, 950],
  [390, 844],
]) {
  globalThis.innerWidth = width;
  globalThis.innerHeight = height;
  const all = globe.view("all", width < 650);
  for (const id of ["guangdong", "macau", "shanxi"]) {
    assert.deepEqual(
      globe.view(id, width < 650),
      all,
      "Filtering must never enlarge the sphere or move the camera",
    );
    const region = globe.regions.get(id),
      scale = regionMagnification(region);
    const focus = geoPoint(region.lat, region.lon, 1);
    const points = polygonsOf(region.feature.geometry).flat(2);
    let largestAngle = 0;
    for (const [lon, lat] of points) {
      const direction = geoPoint(lat, lon, 1);
      const angle =
        Math.acos(THREE.MathUtils.clamp(focus.dot(direction), -1, 1)) / scale;
      largestAngle = Math.max(largestAngle, angle);
      assert(
        angle < 1.14,
        `${id}: complete region must stay within the clear central lens`,
      );
    }
    assert(
      largestAngle > 0.6,
      "Tiny regions must receive a real geographic magnification",
    );
  }
}
const origin = new THREE.Vector3(0, 3.5, 0);
for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
  const pose = orbitPose(angle),
    radial = pose.position.clone().sub(origin).normalize();
  assert(Math.abs(pose.position.distanceTo(origin) - ORBIT_RADIUS) < 1e-8);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
  const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(pose.quaternion);
  assert(
    normal.dot(radial) > 0.999999,
    "Photo plane must face radially outward",
  );
  assert(
    Math.abs(edge.dot(radial)) < 1e-8,
    "Photo edge must remain tangent to the sphere",
  );
}
assert(PHOTO_WIDTH < 1.5, "Frames stay small relative to the globe");
// Real raycasting against a visible front frame drives pause, approach, and return.
innerWidth = 1239;
innerHeight = 950;
const camera = new THREE.PerspectiveCamera(
  46,
  innerWidth / innerHeight,
  0.1,
  80,
);
camera.position.set(0, 3.5, 13);
camera.lookAt(origin);
camera.updateMatrixWorld();
const card = new THREE.Group();
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.3, 0.9, 0.04),
  new THREE.MeshBasicMaterial(),
);
mesh.userData.photo = "guangdong-01";
card.add(mesh);
card.userData = { photo: photographs[0], visibility: 1, hover: 0 };
globe.group.add(card);
globe.photoCards.push(card);
globe.ready = true;
globe.interactionEnabled = true;
globe.orbitAngle = Math.PI / 2;
globe.update(0, camera, 1, 0, 0);
const baseDistance = card.position.distanceTo(camera.position);
const point = card.position.clone().project(camera);
const x = ((point.x + 1) * innerWidth) / 2,
  y = ((1 - point.y) * innerHeight) / 2;
assert.equal(globe.pick(x, y, camera), "guangdong-01");
globe.setPointer(x, y);
const pausedAngle = globe.orbitAngle;
for (let i = 0; i < 60; i++) globe.update(i / 60, camera, 1, 0, 1 / 60);
assert.equal(globe.hovered, "guangdong-01");
assert.equal(
  globe.orbitAngle,
  pausedAngle,
  "Hover must pause orbital movement",
);
assert(
  card.position.distanceTo(camera.position) < baseDistance - 1.5,
  "Hovered photo approaches the camera",
);
assert(card.scale.x > 1.8, "Hovered photo enlarges");
globe.clearPointer();
for (let i = 0; i < 60; i++) globe.update(1 + i / 60, camera, 1, 0, 1 / 60);
assert(
  globe.orbitAngle > pausedAngle + 0.1,
  "Leaving the frame resumes movement",
);
assert(card.scale.x < 1.01, "Photo returns to its small size");
const stopped = globe.orbitAngle;
globe.update(5, camera, 0, 0, 1);
assert.equal(globe.orbitAngle, stopped, "Reduced motion stops orbiting");
for (const hz of [30, 144]) {
  globe.orbitAngle = 0;
  for (let i = 0; i < hz; i++) globe.update(i / hz, camera, 1, 0, 1 / hz);
  assert(
    Math.abs(globe.orbitAngle - 0.115) < 1e-8,
    "Orbit speed is independent of frame rate",
  );
}
assert(
  photographs.every((p) => !p.image && p.empty),
  "Keep user-requested empty frames",
);
assert.equal(globe.decor.planets.length, 3);
assert(
  globe.decor.satellite.children.length > 0 &&
    globe.decor.station.children.length > 0,
);
console.log(
  "Gallery checks passed: fixed globe, region lens fitting, tangential orbit, raycast hover pause/approach/return, reduced motion and frame-rate independence.",
);
