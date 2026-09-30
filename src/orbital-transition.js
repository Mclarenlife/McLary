import gsap from "gsap";
import * as THREE from "three";
import { captureViewport } from "./scene-capture.js";
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
    natural: 1 - smooth(0.55, 0.96, p),
    interface: smooth(0.79, 1, p),
  };
}

export class OrbitalTransition {
  constructor() {
    this.app = document.querySelector("#app");
    this.snapshot = document.createElement("canvas");
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: { frame: { value: null }, progress: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform sampler2D frame; uniform float progress; varying vec2 vUv;
        void main(){
          vec4 color=texture2D(frame,vUv);
          float edge=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));
          float feather=smoothstep(0.,.12,progress)*.25;
          float alpha=mix(1.,smoothstep(0.,max(feather,.00001),edge),smoothstep(0.,.035,progress));
          alpha*=1.-smoothstep(.23,.46,progress);
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
  start(swap, onComplete, beforeCapture, { scene, entering, destination }) {
    this.cancel();
    this.scene = scene;
    this.onComplete = onComplete;
    this.destination = destination;
    this.entering = entering;
    if (!scene || !scene.photoGallery.ready) {
      swap();
      this.finish();
      return gsap.timeline();
    }
    if (entering) captureViewport(this.snapshot, beforeCapture);
    // Capture the destination before flying down to it on a return journey.
    swap();
    if (!entering) captureViewport(this.snapshot, beforeCapture);
    this.texture = new THREE.CanvasTexture(this.snapshot);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material.uniforms.frame.value = this.texture;
    scene.setPage("gallery", true);
    scene.photoGallery.select("all", true);
    scene.orbitalFlight = this;
    scene.orbitalActive = true;
    this.state = { progress: entering ? 0 : 1 };
    const pose = orbitalPose(0, innerWidth < 650);
    this.patch.position.copy(pose.anchor).addScaledVector(pose.normal, 0.0001);
    const frame = new THREE.Matrix4().lookAt(
      pose.position,
      pose.anchor,
      new THREE.Vector3(0, 1, 0),
    );
    this.patch.quaternion.setFromRotationMatrix(frame);
    const height =
      2 *
      (0.006 - 0.0001) *
      Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2));
    this.patch.scale.set(
      height * scene.camera.aspect * 1.002,
      height * 1.002,
      1,
    );
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
    this.scene.photoGallery.material.uniforms.flight.value = pose.natural;
    this.app.style.opacity = this.entering ? pose.interface : 0;
    // The work canvas sits above the background and must not cover the flight.
    const work = this.app.querySelector(".gallery-canvas");
    if (work) work.style.visibility = "hidden";
    this.scene.photoGallery.decor.group.visible = p > 0.48;
    this.scene.photoGallery.flightReveal = smooth(0.5, 0.8, p);
    if (import.meta.env.DEV) this.app.dataset.flight = p.toFixed(2);
    this.scene.render();
  }
  finish() {
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
    this.texture?.dispose();
    this.texture = null;
    this.material.uniforms.frame.value = null;
    if (this.scene) {
      this.scene.orbitalFlight = null;
      this.scene.orbitalActive = false;
      this.scene.photoGallery.material.uniforms.flight.value = 0;
      this.scene.photoGallery.flightReveal = 1;
      this.scene.photoGallery.decor.group.visible = true;
    }
    this.app.inert = false;
    this.app.style.opacity = "";
    this.app
      .querySelectorAll(".gallery-canvas")
      .forEach((c) => (c.style.visibility = ""));
    delete this.app.dataset.flight;
    document.documentElement.classList.remove("orbital-active");
    this.onComplete = null;
  }
  complete() {
    if (this.timeline) this.finish();
  }
}
