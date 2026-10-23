// Offline only. npm install --prefix artifacts/model-tools @gltf-transform/core@4.4.0
// @gltf-transform/extensions@4.4.0 @gltf-transform/functions@4.4.0
// meshoptimizer@1.0.1 draco3dgltf@1.5.7 sharp@0.34.5
// node scripts/optimize-mobile-models.mjs /path/to/toktx.exe
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const require = createRequire(path.resolve('artifacts/model-tools/package.json'));
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression, KHRTextureBasisu } = require('@gltf-transform/extensions');
const { weld, simplify, dedup, reorder, compactPrimitive, draco: compressDraco, getBounds } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require('meshoptimizer');
const draco = require('draco3dgltf');
const encoder = process.argv[2];
if (!encoder) throw Error('Pass the official KTX toktx executable');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco.createDecoderModule(),
  'draco3d.encoder': await draco.createEncoderModule(),
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const temporary = 'artifacts/mobile-models';
await fs.mkdir(temporary, { recursive: true });
await fs.mkdir('public/models/mobile', { recursive: true });
const settings = [
  ['shipwreck-detail', .55, .001], ['ruins-detail', .5, .001],
  ['boat-hull', .75, .0004], ['shark', .6, .0005],
  ['turtle', .6, .0005], ['whale', .6, .0005],
];
function stats(document) {
  const root = document.getRoot();
  const primitives = root.listMeshes().flatMap(m => m.listPrimitives());
  return {
    triangles: primitives.reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0),
    vertices: primitives.reduce((n, p) => n + p.getAttribute('POSITION').getCount(), 0),
    primitives: primitives.length,
    geometryBytes: root.listAccessors().reduce((n, a) => n + (a.getArray()?.byteLength || 0), 0),
  };
}
const report = [];
for (const [name, ratio, error] of settings) {
  const original = await fs.readFile(`public/models/${name}.glb`);
  const document = await io.readBinary(original);
  const root = document.getRoot(), before = stats(document);
  const staticSeabed = name.endsWith('detail');
  const originalBounds = getBounds(root.listScenes()[0]);
  // Keep local coordinates and node transforms EXACTLY: swim shaders bend bodies
  // in model units. Quantization transforms would change the animation amplitude.
  const nodes = root.listNodes().map(n => ({ name: n.getName(), matrix: n.getMatrix() }));
  for (const ext of root.listExtensionsUsed())
    if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
  await document.transform(weld());
  if (staticSeabed) {
    // Flat stone faces and UV islands block topology-only decimation. Include
    // normal/UV error explicitly so redundant bevels can collapse across seams.
    for (const primitive of root.listMeshes().flatMap(m => m.listPrimitives())) {
      const position = primitive.getAttribute('POSITION');
      const normal = primitive.getAttribute('NORMAL'), uv = primitive.getAttribute('TEXCOORD_0');
      const attributes = new Float32Array(position.getCount() * 5);
      for (let i = 0; i < position.getCount(); i++) {
        if (normal) attributes.set(normal.getElement(i, []), i * 5);
        if (uv) attributes.set(uv.getElement(i, []), i * 5 + 3);
      }
      const old = primitive.getIndices(), indices = new Uint32Array(old.getArray());
      const [reduced] = MeshoptSimplifier.simplifyWithAttributes(indices, position.getArray(), 3,
        attributes, 5, [.1, .1, .1, .1, .1], null, Math.floor(indices.length * ratio / 3) * 3,
        error, ['Permissive']);
      primitive.setIndices(document.createAccessor().setType('SCALAR').setBuffer(old.getBuffer()).setArray(reduced));
      if (old.listParents().length === 1) old.dispose();
      compactPrimitive(primitive);
    }
  } else await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error }));
  await document.transform(dedup());
  const textures = [];
  for (const texture of root.listTextures()) {
    const srgb = root.listMaterials().some(m => m.getBaseColorTexture() === texture || m.getEmissiveTexture() === texture);
    // Retain full color resolution. Only distant surface micro-detail maps shrink.
    const size = srgb ? 1024 : 512;
    const pixels = await sharp(texture.getImage()).resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    const hash = createHash('sha256').update(pixels).update(String(srgb)).digest('hex');
    const png = path.join(temporary, `${hash}.png`), ktx = path.join(temporary, `${hash}.ktx2`);
    await fs.writeFile(png, pixels);
    try { assert((await fs.stat(ktx)).size > 80); } catch {
      execFileSync(encoder, ['--t2', '--encode', 'uastc', '--uastc_quality', '4', '--zcmp', '18',
        '--genmipmap', '--assign_oetf', srgb ? 'srgb' : 'linear', '--threads', '4', ktx, png], { stdio: 'pipe' });
    }
    const bytes = await fs.readFile(ktx);
    texture.setImage(bytes).setMimeType('image/ktx2');
    textures.push({ name: texture.getName(), width: bytes.readUInt32LE(20), height: bytes.readUInt32LE(24), bytes: bytes.length, srgb });
  }
  if (textures.length) document.createExtension(KHRTextureBasisu).setRequired(true);
  if (staticSeabed) {
    // Benchmarked against Meshopt: repeating UVs on these authored models make
    // Draco substantially smaller. Reduced geometry also lowers its decode work.
    await document.transform(compressDraco({ quantizePosition: 16, quantizeNormal: 12,
      quantizeTexcoord: 14, encodeSpeed: 5, decodeSpeed: 5 }));
  } else {
    await document.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));
    document.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  }
  const output = await io.writeBinary(document);
  const decoded = await io.readBinary(output), after = stats(decoded);
  if (!staticSeabed) assert.deepEqual(decoded.getRoot().listNodes().map(n => ({ name: n.getName(), matrix: n.getMatrix() })), nodes);
  assert.equal(after.primitives, before.primitives, 'No material or model part may disappear');
  assert(after.triangles < before.triangles);
  await fs.writeFile(`public/models/mobile/${name}.glb`, output);
  const prior = await fs.stat(`public/models/${name}${name.endsWith('detail') ? '-ktx2' : ''}.glb`);
  report.push({ name, ratio, error, sourceHash: createHash('sha256').update(original).digest('hex'),
    originalBytes: prior.size, mobileBytes: output.length, originalBounds, before, after, textures });
  console.log(`${name}: ${before.triangles} -> ${after.triangles} triangles; ${prior.size} -> ${output.length} bytes`);
}
await fs.writeFile('public/models/mobile/manifest.json', JSON.stringify({ version: 1, models: report }, null, 2) + '\n');
