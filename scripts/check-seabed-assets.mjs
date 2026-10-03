import fs from "node:fs/promises";
import assert from "node:assert/strict";
for (const name of ["shipwreck-detail", "ruins-detail"]) {
  const bytes=await fs.readFile(`public/models/${name}.glb`);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert(bytes.length<12*1024*1024,"Each detailed asset remains within the loading budget");
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert(gltf.extensionsRequired.includes("KHR_draco_mesh_compression"));
  assert(gltf.images.every(image=>Number.isInteger(image.bufferView)),"Textures must be embedded, with no missing external references");
  assert(gltf.materials.some(m=>m.normalTexture&&m.pbrMetallicRoughness?.baseColorTexture),"Assets have real surface and normal maps");
  let triangles=0;
  for(const mesh of gltf.meshes) for(const p of mesh.primitives) {
    assert(p.attributes.NORMAL!==undefined && p.attributes.TEXCOORD_0!==undefined);
    const pos=gltf.accessors[p.attributes.POSITION];
    assert([...pos.min,...pos.max].every(Number.isFinite));
    triangles+=gltf.accessors[p.indices].count/3;
  }
  assert(triangles<300000,"Each model has bounded geometry");
  assert(gltf.meshes.length<=8,"Materials are batched to keep draw calls bounded");
  console.log(`${name}: ${(bytes.length/1048576).toFixed(1)} MiB, ${triangles} triangles, ${gltf.meshes.length} batches, embedded PBR maps`);
}
for(const file of ["draco_decoder.wasm","draco_wasm_wrapper.js","draco_decoder.js"])
  assert((await fs.stat(`public/models/draco/${file}`)).size>0);
