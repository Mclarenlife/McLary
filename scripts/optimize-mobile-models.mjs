// Offline model authoring. Install build-only dependencies under artifacts/model-tools:
// @gltf-transform/core@4.4.0 @gltf-transform/extensions@4.4.0
// @gltf-transform/functions@4.4.0 meshoptimizer@1.0.1
// Run: node scripts/optimize-mobile-models.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(path.resolve('artifacts/model-tools/package.json'));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { weld, simplify, dedup, reorder, getBounds } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
await fs.mkdir('public/models/mobile', { recursive: true });
const settings = [['boat-hull', .75, .0004], ['shark', .6, .0005], ['turtle', .6, .0005], ['whale', .6, .0005]];
function stats(document) {
  const root = document.getRoot();
  const primitives = root.listMeshes().flatMap(m => m.listPrimitives());
  return {
    triangles: primitives.reduce((n,p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0),
    vertices: primitives.reduce((n,p) => n + p.getAttribute('POSITION').getCount(), 0),
    primitives: primitives.length,
    geometryBytes: root.listAccessors().reduce((n,a) => n + (a.getArray()?.byteLength || 0), 0),
  };
}
const report = [];
for (const [name,ratio,error] of settings) {
  const original = await fs.readFile(`public/models/${name}.glb`);
  const document = await io.readBinary(original), root = document.getRoot();
  const before = stats(document), originalBounds = getBounds(root.listScenes()[0]);
  const nodes = root.listNodes().map(n => ({ name:n.getName(),matrix:n.getMatrix() }));
  assert.equal(root.listTextures().length,0,'Marine models use materials/vertex colors');
  await document.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio,error}),dedup(),reorder({encoder:MeshoptEncoder,target:'size'}));
  // Keep local coordinates: swim shaders bend bodies in model units.
  document.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const output = await io.writeBinary(document), decoded = await io.readBinary(output), after = stats(decoded);
  assert.deepEqual(decoded.getRoot().listNodes().map(n => ({name:n.getName(),matrix:n.getMatrix()})),nodes);
  assert.equal(after.primitives,before.primitives);
  assert(after.triangles < before.triangles);
  await fs.writeFile(`public/models/mobile/${name}.glb`,output);
  report.push({name,ratio,error,sourceHash:createHash('sha256').update(original).digest('hex'),originalBytes:original.length,mobileBytes:output.length,originalBounds,before,after,textures:[]});
  console.log(`${name}: ${before.triangles} -> ${after.triangles} triangles; ${original.length} -> ${output.length} bytes`);
}
await fs.writeFile('public/models/mobile/manifest.json',JSON.stringify({version:1,models:report},null,2)+'\n');
