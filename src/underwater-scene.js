import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const backgroundVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }
`;
const backgroundFragment = /* glsl */ `
  uniform float time;
  uniform float aspect;
  uniform vec2 pointer;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
      mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
  }
  void main() {
    vec2 uv = vUv + pointer * .008;
    float depth = 1. - uv.y;
    vec3 color = mix(vec3(.004, .025, .058), vec3(.07, .32, .37), pow(uv.y, 1.45));
    float water = noise(vec2(uv.x * 9. + time * .045, uv.y * 5. - time * .06));
    color += vec3(.007, .027, .03) * water;

    // Sunlight fans out from points above the surface. Broad shafts contain
    // softer moving filaments, rather than fixed stripes painted on the sky.
    float rays = 0.;
    for (int i = 0; i < 9; i++) {
      float n = float(i);
      float source = .22 + .072 * n;
      float slope = (n - 4.) * .135 + sin(time * .13 + n * 2.7) * .025;
      float center = source + (depth + .1) * slope;
      float width = (.012 + .025 * depth) * (1. + .3 * sin(n * 7.));
      float distance = (uv.x - center) * min(aspect, 1.7);
      float shaft = exp(-pow(distance / width, 2.));
      float filament = .65 + .35 * noise(vec2(uv.x * 65. + n, depth * 3. + time * .16));
      rays += shaft * filament * (.65 + .35 * sin(time * .25 + n * 4.));
    }
    rays *= exp(-depth * 2.5) * smoothstep(0., .12, depth);
    color += vec3(.12, .27, .25) * rays;
    float glow = exp(-pow((uv.x - .48) * aspect * 1.5, 2.) - depth * 8.);
    color += vec3(.20, .35, .30) * glow;

    // Shimmering underside of the surface stays near the top of the view.
    vec2 surface = vec2(uv.x * 22., depth * 85.);
    surface.x += sin(surface.y * .42 + time * .3) * .8;
    float shimmer = pow(max(0., sin(surface.x + sin(surface.y - time * .22))
      * sin(surface.y * .9 + sin(surface.x * .8 + time * .25))), 5.);
    color += vec3(.09, .17, .15) * shimmer * exp(-depth * 18.);
    color *= 1. - .22 * pow(abs(uv.x - .5) * 2., 2.);
    gl_FragColor = vec4(color, 1.);
  }
