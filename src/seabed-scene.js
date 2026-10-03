import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// One continuous, low-frequency landscape; no tiled bitmap or screen grain.
export function sandHeight(x, z) {
  return -25 + Math.sin(x * .12 + z * .045) * .65
    + Math.cos(z * .10 - x * .035) * .85
    + Math.sin(x * .27 + z * .16) * .12;
}
const vertex = /* glsl */ `
  uniform float time;
  uniform float sway;
  varying vec3 world;
  varying vec3 surfaceNormal;
  varying vec3 tint;
  varying float distanceToEye;
  void main() {
    vec3 p = position;
    #ifdef USE_INSTANCING
      vec3 anchor = instanceMatrix[3].xyz;
      float flex = pow(max(0., p.y), 1.7);
      p.x += sin(time * .8 + anchor.x * .31 + anchor.z * .17 + p.y * 1.4) * flex * sway;
      p.z += cos(time * .63 + anchor.x * .21 + p.y * 1.8) * flex * sway * .6;
      vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.);
      surfaceNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    #else
      vec4 w = modelMatrix * vec4(p, 1.);
      surfaceNormal = normalize(mat3(modelMatrix) * normal);
    #endif
    tint = vec3(1.);
    #ifdef USE_INSTANCING_COLOR
      tint = instanceColor;
    #endif
    world = w.xyz;
    vec4 view = viewMatrix * w;
    distanceToEye = length(view.xyz);
    gl_Position = projectionMatrix * view;
  }
`;
const fragment = /* glsl */ `
  uniform float time;
  uniform float daylight;
  uniform float night;
  uniform float sand;
  uniform float reveal;
  uniform vec3 baseColor;
  varying vec3 world;
  varying vec3 surfaceNormal;
  varying vec3 tint;
  varying float distanceToEye;
  void main() {
    vec3 n = normalize(surfaceNormal);
    if (!gl_FrontFacing) n = -n;
    float lighting = .35 + .65 * max(0., dot(n, normalize(vec3(-.4, 1., .3))));
    float ripplePhase = world.z * 4.1 + sin(world.x * .6 + world.z * .15) * 1.7;
    float ripple = sin(ripplePhase);
    float detail = mix(1., .93 + .07 * ripple, sand);
    vec2 q = world.xz * .46;
    q += vec2(sin(q.y * .7 + time * .3), cos(q.x * .6 - time * .24)) * .5;
    float field = sin(q.x * 2.1 + q.y + time * .25) + sin(q.y * 2.7 - q.x * .7 - time * .32);
    float caustic = pow(max(0., 1. - abs(field) * .8), 9.);
    vec3 color = baseColor * tint * detail * lighting * (.22 + daylight * .78);
    color += vec3(.28, .55, .49) * caustic * (.08 + daylight * .28) * max(.1, n.y);
    color += vec3(.012, .045, .05) * night;
    vec3 haze = mix(vec3(.012, .095, .115), vec3(.004, .017, .035), night);
    float fog = 1. - exp(-max(0., distanceToEye - 7.) * .039);
    color = mix(color, haze, fog);
    gl_FragColor = vec4(color, reveal);
    // The shared scene OutputPass applies tone mapping and display conversion.
  }
`;

