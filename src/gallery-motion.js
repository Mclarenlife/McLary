import * as THREE from "three";
import gsap from "gsap";
import {
  clamp,
  damp,
  ribbonPoint,
  atlasPosition,
  projectAt,
  galleryBend,
} from "./paper-geometry.js";

const vertexShader = /* glsl */ `
  uniform vec2 range;
  varying vec2 sheet;
  varying vec3 viewPosition;
  void main() {
    sheet = vec2(uv.x, mix(range.y, range.x, uv.y));
    vec4 view = modelViewMatrix * vec4(position, 1.);
    viewPosition = view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D atlas;
  uniform float offset;
  uniform float contentHeight;
  uniform float rowPitch;
  uniform float imageHeight;
  uniform float cardWidth;
  uniform float columnPitch;
  uniform float sheetWidth;
  uniform float start;
  uniform float time;
  uniform float dispersion;
  uniform vec2 viewport;
  uniform vec2 maskEdges;
  varying vec2 sheet;
  varying vec3 viewPosition;
  void main() {
    float content = sheet.y - start + offset;
    if (content < 0. || content >= contentHeight) discard;
    vec2 uv = vec2(sheet.x, 1. - content / contentHeight);
    vec4 base = texture2D(atlas, uv);
    if (base.a < .01) discard;
    vec2 dx = vec2(dFdx(sheet.x), -dFdx(sheet.y) / contentHeight);
    vec2 dy = vec2(dFdy(sheet.x), -dFdy(sheet.y) / contentHeight);
    // The same phases drive the physical flutter and the tiny optical shift.
    float x = (sheet.x - .5) * sheetWidth;
    float wave = x * .005 + sheet.y * .0055 - time * 1.75;
    float crossWave = sheet.y * .004 - x * .004 + time * 1.22;
    vec2 flow = vec2(cos(wave) * .65 + cos(crossWave) * .35, sin(wave + crossWave) * .45);
    float rowY = mod(content, rowPitch);
    float columnX = mod(sheet.x * sheetWidth, columnPitch);
    float photo = smoothstep(0., 14., columnX) * (1. - smoothstep(cardWidth - 14., cardWidth, columnX));
    photo *= smoothstep(0., 10., rowY) * (1. - smoothstep(imageHeight - 10., imageHeight, rowY));
    // Suppress fringing at the image boundary and reduce it on captions to 3%.
    vec2 split = (dx * flow.x + dy * flow.y) * dispersion * mix(.03, 1., photo);
    vec4 red = texture2D(atlas, uv + split);
    vec4 blue = texture2D(atlas, uv - split);
    vec4 color = vec4(mix(base.rgb, vec3(red.r, base.g, blue.b), min(red.a, blue.a)), base.a);
    vec3 normal = normalize(cross(dFdx(viewPosition), dFdy(viewPosition)));
    color.rgb *= .85 + .15 * abs(normal.z);
    // A broad, softly refracted highlight travels diagonally across the photos.
    vec2 cardUv = vec2(columnX / cardWidth, rowY / imageHeight);
    float lightPhase = mod(time * .22 + floor(content / rowPitch) * .31, 3.8) - .9;
    float beam = exp(-pow((cardUv.x + cardUv.y - lightPhase + sin(wave) * .045) / .31, 2.));
    float sheen = beam * (.06 + .085 * abs(normal.z)) * photo;
    color.rgb = mix(color.rgb, vec3(.90, .98, 1.), sheen);
    // Fade only the paper itself at the heading; the sea/light stays continuous.
    float screenY = viewport.x - gl_FragCoord.y / viewport.y;
    color.a *= smoothstep(maskEdges.x, maskEdges.y, screenY);
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

export class GalleryMotion {
  constructor(grid, onSelect, entry = { value: 0 }, onProgress = () => {}) {
    this.grid = grid;
    this.stage = grid.closest(".work-stage");
    this.onSelect = onSelect;
    this.entry = entry;
    this.onProgress = onProgress;
    this.enabled = false;
    this.filterFlight = { value: 0 };
    this.filtering = false;
    this.abort = new AbortController();
    this.media = matchMedia("(prefers-reduced-motion: reduce)");
    this.cards = [...grid.querySelectorAll(".project-card")];
    this.pointer = new THREE.Vector2();
    this.pointerTarget = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.current = this.target = this.speed = this.time = 0;
    this.lastTime = performance.now();
    this.ready = false;
    this.disposed = false;
    this.stage.classList.add("sheet-preparing");
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      this.stage.classList.remove("sheet-preparing");
      this.preparation = Promise.resolve(false);
      return;
    }
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.canvas = this.renderer.domElement;
    this.canvas.className = "gallery-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    grid.closest(".work-surface").prepend(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 7000);
    this.camera.position.z = 1400;
    this.geometry = new THREE.PlaneGeometry(1, 1, 48, 192);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: {
        atlas: { value: null },
        offset: { value: 0 },
        contentHeight: { value: 1 },
        rowPitch: { value: 1 },
        imageHeight: { value: 1 },
        cardWidth: { value: 1 },
        columnPitch: { value: 1 },
        sheetWidth: { value: 1 },
        start: { value: 330 },
        time: { value: 0 },
        dispersion: { value: 0.32 },
        viewport: { value: new THREE.Vector2(1, 1) },
        maskEdges: { value: new THREE.Vector2(235, 315) },
        range: { value: new THREE.Vector2(-2600, 1200) },
      },
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.tick = () => this.renderFrame();
    this.measure = this.measure.bind(this);
    const signal = this.abort.signal;
    addEventListener("resize", this.measure, { signal });
    this.media.addEventListener("change", () => this.updateMode(), { signal });
    addEventListener(
      "wheel",
      (event) => {
        if (!this.active() || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        const unit =
          event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? this.height : 1;
        this.scrollBy(
          clamp(
            (Math.abs(event.deltaY) >= Math.abs(event.deltaX)
              ? event.deltaY
              : event.deltaX) * unit,
            -1800,
            1800,
          ) * 0.9,
        );
      },
      { signal, passive: false },
    );
    this.canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (!this.active() || !event.isPrimary || event.button !== 0) return;
        this.drag = {
          y: event.clientY,
          startY: event.clientY,
          moved: false,
          delta: 0,
        };
        this.canvas.setPointerCapture(event.pointerId);
      },
      { signal },
    );
    addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType !== "touch")
          this.pointerTarget.set(
            (event.clientX / innerWidth) * 2 - 1,
            (event.clientY / innerHeight) * 2 - 1,
          );
        if (this.drag && this.active()) {
          this.drag.delta = this.drag.y - event.clientY;
          this.drag.moved ||= Math.abs(this.drag.startY - event.clientY) > 5;
          this.scrollBy(this.drag.delta * 1.25);
          this.drag.y = event.clientY;
        }
      },
      { signal, passive: true },
    );
    addEventListener(
      "pointerup",
      () => {
        if (this.drag?.moved) {
          this.scrollBy(clamp(this.drag.delta * 7, -350, 350));
          this.ignoreClickUntil = performance.now() + 200;
        }
        this.drag = null;
      },
      { signal },
    );
    addEventListener(
      "pointercancel",
      () => {
        this.drag = null;
      },
      { signal },
    );
    document.documentElement.addEventListener(
      "pointerleave",
      () => this.pointerTarget.set(0, 0),
      { signal },
    );
    this.canvas.addEventListener("click", (event) => this.pick(event), {
      signal,
    });
    addEventListener(
      "keydown",
      (event) => {
        if (
          !this.active() ||
          event.target.closest("button,a,input,textarea,select")
        )
          return;
        const step = {
          ArrowDown: 80,
          ArrowUp: -80,
          PageDown: this.height * 0.65,
          PageUp: -this.height * 0.65,
          " ": this.height * (event.shiftKey ? -0.65 : 0.65),
        }[event.key];
        if (step !== undefined) {
          event.preventDefault();
          this.scrollBy(step);
        }
        if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          this.target = event.key === "End" ? this.maxTravel : 0;
        }
      },
      { signal },
    );
    grid.addEventListener(
      "focusin",
      (event) => {
        if (!this.ready || this.media.matches) return;
        const card = event.target.closest(".project-card");
        const region = this.regions.find((r) => r.id === card?.dataset.project);
        if (region) this.target = clamp(region.y - 55, 0, this.maxTravel);
      },
      { signal },
    );
    this.canvas.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        this.destroy();
      },
      { signal },
    );
    this.measure();
    gsap.ticker.add(this.tick);
    this.preparation = this.load();
  }

  async load() {
    let loaded = 0;
    this.onProgress(0.05, "Loading your projects");
    try {
      await Promise.all(
        this.cards.map(async (card) => {
          const image = card.querySelector("img");
          await image?.decode().catch(() => {});
          this.onProgress(
            0.05 + (++loaded / this.cards.length) * 0.7,
            "Loading your projects",
          );
        }),
      );
      await document.fonts.ready;
      if (this.disposed) return false;
      this.ready = true;
      this.measure();
      this.onProgress(0.85, "Preparing your experience");
      await this.renderer.compileAsync(this.scene, this.camera);
      if (this.disposed) return false;
      this.renderFrame(true);
      this.stage.classList.remove("sheet-preparing");
      this.updateMode();
      this.onProgress(1, "Your space is ready");
      return true;
    } catch (error) {
      console.warn(
        "Gallery graphics unavailable; using the prepared project list.",
        error,
      );
      this.destroy();
      this.onProgress(1, "Your space is ready");
      return false;
    }
  }

  setCards() {
    const cards = [...this.grid.querySelectorAll(".project-card")];
    const changed =
      cards.length !== this.cards.length ||
      cards.some((card, i) => card !== this.cards[i]);
    this.cards = cards;
    this.current = this.target = this.speed = 0;
    this.stage.scrollTop = 0;
    if (!this.ready || this.disposed) return;
    if (changed) this.buildAtlas();
    this.renderFrame(true);
  }

  setActive(enabled) {
    this.enabled = enabled;
    this.lastTime = performance.now();
    this.drag = null;
    if (enabled) {
      this.pointer.set(0, 0);
      this.pointerTarget.set(0, 0);
      this.renderFrame(true);
    } else if (this.canvas) {
      this.cancelFilter();
      this.canvas.style.visibility = "hidden";
    }
  }

  switchCards(commit) {
    if (!this.ready || this.disposed || this.media.matches || !this.enabled) {
      commit();
      return;
    }
    this.pendingCards = commit;
    if (this.filtering) return;
    this.filtering = true;
    this.stage.setAttribute("aria-busy", "true");
    this.filterFlight.value = this.current;
    this.filterTimeline = gsap.timeline({
      onComplete: () => {
        this.filtering = false;
        this.current = this.target = 0;
        this.stage.setAttribute("aria-busy", "false");
        if (this.pendingCards) this.switchCards(this.pendingCards);
      },
    });
    this.filterTimeline.to(this.filterFlight, {
      value: this.contentHeight + this.start - this.minimum + 16,
      duration: 1.25,
      ease: "power2.in",
    });
    this.filterTimeline.call(() => {
      const swap = this.pendingCards;
      this.pendingCards = null;
      swap?.();
      this.filterFlight.value = -(this.height - this.start + 320);
      this.current = this.filterFlight.value;
      this.target = 0;
      this.renderFrame(true);
    });
    this.filterTimeline.to(this.filterFlight, {
      value: 0,
      duration: 1.45,
      ease: "power3.out",
    });
  }

  cancelFilter() {
    this.filterTimeline?.kill();
    this.filtering = false;
    this.stage.setAttribute("aria-busy", "false");
    const pending = this.pendingCards;
    this.pendingCards = null;
    pending?.();
  }

  active() {
    return (
      this.ready &&
      this.enabled &&
      !this.filtering &&
      !this.disposed &&
      !this.media.matches &&
      !this.grid.closest("[inert]") &&
      !document.querySelector("dialog[open]") &&
      Math.abs(this.entry.value) < 0.03
    );
  }

  scrollBy(amount) {
    this.target = clamp(this.target + amount, 0, this.maxTravel);
  }

  updateMode() {
    const enabled = this.ready && !this.media.matches;
    this.stage.classList.toggle("sheet-ready", enabled);
    this.canvas.style.display = enabled ? "block" : "none";
    this.stage.scrollTop = 0;
  }

  measure() {
    if (this.disposed || !this.renderer) return;
    const progress = this.maxTravel ? this.current / this.maxTravel : 0;
    this.width = document.documentElement.clientWidth;
    this.height = innerHeight;
    this.mobile = this.width <= 700;
    this.sheetWidth = Math.min(
      this.width - (this.mobile ? 44 : this.width * 0.16),
      1190,
    );
    this.start = this.mobile ? 258 : 330;
    this.horizon = this.mobile ? 188 : 238;
    this.radius = this.mobile ? 160 : 210;
    this.minimum = -2600;
    this.maximum = this.height + 260;
    this.camera.aspect = this.width / this.height;
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(this.height / 2800),
    );
    this.camera.updateProjectionMatrix();
    // Put the vanishing point beneath the fixed title, rather than screen center.
    this.camera.projectionMatrix.elements[9] =
      (2 * this.horizon) / this.height - 1;
    this.camera.projectionMatrixInverse
      .copy(this.camera.projectionMatrix)
      .invert();
    this.renderer.setSize(this.width, this.height);
    this.material.uniforms.viewport.value.set(
      this.height,
      this.renderer.getPixelRatio(),
    );
    this.material.uniforms.maskEdges.value.set(
      this.mobile ? 184 : 235,
      this.mobile ? 244 : 315,
    );
    this.material.uniforms.start.value = this.start;
    this.material.uniforms.range.value.set(this.minimum, this.maximum);
    if (this.ready) {
      this.buildAtlas();
      this.current = this.target = clamp(
        progress * this.maxTravel,
        0,
        this.maxTravel,
      );
    }
  }

  buildAtlas() {
    const columns = this.mobile ? 1 : 2;
    const gap = this.mobile ? 0 : 30;
    const cardWidth = (this.sheetWidth - gap) / columns;
    const imageHeight = cardWidth / 1.52;
    this.rowPitch = imageHeight + 108;
    this.contentHeight = Math.ceil(this.cards.length / columns) * this.rowPitch;
    this.maxTravel = Math.max(0, this.contentHeight - this.rowPitch);
    const ratio = Math.min(
      2,
      this.renderer.capabilities.maxTextureSize /
        Math.max(this.sheetWidth, this.contentHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(this.sheetWidth * ratio);
    canvas.height = Math.ceil(this.contentHeight * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    this.regions = [];
    this.cards.forEach((card, i) => {
      const x = (i % columns) * (cardWidth + gap),
        y = Math.floor(i / columns) * this.rowPitch;
      const image = card.querySelector("img");
      if (image?.naturalWidth) {
        const scale = Math.max(
          cardWidth / image.naturalWidth,
          imageHeight / image.naturalHeight,
        );
        const sw = cardWidth / scale,
          sh = imageHeight / scale;
        ctx.drawImage(
          image,
          (image.naturalWidth - sw) / 2,
          (image.naturalHeight - sh) / 2,
          sw,
          sh,
          x,
          y,
          cardWidth,
          imageHeight,
        );
      } else {
        ctx.fillStyle = getComputedStyle(
          card.querySelector(".project-cover"),
        ).backgroundColor;
        ctx.fillRect(x, y, cardWidth, imageHeight);
      }
      ctx.fillStyle = "#eaf9f5";
      ctx.textBaseline = "top";
      ctx.font = '500 18px "DM Sans"';
      ctx.fillText(
        card.querySelector("h2").textContent,
        x,
        y + imageHeight + 13,
        cardWidth - 30,
      );
      ctx.font = '400 14px "DM Sans"';
      ctx.fillText(
        card.querySelector(".project-info p").textContent,
        x,
        y + imageHeight + 37,
        cardWidth - 30,
      );
      ctx.font = '400 24px "DM Sans"';
      ctx.fillText("↗", x + cardWidth - 23, y + imageHeight + 20);
      ctx.strokeStyle = "rgba(215,244,242,.42)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y + imageHeight + 66);
      ctx.lineTo(x + cardWidth, y + imageHeight + 66);
      ctx.stroke();
      this.regions.push({
        id: card.dataset.project,
        x,
        y,
        width: cardWidth,
        height: imageHeight + 66,
      });
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.material.uniforms.atlas.value?.dispose();
    this.material.uniforms.atlas.value = texture;
    this.material.uniforms.contentHeight.value = this.contentHeight;
    this.material.uniforms.rowPitch.value = this.rowPitch;
    this.material.uniforms.imageHeight.value = imageHeight;
    this.material.uniforms.cardWidth.value = cardWidth;
    this.material.uniforms.columnPitch.value = cardWidth + gap;
    this.material.uniforms.sheetWidth.value = this.sheetWidth;
    this.renderer.initTexture(texture);
  }

  renderFrame(force = false) {
    if (this.disposed || !this.renderer) return;
    const now = performance.now();
    const dt = clamp((now - this.lastTime) / 1000, 0.001, 0.05);
    this.lastTime = now;
    if (
      !this.ready ||
      (!force && (!this.enabled || this.media.matches || document.hidden))
    )
      return;
    const blocked =
      this.grid.closest("[inert]") || document.querySelector("dialog[open]");
    this.canvas.style.visibility = this.grid.closest("[inert]")
      ? "hidden"
      : "visible";
    const last = this.current;
    if (!blocked) {
      this.time += dt;
      this.current = this.filtering
        ? this.filterFlight.value
        : damp(this.current, this.target, 8, dt);
    }
    this.speed = damp(this.speed, (this.current - last) / dt, 8, dt);
    this.pointer.x = damp(
      this.pointer.x,
      this.mobile ? 0 : this.pointerTarget.x,
      4,
      dt,
    );
    this.pointer.y = damp(
      this.pointer.y,
      this.mobile ? 0 : this.pointerTarget.y,
      4,
      dt,
    );
    this.mesh.rotation.set(
      this.pointer.y * 0.075,
      this.pointer.x * 0.14,
      -this.pointer.x * 0.009,
    );
    this.mesh.position.y = -this.entry.value * this.height * 1.12;
    const pos = this.geometry.attributes.position,
      uv = this.geometry.attributes.uv;
    const flutter =
      (this.mobile ? 0.6 : 1) + Math.min(Math.abs(this.speed) / 3000, 0.5);
    this.bend = galleryBend(this.start, this.height, this.mobile, this.current);
    for (let i = 0; i < pos.count; i++) {
      const distance =
        this.maximum + (this.minimum - this.maximum) * uv.getY(i);
      pos.setXYZ(
        i,
        ...ribbonPoint(
          (uv.getX(i) - 0.5) * this.sheetWidth,
          distance,
          this.bend,
          this.radius,
          this.horizon,
          this.time,
          flutter,
          this.sheetWidth,
        ),
      );
    }
    pos.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    this.material.uniforms.offset.value = this.current;
    this.material.uniforms.time.value = this.time;
    this.material.uniforms.dispersion.value =
      (this.mobile ? 0.22 : 0.32) + Math.min(Math.abs(this.speed) / 7000, 0.18);
    this.renderer.render(this.scene, this.camera);
    if (import.meta.env.DEV) {
      this.canvas.dataset.travel = this.current.toFixed(2);
      this.canvas.dataset.maxTravel = this.maxTravel.toFixed(2);
      this.canvas.dataset.meshes = "1";
      this.canvas.dataset.prepared = "true";
      this.canvas.dataset.bend = this.bend.toFixed(2);
      this.canvas.dataset.filtering = String(this.filtering);
    }
  }

  pick(event) {
    if (!this.active() || performance.now() < (this.ignoreClickUntil || 0))
      return;
    this.ndc.set(
      (event.clientX / this.width) * 2 - 1,
      1 - (event.clientY / this.height) * 2,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    for (const hit of this.raycaster.intersectObject(this.mesh)) {
      const distance = this.maximum + (this.minimum - this.maximum) * hit.uv.y;
      const y = atlasPosition(
        distance,
        this.current,
        this.start,
        this.contentHeight,
      );
      if (y === null) continue;
      const region = projectAt(hit.uv.x * this.sheetWidth, y, this.regions);
      if (region) {
        this.onSelect(region.id);
        return;
      }
    }
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelFilter();
    this.abort.abort();
    gsap.ticker.remove(this.tick);
    this.ready = false;
    this.stage.classList.remove("sheet-ready", "sheet-preparing");
    this.material?.uniforms.atlas.value?.dispose();
    this.material?.dispose();
    this.geometry?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas?.remove();
  }
}
