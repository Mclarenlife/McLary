import assert from "node:assert/strict";
import * as THREE from "three";
import { workTravel, workDepth, submergedView } from "../src/work-depth.js";
import { SeabedScene, sandHeight } from "../src/seabed-scene.js";
import { DayCycle } from "../src/day-cycle.js";

for (const [content, row, height] of [[370,370,720],[900,450,844],[3000,400,900]]) {
  const range = workTravel(content,row,height);
  assert.equal(workDepth(range.listEnd,range.listEnd,range.descent),0,"All rows get normal reading travel before diving");
  assert.equal(workDepth(range.max,range.listEnd,range.descent),1,"Finite scroll ends at the seabed");
  assert.equal(workDepth(-100,range.listEnd,range.descent),0);
  assert.equal(workDepth(range.max+10000,range.listEnd,range.descent),1);
  let previous = 0;
  for(let travel=0;travel<=range.max;travel+=5) {
    const d=workDepth(travel,range.listEnd,range.descent);
    assert(d>=previous && d-previous < .02,"Descent has no discontinuity"); previous=d;
  }
}
const view={x:0,y:6.2,z:20,tx:0,ty:6,tz:-9};
assert.deepEqual(submergedView(view,0),view,"Returning to list restores exact initial view");
const bottom=submergedView(view,1);
assert(bottom.y > sandHeight(bottom.x,bottom.z)+4,"Camera remains safely above the terrain");
assert(bottom.ty > bottom.y,"Seabed camera looks slightly upward through the monumental ruins");
for(let x=-6;x<=6;x+=1) for(let z=13;z<=17;z+=1)
  assert(bottom.y-2.7 > sandHeight(x,z)+3,"Pointer movement and mobile camera retain terrain clearance");
const heights=[];
for(let x=-35;x<=35;x+=1) for(let z=-65;z<=15;z+=1) {
  const h=sandHeight(x,z); heights.push(h);
  assert(Math.abs(sandHeight(x+.1,z)-h)<.15,"Terrain has smooth, continuous slopes");
}
assert(Math.max(...heights)-Math.min(...heights)>4,"Landscape has meaningful banks and gullies");
assert(Math.abs(sandHeight(-8,-42)-sandHeight(8,-42))<.6,"Wreck rests on a stable sandy berth");
const seabed=new SeabedScene(new DayCycle("noon"),{value:0});
assert(!seabed.group.visible);
seabed.setDepth(1); assert(seabed.group.visible);
seabed.setDepth(0); assert(!seabed.group.visible);
let drawCalls = 0;
seabed.group.traverse((mesh) => {
  if (!mesh.isMesh) return;
  drawCalls++;
  assert(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
  if(mesh instanceof THREE.InstancedMesh) assert(Array.from(mesh.instanceMatrix.array).every(Number.isFinite));
});
assert(drawCalls <= 12,"Detailed ruins, shafts and wreck remain batched within twelve draws");
assert.equal(seabed.ruins.children.length,3,"Stone, reefs and coral each share a single draw");
const ruinsBounds = new THREE.Box3().setFromObject(seabed.ruins);
assert(ruinsBounds.min.z < -90 && ruinsBounds.max.y > 10,"Ruins extend into the distance and tower above the wreck");
assert.equal(seabed.wreck.children.length,4,"Wreck batches its timbers, metal, rigging and canvas");
const wreckBounds = new THREE.Box3().setFromObject(seabed.wreck);
assert(wreckBounds.max.z < -26,"Enlarged wreck remains over forty units from the camera");
assert(wreckBounds.max.y > -14,"Broken masts make a recognisable tall silhouette");
seabed.resize(390);
assert(seabed.wreck.scale.x < .75,"Phone view keeps the full ship silhouette in frame");
seabed.resize(1280);
assert.equal(seabed.wreck.scale.x,1.22);
console.log("Work descent passed: finite travel, all rows readable, reversible continuous depth, camera clearance and bounded geometry.");
