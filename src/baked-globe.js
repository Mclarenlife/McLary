import * as THREE from "three";
import { yieldToBrowser } from "./startup-progress.js";
import manifest from "../public/earth/baked/manifest.json";

export function mapVariant(variants, limit) {
  const supported = variants.filter(
    (v) => v.width <= limit && v.height <= limit,
  );
  if (!supported.length)
    throw Error("GPU texture limit is below the baked map size");
  return supported.at(-1);
}

export async function loadBakedGlobe(renderer, onProgress = () => {}) {
  const world = mapVariant(
    manifest.world,
    Math.min(
      renderer.capabilities.maxTextureSize,
      innerWidth < 650 ? 4096 : 8192,
    ),
  );
  const flight = mapVariant(
    manifest.flight,
    Math.min(renderer.capabilities.maxTextureSize, 4096),
  );
  const entries = [
    world,
    flight,
    ...manifest.regions.flatMap((r) => [r.mask, r.context]),
  ];
  const textures = new Array(entries.length);
  const loader = new THREE.TextureLoader();
  let next = 0,
    done = 0;
  // Bound concurrent image decoding on phones; every map still finishes before entry.
  const results = await Promise.allSettled(
    Array.from({ length: 2 }, async () => {
      while (next < entries.length) {
        const i = next++;
        const texture = await loader.loadAsync(entries[i].url);
        textures[i] = texture;
        texture.colorSpace = THREE.NoColorSpace;
        texture.anisotropy = 4;
        if (i === 0) texture.wrapS = THREE.RepeatWrapping;
        await yieldToBrowser();
        renderer.initTexture(texture);
        onProgress(++done / entries.length);
      }
    }),
  );
  const failure = results.find((r) => r.status === "rejected");
  if (failure) {
    textures.forEach((t) => t.dispose());
    throw failure.reason;
  }
  return {
    world: textures[0],
    flight: textures[1],
    flightBounds: manifest.flightBounds,
    regions: manifest.regions.map((r, i) => ({
      ...r,
      bounds: new THREE.Vector4(...r.bounds),
      contextBounds: new THREE.Vector4(...r.contextBounds),
      texture: textures[2 + i * 2],
      contextTexture: textures[3 + i * 2],
    })),
  };
}
