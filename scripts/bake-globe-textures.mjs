// Run when geographic data or globe-surface rasterization changes.
// CANVAS_MODULE may point to an installed @napi-rs/canvas package.
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import {
  countryTexture,
  contextTexture,
  regionTexture,
  regionInfo,
} from "../src/globe-surface.js";
const require = createRequire(import.meta.url);
const { createCanvas } = require(
  process.env.CANVAS_MODULE || "@napi-rs/canvas",
);
globalThis.document = { createElement: () => createCanvas(1, 1) };
const world = JSON.parse(
  await fs.readFile("public/earth/countries.json", "utf8"),
);
const data = JSON.parse(await fs.readFile("public/earth/regions.json", "utf8"));
const directory = "public/earth/baked";
await fs.mkdir(directory, { recursive: true });
const manifest = {
  version: 1,
  world: [],
  flight: [],
  flightBounds: world.flightContext.bounds,
  regions: [],
};
async function save(name, texture) {
  const canvas = texture.image;
  // PNG keeps both independent mask channels and subpixel borders losslessly.
  const png = await canvas.encode("png");
  const hash = createHash("sha256").update(png).digest("hex").slice(0, 12);
  const file = `${name}-${hash}.png`;
  await fs.writeFile(`${directory}/${file}`, png);
  const entry = {
    url: `/earth/baked/${file}`,
    width: canvas.width,
    height: canvas.height,
    bytes: png.length,
  };
  texture.dispose();
  console.log(name, png.length);
  return entry;
}
for (const width of [2048, 4096, 8192])
  manifest.world.push(
    await save(`world-${width}`, countryTexture(world.countries, width)),
  );
for (const width of [2048, 4096])
  manifest.flight.push(
    await save(`flight-${width}`, contextTexture(world.flightContext, width)),
  );
for (const feature of data.features) {
  const info = regionInfo(feature);
  const context = world.contexts.find((c) => c.id === feature.properties.id);
  const id = feature.properties.id;
  manifest.regions.push({
    id,
    lat: info.lat,
    lon: info.lon,
    extent: info.extent,
    bounds: info.bounds.toArray(),
    contextBounds: context.bounds,
    mask: await save(`${id}-mask`, regionTexture(feature, info.bounds)),
    context: await save(`${id}-context`, contextTexture(context)),
  });
}
await fs.writeFile(`${directory}/manifest.json`, JSON.stringify(manifest));
console.log(
  "Baked globe maps retain the original desktop/mobile resolutions and shader channels.",
);
