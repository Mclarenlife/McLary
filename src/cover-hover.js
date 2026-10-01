import { damp } from "./paper-geometry.js";

export const MAX_COVER_HOVERS = 32;

// Atlas coordinates, not DOM rectangles: the hit follows the bent paper.
export function coverAt(x, y, regions, imageHeight) {
  const index = regions.findIndex(
    (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + imageHeight,
  );
  if (index < 0 || index >= MAX_COVER_HOVERS) return null;
  const r = regions[index];
  return { index, u: (x - r.x) / r.width, v: (y - r.y) / imageHeight };
}

export class CoverHover {
  constructor() {
    this.values = new Float32Array(MAX_COVER_HOVERS * 4);
    this.reset();
  }
  reset() {
    this.values.fill(0);
    for (let i = 0; i < MAX_COVER_HOVERS; i++) {
      this.values[i * 4] = 0.5;
      this.values[i * 4 + 1] = 0.5;
    }
  }
  update(dt, hit) {
    for (let i = 0; i < MAX_COVER_HOVERS; i++) {
      const n = i * 4,
        selected = hit?.index === i;
      let spread = 0;
      if (selected) {
        const distance = Math.hypot(
          hit.u - this.values[n],
          hit.v - this.values[n + 1],
        );
        if (this.values[n + 2] < 0.005) {
          this.values[n] = hit.u;
          this.values[n + 1] = hit.v;
        } else {
          this.values[n] = damp(this.values[n], hit.u, 12, dt);
          this.values[n + 1] = damp(this.values[n + 1], hit.v, 12, dt);
          spread = Math.min(distance * 5, 1);
        }
      }
      this.values[n + 2] = damp(this.values[n + 2], selected ? 1 : 0, 9, dt);
      this.values[n + 3] = damp(this.values[n + 3], spread, 5, dt);
    }
  }
}
