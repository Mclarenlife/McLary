import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let totalBytes = 0;
for (const name of ["boat-hull", "shark", "whale", "turtle"]) {
  const file = await fs.readFile(`public/models/${name}.glb`);
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  const data = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)));
  assert(
    !data.images?.length,
    "Marine models should not need additional texture requests",
  );
  const { scene } = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    "",
  );
  let draws = 0,
    vertices = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    draws++;
    const p = o.geometry.attributes.position;
    vertices += p.count;
    assert(o.geometry.attributes.normal, "Export includes smooth normals");
    assert(Array.from(p.array).every(Number.isFinite));
  });
  const size = new THREE.Box3()
    .setFromObject(scene)
    .getSize(new THREE.Vector3());
  assert(
    size.x > 2 && size.x < 8 && size.y < 3 && size.z < 6,
    "GLB dimensions remain in the website's Y-up coordinates",
  );
  assert(
    draws <= 8,
    "Parts should be batched by material for mobile rendering",
  );
  assert(vertices < 100000, "Keep a bounded mesh budget");
  totalBytes += file.length;
  console.log(name, { draws, vertices, bytes: file.length });
}
assert(
  totalBytes < 8_000_000,
  "All four assets fit the initial-loading budget",
);
console.log("Marine asset checks passed.");
