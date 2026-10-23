import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import {
  countryTexture,
  contextTexture,
  regionInfo,
  regionTexture,
} from "../src/globe-surface.js";
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require(
  process.env.CANVAS_MODULE || "@napi-rs/canvas",
);
globalThis.document = { createElement: () => createCanvas(1, 1) };
const manifest = JSON.parse(
  await fs.readFile("public/earth/baked/manifest.json", "utf8"),
);
const world = JSON.parse(
  await fs.readFile("public/earth/countries.json", "utf8"),
);
const regions = JSON.parse(
  await fs.readFile("public/earth/regions.json", "utf8"),
);
async function compare(entry, reference) {
  const png = await fs.readFile(`public${entry.url}`);
  assert.equal(png.length, entry.bytes);
  assert(
    entry.url.includes(
      createHash("sha256").update(png).digest("hex").slice(0, 12),
    ),
  );
  const image = await loadImage(png);
  assert.equal(image.width, entry.width);
  assert.equal(image.height, entry.height);
  const canvas = createCanvas(entry.width, entry.height),
    ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const baked = ctx.getImageData(0, 0, entry.width, entry.height).data;
  const original = reference.image
    .getContext("2d")
    .getImageData(0, 0, entry.width, entry.height).data;
  assert(
    Buffer.from(baked).equals(Buffer.from(original)),
    `Mask channels changed: ${entry.url}`,
  );
  reference.dispose();
}
for (const entry of manifest.world)
  await compare(entry, countryTexture(world.countries, entry.width));
for (const entry of manifest.flight)
  await compare(entry, contextTexture(world.flightContext, entry.width));
for (const region of manifest.regions) {
  const feature = regions.features.find((f) => f.properties.id === region.id);
  const info = regionInfo(feature);
  assert.deepEqual(region.bounds, info.bounds.toArray());
  for (const key of ["lat", "lon", "extent"])
    assert.equal(region[key], info[key]);
  const context = world.contexts.find((c) => c.id === region.id);
  assert.deepEqual(region.contextBounds, context.bounds);
  await compare(region.mask, regionTexture(feature, info.bounds));
  await compare(region.context, contextTexture(context));
}
const common =
  manifest.flight.at(-1).bytes +
  manifest.regions.reduce((n, r) => n + r.mask.bytes + r.context.bytes, 0);
console.log({
  desktopMapBytes: common + manifest.world.at(-1).bytes,
  mobileMapBytes: common + manifest.world[1].bytes,
  checks:
    "All PNG pixels, independent mask channels, resolutions, geographic bounds and asset hashes match the rasterizer.",
});