`;

function fishGeometry() {
  const body = new THREE.SphereGeometry(1, 12, 8);
  body.scale(0.83, 0.24, 0.12);
  const fins = new THREE.BufferGeometry();
  fins.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.65, 0, 0, -1.28, 0.34, 0, -1.13, 0, 0, -0.65, 0, 0, -1.13, 0, 0,
        -1.28, -0.34, 0, 0.15, 0.17, 0, -0.39, 0.43, 0, -0.48, 0.16, 0, -0.05,
        -0.17, 0, -0.43, -0.35, 0, -0.44, -0.12, 0,
      ],
      3,
    ),
  );
  fins.computeVertexNormals();
  const flatBody = body.toNonIndexed();
  flatBody.deleteAttribute("uv");
  const geometry = mergeGeometries([flatBody, fins]);
  body.dispose();
  flatBody.dispose();
  fins.dispose();
  return geometry;
}

// One bounded overlay lets the small bubbles pass in front of project images,
// while fish and shafts remain in the shared 3D background/scene transition.
class BubbleTrail {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "sea-bubbles";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.hidden = true;
    document.body.append(this.canvas);
    this.context = this.canvas.getContext("2d");
    this.items = [];
    this.lastInput = -100;
    this.lastPoint = null;
    this.resize();
  }
  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.ratio = Math.min(devicePixelRatio, 1.5);
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    this.context?.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    this.items.length = 0;
    this.lastPoint = null;
  }
  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    this.canvas.hidden = !active;
    if (!active) {
      this.items.length = 0;
      this.lastPoint = null;
      this.context?.clearRect(0, 0, this.width, this.height);
    }
  }
  emit(x, y, time) {
    if (this.canvas.hidden || !this.context) return;
    const previous = this.lastPoint;
    this.lastPoint = { x, y };
    if (time - this.lastInput < 0.055) return;
    if (previous && Math.hypot(x - previous.x, y - previous.y) < 2) return;
    this.lastInput = time;
    const radius = 2.5 + Math.random() * 4;
    if (this.items.length >= 48) this.items.shift();
    this.items.push({
      x,
      y,
      radius,
      age: 0,
      life: 2.1 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      vx: previous ? THREE.MathUtils.clamp((x - previous.x) * 0.3, -18, 18) : 0,
      speed: 28 + Math.random() * 25,
    });
  }
  update(delta) {
    const ctx = this.context;
    if (this.canvas.hidden || !ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i];
      b.age += delta;
      if (b.age >= b.life || b.y < -15) {
        this.items.splice(i, 1);
        continue;
      }
      b.x +=
        (b.vx * Math.exp(-b.age * 2) + Math.sin(b.age * 3 + b.phase) * 9) *
        delta;
      b.y -= (b.speed + b.age * 9) * delta;
      const radius = b.radius * (1 + b.age * 0.1);
      ctx.globalAlpha =
        Math.min(1, b.age * 9) * Math.min(1, (b.life - b.age) * 1.5) * 0.72;
      const lens = ctx.createRadialGradient(
        b.x - radius * 0.28,
        b.y - radius * 0.3,
        0,
        b.x,
        b.y,
        radius,
      );
      lens.addColorStop(0, "rgba(226,255,253,.08)");
      lens.addColorStop(0.7, "rgba(181,238,244,.015)");
      lens.addColorStop(0.9, "rgba(183,242,248,.20)");
      lens.addColorStop(1, "rgba(233,255,253,.65)");
      ctx.fillStyle = lens;
      ctx.beginPath();
      ctx.ellipse(
        b.x,
        b.y,
        radius,
        radius * 1.08,
        Math.sin(b.age * 3) * 0.12,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.strokeStyle = "rgba(244,255,255,.85)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius * 0.78, Math.PI * 1.07, Math.PI * 1.43);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

export class UnderwaterScene {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.time = { value: 0 };
    this.bubbles = new BubbleTrail();
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: backgroundVertex,
        fragmentShader: backgroundFragment,
        uniforms: {
          time: this.time,
          aspect: { value: innerWidth / innerHeight },
          pointer: { value: new THREE.Vector2() },
        },
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -1000;
    this.group.add(this.backdrop);
    const count = innerWidth < 650 ? 24 : 40;
    const geometry = fishGeometry();
    geometry.setAttribute(
      "phase",
      new THREE.InstancedBufferAttribute(
        Float32Array.from({ length: count }, (_, i) => i * 2.399),
        1,
      ),
    );
    const material = new THREE.ShaderMaterial({
      uniforms: { time: this.time },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        uniform float time;
        attribute float phase;
        varying vec3 vNormal;
        varying float distanceToCamera;
        void main() {
          vec3 p = position;
          float tail = 1. - smoothstep(-1.2, .25, p.x);
          p.z += sin(time * 7.5 + phase + p.x * 2.8) * .24 * tail * tail;
          vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.);
          vec4 view = viewMatrix * world;
          vNormal = mat3(modelMatrix * instanceMatrix) * normal;
          distanceToCamera = -view.z;
          gl_Position = projectionMatrix * view;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying float distanceToCamera;
        void main() {
          float light = pow(max(0., normalize(vNormal).y), 2.);
          vec3 fish = mix(vec3(.011, .065, .075), vec3(.12, .27, .28), light);
          float haze = smoothstep(22., 75., distanceToCamera);
          gl_FragColor = vec4(mix(fish, vec3(.025, .16, .20), haze * .85), 1.);
        }
      `,
    });
    this.fish = new THREE.InstancedMesh(geometry, material, count);
    this.fish.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fish.frustumCulled = false;
    this.group.add(this.fish);
    this.transform = new THREE.Object3D();
    this.update(0, 0, new THREE.Vector2());
  }
  resize() {
    this.backdrop.material.uniforms.aspect.value = innerWidth / innerHeight;
    this.bubbles.resize();
  }
  setActive(active) {
    this.group.visible = active;
    this.bubbles.setActive(false);
  }
  update(time, delta, pointer) {
    this.time.value = time;
    this.backdrop.material.uniforms.pointer.value.copy(pointer);
    for (let i = 0; i < this.fish.count; i++) {
      const school = i % 3;
      const direction = school === 1 ? -1 : 1;
      const seed = Math.sin(i * 73.13) * 0.5 + 0.5;
      const x = ((i * 3.17 + time * (0.62 + school * 0.13)) % 64) - 32;
      this.transform.position.set(
        x * direction,
        (school === 0 ? 13 : school === 1 ? 7 : -1) +
          seed * 3 +
          Math.sin(time * 0.65 + i) * 0.22,
        -10 - school * 8 - seed * 5,
      );
      this.transform.rotation.set(
        0,
        direction === 1 ? 0.1 : Math.PI - 0.1,
        Math.cos(time * 0.65 + i) * 0.025,
      );
      this.transform.scale.setScalar(0.22 + seed * 0.13);
      this.transform.updateMatrix();
      this.fish.setMatrixAt(i, this.transform.matrix);
    }
    this.fish.instanceMatrix.needsUpdate = true;
    this.bubbles.update(delta);
  }
}
