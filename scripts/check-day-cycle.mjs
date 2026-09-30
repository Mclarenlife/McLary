import assert from "node:assert/strict";
import {
  DayCycle,
  timeAtHour,
  validTimeMode,
  savedTimeMode,
} from "../src/day-cycle.js";

for (const [hour, expected] of [
  [0, "night"],
  [4.99, "night"],
  [5, "morning"],
  [9.99, "morning"],
  [10, "noon"],
  [13.99, "noon"],
  [14, "afternoon"],
  [18.99, "afternoon"],
  [19, "night"],
  [23.99, "night"],
])
  assert.equal(timeAtHour(hour), expected);
assert.equal(validTimeMode("invalid"), "system");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  get() {
    throw new Error("Storage blocked");
  },
});
assert.equal(
  savedTimeMode(),
  "system",
  "Blocked browser storage must not prevent startup",
);
delete globalThis.localStorage;
const a = new DayCycle("noon"),
  b = new DayCycle("noon");
const shared = a.uniforms.night;
a.setMode("night");
b.setMode("night");
assert.equal(
  shared.value,
  0,
  "Selecting a time must not jump to its final lighting",
);
for (let i = 0; i < 60; i++) a.update(1 / 60);
for (let i = 0; i < 30; i++) b.update(1 / 30);
assert(
  Math.abs(a.uniforms.night.value - b.uniforms.night.value) < 1e-10,
  "Lighting interpolation must be frame-rate independent",
);
assert(a.uniforms.night.value > 0 && a.uniforms.night.value < 1);
a.setMode("morning", true);
assert.equal(
  shared.value,
  0,
  "Reduced-motion changes update the same shared uniform immediately",
);
for (const mode of ["morning", "noon", "afternoon", "night"]) {
  a.setMode(mode, true);
  for (const { value } of Object.values(a.uniforms)) {
    const numbers = typeof value === "number" ? [value] : value.toArray();
    assert(numbers.every(Number.isFinite));
  }
  assert(Math.abs(a.uniforms.direction.value.length() - 1) < 1e-6);
}
console.log(
  "Day cycle checks passed: local-time boundaries, safe persistence fallback, smooth frame-independent interpolation, reduced motion and finite palettes.",
);
