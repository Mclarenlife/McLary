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
assert(bottom.ty < bottom.y,"Seabed camera looks down into the landscape");
const seabed=new SeabedScene(new DayCycle("noon"),{value:0});
assert(!seabed.group.visible);
seabed.setDepth(1); assert(seabed.group.visible);
seabed.setDepth(0); assert(!seabed.group.visible);
for (const mesh of seabed.group.children) {
  assert(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
  if(mesh instanceof THREE.InstancedMesh) assert(Array.from(mesh.instanceMatrix.array).every(Number.isFinite));
}
assert(seabed.group.children.length <= 5,"Instanced landscape keeps draw calls bounded");
console.log("Work descent passed: finite travel, all rows readable, reversible continuous depth, camera clearance and bounded geometry.");
