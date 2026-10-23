import fs from "node:fs/promises";
import assert from "node:assert/strict";
for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
  const local = await fs.readFile(`public/textures/basis/${file}`);
  const upstream = await fs.readFile(`node_modules/three/examples/jsm/libs/basis/${file}`);
  if (file.endsWith(".js"))
    assert.equal(local.toString().replace(/\r\n/g, "\n"), upstream.toString().replace(/\r\n/g, "\n"));
  else assert.deepEqual(local, upstream);
}
const sky = await fs.readFile("public/textures/ocean-sky.ktx2");
assert.equal(sky.readUInt32LE(20), 4096);
assert.equal(sky.readUInt32LE(24), 2048);
assert.equal(sky.readUInt32LE(40), 13);
assert.equal(sky[sky.readUInt32LE(48) + 12], 163, "Sky uses ETC1S");
assert.equal(sky[sky.readUInt32LE(48) + 14], 2, "Sky remains sRGB");
console.log("Sky KTX2 dimensions, mipmaps, color space and bundled decoder integrity passed.");
