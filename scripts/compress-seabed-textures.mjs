// Requires Khronos KTX-Software 4.4.2. Originals remain the authoring/fallback assets.
// Usage: node scripts/compress-seabed-textures.mjs /path/to/toktx.exe [lossless-sky.png]
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const encoder = process.argv[2];
if (!encoder) throw Error("Pass the path to the official toktx encoder");
const temporary = "artifacts/ktx-conversion";
await fs.mkdir(temporary, { recursive: true });
const pad = (buffer, byte = 0) => Buffer.concat([buffer, Buffer.alloc((4 - buffer.length % 4) % 4, byte)]);
const report = [];
for (const name of ["shipwreck-detail", "ruins-detail"]) {
  const input = await fs.readFile(`public/models/${name}.glb`);
  const jsonLength = input.readUInt32LE(12);
  const document = JSON.parse(input.subarray(20, 20 + jsonLength));
  const binary = input.subarray(28 + jsonLength);
  const replacements = new Map(), images = new Map(), remap = new Map();
  let unique = 0;
  for (const [index, image] of document.images.entries()) {
    const view = document.bufferViews[image.bufferView];
    const png = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const srgb = document.materials.some(m => {
      const texture = m.pbrMetallicRoughness?.baseColorTexture;
      return texture && document.textures[texture.index].source === index;
    });
    const hash = createHash("sha256").update(png).update(String(srgb)).digest("hex");
    if (images.has(hash)) {
      remap.set(index, images.get(hash));
      replacements.set(image.bufferView, Buffer.alloc(0));
      continue;
    }
    images.set(hash, index);
    unique++;
    const source = path.join(temporary, `${name}-${index}.png`);
    const target = path.join(temporary, `${name}-${index}.ktx2`);
    await fs.writeFile(source, png);
    // Full resolution, highest UASTC search quality, no lossy RDO stage.
    // Keep all channels and use linear filtering for normal/roughness mipmaps.
    execFileSync(encoder, ["--t2", "--encode", "uastc", "--uastc_quality", "4",
      "--zcmp", "18", "--genmipmap", "--assign_oetf", srgb ? "srgb" : "linear",
      "--threads", "4", target, source], { stdio: "pipe" });
    replacements.set(image.bufferView, await fs.readFile(target));
    image.mimeType = "image/ktx2";
    console.log(`${name}: ${image.name}`);
  }
  // Identical source images share one GPU texture via GLTFLoader's image/sampler cache.
  for (const texture of document.textures) {
    const source = remap.get(texture.source) ?? texture.source;
    texture.extensions = { ...texture.extensions, KHR_texture_basisu: { source } };
    delete texture.source;
  }
  // Remove duplicate images and unused buffer views without touching geometry bytes.
  const usedImages = document.images.map((_, i) => i).filter(i => !remap.has(i));
  for (const texture of document.textures)
    texture.extensions.KHR_texture_basisu.source = usedImages.indexOf(texture.extensions.KHR_texture_basisu.source);
  document.images = usedImages.map(i => document.images[i]);
  const unusedViews = new Set([...remap.keys()].map(i => {
    const original = JSON.parse(input.subarray(20, 20 + jsonLength));
    return original.images[i].bufferView;
  }));
  const viewMap = new Map(), chunks = [];
  let offset = 0;
  document.bufferViews = document.bufferViews.flatMap((view, index) => {
    if (unusedViews.has(index)) return [];
    viewMap.set(index, viewMap.size);
    const data = replacements.get(index) ?? binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const result = { ...view, byteOffset: offset, byteLength: data.length };
    const aligned = pad(data);
    chunks.push(aligned); offset += aligned.length;
    return [result];
  });
  for (const image of document.images) image.bufferView = viewMap.get(image.bufferView);
  for (const accessor of document.accessors || []) {
    if (accessor.bufferView !== undefined) accessor.bufferView = viewMap.get(accessor.bufferView);
    for (const part of [accessor.sparse?.indices, accessor.sparse?.values])
      if (part) part.bufferView = viewMap.get(part.bufferView);
  }
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) {
    const draco = primitive.extensions?.KHR_draco_mesh_compression;
    if (draco) draco.bufferView = viewMap.get(draco.bufferView);
  }
  for (const key of ["extensionsUsed", "extensionsRequired"])
    document[key] = [...new Set([...(document[key] || []), "KHR_texture_basisu"])];
  document.buffers[0].byteLength = offset;
  const json = pad(Buffer.from(JSON.stringify(document)), 32);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + offset, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(offset, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  const output = Buffer.concat([header, json, binHeader, ...chunks]);
  await fs.writeFile(`public/models/${name}-ktx2.glb`, output);
  report.push({ name, originalBytes: input.length, compressedBytes: output.length, originalTextures: usedImages.length + remap.size, uniqueTextures: unique });
}
await fs.writeFile(`${temporary}/report.json`, JSON.stringify(report, null, 2));
console.table(report);
if (process.argv[3]) {
  // A lossless PNG export of ocean-sky.webp. Standalone Three textures have flipY
  // enabled; compressed textures cannot flip on upload, so bake it into the pixels.
  execFileSync(encoder, ["--t2", "--encode", "etc1s", "--qlevel", "255", "--clevel", "2",
    "--genmipmap", "--assign_oetf", "srgb", "--lower_left_maps_to_s0t0", "--threads", "4",
    "public/textures/ocean-sky.ktx2", process.argv[3]], { stdio: "inherit" });
}
