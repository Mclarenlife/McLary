import gsap from "gsap";
import * as THREE from "three";
import { captureViewport } from "./scene-capture.js";

// Inverse radial mapping in units of half the shortest viewport side.
export function gravityOffset(x, y) {
  const pull = 0.85 / (Math.hypot(x, y) + 0.08) ** 0.85;
  return [x * pull, y * pull];
}
export function blackHoleLens(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return {
    pull: Math.min(100, 0.24 * (p / Math.max(0.00001, 1 - p)) ** 1.25),
    warp: p ** 0.8,
    split: Math.sin(p * Math.PI),
    hidden: p >= 1,
  };
}

const fragmentShader = `
  uniform sampler2D frame;
  uniform vec2 resolution;
  uniform float pull, warp, split, direction, hidden;
  varying vec2 vUv;
  vec3 sampleFrame(vec2 uv) {
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec3(0.00061, 0.00091, 0.00273);
    return texture2D(frame, uv).rgb;
  }
  void main() {
    vec2 aspect = resolution / min(resolution.x, resolution.y);
    vec2 q = (vUv - 0.5) * aspect * 2.0;
    float radius = length(q);
    float sourceRadius = radius;
    for (int i = 0; i < 2; i++)
      sourceRadius += pull * sourceRadius * 0.85 / pow(sourceRadius + 0.08, 0.85);
    // Exact polar sampling: the inner image winds much faster than the rim.
    // Unlike rotating a DOM rectangle, each radius follows a different orbit.
    float angle = atan(q.y, q.x) + direction * 12.0 * warp * exp(-sourceRadius * 1.65);
    vec2 ray = vec2(cos(angle), sin(angle));
    vec2 uv = 0.5 + ray * sourceRadius / aspect * 0.5;
    vec2 dispersion = (ray + vec2(-ray.y, ray.x) * 0.45) / aspect * split * 0.0017;
    vec3 color = vec3(sampleFrame(uv + dispersion).r, sampleFrame(uv).g, sampleFrame(uv - dispersion).b);
    gl_FragColor = vec4(mix(color, vec3(0.00061, 0.00091, 0.00273), hidden), 1.0);
    #include <colorspace_fragment>
  }
`;

export class SingularityTransition {
  constructor() {
    this.stage = document.createElement("div");
    this.stage.className = "singularity-stage";
    this.world = document.createElement("div");
    this.world.className = "singularity-world";
    document.body.prepend(this.stage);
    this.stage.append(this.world);
    this.world.append(...document.querySelectorAll("#scene,#grain,#app"));
    this.snapshot = document.createElement("canvas");
    this.snapshot.width = this.snapshot.height = 1;
    this.texture = new THREE.CanvasTexture(this.snapshot);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.uniforms = {
      frame: { value: this.texture },
      resolution: { value: new THREE.Vector2(1, 1) },
      pull: { value: 0 },
      warp: { value: 0 },
      split: { value: 0 },
      direction: { value: 1 },
      hidden: { value: 0 },
    };
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      this.renderer.setSize(1, 1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.domElement.className = "singularity-canvas";
      this.renderer.domElement.setAttribute("aria-hidden", "true");
      this.stage.append(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.scene.add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
            fragmentShader,
            depthTest: false,
            depthWrite: false,
          }),
        ),
      );
      // Compile before the welcome screen is dismissed, not on the first click.
      this.renderer.compile(this.scene, this.camera);
      this.renderer.render(this.scene, this.camera);
    } catch {
      this.renderer?.dispose();
      this.renderer = null;
    }
  }

  capture() {
    // The overlay covers this synchronous refresh: the unwarped page never flashes.
    this.world.style.visibility = "";
    captureViewport(this.snapshot, this.beforeCapture);
    this.texture.dispose();
    this.texture = new THREE.CanvasTexture(this.snapshot);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.uniforms.frame.value = this.texture;
    this.world.style.visibility = "hidden";
  }

  start(swap, onComplete, beforeCapture) {
    this.cancel();
    this.swapped = false;
    this.swap = swap;
    this.onComplete = onComplete;
    this.beforeCapture = beforeCapture;
    if (!this.renderer) {
      this.commit();
      this.finish();
      return gsap.timeline();
    }
    this.renderer.setSize(innerWidth, innerHeight);
    this.uniforms.resolution.value.set(innerWidth, innerHeight);
    this.uniforms.direction.value = 1;
    this.state = { progress: 0 };
    this.stage.classList.add("is-active");
    this.stage.dataset.phase = "collapse";
    document.documentElement.classList.add("singularity-active");
    this.world.inert = true;
    this.capture();
    this.update();
    this.timeline = gsap.timeline({
      onUpdate: () => this.update(),
      onComplete: () => this.finish(),
    });
    this.timeline
      .to(this.state, {
        progress: 1,
        duration: 1.3,
        ease: (t) => 0.22 * t + 0.78 * t ** 2.4,
      })
      .call(() => {
        this.commit();
        this.capture();
        // Unwinding the opposite pose continues the same clockwise travel.
        this.uniforms.direction.value = -1;
        this.stage.dataset.phase = "burst";
      })
      .to(this.state, {
        progress: 0,
        duration: 1.3,
        ease: (t) => 1 - 0.4 * (1 - t) - 0.6 * (1 - t) ** 2.4,
      });
    return this.timeline;
  }

  commit() {
    if (this.swapped) return;
    this.swapped = true;
    this.swap?.();
  }
  update() {
    const lens = blackHoleLens(this.state.progress);
    if (import.meta.env?.DEV)
      this.stage.dataset.progress = this.state.progress.toFixed(2);
    for (const key of ["pull", "warp", "split"])
      this.uniforms[key].value = lens[key];
    this.uniforms.hidden.value = Number(lens.hidden);
    this.renderer.render(this.scene, this.camera);
  }
  finish() {
    const done = this.onComplete;
    this.cancel();
    done?.();
  }
  cancel() {
    this.timeline?.kill();
    this.timeline = null;
    this.stage.classList.remove("is-active");
    delete this.stage.dataset.phase;
    delete this.stage.dataset.progress;
    document.documentElement.classList.remove("singularity-active");
    this.world.inert = false;
    this.world.removeAttribute("style");
    this.swap = null;
    this.onComplete = null;
    this.beforeCapture = null;
  }
  complete() {
    if (!this.timeline) return;
    this.commit();
    this.finish();
  }
}
