import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { TextureLoader } from "three";

// A single worker pool per renderer: detect ASTC/BC7/ETC support on the actual GPU,
// never from user-agent strings. Unsupported compressed formats use loader fallback.
const loaders = new WeakMap();
export function compressedTextures(renderer) {
  let loader = loaders.get(renderer);
  if (!loader) {
    loader = new KTX2Loader()
      .setTranscoderPath("/textures/basis/")
      .setWorkerLimit(2)
      .detectSupport(renderer);
    loaders.set(renderer, loader);
  }
  return loader;
}

export async function loadCompressedTexture(renderer, url, fallback) {
  try {
    const texture = await compressedTextures(renderer).loadAsync(url);
    if (import.meta.env?.DEV && new URLSearchParams(location.search).has("profile"))
      console.info("KTX2 " + JSON.stringify({ url, compressed: texture.isCompressedTexture === true,
        format: texture.format, bytes: texture.mipmaps.reduce((sum, m) => sum + (m.data?.byteLength || 0), 0) }));
    return texture;
  } catch (error) {
    console.warn(`Compressed texture unavailable; loading ${fallback}`, error);
    return new TextureLoader().loadAsync(fallback);
  }
}

export function releaseTextureDecoder(renderer) {
  // Textures retain their compressed mip data; the WASM worker heaps can go away.
  loaders.get(renderer)?.dispose();
  loaders.delete(renderer);
}
