// Natural Earth public-domain country geometry; keep the original cached input
// outside the published source. Run this only when refreshing the bundled map.
import fs from "node:fs/promises";
const url =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";
const raw = await fs
  .readFile("artifacts/maps/countries.json", "utf8")
  .catch(async () => {
    const response = await fetch(url);
    if (!response.ok) throw Error("Country download failed");
    return response.text();
  });
const distance = (p, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
function simplify(points) {
  if (points.length < 5) return points;
  let max = 0,
    split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distance(points[i], points[0], points.at(-1));
    if (d > max) {
      max = d;
      split = i;
    }
  }
  if (max <= 0.045) return [points[0], points.at(-1)];
  return [
    ...simplify(points.slice(0, split + 1)).slice(0, -1),
    ...simplify(points.slice(split)),
  ];
}
const original = JSON.parse(raw).features;
const countries = original.map((f) => ({
  name: f.properties.ADMIN,
  polygons: (f.geometry.type === "MultiPolygon"
    ? f.geometry.coordinates
    : [f.geometry.coordinates]
  ).map((polygon) =>
    polygon.map((ring) => {
      const simple = simplify(ring);
      return (simple.length < 4 ? ring : simple).map((p) =>
        p.map((v) => Math.round(v * 10000) / 10000),
      );
    }),
  ),
}));
// Preserve detailed local coastlines for the internal lens: a world atlas alone
// cannot resolve Macau. Clip original country polygons into three local atlases.
const regions = JSON.parse(
  await fs.readFile("public/earth/regions.json", "utf8"),
);
function clipRing(ring, bounds) {
  let points = ring;
  for (const [axis, edge, sign] of [
    [0, bounds[0], 1],
    [0, bounds[0] + bounds[2], -1],
    [1, bounds[1], 1],
    [1, bounds[1] + bounds[3], -1],
  ]) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const ain = (a[axis] - edge) * sign >= 0,
        bin = (b[axis] - edge) * sign >= 0;
      if (ain) result.push(a);
      if (ain !== bin) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    points = result;
  }
  return points;
}
const contexts = regions.features.map((f) => {
  const coordinates = (
    f.geometry.type === "MultiPolygon"
      ? f.geometry.coordinates
      : [f.geometry.coordinates]
  ).flat(2);
  const xs = coordinates.map((p) => p[0]),
    ys = coordinates.map((p) => p[1]);
  const lon = (Math.min(...xs) + Math.max(...xs)) / 2,
    lat = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cos = Math.cos((lat * Math.PI) / 180);
  const extent = Math.max(
    Math.max(...ys) - Math.min(...ys),
    (Math.max(...xs) - Math.min(...xs)) * cos,
  );
  const bounds = [
    lon - (extent * 1.6) / cos,
    lat - extent * 1.6,
    (extent * 3.2) / cos,
    extent * 3.2,
  ];
  const polygons = original.flatMap((country) =>
    (country.geometry.type === "MultiPolygon"
      ? country.geometry.coordinates
      : [country.geometry.coordinates]
    )
      .map((polygon) =>
        polygon
          .map((ring) => clipRing(ring, bounds))
          .filter((ring) => ring.length > 3),
      )
      .filter((polygon) => polygon.length),
  );
  return { id: f.properties.id, bounds, polygons };
});
await fs.writeFile(
  "public/earth/countries.json",
  JSON.stringify({ source: url, countries, contexts }),
);
console.log(`Prepared ${countries.length} country geometries.`);
