import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Small original 3D studies, rendered locally for the portfolio cards.
// Replace any `image` in content.js with a local file to show your real work.
export function renderStudies(projects) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(1000, 660);
  renderer.setPixelRatio(1);
  renderer.setClearColor("#e5d0c5");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer),
    environment = new RoomEnvironment(),
    env = pmrem.fromScene(environment, 0.04);
  const camera = new THREE.PerspectiveCamera(38, 1000 / 660, 0.1, 100);
  camera.position.set(6, 4.3, 8);
  camera.lookAt(0, 1.2, 0);
  for (const p of projects) {
    if (p.image && !p.image.startsWith("/studies/")) continue;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(p.color);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.55;
    scene.add(new THREE.HemisphereLight("#ffffff", p.color, 2.2));
    const sun = new THREE.DirectionalLight("#fff3dc", 3);
    sun.position.set(-4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -7,
      right: 7,
      top: 7,
      bottom: -7,
    });
    sun.shadow.normalBias = 0.025;
    scene.add(sun);
    const matte = new THREE.MeshStandardMaterial({
      color: p.color,
      roughness: 0.8,
    });
    const bright = new THREE.MeshPhysicalMaterial({
      color: "#ede1cf",
      metalness: 0.45,
      roughness: 0.22,
      clearcoat: 1,
      iridescence: 1,
      iridescenceThicknessRange: [150, 410],
    });
    const accent = new THREE.MeshStandardMaterial({
      color: p.color,
      metalness: 0.65,
      roughness: 0.25,
    });
    function mesh(geo, mat, pos = [0, 0, 0]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      return m;
    }
    const floor = mesh(new THREE.PlaneGeometry(100, 100), matte);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    if (p.art === "portal") {
      const shape = new THREE.Shape();
      shape.moveTo(-1.65, 0);
      shape.lineTo(1.65, 0);
      shape.lineTo(1.65, 2.9);
      shape.absarc(0, 2.9, 1.65, 0, Math.PI);
      shape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-1.05, 0.01);
      hole.lineTo(-1.05, 2.85);
      hole.absarc(0, 2.85, 1.05, Math.PI, 0, true);
      hole.lineTo(1.05, 0.01);
      hole.closePath();
      shape.holes.push(hole);
      const m = mesh(
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.65,
          bevelEnabled: true,
          bevelSize: 0.04,
          bevelThickness: 0.04,
          bevelSegments: 3,
        }),
        new THREE.MeshStandardMaterial({ color: "#9caec2", roughness: 0.5 }),
        [0, 0, 0],
      );
      m.rotation.y = -0.1;
      mesh(new THREE.SphereGeometry(0.62, 48, 32), bright, [0.25, 0.66, 1.1]);
    } else if (p.art === "ribbon") {
      const m = mesh(
        new THREE.TorusKnotGeometry(1.1, 0.35, 180, 36, 2, 3),
        bright,
        [0, 2, 0],
      );
      m.rotation.set(0.6, 0.5, 0.35);
      mesh(
        new THREE.CylinderGeometry(1.65, 1.65, 0.5, 64),
        matte,
        [0, 0.25, 0],
      );
    } else if (p.art === "sphere") {
      mesh(
        new THREE.BoxGeometry(2.9, 0.8, 2.9),
        new THREE.MeshStandardMaterial({ color: "#b38c74" }),
        [0, 0.4, 0],
      );
      mesh(new THREE.SphereGeometry(1.2, 64, 40), bright, [0, 2, 0]);
      mesh(new THREE.SphereGeometry(0.38, 40, 24), accent, [1.9, 0.38, 1.3]);
    } else if (p.art === "orbit") {
      mesh(new THREE.SphereGeometry(0.7, 48, 32), bright, [0, 1.8, 0]);
      for (let i = 0; i < 4; i++) {
        const m = mesh(
          new THREE.TorusGeometry(1.5 + i * 0.16, 0.08, 16, 96),
          bright,
          [0, 1.8, 0],
        );
        m.rotation.set(i * 0.47, Math.PI / 3 + i * 0.19, i * 0.35);
      }
    } else if (p.art === "bloom") {
      const m = mesh(
        new THREE.TorusKnotGeometry(1, 0.4, 180, 36, 3, 5),
        new THREE.MeshPhysicalMaterial({
          color: "#889b6d",
          roughness: 0.38,
          metalness: 0.25,
          clearcoat: 1,
        }),
        [0, 1.95, 0],
      );
      m.rotation.set(0.5, 0.3, 0.1);
      mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 64), matte, [0, 0.3, 0]);
    } else {
      for (let i = 0; i < 8; i++)
        mesh(new THREE.BoxGeometry(2.9, (i + 1) * 0.3, 0.55), matte, [
          -0.8,
          (i + 1) * 0.15,
          1.3 - i * 0.5,
        ]);
      mesh(new THREE.SphereGeometry(0.72, 48, 32), bright, [0.6, 3.4, -1.5]);
      const ring = mesh(
        new THREE.TorusGeometry(1.6, 0.17, 20, 72),
        accent,
        [1.6, 2.2, -2.4],
      );
      ring.rotation.y = -0.3;
    }
    renderer.render(scene, camera);
    p.image = renderer.domElement.toDataURL("image/webp", 0.92);
    if (import.meta.env.DEV)
      fetch("/__dev/save-study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, image: p.image }),
      }).catch(() => {});
    const geometries = new Set(),
      materials = new Set();
    scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
  env.dispose();
  environment.dispose();
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
}