export class SeabedScene {
  constructor(day, time) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.reveal = { value: 0 };
    this.materials = [];
    const material = (color, sand = 0, sway = 0) => {
      const m = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
        side: THREE.DoubleSide, transparent: true, uniforms: { time, reveal: this.reveal, daylight: day.uniforms.daylight,
          night: day.uniforms.night, baseColor: {value:new THREE.Color(color)},
          sand: {value:sand}, sway: {value:sway} } });
      this.materials.push(m);
      return m;
    };
    const terrain = new THREE.PlaneGeometry(200, 200, 160, 160);
    terrain.rotateX(-Math.PI / 2);
    terrain.translate(0, 0, -45);
    const positions = terrain.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setY(i, sandHeight(positions.getX(i), positions.getZ(i)));
    terrain.computeVertexNormals();
    this.floor = new THREE.Mesh(terrain, material("#91b7a5", 1));
    this.group.add(this.floor);

    // Rounded eroded stone, shared geometry with varied proportions and colour.
    const stone = new THREE.SphereGeometry(1, 22, 14);
    const p = stone.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const warp = 1 + .12 * Math.sin(x * 5 + z * 3) * Math.cos(y * 4 - z * 2);
      p.setXYZ(i, x * warp, y * warp, z * warp);
    }
    stone.computeVertexNormals();
    const random = (() => { let s = 2811; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    const pose = new THREE.Object3D();
    this.rocks = new THREE.InstancedMesh(stone, material("#789a92"), 64);
    for (let i = 0; i < this.rocks.count; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (7 + random() * 29), z = 11 - random() * 66;
      const size = .45 + random() ** 2 * 4;
      pose.position.set(x, sandHeight(x, z) - size * .22, z);
      pose.scale.set(size * 1.5, size * (.45 + random() * .55), size);
      pose.rotation.set(random() * .35, random() * 6.28, random() * .2);
      pose.updateMatrix(); this.rocks.setMatrixAt(i, pose.matrix);
      this.rocks.setColorAt(i, new THREE.Color().setHSL(.44 + random() * .08, .12, .55 + random() * .2));
    }
    this.group.add(this.rocks);

    // Tapered ribbons bend from their planted roots, rather than rigid rotating cards.
    const blade = new THREE.PlaneGeometry(.20, 1, 2, 12);
    blade.translate(0, .5, 0);
    const b = blade.attributes.position;
    for (let i = 0; i < b.count; i++) {
      const h = b.getY(i);
      b.setX(i, b.getX(i) * Math.sin(Math.PI * (h * .96 + .02)));
      b.setZ(i, Math.sin(h * 2.5) * .13);
    }
    blade.computeVertexNormals();
    this.grass = new THREE.InstancedMesh(blade, material("#548a77", 0, .16), 720);
    for (let i = 0; i < this.grass.count; i++) {
      const cluster = Math.floor(i / 18);
      const side = cluster % 2 ? 1 : -1;
      const x = side * (5.5 + (cluster * 5.713 % 25)) + (random() - .5) * 3;
      const z = 13 - (cluster * 7.321 % 62) + (random() - .5) * 3;
      pose.position.set(x, sandHeight(x, z) - .06, z);
      const height = .7 + random() * 2.4;
      pose.scale.set(.7 + random(), height, 1);
      pose.rotation.set(0, random() * 6.28, (random() - .5) * .2);
      pose.updateMatrix(); this.grass.setMatrixAt(i, pose.matrix);
      this.grass.setColorAt(i, new THREE.Color().setHSL(.39 + random() * .08, .35, .50 + random() * .25));
    }
    this.group.add(this.grass);

    // Small branching coral colonies; muted mineral colour keeps the landscape calm.
    const branches = [];
    const tube = (points, radius) => {
      branches.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 10, radius, 6, false));
      const tip = new THREE.SphereGeometry(radius, 6, 5);
      tip.translate(...points.at(-1)); branches.push(tip);
    };
    for(let arm=0; arm<5; arm++) {
      const a = arm * 2.399;
      const x = Math.cos(a), z = Math.sin(a);
      tube([[0,0,0],[x*.17,.4,z*.17],[x*.38,.9,z*.38],[x*.55,1.4,z*.55]], .055);
      for(let j=0;j<3;j++) {
        const y=.5+j*.24, side=j%2?1:-1;
        const bx=x*y*.4,bz=z*y*.4;
        tube([[bx,y,bz],[bx+z*.2*side,y+.2,bz-x*.2*side],[bx+z*.35*side,y+.5,bz-x*.35*side]],.03);
      }
    }
    const stem = mergeGeometries(branches);
    branches.forEach(g => g.dispose());
    this.coral = new THREE.InstancedMesh(stem, material("#b88b89", 0, .018), 22);
    for (let i = 0; i < this.coral.count; i++) {
      const cluster = i;
      const x = (cluster % 2 ? -1 : 1) * (6 + cluster * 3.07 % 17);
      const z = 4 - (cluster * 4.71 % 38);
      const angle = i * 2.399;
      const h = .5 + random() * .9;
      pose.position.set(x, sandHeight(x, z) -.03, z);
      pose.rotation.set(0, angle, 0);
      pose.scale.setScalar(h); pose.updateMatrix(); this.coral.setMatrixAt(i, pose.matrix);
    }
    this.group.add(this.coral);
  }
  setDepth(depth) {
    this.group.visible = depth > .015;
    this.reveal.value = THREE.MathUtils.smoothstep(depth, .015, .22);
  }
}
