import assert from "node:assert/strict";
import { GalleryMotion } from "../src/gallery-motion.js";
const list = Object.create(GalleryMotion.prototype);
Object.assign(list, {
  current: 340,
  target: 340,
  contentHeight: 2400,
  start: 310,
  minimum: -110,
  height: 900,
  filterFlight: { value: 0 },
  stage: { setAttribute() {} },
  renderFrame() {},
  filtering: false,
});
let departed = 0;
let timeline = list.leaveForRoute(() => departed++).pause();
assert.equal(
  list.filterFlight.value,
  340,
  "Departure begins at current scroll position",
);
timeline.totalTime(0.8, false);
assert(list.filterFlight.value > 340);
assert.equal(departed, 0);
timeline.totalTime(timeline.duration(), false);
assert.equal(departed, 1);
assert(list.filterFlight.value > list.contentHeight);
list.prepareRouteEntry();
assert(
  list.current < -(list.height - list.start),
  "Incoming list starts below viewport before it is visible",
);
timeline = list.enterForRoute().pause();
timeline.totalTime(0.5, false);
assert(list.filterFlight.value < 0);
assert(list.filtering);
timeline.totalTime(timeline.duration(), false);
assert.equal(list.filterFlight.value, 0);
assert.equal(list.current, 0);
assert(!list.filtering);
// A seabed exit must ascend continuously before either the paper exit or flight.
let bubbles=0, flights=0;
Object.assign(list, {
  current:2200, target:2200, depth:1, listEnd:550, descentTravel:1650,
  applyDepth(value) { this.depth=value; },
});
timeline=list.leaveForRoute(() => flights++, {onAscent:() => bubbles++}).pause();
assert.equal(list.depth,1,"Click does not reset the seabed camera");
assert.equal(list.filterFlight.value,2200);
let previousDepth=1, previousTravel=2200;
for(let t=.02;t<=2.8;t+=.02) {
  timeline.totalTime(t,false);
  assert(list.depth<=previousDepth && previousDepth-list.depth<.06,"Ascent depth is continuous and monotonic");
  assert(list.current<=previousTravel,"Ascent scroll only travels toward the top");
  assert.equal(flights,0,"Orbital flight cannot start while ascending");
  previousDepth=list.depth; previousTravel=list.current;
}
timeline.totalTime(2.8,false);
assert.equal(list.current,0); assert.equal(list.target,0); assert.equal(list.depth,0);
assert.equal(bubbles,1,"Reuse one entry bubble burst for the ascent");
timeline.totalTime(3.2,false);
assert(list.filterFlight.value>0,"Normal upward paper exit follows the ascent");
assert.equal(list.depth,0); assert.equal(flights,0);
timeline.totalTime(timeline.duration(),false);
assert.equal(flights,1,"Only the finished sequence starts the gallery flight");
Object.assign(list,{current:2200,target:2200,depth:1});
timeline=list.leaveForRoute(() => flights++).pause();
timeline.totalTime(.5,false);
list.cancelFilter();
assert(!list.filtering,"Interrupted ascent releases the list input lock");
assert.equal(flights,1,"Cancellation never starts a stale flight");
console.log(
  "Route list checks passed: continuous seabed ascent, one bubble burst, ordered flight, cancellation, paper exit and entry.",
);
