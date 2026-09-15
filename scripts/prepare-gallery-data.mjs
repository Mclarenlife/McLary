import fs from "node:fs/promises";
const data = JSON.parse(await fs.readFile("artifacts/maps/china.json", "utf8"));
const select = {
  "Guangzhou Province": ["guangdong", "广东"],
  "Macau Special Administrative Region": ["macau", "澳门"],
  "Shanxi Province": ["shanxi", "山西"],
};
const features = data.features
  .filter((f) => select[f.properties.shapeName])
  .map((f) => {
    const [id, name] = select[f.properties.shapeName];
    return {
      type: "Feature",
      properties: { id, name, sourceName: f.properties.shapeName },
      geometry: f.geometry,
    };
  });
const world = JSON.parse(
  await fs.readFile("artifacts/maps/countries.json", "utf8"),
);
features.find((f) => f.properties.id === "macau").geometry =
  world.features.find((f) => f.properties.ADM0_A3 === "MAC").geometry;
features.find((f) => f.properties.id === "macau").properties.sourceName =
  "Natural Earth 10m Macao";
if (features.length !== 3) throw Error("Missing photography regions");
await fs.writeFile(
  "public/earth/regions.json",
  JSON.stringify({
    type: "FeatureCollection",
    source: "geoBoundaries CHN ADM1, 2019, release 9469f09",
    features,
  }),
);
for (const f of features) {
  const points = f.geometry.coordinates.flat(
    f.geometry.type === "MultiPolygon" ? 2 : 1,
  );
  console.log(f.properties.id, points.length, [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ]);
}
