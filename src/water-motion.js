import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ScenePush } from "./scene-push.js";

const RIPPLE_COUNT = 10;

// Shared wave heights and analytic slopes keep the mesh and its reflection in sync.
const waves = /* glsl */ `
  uniform float waveTime;
  uniform vec4 waterRipples[${RIPPLE_COUNT}];
  vec3 wave(vec2 p, vec2 direction, float frequency, float speed, float amplitude) {
    float phase = dot(p, direction) * frequency + waveTime * speed;
    return vec3(sin(phase) * amplitude,
      direction * (cos(phase) * frequency * amplitude));
  }
  vec3 waterField(vec2 p) {
    vec3 field = wave(p, vec2(.94, .34), 1.65, -.85, .046);
    field += wave(p, vec2(-.38, .92), 2.7, 1.12, .026);
    field += wave(p, vec2(.71, -.71), 4.8, -1.4, .012);
    field += wave(p, vec2(.23, .97), 8.6, 1.75, .006);
    for (int i = 0; i < ${RIPPLE_COUNT}; i++) {
      vec4 ripple = waterRipples[i];
      float age = waveTime - ripple.z;
      if (age < 0.0 || age > 5.0 || ripple.w == 0.0) continue;
      vec2 delta = p - ripple.xy;
      float radius = max(length(delta), .001);
      float front = radius - age * 2.8;
      float envelope = exp(-front * front * .65) * exp(-age * .8) * ripple.w;
      float phase = front * 7.0;
      float h = sin(phase) * envelope;
      float slope = (cos(phase) * 7.0 - sin(phase) * 1.3 * front) * envelope;
      field += vec3(h, delta / radius * slope);
    }
    return field;
  }
`;

export class WaterMotion {
  constructor(renderer, scene, camera, water) {
    this.time = 0;
    this.nextWater = 0;
    this.nextScreen = 0;
    this.lastInput = -100;
    this.lastPoint = new THREE.Vector2(-10, -10);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.07);
    this.hit = new THREE.Vector3();
    this.ndc = new THREE.Vector2();
    this.waveTime = { value: 0 };
    this.ripples = {
      value: Array.from(
        { length: RIPPLE_COUNT },
        () => new THREE.Vector4(0, 0, -100, 0),
      ),
    };
    const material = water.material;
    material.uniforms.waveTime = this.waveTime;
    material.uniforms.waterRipples = this.ripples;
    material.vertexShader = material.vertexShader
      .replace(
        "void main() {",
        `${waves}\nvoid main() {\nvec3 wavePosition = position;\nvec2 waterPoint = (modelMatrix * vec4(position, 1.)).xz;\nwavePosition.z += waterField(waterPoint).x;`,
      )
      .replaceAll("vec4( position, 1.0 )", "vec4( wavePosition, 1.0 )");
    material.fragmentShader = material.fragmentShader
      .replace(
        "void main() {",
        `${waves}\nvoid main() {\nvec3 waveData = waterField(worldPosition.xz);`,
      )
      .replace(
        "normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) )",
        "normalize(vec3(-waveData.y, 1.0, -waveData.z) + vec3(noise.x, 0.0, noise.y) * .10)",
      );

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.screenPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        aspect: { value: innerWidth / innerHeight },
        ripples: {
          value: Array.from(
            { length: RIPPLE_COUNT },
            () => new THREE.Vector4(0, 0, -100, 0),
          ),
        },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float aspect;
        uniform vec4 ripples[${RIPPLE_COUNT}];
        varying vec2 vUv;
        void main() {
          vec2 offset = vec2(0.);
          for (int i = 0; i < ${RIPPLE_COUNT}; i++) {
            vec4 r = ripples[i];
            float age = time - r.z;
            if (age < 0. || age > 2.8 || r.w == 0.) continue;
            vec2 delta = (vUv - r.xy) * vec2(aspect, 1.);
            float distance = max(length(delta), .001);
            float front = distance - age * .23;
            float envelope = exp(-front * front * 180.) * exp(-age * 1.5);
            offset += delta / distance / vec2(aspect, 1.) * cos(front * 105.) * envelope * r.w;
          }
          gl_FragColor = texture2D(tDiffuse, clamp(vUv + offset, .001, .999));
        }
      `,
    });
    this.composer.addPass(this.screenPass);
    this.push = new ScenePush(renderer);
    this.composer.addPass(this.push.pass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    this.camera = camera;
  }

  disturb(clientX, clientY, strong = false) {
    const x = clientX / innerWidth;
    const y = 1 - clientY / innerHeight;
    const distance = this.lastPoint.distanceTo(new THREE.Vector2(x, y));
    if (!strong && (this.time - this.lastInput < 0.14 || distance < 0.012))
      return;
    this.lastInput = this.time;
    this.lastPoint.set(x, y);
    const screenRipple =
      this.screenPass.uniforms.ripples.value[this.nextScreen++ % RIPPLE_COUNT];
    screenRipple.set(x, y, this.time, strong ? 0.0024 : 0.0009);
    this.ndc.set(x * 2 - 1, y * 2 - 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (
      this.raycaster.ray.intersectPlane(this.plane, this.hit) &&
      this.hit.distanceTo(this.camera.position) < 65
    ) {
      this.ripples.value[this.nextWater++ % RIPPLE_COUNT].set(
        this.hit.x,
        this.hit.z,
        this.time,
        strong ? 0.028 : 0.011,
      );
    }
  }

  update(delta, reduced) {
    if (!reduced) this.time += delta;
    this.waveTime.value = this.time;
    this.screenPass.uniforms.time.value = this.time;
    this.screenPass.enabled = !reduced;
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.screenPass.uniforms.aspect.value = width / height;
  }

  render() {
    this.push.update();
    this.composer.render();
  }
}
