import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
export async function loadMarineModel(name) {
  const { scene } = await loader.loadAsync(`/models/${name}.glb`);
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    object.material.envMapIntensity = name === "boat-hull" ? 0.65 : 0.22;
  });
  return scene;
}
