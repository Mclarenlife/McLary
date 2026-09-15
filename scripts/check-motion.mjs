import assert from "node:assert/strict";
import {
  ribbonPoint,
  atlasPosition,
  projectAt,
  damp,
  galleryBend,
} from "../src/paper-geometry.js";

for (const { start, height, mobile, radius, horizon } of [
  { start: 330, height: 950, mobile: false, radius: 210, horizon: 238 },
  { start: 258, height: 844, mobile: true, radius: 160, horizon: 188 },
]) {
  const restingBend = galleryBend(start, height, mobile, 0);
  for (const y of [start, start + 100, start + 400]) {
    assert.equal(
      ribbonPoint(0, y, restingBend, radius, horizon, 0, 0)[2],
      0,
      "The first row must have no curl on initial entry or after resetting",
    );
  }
  assert.equal(galleryBend(start, height, mobile, -50), restingBend);
  const activeBend = galleryBend(start, height, mobile, 300);
  assert(
    activeBend < height * (mobile ? 0.62 : 0.68),
    "The active fold must move higher than the previous fold zone",
  );
  let previous = restingBend;
  for (let travel = 1; travel <= 300; travel++) {
    const next = galleryBend(start, height, mobile, travel);
    assert(
      next >= previous && next - previous < 2.5,
      "The fold must ease in without a geometry jump",
    );
    previous = next;
  }
  const firstFold = ribbonPoint(
    0,
    activeBend - (radius * Math.PI * 2) / 3,
    activeBend,
    radius,
    horizon,
    0,
    0,
  );
  const projectedY = horizon - (firstFold[1] * 1400) / (1400 - firstFold[2]);
  assert(
    projectedY > (mobile ? 244 : 315) + 10,
    "The raised fold must remain below the heading mask",
  );
}

const bend = galleryBend(330, 950, false, 300),
  radius = 210,
  horizon = 238;
const surface = (x, distance) =>
  ribbonPoint(x, distance, bend, radius, horizon, 0, 0);
for (const distance of [900, 700, 500, 250, -600, -2000]) {
  const left = surface(-300, distance),
    right = surface(300, distance);
  assert.deepEqual(
    left.slice(1),
    right.slice(1),
    "Both columns and their captions must share one continuous curve",
  );
}
const before = surface(0, bend - 0.001),
  after = surface(0, bend + 0.001);
assert(
  Math.hypot(...before.map((v, i) => v - after[i])) < 0.0021,
  "The flat-to-curved join must not jump",
);
const rear = surface(0, -1500),
  farther = surface(0, -2200);
assert(
  farther[2] < rear[2] - 600,
  "The rear surface must continue into depth instead of folding each card back onto itself",
);
assert.equal(surface(0, 900)[2], 0, "The front portion should stay unfolded");
const firstLength = (radius * Math.PI * 2) / 3;
const hold = radius * 1.15;
const returnLength = (radius * 0.78 * Math.PI) / 3;
const tangentAngle = (arc) => {
  const a = surface(0, bend - arc + 0.001);
  const b = surface(0, bend - arc - 0.001);
  return (Math.atan2(-(b[2] - a[2]), b[1] - a[1]) * 180) / Math.PI;
};
assert(
  Math.abs(tangentAngle(firstLength) - 120) < 0.001,
  "The first fold must reach 120 degrees and point backward/downward",
);
assert(
  Math.abs(tangentAngle(firstLength + hold + returnLength) - 60) < 0.001,
  "The return must settle at 60 degrees and point backward/upward",
);
for (const fraction of [0.1, 0.5, 0.9]) {
  assert(
    Math.abs(tangentAngle(firstLength + hold * fraction) - 120) < 0.001,
    "The sheet must travel at 120 degrees before the return bend starts",
  );
}
const holdStart = surface(0, bend - firstLength);
const holdEnd = surface(0, bend - firstLength - hold);
assert(
  Math.abs(Math.hypot(...holdEnd.map((v, i) => v - holdStart[i])) - hold) <
    0.001,
  "The intermediate segment must keep its full travel length",
);
for (const arc of [
  firstLength,
  firstLength + hold,
  firstLength + hold + returnLength,
]) {
  const a = surface(0, bend - arc + 0.001);
  const b = surface(0, bend - arc - 0.001);
  assert(
    Math.hypot(...a.map((v, i) => v - b[i])) < 0.0021,
    "Both bend joins must remain continuous",
  );
}
const inwardLeft = surface(-300, bend - firstLength * 0.5);
const outwardDistance = bend - firstLength - hold - returnLength;
const outwardLeft = surface(-300, outwardDistance);
assert(
  inwardLeft[0] > -260 && outwardLeft[0] < -330,
  "The left half must bend inward, then outward",
);
assert(
  surface(300, bend - firstLength * 0.5)[0] < 260 &&
    surface(300, outwardDistance)[0] > 330,
  "The right half must mirror the left half",
);
const projectY = ([, y, z]) => horizon - (y * 1400) / (1400 - z);
assert(
  projectY(surface(0, bend - firstLength)) > 315 + 10,
  "The strongest fold must sit below the fixed heading mask",
);
const regions = [
  { id: "first", x: 0, y: 0, width: 500, height: 400 },
  { id: "second", x: 530, y: 0, width: 500, height: 400 },
  { id: "third", x: 0, y: 450, width: 500, height: 400 },
];
assert.equal(
  atlasPosition(329, 0, 330, 900),
  null,
  "Nothing precedes the first project",
);
assert.equal(atlasPosition(330, 0, 330, 900), 0);
assert.equal(
  atlasPosition(1230, 0, 330, 900),
  null,
  "The tail must stop instead of repeating",
);
assert.equal(
  atlasPosition(330, 900, 330, 900),
  null,
  "Scrolling must never wrap to the first project",
);
const content = atlasPosition(700, 0, 330, 900);
assert.equal(projectAt(220, content, regions).id, "first");
assert.equal(projectAt(700, content, regions).id, "second");
assert.equal(
  projectAt(220, atlasPosition(700, 450, 330, 900), regions).id,
  "third",
);
assert.equal(
  projectAt(515, 30, regions),
  undefined,
  "A gutter must not open an unrelated project",
);
assert.equal(
  projectAt(300, 430, regions),
  undefined,
  "A row gap must not open a project",
);
assert.notDeepEqual(
  ribbonPoint(200, 500, bend, radius, horizon, 0),
  ribbonPoint(200, 500, bend, radius, horizon, 1),
);
const settle = (fps) => {
  let n = 0;
  for (let i = 0; i < fps; i++) n = damp(n, 2000, 8, 1 / fps);
  return n;
};
assert(Math.abs(settle(30) - settle(120)) < 0.000001);
console.log(
  "Ribbon checks passed: unfolded initial row, smooth raised fold, shared surface, 120-degree travel segment, continuous joins, 60-degree return, finite head/tail, image/caption picking, transparent gaps, flutter, frame-rate independence.",
);
