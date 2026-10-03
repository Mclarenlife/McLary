import { applyCameraView } from "./camera-pose.js";
import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OceanScene, oceanView } from "./ocean-scene.js";
import { UnderwaterScene } from "./underwater-scene.js";
import { PhotoGlobe } from "./photo-globe.js";
import { profile } from "./content.js";
import gsap from "gsap";
import { WaterMotion } from "./water-motion.js";
import { DayCycle } from "./day-cycle.js";
import { waterVeil } from "./water-veil.js";
import { submergedView } from "./work-depth.js";

// Scene geometry and interaction are authored for this project. The gallery's
// bundled geographic data is credited in public/earth.
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
    this.workDepth = 0;
    this.day = new DayCycle();
    this.timeCheck = 0;
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
    this.ambient = new THREE.HemisphereLight("#f8edf0", "#737488", 2.1);
    this.scene.add(this.ambient);
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
    this.sunLight = sun;
    const fill = new THREE.DirectionalLight("#c5d4ff", 1.4);
    fill.position.set(9, 8, -12);
    this.scene.add(fill);
    this.fillLight = fill;
    this.ocean = new OceanScene(profile.email, this.day);
    this.scene.add(this.ocean.group);
    // Water's API requires a normal sampler; all actual detail is now computed
    // in world space by WaterMotion, without a repeated texture tile.
    const normal = texture(1, () => [128, 128, 255]);
    const waterSegments = innerWidth < 600 ? 96 : 192;
    const waterGeometry = new THREE.PlaneGeometry(
      600,
      600,
      waterSegments,
      waterSegments,
    );
    // Spend vertices near the boat and camera rather than on the distant horizon.
    const grid = waterGeometry.attributes.position;
    for (let i = 0; i < grid.count; i++) {
      for (const axis of [0, 1]) {
        const v = grid.getComponent(i, axis) / 300;
        grid.setComponent(
          i,
          axis,
          Math.sign(v) * Math.pow(Math.abs(v), 1.65) * 300,
        );
      }
    }
    this.water = new Water(waterGeometry, {
      textureWidth: innerWidth < 600 ? 512 : 1024,
      textureHeight: innerWidth < 600 ? 512 : 1024,
      waterNormals: normal,
      sunDirection: new THREE.Vector3(-42, 29, -120).normalize(),
      sunColor: 0xffefde,
      waterColor: 0x5798a8,
      distortionScale: 1.35,
      fog: true,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.07;
    this.water.material.uniforms.size.value = 32;
    this.scene.add(this.water);
    this.waterMotion = new WaterMotion(
      this.renderer,
      this.scene,
      this.camera,
      this.water,
      this.day,
    );
    this.underwater = new UnderwaterScene(this.day);
    this.scene.add(this.underwater.group);
    this.photoGallery = new PhotoGlobe();
    this.scene.add(this.photoGallery.group);
    this.addParticles();
    this.resize = () => {
      this.day.setAspect(innerWidth / innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.waterMotion.resize(innerWidth, innerHeight);
      this.ocean.setLayout(innerWidth < 650);
      this.underwater.resize();
      if (this.page) this.setPage(this.page, true);
    };
    addEventListener("resize", this.resize);
    this.onMove = (e) => {
      this.pointer.set(
        e.clientX / innerWidth - 0.5,
        e.clientY / innerHeight - 0.5,
      );
      if (
        this.page === "gallery" &&
        e.pointerType !== "touch" &&
        !this.dragging &&
        !e.target.closest("a,button,.menu,.dialog,.intro,.time-control")
      ) {
        this.photoGallery.setPointer(e.clientX, e.clientY);
      } else this.photoGallery.clearPointer();
      if (
        this.entered &&
        !this.reduced &&
        !e.target.closest("a,button,.menu,.dialog,.intro")
      ) {
        if (this.page === "work") {
          if (!this.waterMotion.push.pass.enabled)
            this.underwater.bubbles.emit(
              e.clientX,
              e.clientY,
              this.waterMotion.time,
            );
        } else if (this.page !== "gallery")
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
    document.addEventListener("pointerleave", () =>
      this.photoGallery.clearPointer(),
    );
    addEventListener("blur", () => this.photoGallery.clearPointer());
    container.addEventListener("pointerdown", (e) => {
      if (
        this.entered &&
        !this.reduced &&
        !["work", "gallery"].includes(this.page)
      )
        this.waterMotion.disturb(e.clientX, e.clientY, true);
      if (this.page === "gallery") {
        this.galleryClickPhoto = this.photoGallery.pick(
          e.clientX,
          e.clientY,
          this.camera,
        );
        this.dragging = true;
        this.lastX = e.clientX;
        this.galleryPointerDown = { x: e.clientX, y: e.clientY };
        container.setPointerCapture(e.pointerId);
      }
    });
    addEventListener("pointerup", (e) => {
      if (
        this.dragging &&
        this.page === "gallery" &&
        this.galleryPointerDown &&
        Math.hypot(
          e.clientX - this.galleryPointerDown.x,
          e.clientY - this.galleryPointerDown.y,
        ) < 5
      ) {
        const id =
          this.galleryClickPhoto ||
          this.photoGallery.pick(e.clientX, e.clientY, this.camera);
        if (id) this.onPhotoSelect?.(id);
      }
      this.dragging = false;
      if (
        this.page === "gallery" &&
        e.pointerType !== "touch" &&
        !e.target.closest("a,button,.menu,.dialog,.intro")
      )
        this.photoGallery.setPointer(e.clientX, e.clientY);
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
    await Promise.all([
      this.ocean.prepare(this.renderer),
      this.underwater.visitors.prepare(),
      this.photoGallery.prepare(this.renderer),
    ]);
    const visible = this.ocean.group.visible;
    const underwaterVisible = this.underwater.group.visible;
    const galleryVisible = this.photoGallery.group.visible;
    const seabedVisible = this.underwater.seabed.group.visible;
    this.ocean.group.visible = true;
    this.underwater.group.visible = true;
    this.photoGallery.group.visible = true;
    this.underwater.seabed.group.visible = true;
    // Rare visitors are also compiled now, not when their first pass begins.
    const visitors = this.underwater.visitors.creatures;
    const visitorVisibility = visitors.map((v) => v.visible);
    visitors.forEach((v) => (v.visible = true));
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } finally {
      this.ocean.group.visible = visible;
      this.underwater.group.visible = underwaterVisible;
      this.photoGallery.group.visible = galleryVisible;
      this.underwater.seabed.group.visible = seabedVisible;
      visitors.forEach((v, i) => (v.visible = visitorVisibility[i]));
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
    const enteringGallery = page === "gallery" && this.page !== page;
    this.page = page;
    if (page !== "work") this.setWorkDepth(0);
    waterVeil.settle(page);
    this.dragOffset = 0;
    const oceanPage = page === "index" || page === "contact";
    const target = oceanPage
      ? oceanView(page === "contact", innerWidth < 650)
      : page === "gallery"
        ? this.photoGallery.view(
            enteringGallery ? "all" : this.photoGallery.selected,
            innerWidth < 650,
          )
        : { x: 0, y: 6.2, z: 20, tx: 0, ty: 6, tz: -9 };
    this.photoGallery.group.visible = page === "gallery";
    this.photoGallery.clearPointer();
    if (enteringGallery) this.photoGallery.select("all", true);
    this.camera.near = 0.1;
    this.camera.far = page === "gallery" ? 80 : 800;
    this.camera.updateProjectionMatrix();
    this.underwater.setActive(page === "work");
    this.water.visible = !["work", "gallery"].includes(page);
    this.ocean.group.visible = oceanPage;
    this.particles.visible = false;
    this.applyDayLighting(page);
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
        page === "gallery"
          ? "#050709"
          : page === "work"
            ? "#0c5268"
            : "#d9d7e4",
      ),
      duration: this.reduced || immediate ? 0 : 0.4,
    });
  }
  cancelTransition() {
    this.pushTimeline?.kill();
    this.waterMotion.push.finish();
    this.transitionTarget = null;
    waterVeil.settle(this.page);
  }
  beginTransition(direction, nextPage) {
    if (this.reduced) return;
    this.cancelTransition();
    this.waterMotion.push.capture(
      this.waterMotion.composer,
      this.waterMotion.outputPass,
      direction,
      this.waterMotion.veilPass,
    );
    this.transitionTarget = nextPage;
    this.setPage(nextPage, true);
    waterVeil.cross(direction);
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
  setPlace(id) {
    this.dragOffset = 0;
    this.photoGallery.select(id, this.reduced);
    const target = this.photoGallery.view(id, innerWidth < 650);
    gsap.to(this.view, {
      ...target,
      duration: this.reduced ? 0 : 2.4,
      ease: "power3.inOut",
      overwrite: true,
    });
  }
  setWorkDepth(value) {
    this.workDepth = THREE.MathUtils.clamp(value, 0, 1);
    this.underwater.setDepth(this.workDepth);
  }
  setTimeMode(mode) {
    this.day.setMode(mode, this.reduced);
  }
  applyDayLighting(page = this.page) {
    const u = this.day.uniforms;
    const gallery = page === "gallery";
    if (gallery) this.sunLight.color.set("#fff0d7");
    else this.sunLight.color.copy(u.sun.value);
    this.sunLight.intensity = gallery ? 4.3 : u.sunPower.value;
    if (gallery) this.sunLight.position.set(-9, 14, 6);
    else
      this.sunLight.position
        .copy(u.direction.value)
        .multiplyScalar(25)
        .add(this.sunLight.target.position);
    this.ambient.intensity = gallery ? 2.1 : u.ambient.value;
    this.fillLight.intensity = gallery ? 1.4 : 0.25 + u.daylight.value * 1.15;
    this.scene.environmentIntensity = gallery
      ? 0.65
      : 0.16 + u.daylight.value * 0.49;
    if (gallery) this.scene.fog.color.set("#e1e1e5");
    else this.scene.fog.color.copy(u.fog.value);
    this.water.material.uniforms.waterColor.value.copy(u.water.value);
    this.water.material.uniforms.sunColor.value
      .copy(u.sun.value)
      .multiplyScalar(0.28 + u.daylight.value * 0.72);
    this.water.material.uniforms.sunDirection.value.copy(u.direction.value);
  }
  render() {
    if (document.hidden) return;
    this.clock.update();
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.timeCheck += delta;
    if (this.timeCheck > 5) {
      this.day.resolve();
      this.timeCheck = 0;
    }
    this.day.update(delta, this.reduced);
    this.applyDayLighting();
    const night = this.day.uniforms.night.value > 0.45;
    if (night !== this.nightUI) {
      document.body.classList.toggle("night-ocean", night);
      this.nightUI = night;
    }
    if (document.body.dataset.timeOfDay !== this.day.resolved)
      document.body.dataset.timeOfDay = this.day.resolved;
    this.waterMotion.update(delta, this.reduced);
    const t = this.waterMotion.time;
    const motion = this.reduced ? 0 : 1;
    this.water.material.uniforms.time.value = t * 0.45;
    if (this.ocean.group.visible) this.ocean.update(t, motion);
    this.particles.rotation.y = t * 0.009 * motion;
    this.smoothPointer.lerp(this.pointer, 1 - Math.exp(-4 * delta));
    const bubblesActive =
      this.page === "work" &&
      this.entered &&
      !this.reduced &&
      !document.body.classList.contains("menu-open") &&
      !document.querySelector("dialog[open]") &&
      !this.waterMotion.push.pass.enabled;
    this.underwater.bubbles.setActive(bubblesActive);
    if (this.underwater.group.visible)
      this.underwater.update(t, delta * motion, this.smoothPointer);
    const mobile = innerWidth < 650,
      inGallery = this.page === "gallery";
    const renderView = this.page === "work" ? submergedView(this.view, this.workDepth) : this.view;
    applyCameraView(this.camera, renderView, this.page, this.smoothPointer, {
      mobile,
      reduced: this.reduced,
      contact: this.contactMix.value,
      drag: this.dragOffset,
    });
    if (inGallery) {
      const near = THREE.MathUtils.clamp(
        (this.view.z - this.view.tz) * 0.015,
        0.00001,
        0.1,
      );
      if (Math.abs(near - this.camera.near) > 0.000001) {
        this.camera.near = near;
        this.camera.updateProjectionMatrix();
      }
    }
    this.orbitalFlight?.applyCamera(this.camera);
    if (inGallery) {
      this.photoGallery.interactionEnabled =
        this.entered &&
        !this.dragging &&
        !document.body.classList.contains("menu-open") &&
        !document.querySelector("dialog[open]") &&
        !this.orbitalActive &&
        !this.waterMotion.push.pass.enabled;
      this.photoGallery.update(t, this.camera, motion, this.dragOffset, delta);
      this.renderer.domElement.style.cursor = this.photoGallery.hovered
        ? "pointer"
        : "grab";
    } else this.renderer.domElement.style.cursor = "";
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
      this.renderer.domElement.dataset.underwater = String(
        this.underwater.group.visible,
      );
      this.renderer.domElement.dataset.place = this.photoGallery.selected;
      this.renderer.domElement.dataset.globeQuaternion =
        this.photoGallery.earthGroup.quaternion
          .toArray()
          .map((v) => v.toFixed(5))
          .join(",");
      this.renderer.domElement.dataset.recentering = String(
        !!this.photoGallery.departureActive,
      );
      this.renderer.domElement.dataset.globeReady = String(
        this.photoGallery.ready,
      );
      this.renderer.domElement.dataset.photoHover =
        this.photoGallery.hovered || "";
      this.renderer.domElement.dataset.orbitAngle =
        this.photoGallery.orbitAngle.toFixed(4);
      this.renderer.domElement.dataset.mapScale =
        this.photoGallery.material.uniforms.magnification.value.toFixed(6);
      this.renderer.domElement.dataset.visitor =
        this.underwater.visitors.creatures
          .filter((v) => v.visible)
          .map((v) => v.userData.kind)
          .join(",");
      this.underwater.bubbles.canvas.dataset.count = String(
        this.underwater.bubbles.items.length,
      );
    }
    this.orbitalFlight?.renderSurface();
    this.waterMotion.render();
  }
}
