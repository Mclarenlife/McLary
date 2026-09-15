import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OceanScene, oceanView } from "./ocean-scene.js";
import { profile } from "./content.js";
import gsap from "gsap";
import { WaterMotion } from "./water-motion.js";

// All geometry, materials and textures below are authored for this project.
// No remote models, shaders, imagery or fonts are loaded at runtime.
function texture(size, sample) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgb = sample(x, y),
        i = (y * size + x) * 4;
      data.set([...rgb, 255], i);
    }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function archWall(width, height, openings) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();
  for (const { x, w, h, y = 0.02, arch = true } of openings) {
    const hole = new THREE.Path(),
      left = x - w / 2,
      right = x + w / 2;
    hole.moveTo(left, y);
    hole.lineTo(left, y + h - (arch ? w / 2 : 0));
    if (arch) hole.absarc(x, y + h - w / 2, w / 2, Math.PI, 0, true);
    else {
      hole.lineTo(left, y + h);
      hole.lineTo(right, y + h);
    }
    hole.lineTo(right, y);
    hole.closePath();
    shape.holes.push(hole);
  }
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.7,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.045,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 40,
  });
}

export class PortfolioScene {
  constructor(container) {
    this.container = container;
    this.motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = this.motionPreference.matches;
    this.motionPreference.addEventListener("change", (event) => {
      this.reduced = event.matches;
    });
    this.pointer = new THREE.Vector2();
    this.smoothPointer = new THREE.Vector2();
    this.dragOffset = 0;
    this.dragging = false;
    this.entered = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#d9d7e4");
    this.scene.fog = new THREE.Fog("#d7e3e1", 65, 260);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(
      46,
      innerWidth / innerHeight,
      0.1,
      800,
    );
    this.view = oceanView(false, innerWidth < 650);
    this.contactMix = { value: 0 };
    const env = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(env, 0.04);
    this.scene.environment = this.environment.texture;
    env.dispose();
    pmrem.dispose();
    this.scene.environmentIntensity = 0.65;
    this.scene.add(new THREE.HemisphereLight("#f8edf0", "#737488", 2.1));
    const sun = new THREE.DirectionalLight("#fff0d7", 4.3);
    sun.position.set(-9, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -17,
      right: 17,
      top: 18,
      bottom: -12,
      near: 0.1,
      far: 60,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 4;
    sun.target.position.set(0, 0, -5);
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight("#c5d4ff", 1.4);
    fill.position.set(9, 8, -12);
    this.scene.add(fill);
    this.ocean = new OceanScene(profile.email);
    this.scene.add(this.ocean.group);
    const normal = texture(256, (x, y) => {
      const u = (x / 256) * Math.PI * 2,
        v = (y / 256) * Math.PI * 2;
      const dx =
        0.35 * Math.cos(u * 3 + Math.sin(v * 2)) +
        0.22 * Math.cos(u * 7 - v * 5);
      const dy = 0.2 * Math.cos(v * 4 + u * 2) + 0.14 * Math.sin(v * 8 - u * 3);
      const n = new THREE.Vector3(dx, dy, 1).normalize();
      return [
        (n.x * 0.5 + 0.5) * 255,
        (n.y * 0.5 + 0.5) * 255,
        (n.z * 0.5 + 0.5) * 255,
      ];
    });
    const waterSegments = innerWidth < 600 ? 96 : 192;
    this.water = new Water(
      new THREE.PlaneGeometry(600, 600, waterSegments, waterSegments),
      {
        textureWidth: innerWidth < 600 ? 512 : 1024,
        textureHeight: innerWidth < 600 ? 512 : 1024,
        waterNormals: normal,
        sunDirection: new THREE.Vector3(-0.5, 0.8, 0.2).normalize(),
        sunColor: 0xffefde,
        waterColor: 0x5798a8,
        distortionScale: 2.4,
        fog: true,
      },
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.07;
    this.water.material.uniforms.size.value = 32;
    this.scene.add(this.water);
    this.waterMotion = new WaterMotion(
      this.renderer,
      this.scene,
      this.camera,
      this.water,
    );
    this.galleryRoom = new THREE.Group();
    this.galleryRoom.visible = false;
    this.scene.add(this.galleryRoom);
    const galleryPlaster = new THREE.MeshStandardMaterial({
      color: "#e2e1e7",
      roughness: 0.72,
      metalness: 0.12,
    });
    for (const side of [-1, 1]) {
      const portal = new THREE.Mesh(
        archWall(8, 15, [{ x: 0, w: 4.6, h: 11 }]),
        galleryPlaster,
      );
      portal.position.set(side * 13.5, -0.1, -8);
      portal.rotation.y = -side * 0.32;
      portal.castShadow = portal.receiveShadow = true;
      this.galleryRoom.add(portal);
    }
    const paperMaterial = new THREE.MeshPhysicalMaterial({
      color: "#e0dae8",
      metalness: 0.86,
      roughness: 0.17,
      iridescence: 1,
      side: THREE.DoubleSide,
    });
    this.floatingPages = [];
    for (let i = 0; i < 42; i++) {
      const geometry = new THREE.PlaneGeometry(
        0.25 + (i % 3) * 0.12,
        0.16 + (i % 4) * 0.05,
        5,
        7,
      );
      const pos = geometry.attributes.position;
      for (let v = 0; v < pos.count; v++)
        pos.setZ(v, Math.sin(pos.getY(v) * 10) * 0.1);
      geometry.computeVertexNormals();
      const paper = new THREE.Mesh(geometry, paperMaterial);
      paper.position.set(
        Math.sin(i * 73.1) * 13,
        2 + (i % 12) * 1.1,
        -12 + Math.cos(i * 23.7) * 5,
      );
      paper.rotation.set(i, i * 0.7, i * 0.4);
      paper.userData.baseY = paper.position.y;
      this.galleryRoom.add(paper);
      this.floatingPages.push(paper);
    }
    const metal = new THREE.MeshStandardMaterial({
      color: "#c5abb4",
      metalness: 0.8,
      roughness: 0.27,
    });
    this.play = new THREE.Group();
    this.play.visible = false;
    this.scene.add(this.play);
    const sculptMat = new THREE.MeshPhysicalMaterial({
      color: "#ccb9e1",
      metalness: 0.6,
      roughness: 0.2,
      iridescence: 1,
      clearcoat: 1,
    });
    this.sculpture = new THREE.Mesh(
      new THREE.TorusKnotGeometry(2, 0.55, 160, 28, 2, 3),
      sculptMat,
    );
    this.sculpture.position.set(0, 3.5, 0);
    this.play.add(this.sculpture);
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(4.1, 0.02, 8, 128),
      metal,
    );
    orbit.position.y = 3.5;
    orbit.rotation.x = Math.PI / 2;
    this.play.add(orbit);
    this.addParticles();
    this.resize = () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.waterMotion.resize(innerWidth, innerHeight);
      this.ocean.setLayout(innerWidth < 650);
      if (this.page) this.setPage(this.page, true);
    };
    addEventListener("resize", this.resize);
    this.onMove = (e) => {
      this.pointer.set(
        e.clientX / innerWidth - 0.5,
        e.clientY / innerHeight - 0.5,
      );
      if (
        this.entered &&
        !this.reduced &&
        !e.target.closest("a,button,.menu,.dialog,.work")
      ) {
        this.waterMotion.disturb(e.clientX, e.clientY);
      }
      if (this.dragging) {
        this.dragOffset = THREE.MathUtils.clamp(
          this.dragOffset + (e.clientX - this.lastX) * 0.013,
          -3.5,
          3.5,
        );
        this.lastX = e.clientX;
      }
    };
    addEventListener("pointermove", this.onMove);
    container.addEventListener("pointerdown", (e) => {
      if (this.entered && !this.reduced)
        this.waterMotion.disturb(e.clientX, e.clientY, true);
      if (this.page === "playground") {
        this.dragging = true;
        this.lastX = e.clientX;
        container.setPointerCapture(e.pointerId);
      }
    });
    addEventListener("pointerup", () => {
      this.dragging = false;
    });
    addEventListener("pointercancel", () => {
      this.dragging = false;
    });
    this.clock = new THREE.Timer();
    this.render = this.render.bind(this);
    this.renderer.setAnimationLoop(this.render);
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      container.classList.add("context-lost");
      document.dispatchEvent(new CustomEvent("scene-unavailable"));
    });
  }
  async prepare() {
    await document.fonts.ready;
    this.ocean.prepare(this.renderer);
    const visible = this.ocean.group.visible;
    this.ocean.group.visible = true;
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } finally {
      this.ocean.group.visible = visible;
    }
  }
  box(size, position, material, parent = this.scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    m.position.set(...position);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  addParticles() {
    const geo = new THREE.BufferGeometry(),
      coords = new Float32Array(210 * 3);
    for (let i = 0; i < coords.length; i++)
      coords[i] =
        (Math.sin(i * 51.72) * 0.5 + 0.5) * (i % 3 === 1 ? 12 : 36) -
        (i % 3 === 1 ? 0 : 18);
    geo.setAttribute("position", new THREE.BufferAttribute(coords, 3));
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#fffaf4",
        size: 0.025,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.scene.add(this.particles);
  }
  setPage(page, immediate = false) {
    if (
      this.transitionTarget === page &&
      this.waterMotion.push.pass.enabled &&
      !immediate
    )
      return;
    this.page = page;
    this.dragOffset = 0;
    const oceanPage = page === "index" || page === "contact";
    const target = oceanPage
      ? oceanView(page === "contact", innerWidth < 650)
      : page === "playground"
        ? { x: 0, y: 4, z: 13, tx: 0, ty: 3.5, tz: 0 }
        : { x: 0, y: 6.2, z: 20, tx: 0, ty: 6, tz: -9 };
    this.play.visible = page === "playground";
    this.galleryRoom.visible = page === "work";
    this.ocean.group.visible = oceanPage;
    this.particles.visible = !oceanPage;
    this.scene.fog.color.set(oceanPage ? "#d7e3e1" : "#e1e1e5");
    this.water.material.uniforms.waterColor.value.set(
      oceanPage ? "#5798a8" : "#8c839d",
    );
    gsap.to(this.view, {
      ...target,
      duration: this.reduced || immediate ? 0 : this.entered ? 2.6 : 0,
      ease: "power3.inOut",
      overwrite: true,
    });
    gsap.to(this.contactMix, {
      value: page === "contact" ? 1 : 0,
      duration: this.reduced || immediate ? 0 : 2.6,
      ease: "power3.inOut",
      overwrite: true,
    });
    gsap.to(this.ocean.reveal, {
      value: page === "contact" ? 1 : 0,
      duration: this.reduced ? 0 : page === "contact" ? 1.25 : 0.35,
      delay: this.reduced ? 0 : page === "contact" && this.entered ? 1.15 : 0,
      overwrite: true,
    });
    gsap.to(this.scene.background, {
      ...new THREE.Color(
        page === "playground"
          ? "#252431"
          : page === "work"
            ? "#e1e1e5"
            : "#d9d7e4",
      ),
      duration: this.reduced || immediate ? 0 : 0.4,
    });
  }
  cancelTransition() {
    this.pushTimeline?.kill();
    this.waterMotion.push.finish();
    this.transitionTarget = null;
  }
  beginTransition(direction, nextPage) {
    if (this.reduced) return;
    this.cancelTransition();
    this.waterMotion.push.capture(
      this.waterMotion.composer,
      this.waterMotion.outputPass,
      direction,
    );
    this.transitionTarget = nextPage;
    this.setPage(nextPage, true);
    this.pushTimeline = gsap
      .timeline({ onComplete: () => this.cancelTransition() })
      .to(this.waterMotion.push, {
        progress: -0.035,
        duration: 0.38,
        ease: "power2.inOut",
      })
      .to(this.waterMotion.push, {
        progress: 0.8,
        duration: 0.56,
        ease: "power3.in",
      })
      .to(this.waterMotion.push, {
        progress: 1,
        duration: 2.3,
        ease: "elastic.out(1,0.58)",
      });
  }
  setSculpture(type) {
    const geo =
      type === "orbit"
        ? new THREE.TorusGeometry(2, 0.58, 48, 120)
        : type === "bloom"
          ? new THREE.TorusKnotGeometry(1.65, 0.5, 160, 32, 3, 5)
          : new THREE.TorusKnotGeometry(2, 0.55, 160, 28, 2, 3);
    this.sculpture.geometry.dispose();
    this.sculpture.geometry = geo;
    gsap.fromTo(
      this.sculpture.scale,
      { x: 0.01, y: 0.01, z: 0.01 },
      { x: 1, y: 1, z: 1, duration: 0.8, ease: "back.out(1.4)" },
    );
  }
  render() {
    if (document.hidden) return;
    this.clock.update();
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.waterMotion.update(delta, this.reduced);
    const t = this.waterMotion.time;
    const motion = this.reduced ? 0 : 1;
    this.water.material.uniforms.time.value = t * 0.45;
    if (this.ocean.group.visible) this.ocean.update(t, motion);
    this.particles.rotation.y = t * 0.009 * motion;
    this.sculpture.rotation.y = t * 0.18 * motion + this.dragOffset;
    this.sculpture.rotation.z = Math.sin(t * 0.21) * 0.12 * motion;
    this.floatingPages.forEach((paper, i) => {
      paper.position.y =
        paper.userData.baseY + Math.sin(t * 0.45 + i) * 0.24 * motion;
      paper.rotation.y = i * 0.7 + t * 0.15 * motion;
    });
    this.smoothPointer.lerp(this.pointer, 1 - Math.exp(-4 * delta));
    const mobile = innerWidth < 650,
      parallax = mobile ? 0 : (6 - this.contactMix.value * 5.65) * motion;
    this.camera.position.set(
      this.view.x + this.smoothPointer.x * parallax + this.dragOffset,
      this.view.y - this.smoothPointer.y * parallax * 0.46,
      this.view.z +
        (mobile && this.page !== "index" && this.page !== "contact" ? 4 : 0),
    );
    this.camera.lookAt(
      this.view.tx +
        this.dragOffset * 0.5 -
        this.smoothPointer.x * parallax * 0.13,
      this.view.ty + this.smoothPointer.y * parallax * 0.1,
      this.view.tz,
    );
    this.camera.rotateZ(-this.smoothPointer.x * parallax * 0.004);
    if (this.page === "contact")
      this.onContactFrame?.(
        this.ocean.emailBounds(this.camera, innerWidth, innerHeight),
        this.ocean.reveal.value,
      );
    if (import.meta.env.DEV) {
      this.renderer.domElement.dataset.scene = this.page;
      this.renderer.domElement.dataset.camera = [
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      ]
        .map((v) => v.toFixed(2))
        .join(",");
      this.renderer.domElement.dataset.contact =
        this.ocean.reveal.value.toFixed(2);
      this.renderer.domElement.dataset.transition = this.waterMotion.push.pass
        .enabled
        ? "elastic"
        : "camera";
    }
    this.waterMotion.render();
  }
}
