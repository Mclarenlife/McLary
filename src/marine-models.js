import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mobileModels, mobileModelDecoder } from './model-quality.js';

const loader = new GLTFLoader();
export async function loadMarineModel(name) {
  let result;
  if (mobileModels()) {
    try {
      const mobileLoader = new GLTFLoader().setMeshoptDecoder(await mobileModelDecoder());
      result = await mobileLoader.loadAsync(`/models/mobile/${name}.glb`);
    } catch (error) {
      console.warn(`Mobile model unavailable; loading original ${name}`, error);
    }
  }
  const { scene } = result || await loader.loadAsync(`/models/${name}.glb`);
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    object.material.envMapIntensity = name === "boat-hull" ? 0.65 : 0.22;
  });
  return scene;
}
