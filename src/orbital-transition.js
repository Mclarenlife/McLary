import gsap from "gsap";
import * as THREE from "three";
import { oceanView } from "./ocean-scene.js";
import { EARTH_RADIUS, geoPoint, globeOrientation } from "./photo-globe.js";

// South of Guangdong, offshore in the northern South China Sea.
export const DEPARTURE = { lat: 20.5, lon: 114 };
const center = new THREE.Vector3(0, 3.5, 0);
const smooth = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function orbitalPose(progress, mobile = false) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const normal = geoPoint(DEPARTURE.lat, DEPARTURE.lon, 1).applyQuaternion(
    globeOrientation(35, 105),
  );
  const anchor = normal.clone().multiplyScalar(EARTH_RADIUS).add(center);
  const end = (mobile ? 21.5 : 13) - EARTH_RADIUS;
  // Logarithmic travel crosses local, regional and planetary scales continuously.
  const altitude = 0.006 * (end / 0.006) ** (1 - (1 - p) ** 1.4);
  const direction = normal
    .clone()
    .lerp(new THREE.Vector3(0, 0, 1), smooth(0.25, 1, p))
    .normalize();
  return {
    anchor,
    normal,
    altitude,
    position: direction.multiplyScalar(EARTH_RADIUS + altitude).add(center),
    target: anchor.clone().lerp(center, smooth(0.25, 0.92, p)),
    interface: smooth(0.79, 1, p),
  };
}

