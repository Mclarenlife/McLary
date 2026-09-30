import * as THREE from "three";

function glowTexture() {
  const size = 32,
    pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(
        (x + 0.5 - size / 2) / (size / 2),
        (y + 0.5 - size / 2) / (size / 2),
      );
      const alpha = Math.exp(-r * r * 7) * Math.max(0, 1 - r) ** 2;
      pixels.set([255, 255, 255, Math.round(alpha * 255)], (y * size + x) * 4);
    }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.needsUpdate = true;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  return texture;
}

export class BoatLighting {
  constructor(boat, day) {
    this.day = day;
    this.group = new THREE.Group();
    this.group.name = "Night cabin and navigation lights";
    boat.add(this.group);
    this.windows = [];
    this.warm = new THREE.Color("#ffc078");
    this.windowTint = new THREE.Color("#ffd69a");
    this.fixtures = [];
    const glow = glowTexture();
    const housing = new THREE.MeshStandardMaterial({
      color: "#46535a",
      metalness: 0.7,
      roughness: 0.35,
    });
    const add = (name, position, color, radius, haloSize, flash = false) => {
      const fitting = new THREE.Group();
      fitting.name = name;
      fitting.position.set(...position);
      const mount = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.8, radius, radius * 1.4, 8),
        housing,
      );
      mount.position.y = -radius * 0.8;
      fitting.add(mount);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 10, 8),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          toneMapped: false,
          depthWrite: false,
        }),
      );
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      halo.scale.setScalar(haloSize);
      fitting.add(core, halo);
      this.group.add(fitting);
      this.fixtures.push({ core, halo, flash });
    };
    add("Masthead warm white", [-0.72, 4.97, 0], "#fff0ce", 0.038, 0.29);
    add(
      "Mast warning beacon",
      [-0.72, 4.38, 0.055],
      "#ff6654",
      0.028,
      0.2,
      true,
    );
    add("Hull red marker", [-1.6, 0.66, 0.36], "#ff5e49", 0.027, 0.19);
    add("Hull green marker", [-1.6, 0.66, -0.36], "#79e4a7", 0.027, 0.19);
    add("Stern white marker", [1.91, 0.73, 0], "#fff2cf", 0.027, 0.19);
    add("Cabin roof lamp", [-0.4, 0.75, 0.22], "#ffce86", 0.025, 0.19);
    add("Cockpit lamp", [1.35, 0.62, 0.29], "#ffce86", 0.025, 0.19);
    // Two short-range lights illuminate the actual deck and sail, without
    // shadow maps or a scene-wide bloom pass that would affect Gallery.
    this.deck = new THREE.PointLight("#ffc48b", 0, 2.8, 2);
    this.deck.position.set(0.65, 1.12, 0.14);
    this.cabin = new THREE.PointLight("#ffbb74", 0, 1.45, 2);
    this.cabin.position.set(-0.28, 0.84, 0.1);
    this.group.add(this.deck, this.cabin);
  }
  bindHull(hull) {
    const seen = new Set();
    hull.traverse((part) => {
      if (
        !part.isMesh ||
        !part.material.name.includes("Smoked cabin glass") ||
        seen.has(part.material)
      )
        return;
      const material = part.material;
      seen.add(material);
      material.emissive.copy(this.warm);
      material.emissiveIntensity = 0;
      this.windows.push({
        material,
        base: material.color.clone(),
        metalness: material.metalness,
      });
    });
  }
  update(time, motion) {
    const night = THREE.MathUtils.smoothstep(
      this.day.uniforms.night.value,
      0.08,
      0.94,
    );
    this.windows.forEach(({ material, base, metalness }) => {
      material.color.copy(base).lerp(this.windowTint, night);
      material.emissiveIntensity = night * 2.1;
      material.metalness = THREE.MathUtils.lerp(metalness, 0.04, night);
    });
    this.fixtures.forEach(({ core, halo, flash }) => {
      const pulse =
        flash && motion
          ? 0.38 +
            0.62 * Math.pow(0.5 + 0.5 * Math.cos((time * Math.PI * 2) / 4.8), 6)
          : 1;
      core.material.opacity = night * pulse;
      halo.material.opacity = night * pulse * 0.7;
    });
    this.deck.intensity = night * 0.95;
    this.cabin.intensity = night * 0.38;
  }
}
