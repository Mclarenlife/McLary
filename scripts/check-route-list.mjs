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
console.log(
  "Route list checks passed: continuous exit, offscreen preparation, bottom entry and input unlock.",
);