export class OrbitalTransition {
  constructor() {
    this.app = document.querySelector("#app");
    this.surfaceCamera = new THREE.PerspectiveCamera();
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: { frame: { value: null }, progress: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy*2.,0.,1.);}`,
      fragmentShader: `
        uniform sampler2D frame; uniform float progress; varying vec2 vUv;
        void main(){
          vec4 color=texture2D(frame,vUv);
          float gray=dot(color.rgb,vec3(.2126,.7152,.0722));
          color.rgb=mix(color.rgb,vec3(gray),smoothstep(.015,.12,progress));
          float haze=length((vUv-.5)*vec2(1.,.8));
          float alpha=1.-smoothstep(.15,.38,progress+haze*.035);
          gl_FragColor=vec4(color.rgb,alpha);
          #include <colorspace_fragment>
        }`,
    });
    this.patch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.patch.renderOrder = 100;
    this.patch.frustumCulled = false;
    this.patch.visible = false;
  }
  prepare(scene) {
    scene.scene.add(this.patch);
    this.patch.visible = true;
    scene.renderer.compile(scene.scene, scene.camera);
    this.patch.visible = false;
  }
  start(swap, onComplete, { scene, entering, destination }) {
    this.cancel();
    this.scene = scene;
    this.onComplete = onComplete;
    this.destination = destination;
    this.entering = entering;
    this.swap = swap;
    this.swapped = false;
    if (!scene || !scene.photoGallery.ready) {
      this.commit();
      this.finish();
      return gsap.timeline();
    }
    this.surfacePage = entering ? scene.page : destination;
    this.surfaceCamera.copy(scene.camera);
    if (!entering) {
      const view =
        this.surfacePage === "work"
          ? {
              x: 0,
              y: 6.2,
              z: innerWidth < 650 ? 24 : 20,
              tx: 0,
              ty: 6,
              tz: -9,
            }
          : oceanView(this.surfacePage === "contact", innerWidth < 650);
      this.surfaceCamera.position.set(view.x, view.y, view.z);
      this.surfaceCamera.lookAt(view.tx, view.ty, view.tz);
    }
    this.surfaceStart = this.surfaceCamera.position.clone();
    this.surfaceRotation = this.surfaceCamera.quaternion.clone();
    this.surfaceCamera.near = 0.1;
    this.surfaceCamera.far = 1200;
    this.surfaceCamera.updateProjectionMatrix();
    const dpr = Math.min(devicePixelRatio, 1.5);
    this.target = new THREE.WebGLRenderTarget(
      Math.round(innerWidth * dpr),
      Math.round(innerHeight * dpr),
      { type: THREE.HalfFloatType },
    );
    this.material.uniforms.frame.value = this.target.texture;
    scene.setPage("gallery", true);
    scene.photoGallery.select("all", true);
    scene.orbitalFlight = this;
    scene.orbitalActive = true;
    this.state = { progress: entering ? 0 : 1 };
    this.patch.visible = true;
    this.app.inert = true;
    document.documentElement.classList.add("orbital-active");
    this.update();
    this.timeline = gsap
      .timeline({
        onUpdate: () => this.update(),
        onComplete: () => this.finish(),
      })
      .to(this.state, {
        progress: entering ? 1 : 0,
        duration: 5.2,
        ease: "none",
      });
    return this.timeline;
  }
  applyCamera(camera) {
    const p = this.state.progress;
    const pose = orbitalPose(p, innerWidth < 650);
    const restingPosition = camera.position.clone(),
      restingQuaternion = camera.quaternion.clone();
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    const blend = smooth(0.78, 1, p);
    camera.position.lerp(restingPosition, blend);
    camera.quaternion.slerp(restingQuaternion, blend);
    camera.near = Math.min(0.1, pose.altitude * 0.08);
    camera.updateProjectionMatrix();
  }
  update() {
    const p = this.state.progress;
    const pose = orbitalPose(p, innerWidth < 650);
    this.material.uniforms.progress.value = p;
    if ((this.entering && p >= 0.18) || (!this.entering && p <= 0.18))
      this.commit();
    this.app.style.opacity = this.entering
      ? this.swapped
        ? pose.interface
        : 1 - smooth(0, 0.12, p)
      : this.swapped
        ? 1 - smooth(0, 0.12, p)
        : smooth(0.82, 1, p);
    // The work canvas sits above the background and must not cover the flight.
    const work = this.app.querySelector(".gallery-canvas");
    if (work) work.style.visibility = "hidden";
    this.scene.photoGallery.decor.group.visible = p > 0.48;
    this.scene.photoGallery.flightReveal = smooth(0.5, 0.8, p);
    if (import.meta.env?.DEV) this.app.dataset.flight = p.toFixed(2);
    this.scene.render();
  }
  commit() {
    if (this.swapped) return;
    this.swapped = true;
    this.swap?.();
    this.scene?.setPage("gallery", true);
  }
  renderSurface() {
    const p = this.state.progress;
    this.patch.visible = p < 0.38;
    if (!this.patch.visible) return;
    const scene = this.scene,
      renderer = scene.renderer;
    const travel = smooth(0, 0.38, p);
    const rise = (Math.exp(travel * 6) - 1) * 0.4;
    this.surfaceCamera.position
      .copy(this.surfaceStart)
      .add(new THREE.Vector3(0, rise, rise * 0.12));
    this.surfaceCamera.lookAt(0, 0, -4);
    this.surfaceCamera.quaternion.slerpQuaternions(
      this.surfaceRotation,
      this.surfaceCamera.quaternion.clone(),
      travel,
    );
    const layers = [
      scene.water,
      scene.ocean.group,
      scene.underwater.group,
      scene.photoGallery.group,
    ];
    const visibility = layers.map((layer) => layer.visible);
    const background = scene.scene.background.clone(),
      fog = scene.scene.fog.color.clone();
    const target = renderer.getRenderTarget();
    const ocean = this.surfacePage !== "work";
    layers.forEach(
      (layer, i) => (layer.visible = [ocean, ocean, !ocean, false][i]),
    );
    scene.scene.background.set(ocean ? "#d9d7e4" : "#0c5268");
    scene.scene.fog.color.set(ocean ? "#d7e3e1" : "#e1e1e5");
    const time = scene.waterMotion.time;
    if (ocean) scene.ocean.update(time, scene.reduced ? 0 : 1);
    else scene.underwater.update(time, 0, new THREE.Vector2());
    this.patch.visible = false;
    try {
      renderer.setRenderTarget(this.target);
      renderer.render(scene.scene, this.surfaceCamera);
    } finally {
      renderer.setRenderTarget(target);
      layers.forEach((layer, i) => (layer.visible = visibility[i]));
      scene.scene.background.copy(background);
      scene.scene.fog.color.copy(fog);
      this.patch.visible = true;
    }
    if (import.meta.env?.DEV)
      this.app.dataset.surfaceCamera = this.surfaceCamera.position.y.toFixed(2);
  }
  finish() {
    this.commit();
    const done = this.onComplete;
    const scene = this.scene,
      destination = this.destination;
    this.cancel();
    if (scene && destination) {
      scene.setPage(destination, true);
      scene.render();
    }
    done?.();
  }
  cancel() {
    this.timeline?.kill();
    this.timeline = null;
    this.patch.visible = false;
    this.target?.dispose();
    this.target = null;
    this.material.uniforms.frame.value = null;
    if (this.scene) {
      this.scene.orbitalFlight = null;
      this.scene.orbitalActive = false;
      this.scene.photoGallery.flightReveal = 1;
      this.scene.photoGallery.decor.group.visible = true;
    }
    this.app.inert = false;
    this.app.style.opacity = "";
    this.app
      .querySelectorAll(".gallery-canvas")
      .forEach((c) => (c.style.visibility = ""));
    delete this.app.dataset.flight;
    delete this.app.dataset.surfaceCamera;
    this.swap = null;
    document.documentElement.classList.remove("orbital-active");
    this.onComplete = null;
  }
  complete() {
    if (this.timeline) this.finish();
  }
}
