import { renderBudget } from './render-budget.js';

let mobile;
let decoderPromise;
// Freeze the asset tier for this visit. Rotation/resizing must not redownload models.
export function mobileModels() {
  return mobile ??= renderBudget.settings().mobile;
}

export async function mobileModelDecoder() {
  decoderPromise ??= import('three/addons/libs/meshopt_decoder.module.js').then(async ({ MeshoptDecoder }) => {
    if (!MeshoptDecoder.supported) throw Error('Meshopt WASM unavailable');
    await MeshoptDecoder.ready;
    MeshoptDecoder.useWorkers(1);
    return MeshoptDecoder;
  });
  return decoderPromise;
}

export async function releaseModelDecoder() {
  if (decoderPromise) {
    try { (await decoderPromise).useWorkers(0); } catch { /* Original assets already used. */ }
    decoderPromise = undefined;
  }
}
