export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const damp = (a, b, speed, dt) =>
  a + (b - a) * (1 - Math.exp(-speed * dt));

// Keep the first row fully ahead of the fold at rest. Scrolling eases the
// continuous bend into the upper gallery, without a sudden geometry switch.
export function galleryBend(start, mobile, scroll) {
  const progress = clamp(scroll / (mobile ? 150 : 190), 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  // Distances are CSS pixels from the viewport top, never a height percentage.
  // Leave enough room for the 120-degree arc below the fixed heading mask.
  const upperBend = start + (mobile ? 166 : 205);
  return start - 24 + (upperBend - start + 24) * eased;
}

// One continuous path for the whole list, including its captions and gaps.
// The tangent turns to 120 degrees, travels along that slope, then returns to 60.
// never restart at card boundaries: content travels along this fixed surface.
export function ribbonPoint(
  x,
  distance,
  bend,
  radius,
  horizon,
  time = 0,
  flutter = 1,
  width = 1190,
  hold = radius * 1.15,
  out = [],
) {
  let y = distance,
    z = 0;
  let lateral = 1;
  if (distance < bend) {
    const arc = bend - distance;
    const firstAngle = (Math.PI * 2) / 3;
    const finalAngle = Math.PI / 3;
    const firstLength = radius * firstAngle;
    const returnRadius = radius * 0.78;
    const returnLength = returnRadius * (firstAngle - finalAngle);
    const angle = Math.min(arc / radius, firstAngle);
    y = bend - Math.sin(angle) * radius;
    z = -(1 - Math.cos(angle)) * radius;
    if (arc > firstLength) {
      const straight = Math.min(hold, arc - firstLength);
      y -= straight * Math.cos(firstAngle);
      z -= straight * Math.sin(firstAngle);
      const remaining = Math.max(0, arc - firstLength - hold);
      const returnAngle = Math.max(
        finalAngle,
        firstAngle - remaining / returnRadius,
      );
      y += returnRadius * (Math.sin(returnAngle) - Math.sin(firstAngle));
      z += returnRadius * (Math.cos(firstAngle) - Math.cos(returnAngle));
      const tail = Math.max(0, remaining - returnLength);
      y -= tail * Math.cos(finalAngle);
      z -= tail * Math.sin(finalAngle);
    }
    // Both halves draw inward first, then gently open outward along the return.
    // Multiplying x preserves a single continuous surface through the gutter.
    const phase = arc / firstLength;
    const outward = clamp(
      (arc - firstLength - hold * 0.6) / returnLength,
      0,
      1,
    );
    lateral =
      1 -
      0.07 * Math.sin(Math.PI * clamp(phase, 0, 1)) ** 2 +
      0.13 *
        outward *
        outward *
        (3 - 2 * outward) *
        Math.exp(-Math.max(0, phase - 2) * 0.55);
  }
  const wave = Math.sin(x * 0.005 + distance * 0.0055 - time * 1.75);
  const cross = Math.sin(distance * 0.004 - x * 0.004 + time * 1.22);
  const edge = Math.min(1, Math.abs(x) / (width * 0.5));
  out[0] = x * lateral + wave * 7 * flutter;
  out[1] = horizon - y + cross * 12 * flutter;
  out[2] = z + (wave * 30 + cross * 19) * (0.75 + edge * 0.25) * flutter;
  return out;
}

// Each row shares the same folded path. Cache the column phases and use the
// sine addition identity: the result matches ribbonPoint without thousands of
// temporary arrays, repeated arc calculations or trig calls on every frame.
export class RibbonGrid {
  constructor(uv, columns) {
    this.columns = columns;
    this.rows = uv.length / 2 / columns;
    this.uv = uv;
    this.x = new Float64Array(columns * 6);
    this.base = new Float64Array(3);
  }
  update(output, { minimum, maximum, width, bend, radius, horizon, time, flutter }) {
    if (this.width !== width) {
      this.width = width;
      for (let c = 0; c < this.columns; c++) {
        const x = (this.uv[c * 2] - .5) * width, k = c * 6;
        this.x.set([x, Math.sin(x * .005), Math.cos(x * .005),
          Math.sin(-x * .004), Math.cos(-x * .004),
          .75 + Math.min(1, Math.abs(x) / (width * .5)) * .25], k);
      }
    }
    for (let r = 0; r < this.rows; r++) {
      const distance = maximum + (minimum - maximum) * this.uv[r * this.columns * 2 + 1];
      const base = ribbonPoint(1, distance, bend, radius, horizon, 0, 0, width, radius * 1.15, this.base);
      const a = distance * .0055 - time * 1.75, b = distance * .004 + time * 1.22;
      const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
      for (let c = 0; c < this.columns; c++) {
        const k = c * 6, i = (r * this.columns + c) * 3;
        const wave = this.x[k + 1] * ca + this.x[k + 2] * sa;
        const cross = this.x[k + 3] * cb + this.x[k + 4] * sb;
        output[i] = this.x[k] * base[0] + wave * 7 * flutter;
        output[i + 1] = base[1] + cross * 12 * flutter;
        output[i + 2] = base[2] + (wave * 30 + cross * 19) * this.x[k + 5] * flutter;
      }
    }
  }
}

export function atlasPosition(distance, offset, top, contentHeight) {
  const position = distance - top + offset;
  return position >= 0 && position < contentHeight ? position : null;
}

export function projectAt(x, y, regions) {
  return regions.find(
    (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
  );
}
