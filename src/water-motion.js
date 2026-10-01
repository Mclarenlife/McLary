import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ScenePush } from "./scene-push.js";
import { waveFieldGLSL } from "./wave-spectrum.js";
import { waterVeil, waterVeilGLSL } from "./water-veil.js";

const RIPPLE_COUNT = 10;

// Shared wave heights and analytic slopes keep the mesh and its reflection in sync.
const waves = /* glsl */ `
  uniform float waveTime;
  uniform float swell;
  uniform vec4 waterRipples[${RIPPLE_COUNT}];
  vec3 wave(vec2 p, vec2 direction, float frequency, float speed, float amplitude) {
    vec2 crosswind = vec2(-direction.y, direction.x);
    float packetPhase = dot(p, crosswind) * frequency * .19 + waveTime * .11 + frequency * 7.;
    float packet = .64 + .36 * sin(packetPhase);
    vec2 packetSlope = crosswind * frequency * .19 * .36 * cos(packetPhase);
    float bendPhase = dot(p, crosswind) * frequency * .31 - waveTime * .09;
    float phase = dot(p, direction) * frequency + waveTime * speed + .65 * sin(bendPhase);
    vec2 phaseSlope = direction * frequency + crosswind * frequency * .31 * .65 * cos(bendPhase);
    return vec3(sin(phase) * amplitude * packet,
      amplitude * (cos(phase) * phaseSlope * packet + sin(phase) * packetSlope));
  }
  vec3 waterField(vec2 p) {
    vec3 field = vec3(0.);
    ${waveFieldGLSL}
    field *= swell;
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
  constructor(renderer, scene, camera, water, day) {
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
    material.uniforms.swell = day.uniforms.swell;
    material.uniforms.daylight = day.uniforms.daylight;
    material.vertexShader = material.vertexShader
      .replace(
        "void main() {",
        `${waves}\nvoid main() {\nvec3 wavePosition = position;\nvec2 waterPoint = (modelMatrix * vec4(position, 1.)).xz;\nwavePosition.z += waterField(waterPoint).x;`,
      )
      .replaceAll("vec4( position, 1.0 )", "vec4( wavePosition, 1.0 )");
    material.fragmentShader = material.fragmentShader
      .replace(
        "void main() {",
        `${waves}
        uniform float daylight;
        float seaHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float seaNoise(vec2 p) {
          vec2 i=floor(p), f=fract(p); f=f*f*f*(f*(f*6.-15.)+10.);
          return mix(mix(seaHash(i),seaHash(i+vec2(1,0)),f.x),mix(seaHash(i+vec2(0,1)),seaHash(i+1.),f.x),f.y);
        }
        float capillary(vec2 p) {
          mat2 turn=mat2(.8,-.6,.6,.8);
          vec2 drift=vec2(waveTime*.22,-waveTime*.16);
          return seaNoise(p*.53+drift)*.76+seaNoise(turn*p*1.23-drift*.73)*.24;
        }
        void main() {\nvec3 waveData = waterField(worldPosition.xz);`,
      )
      .replace(
        "vec4 noise = getNoise( worldPosition.xz * size );",
        `
        vec2 seaP = worldPosition.xz;
        float fine = capillary(seaP);
        vec2 grain = vec2(capillary(seaP+vec2(.14,0.))-capillary(seaP-vec2(.14,0.)),capillary(seaP+vec2(0.,.14))-capillary(seaP-vec2(0.,.14)))/.28;
        float resolve = 1.-smoothstep(.08,.7,length(fwidth(seaP)));
        vec4 noise = vec4(grain * resolve,0.,0.);
      `,
      )
      .replace(
        "normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) )",
        "normalize(vec3(-waveData.y-noise.x*.045, 1.0, -waveData.z-noise.y*.045))",
      )
      .replace(
        "sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );",
        "sunLight( surfaceNormal, eyeDirection, 56.0, 1.2, 0.35, diffuseLight, specularLight );",
      )
      .replace(
        "vec3 outgoingLight = albedo;",
        /* glsl */ `
        // Deep water absorbs red light; grazing angles retain the real sky reflection.
        vec3 deepWater = waterColor * (.17 + .2*daylight);
        albedo = mix(deepWater + albedo*.53, albedo, reflectance*.7+.12);
        float ridge = smoothstep(.26,.56,waveData.x) * smoothstep(.12,.29,length(waveData.yz));
        float foam = ridge * smoothstep(.58,.78,fine) * .13 * daylight;
        vec3 outgoingLight = albedo + vec3(.44,.58,.56)*foam + specularLight*.09;
      `,
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
    this.veilPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
        ...waterVeil.uniforms,
      },
      vertexShader: this.screenPass.material.vertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        varying vec2 vUv;
        ${waterVeilGLSL}
        void main() {
          vec4 lens = waterLens(vUv, resolution.x / resolution.y);
          vec2 uv = clamp(vUv + lens.xy / resolution, .001, .999);
          vec2 split = lens.xy / resolution * .024 * lens.w;
          vec4 color = texture2D(tDiffuse, uv);
          color.r = texture2D(tDiffuse, clamp(uv + split, .001, .999)).r;
          color.b = texture2D(tDiffuse, clamp(uv - split, .001, .999)).b;
          color.rgb *= 1. + lens.z * .23;
          color.rgb += max(lens.z, 0.) * vec3(.035, .042, .045);
          gl_FragColor = color;
        }
      `,
    });
    // ShaderPass clones descriptors; rebind the live state shared with the paper.
    Object.assign(this.veilPass.uniforms, waterVeil.uniforms);
    this.composer.addPass(this.veilPass);
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
    waterVeil.update(delta, reduced);
    this.veilPass.enabled = waterVeil.uniforms.waterCover.value > 0;
    if (!reduced) this.time += delta;
    this.waveTime.value = this.time;
    this.screenPass.uniforms.time.value = this.time;
    this.screenPass.enabled = !reduced;
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.screenPass.uniforms.aspect.value = width / height;
    this.veilPass.uniforms.resolution.value.set(width, height);
  }

  render() {
    this.push.update();
    this.composer.render();
  }
}
