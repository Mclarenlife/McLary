import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as THREE from "three";
import {
  PhotoGlobe,
  geoPoint,
  globeOrientation,
  EARTH_RADIUS,
} from "../src/photo-globe.js";
import { places, photographs } from "../src/photography.js";
import { SeaVisitors } from "../src/sea-visitors.js";

for (const place of places) {
  const front = geoPoint(place.lat, place.lon, 1).applyQuaternion(
    globeOrientation(place.lat, place.lon),
  );
  assert(
    front.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-10,
    "Selected place must face the viewer",
  );
}
const data = JSON.parse(await fs.readFile("public/earth/regions.json", "utf8"));
globalThis.innerWidth = 1239;
globalThis.innerHeight = 950;
const globe = new PhotoGlobe();
for (const f of data.features) globe.addRegion(f);
for (const [width, height] of [
  [1239, 950],
  [390, 844],
]) {
  innerWidth = width;
  innerHeight = height;
  for (const id of ["guangdong", "macau", "shanxi"]) {
    const view = globe.view(id, width < 650),
      r = globe.regions.get(id);
    assert(view.z > EARTH_RADIUS, "Close-up camera must stay outside Earth");
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.00001, 80);
    camera.position.set(view.x, view.y, view.z);
    camera.lookAt(view.tx, view.ty, view.tz);
    camera.updateMatrixWorld();
    const points = [];
    r.group.traverse((object) => {
      if (!object.isLine) return;
      const a = object.geometry.attributes.position;
      for (let i = 0; i < a.count; i++)
        points.push(
          new THREE.Vector3()
            .fromBufferAttribute(a, i)
            .applyQuaternion(globeOrientation(r.lat, r.lon))
            .add(new THREE.Vector3(0, 3.5, 0))
            .project(camera),
        );
    });
    assert(
      points.every(
        (p) =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          Math.abs(p.x) < 0.96 &&
          Math.abs(p.y) < 0.96,
      ),
      "Entire selected outline must fit",
    );
    assert(
      Math.max(...points.map((p) => p.y)) -
        Math.min(...points.map((p) => p.y)) >
        0.25,
      "Small regions must receive a real close-up",
    );
  }
}
assert(
  photographs.every((p) => !p.image && p.empty),
  "User requested empty frames, not stock photography",
);
const visitors = new SeaVisitors();
visitors.update(8);
assert.equal(
  visitors.creatures.filter((v) => v.visible)[0]?.userData.kind,
  "whale",
);
visitors.update(24);
assert.equal(
  visitors.creatures.filter((v) => v.visible)[0]?.userData.kind,
  "shark",
);
visitors.update(27);
assert.equal(
  visitors.creatures.filter((v) => v.visible)[0]?.userData.kind,
  "turtle",
);
visitors.update(23);
assert.equal(
  visitors.creatures.filter((v) => v.visible).length,
  0,
  "Large creatures need quiet intervals",
);
console.log(
  "Gallery checks passed: China/region orientation, desktop/mobile framing, close-up clearance, empty frames, occasional sea visitors.",
);
