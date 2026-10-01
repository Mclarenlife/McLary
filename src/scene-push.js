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
        elapsed: { value: 0 },
        aspect: { value: 1 },
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
        uniform float elapsed;
        uniform float aspect;
        varying vec2 vUv;
        void main() {
          float t = max(0., elapsed - .38);
          float life = smoothstep(0., .22, t) * (1. - smoothstep(1.35, 2.65, t));
          vec2 screen = vUv;
          // Screen-space y starts at the top; texture y starts at the bottom.
          float y = 1. - vUv.y;
          float bow = sin(vUv.x * 3.14159265) * sin(clamp(progress, 0., 1.) * 3.14159265) * .095;
          float amount = progress + bow;
          float edge = direction > 0. ? 1. - amount : amount;
          // A moving meniscus refracts the scene on both sides of the waterline.
          float distanceToSurface = y - edge;
          float membrane = exp(-pow(distanceToSurface / .085, 2.)) * life;
          screen.x += sin(vUv.y * 31. + vUv.x * 17. - t * 8.) * membrane * .012 / aspect;
          screen.y += (sin(distanceToSurface * 52. - t * 4.) * .018 +
            sin(vUv.x * 24. + t * 5.) * .006) * membrane;
          float rims = 0.;
          float glints = 0.;
          // Rising bubbles on descent; elongated draining droplets on ascent.
          for (int i = 0; i < 14; i++) {
            float fi = float(i);
            float seed = fract(sin(fi * 127.1 + 31.7) * 43758.5453);
            float birth = fract(fi * .381) * .55;
            float age = max(0., t - birth);
            float fade = smoothstep(0., .16, t - birth) * (1. - smoothstep(.65, 1.8, age)) * life;
            vec2 center = vec2(.055 + seed * .89,
              direction > 0. ? -.08 + age * (.48 + seed * .3) : 1.08 - age * (.46 + seed * .24));
            center.x += sin(age * 3. + fi) * .018;
            vec2 delta = (vUv - center) * vec2(aspect, direction > 0. ? 1. : .56);
            float radius = .009 + fract(fi * .713) * .017;
            float d = length(delta) / radius;
            float lens = (1. - smoothstep(.45, 1., d)) * fade;
            screen += delta / vec2(aspect, 1.) * lens * .3;
            rims += exp(-pow((d - .89) / .075, 2.)) * fade * .12;
            glints += exp(-length(delta / radius - vec2(-.32, .47)) * 14.) * fade * .24;
          }
          y = 1. - screen.y;
          float oldHeight = max(.001, 1. - amount);
          float newHeight = max(.001, amount);
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
          float x = .5 + (screen.x - .5) * (1. - sin(localY * 3.14159265) * compression * .10);
          vec2 uv = clamp(vec2(x, 1. - localY), .001, .999);
          gl_FragColor = incoming ? texture2D(tDiffuse, uv) : texture2D(previous, uv);
          float waterLight = exp(-pow(distanceToSurface / .011, 2.)) * life * .12;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(.80, .96, 1.04), membrane * .28);
          gl_FragColor.rgb += vec3(.40, .65, .70) * (rims + glints + waterLight);
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
    this.startedAt = performance.now();
    this.pass.uniforms.elapsed.value = 0;
    this.pass.uniforms.aspect.value = size.x / size.y;
    this.pass.uniforms.progress.value = 0;
    this.pass.uniforms.direction.value = direction;
    this.pass.enabled = true;
  }

  update() {
    this.pass.uniforms.progress.value = this.progress;
    if (this.pass.enabled)
      this.pass.uniforms.elapsed.value =
        (performance.now() - this.startedAt) / 1000;
  }

  finish() {
    this.progress = 1;
    this.pass.enabled = false;
  }
}
