import fs from "node:fs/promises";
import assert from "node:assert/strict";
function glb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const size = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + size));
  const bin = bytes.subarray(28 + size);
  return { json, view: i => {
    const v = json.bufferViews[i];
    return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  }};
}
let before = 0, after = 0, originalTextures = 0, uniqueTextures = 0;
for (const name of ["shipwreck-detail", "ruins-detail"]) {
  const a = await fs.readFile(`public/models/${name}.glb`);
  const b = await fs.readFile(`public/models/${name}-ktx2.glb`);
  before += a.length; after += b.length;
  const source = glb(a), result = glb(b);
  assert(b.length < a.length, "Compression must reduce download size");
  assert(result.json.extensionsRequired.includes("KHR_texture_basisu"));
  assert.deepEqual(result.json.accessors, source.json.accessors);
  assert.deepEqual(result.json.materials, source.json.materials);
  assert.deepEqual(result.json.nodes, source.json.nodes);
  source.json.meshes.forEach((mesh, i) => mesh.primitives.forEach((primitive, j) => {
    const output = result.json.meshes[i].primitives[j];
    assert.deepEqual(primitive.attributes, output.attributes);
    assert.deepEqual(source.view(primitive.extensions.KHR_draco_mesh_compression.bufferView),
      result.view(output.extensions.KHR_draco_mesh_compression.bufferView), "Draco geometry must be byte-for-byte unchanged");
  }));
  originalTextures += source.json.images.length;
  uniqueTextures += result.json.images.length;
  result.json.images.forEach(image => {
    assert.equal(image.mimeType, "image/ktx2");
    const texture = result.view(image.bufferView);
    assert.deepEqual([...texture.subarray(0, 12)], [171,75,84,88,32,50,48,187,13,10,26,10]);
    assert.equal(texture.readUInt32LE(20), 1024, "Original width retained");
    assert.equal(texture.readUInt32LE(24), 1024, "Original height retained");
    assert.equal(texture.readUInt32LE(40), 11, "Complete mip chain included");
    assert.equal(texture.readUInt32LE(44), 2, "Lossless Zstd supercompression");
    const dfd = texture.readUInt32LE(48);
    assert.equal(texture[dfd + 12], 166, "High-quality UASTC color model");
  });
  for (const [i, texture] of result.json.textures.entries()) {
    const image = result.json.images[texture.extensions.KHR_texture_basisu.source];
    assert(image, "Every compressed texture references a valid embedded image");
    const ktx = result.view(image.bufferView), dfd = ktx.readUInt32LE(48);
    const color = result.json.materials.some(m => m.pbrMetallicRoughness?.baseColorTexture?.index === i);
    assert.equal(ktx[dfd + 14], color ? 2 : 1, "sRGB color and linear data maps must stay distinct");
  }
}
for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"])
  assert.deepEqual(await fs.readFile(`public/textures/basis/${file}`),
    await fs.readFile(`node_modules/three/examples/jsm/libs/basis/${file}`));
const sky = await fs.readFile("public/textures/ocean-sky.ktx2");
assert.equal(sky.readUInt32LE(20), 4096);
assert.equal(sky.readUInt32LE(24), 2048);
assert.equal(sky.readUInt32LE(40), 13);
assert.equal(sky[sky.readUInt32LE(48) + 12], 163, "Sky uses ETC1S");
assert.equal(sky[sky.readUInt32LE(48) + 14], 2, "Sky remains sRGB");
// RGBA8 versus ASTC 4x4 / BC7 at 8 bits per pixel; includes the full mip chain.
console.log(JSON.stringify({ before, after, reduction: 1 - after / before, originalTextures,
  uniqueTextures, estimatedOriginalMiB: originalTextures * 4 * 4 / 3,
  estimatedCompressedMiB: uniqueTextures * 4 / 3 }, null, 2));
