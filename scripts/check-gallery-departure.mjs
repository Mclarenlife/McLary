import assert from "node:assert/strict";
import * as THREE from "three";
import { PhotoGlobe, globeOrientation } from "../src/photo-globe.js";
import { OrbitalTransition } from "../src/orbital-transition.js";

globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
globalThis.devicePixelRatio = 1;
const app = {
  inert: false,
  style: {},
  dataset: {},
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.document = {
  querySelector: () => app,
  documentElement: { classList: { add() {}, remove() {} } },
};

for (const destination of ["index", "work", "contact"]) {
  for (const regional of [false, true]) {
    const globe = new PhotoGlobe();
    globe.ready = true;
    globe.earthGroup.quaternion.copy(globeOrientation(regional ? 22 : 35, 147));
    if (regional) {
      globe.selected = "guangdong";
      globe.zoom.value = 1;
      globe.material.uniforms.magnification.value = 0.02;
      globe.material.uniforms.highlight.value = 1;
      globe.material.uniforms.detail.value = 1;
    }
    const initial = globe.earthGroup.quaternion.clone();
    const canonical = globeOrientation(35, 105);
    let swaps = 0,
      completions = 0;
    const scene = {
      photoGallery: globe,
      page: "gallery",
      camera: new THREE.PerspectiveCamera(),
      dragOffset: 3.5,
      setPage(page) {
        this.page = page;
        this.dragOffset = 0;
      },
      render() {
        globe.update(0, this.camera, 0, this.dragOffset);
      },
    };
    const effect = new OrbitalTransition();
    const timeline = effect
      .start(
        () => swaps++,
        () => completions++,
        { scene, entering: false, destination },
      )
      .pause();
    const alignment = timeline.duration() - 5.2;
    assert(alignment >= 0.8, "A rotated globe gets a visible alignment phase");
    assert(
      initial.angleTo(globe.earthGroup.quaternion) < 1e-7,
      "Click preserves the rendered orientation",
    );
    timeline.time(alignment / 2, false);
    scene.render();
    const halfway = globe.earthGroup.quaternion.angleTo(canonical);
    assert(
      halfway > 0.001 && halfway < initial.angleTo(canonical),
      "Alignment rotates gradually without the idle update overriding it",
    );
    assert.equal(
      scene.orbitalFlight,
      undefined,
      "Camera zoom waits for alignment",
    );
    assert.equal(effect.state.progress, 1);
    assert.equal(swaps, 0);
    timeline.time(alignment + 0.001, false);
    assert(globe.earthGroup.quaternion.angleTo(canonical) < 1e-7);
    assert.equal(scene.dragOffset, 0);
    assert.equal(globe.material.uniforms.magnification.value, 1);
    assert.equal(globe.departureActive, false);
    assert.equal(scene.orbitalFlight, effect);
    effect.complete();
    effect.complete();
    assert.equal(swaps, 1);
    assert.equal(completions, 1);
    assert.equal(app.inert, false);

    globe.earthGroup.quaternion.copy(initial);
    const interrupted = effect
      .start(
        () => swaps++,
        () => completions++,
        { scene, entering: false, destination },
      )
      .pause();
    interrupted.time(0.2, false);
    effect.cancel();
    assert.equal(globe.departureActive, false);
    assert.equal(scene.orbitalFlight, null);
    assert.equal(swaps, 1, "Cancellation never navigates");
    assert.equal(app.inert, false);
  }
}
console.log(
  "Gallery departure checks passed: preserved initial pose, gradual alignment, region release, ordered zoom, destinations and cancellation.",
);
