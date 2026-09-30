import * as THREE from "three";

export const timeOptions = [
  ["system", "跟随系统"],
  ["morning", "早晨"],
  ["noon", "中午"],
  ["afternoon", "下午"],
  ["night", "晚上"],
];
export const timeAtHour = (hour) =>
  hour >= 5 && hour < 10
    ? "morning"
    : hour >= 10 && hour < 14
      ? "noon"
      : hour >= 14 && hour < 19
        ? "afternoon"
        : "night";
export const validTimeMode = (value) =>
  timeOptions.some(([id]) => id === value) ? value : "system";
export function savedTimeMode() {
  try {
    return validTimeMode(localStorage.getItem("mclary-time"));
  } catch {
    return "system";
  }
}

// Linear-light colors are interpolated together, so the sky, reflections and
// submerged light source stay in the same time of day throughout a change.
const palettes = {
  morning: {
    top: "#85b8cf",
    horizon: "#f6d5b5",
    tint: "#f4daca",
    water: "#427e87",
    deep: "#123748",
    shallow: "#397e82",
    beam: "#f4d8a2",
    fog: "#d1d3c7",
    sun: "#ffddb1",
    direction: [-0.62, 0.16, -1],
    exposure: 1.32,
    daylight: 0.85,
    night: 0,
    swell: 0.82,
    strength: 0.65,
    sunPower: 3.1,
    ambient: 1.7,
  },
  noon: {
    top: "#579ac2",
    horizon: "#d2e7e8",
    tint: "#e6f3ff",
    water: "#267e93",
    deep: "#073343",
    shallow: "#368e9c",
    beam: "#c7f5eb",
    fog: "#c1d9dd",
    sun: "#fff8e7",
    direction: [-0.25, 0.68, -1],
    exposure: 1.55,
    daylight: 1,
    night: 0,
    swell: 1,
    strength: 1.15,
    sunPower: 4.3,
    ambient: 2.1,
  },
  afternoon: {
    top: "#919bc0",
    horizon: "#fac294",
    tint: "#f5c6ad",
    water: "#586d83",
    deep: "#172f4b",
    shallow: "#4a777e",
    beam: "#ffc38d",
    fog: "#d4b9ad",
    sun: "#ffba78",
    direction: [0.58, 0.13, -1],
    exposure: 1.12,
    daylight: 0.68,
    night: 0,
    swell: 1.2,
    strength: 0.8,
    sunPower: 2.6,
    ambient: 1.5,
  },
  night: {
    top: "#050c23",
    horizon: "#22354f",
    tint: "#3a5277",
    water: "#122c48",
    deep: "#020918",
    shallow: "#102c4c",
    beam: "#6e9fd2",
    fog: "#16253e",
    sun: "#a6c9ed",
    direction: [-0.3, 0.34, -1],
    exposure: 0.09,
    daylight: 0.035,
    night: 1,
    swell: 0.9,
    strength: 0.23,
    sunPower: 0.55,
    ambient: 0.48,
  },
};
const colorKeys = [
  "top",
  "horizon",
  "tint",
  "water",
  "deep",
  "shallow",
  "beam",
  "fog",
  "sun",
];
const numberKeys = [
  "exposure",
  "daylight",
  "night",
  "swell",
  "strength",
  "sunPower",
  "ambient",
];

export class DayCycle {
  constructor(mode = savedTimeMode()) {
    this.mode = validTimeMode(mode);
    this.uniforms = {};
    for (const key of colorKeys)
      this.uniforms[key] = { value: new THREE.Color() };
    for (const key of numberKeys) this.uniforms[key] = { value: 0 };
    this.uniforms.direction = { value: new THREE.Vector3() };
    this.setMode(this.mode, true);
  }
  setMode(mode, immediate = false) {
    this.mode = validTimeMode(mode);
    this.resolve(immediate);
  }
  resolve(immediate = false) {
    const id =
      this.mode === "system" ? timeAtHour(new Date().getHours()) : this.mode;
    if (id !== this.resolved) {
      this.resolved = id;
      const preset = palettes[id];
      this.target = Object.fromEntries(
        colorKeys.map((key) => [key, new THREE.Color(preset[key])]),
      );
      Object.assign(
        this.target,
        Object.fromEntries(numberKeys.map((key) => [key, preset[key]])),
      );
      this.target.direction = new THREE.Vector3(
        ...preset.direction,
      ).normalize();
    }
    if (immediate) this.update(1, true);
  }
  update(delta, immediate = false) {
    const amount = immediate ? 1 : 1 - Math.exp(-delta * 1.65);
    for (const key of colorKeys)
      this.uniforms[key].value.lerp(this.target[key], amount);
    for (const key of numberKeys)
      this.uniforms[key].value = THREE.MathUtils.lerp(
        this.uniforms[key].value,
        this.target[key],
        amount,
      );
    this.uniforms.direction.value
      .lerp(this.target.direction, amount)
      .normalize();
  }
}
