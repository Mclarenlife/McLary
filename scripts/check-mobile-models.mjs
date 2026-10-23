import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { MeshoptDecoder as shippedDecoder } from '../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';

const require = createRequire(path.resolve('artifacts/model-tools/package.json'));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { getBounds } = require('@gltf-transform/functions');
const draco = require('draco3dgltf');
await shippedDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco.createDecoderModule(), 'meshopt.decoder': shippedDecoder,
});
const manifest = JSON.parse(await fs.readFile('public/models/mobile/manifest.json'));
const totals = { originalBytes: 0, mobileBytes: 0, originalTriangles: 0, mobileTriangles: 0, originalGeometryBytes: 0, mobileGeometryBytes: 0 };
for (const model of manifest.models) {
  const original = await fs.readFile(`public/models/${model.name}.glb`);
  assert.equal(createHash('sha256').update(original).digest('hex'), model.sourceHash, 'Desktop/master assets must remain unchanged');
  const bytes = await fs.readFile(`public/models/mobile/${model.name}.glb`);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert(json.extensionsRequired.includes(model.name.endsWith('detail') ? 'KHR_draco_mesh_compression' : 'EXT_meshopt_compression'));
  assert.equal(bytes.length, model.mobileBytes);
  assert(bytes.length < model.originalBytes);
  // Decode with the ACTUAL Three.js runtime decoder, not just the build tool's version.
  const output = await io.readBinary(bytes), source = await io.readBinary(original);
  const shape = doc => doc.getRoot().listNodes().map(n => ({ name: n.getName(), matrix: n.getMatrix() }));
  if (!model.name.endsWith('detail')) assert.deepEqual(shape(output), shape(source), 'Swim animation coordinates/transforms must remain unchanged');
  const bounds = getBounds(output.getRoot().listScenes()[0]);
  const extent = Math.max(...model.originalBounds.max.map((v, i) => v - model.originalBounds.min[i]));
  for (const key of ['min', 'max']) for (let i = 0; i < 3; i++)
    assert(Math.abs(bounds[key][i] - model.originalBounds[key][i]) < extent * .005, 'World silhouette bounds must stay close');
  assert.deepEqual(output.getRoot().listMaterials().map(m => m.getName()).sort(), source.getRoot().listMaterials().map(m => m.getName()).sort());
  const primitives = output.getRoot().listMeshes().flatMap(m => m.listPrimitives());
  assert.equal(primitives.length, model.before.primitives);
  let triangles = 0;
  for (const p of primitives) {
    const positions = p.getAttribute('POSITION'), indices = p.getIndices();
    if (!model.name.endsWith('detail')) assert.equal(positions.getComponentType(), 5126, 'Retain float local coordinates for swim shaders');
    for (const a of p.listAttributes()) for (const value of a.getArray()) assert(Number.isFinite(value));
    for (const index of indices.getArray()) assert(index < positions.getCount());
    triangles += indices.getCount() / 3;
  }
  assert.equal(triangles, model.after.triangles);
  assert(triangles > 0 && triangles < model.before.triangles);
  for (const t of output.getRoot().listTextures()) {
    assert.equal(t.getMimeType(), 'image/ktx2');
    const b = Buffer.from(t.getImage()), color = output.getRoot().listMaterials().some(m => m.getBaseColorTexture() === t);
    assert.equal(b.readUInt32LE(20), color ? 1024 : 512);
    assert.equal(b.readUInt32LE(40), color ? 11 : 10);
    assert.equal(b.readUInt32LE(44), 2, 'Lossless Zstd storage around UASTC');
    const dfd = b.readUInt32LE(48);
    assert.equal(b[dfd + 12], 166, 'UASTC retained');
    assert.equal(b[dfd + 14], color ? 2 : 1, 'Correct color/data transfer function');
  }
  totals.originalBytes += model.originalBytes; totals.mobileBytes += bytes.length;
  totals.originalTriangles += model.before.triangles; totals.mobileTriangles += triangles;
  totals.originalGeometryBytes += model.before.geometryBytes; totals.mobileGeometryBytes += model.after.geometryBytes;
}
console.log('Mobile model validation passed: runtime decoding, complete parts/materials, finite geometry, unchanged transforms/masters, KTX2 mipmaps.');
console.log(JSON.stringify(totals, null, 2));
