import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { workScrollLimit } from '../src/work-scroll.js';
import { GalleryMotion } from '../src/gallery-motion.js';
import { STARTUP_STAGES } from '../src/startup-progress.js';

for (const [content, row, height, start] of [[1124,281,844,258],[796,398,900,330],[796,398,600,330],[281,281,844,258]]) {
  const limit = workScrollLimit(content,row,height,start);
  assert(limit >= 0);
  assert(start + content - limit <= height - 100, 'Final caption stays above the footer');
  assert(limit <= content, 'No additional screenfuls of empty descent');
  const list = Object.create(GalleryMotion.prototype);
  Object.assign(list,{target:0,maxTravel:limit});
  list.scrollBy(100000);
  assert.equal(list.target,limit,'Repeated downward scroll stops at the last row');
  list.scrollBy(-100000);
  assert.equal(list.target,0,'Return to first row remains bounded');
}
assert.equal(workScrollLimit(0,281,844,258),0);
assert(!('seabed' in STARTUP_STAGES));
for (const file of ['scene.js','underwater-scene.js','gallery-motion.js','main.js','underwater-light.js']) {
  const source = await fs.readFile(`src/${file}`,'utf8');
  assert(!/seabed|shipwreck|submergedView|setWorkDepth|onAscent/.test(source), `${file} must not create, preload or navigate into the removed scene`);
}
console.log('Work scroll: finite endpoints, accessible final row, no descent or seabed startup stage.');
