export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const damp = (a, b, speed, dt) =>
  a + (b - a) * (1 - Math.exp(-speed * dt));

// Keep the first row fully ahead of the fold at rest. Scrolling eases the
// continuous bend into the upper gallery, without a sudden geometry switch.
export function galleryBend(start, height, mobile, scroll) {
  const progress = clamp(scroll / (mobile ? 150 : 190), 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const upperBend = Math.max(
    start + (mobile ? 105 : 180),
    height * (mobile ? 0.5 : 0.56),
  );
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
      0.18 * Math.sin(Math.PI * clamp(phase, 0, 1)) ** 2 +
      0.13 *
        outward *
        outward *
        (3 - 2 * outward) *
        Math.exp(-Math.max(0, phase - 2) * 0.55);
  }
  const wave = Math.sin(x * 0.005 + distance * 0.0055 - time * 1.75);
  const cross = Math.sin(distance * 0.004 - x * 0.004 + time * 1.22);
  const edge = Math.min(1, Math.abs(x) / (width * 0.5));
  return [
    x * lateral + wave * 7 * flutter,
    horizon - y + cross * 12 * flutter,
    z + (wave * 30 + cross * 19) * (0.75 + edge * 0.25) * flutter,
  ];
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
