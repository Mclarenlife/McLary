import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// Two full backgrounds share one curved moving boundary. Each image is mapped
// into its remaining height, so the next room physically compresses the old one.
export class ScenePush {
  constructor(renderer) {
    this.renderer = renderer;
    this.progress = 0;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
    });
    this.pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        previous: { value: null },
        progress: { value: 0 },
        direction: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D previous;
        uniform float progress;
        uniform float direction;
        varying vec2 vUv;
        void main() {
          // Screen-space y starts at the top; texture y starts at the bottom.
          float y = 1. - vUv.y;
          float bow = sin(vUv.x * 3.14159265) * sin(clamp(progress, 0., 1.) * 3.14159265) * .095;
          float amount = progress + bow;
          float oldHeight = max(.001, 1. - amount);
          float newHeight = max(.001, amount);
          float edge = direction > 0. ? 1. - amount : amount;
          bool incoming = direction > 0. ? y >= edge : y <= edge;
          float localY;
          float compression;
          if (incoming) {
            localY = direction > 0. ? (y - edge) / newHeight : y / newHeight;
            compression = max(0., 1. - newHeight);
          } else {
            localY = direction > 0. ? y / oldHeight : (y - edge) / oldHeight;
            compression = max(0., 1. - oldHeight);
          }
          // Nonuniform compression and a slight lateral bulge make the push elastic.
          localY += sin(localY * 3.14159265) * compression * .12 * direction;
          float x = .5 + (vUv.x - .5) * (1. - sin(localY * 3.14159265) * compression * .10);
          vec2 uv = clamp(vec2(x, 1. - localY), .001, .999);
          gl_FragColor = incoming ? texture2D(tDiffuse, uv) : texture2D(previous, uv);
        }
      `,
    });
    this.pass.uniforms.previous.value = this.target.texture;
    this.pass.enabled = false;
    this.copy = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: this.pass.material.vertexShader,
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(tDiffuse, vUv); }`,
    });
  }

  capture(composer, outputPass, direction) {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target.setSize(size.x, size.y);
    const previousTarget = this.renderer.getRenderTarget();
    const renderToScreen = composer.renderToScreen;
    const outputEnabled = outputPass.enabled;
    // Capture the current water/refraction result before tone mapping. Both
    // backgrounds then pass through the same output transform exactly once.
    this.pass.enabled = false;
    composer.renderToScreen = false;
    outputPass.enabled = false;
    try {
      composer.render();
      this.copy.render(this.renderer, this.target, composer.readBuffer);
    } finally {
      composer.renderToScreen = renderToScreen;
      outputPass.enabled = outputEnabled;
      this.renderer.setRenderTarget(previousTarget);
    }
    this.progress = 0;
    this.pass.uniforms.progress.value = 0;
    this.pass.uniforms.direction.value = direction;
    this.pass.enabled = true;
  }

  update() {
    this.pass.uniforms.progress.value = this.progress;
  }

  finish() {
    this.progress = 1;
    this.pass.enabled = false;
  }
}
