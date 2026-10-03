const clamp01 = (n) => Math.max(0, Math.min(1, n));
export const smoothRange = (a, b, n) => {
  const t = clamp01((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Reserve normal reading travel for every row, then a separate finite descent.
export function workTravel(contentHeight, rowPitch, height) {
  const listEnd = Math.max(0, contentHeight - rowPitch);
  const descent = Math.max(1350, height * 1.85);
  return { listEnd, descent, max: listEnd + descent };
}
export function workDepth(travel, listEnd, descent) {
  return smoothRange(0.08, 1, (travel - listEnd) / descent);
}
export function submergedView(view, depth) {
  const d = clamp01(depth);
  return { ...view, y: view.y - d * 23.7, z: view.z - d * 7,
    ty: view.ty - d * 22, tz: view.tz - d * 5 };
}
