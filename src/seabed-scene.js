import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createShipwreck } from "./shipwreck.js";
import { createSeabedRuins, createSeabedShafts } from "./seabed-ruins.js";
import { loadSeabedAssets } from "./seabed-assets.js";

const mound = (x, z, cx, cz, sx, sz) => Math.exp(-(((x-cx)/sx)**2 + ((z-cz)/sz)**2));
// Sculpted banks frame a winding sandy channel and a level resting place for the wreck.
export function sandHeight(x, z) {
  const channel = x - (2.8 * Math.sin(z*.085) + 1.2 * Math.sin(z*.19));
  const dunes = Math.sin(z*.24 + x*.10 + Math.sin(x*.13)*1.2)*.55
    + Math.sin(z*.48 - x*.18)*.17;
  const banks = 3.6*mound(x,z,-15,-14,10,15) + 4.3*mound(x,z,19,-30,12,18)
    + 2.5*mound(x,z,-25,-58,18,13) + 2.1*mound(x,z,13,5,7,11);
  const gully = 1.5 * Math.exp(-((channel/3.9)**2));
  const terrain = -25.5 + dunes + banks - gully;
  const berth = Math.exp(-((x/15)**4 + ((z+42)/8)**4));
  return THREE.MathUtils.lerp(terrain, -25.7, berth*.94);
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
    #ifdef USE_COLOR
      tint *= color;
    #endif
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
  uniform float wood;
  uniform vec3 baseColor;
  varying vec3 world;
  varying vec3 surfaceNormal;
  varying vec3 tint;
  varying float distanceToEye;
  vec2 cellHash(vec2 p) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
  }
  float waterLight(vec2 p) {
    // Advected, curved cellular folds instead of intersecting sinusoidal grid lines.
    p += vec2(sin(p.y*1.31+time*.19)+sin(p.y*.57-p.x*.39-time*.13),
      cos(p.x*1.17-time*.16)+sin(p.y*.43+p.x*.71+time*.11))*.62;
    p += vec2(sin(p.y*3.1+p.x*.7-time*.21),cos(p.x*2.8-p.y*.6+time*.17))*.19;
    vec2 cell=floor(p), local=fract(p);
    float first=8., second=8.;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
      vec2 offset=vec2(float(x),float(y));
      vec2 seed=cellHash(cell+offset);
      vec2 site=.5+.37*sin(seed*6.2831+time*.23);
      float d=length(offset+site-local);
      second=min(second,max(first,d)); first=min(first,d);
    }
    float edge=second-first;
    float aa=max(fwidth(edge),.009);
    float shimmer=.5+.5*sin(p.x*1.9+p.y*.73+time*.47);
    float fold=1.-smoothstep(.006,.035+.038*shimmer+aa,edge);
    return fold*smoothstep(.10,.85,shimmer);
  }
  void main() {
    vec3 n = normalize(surfaceNormal);
    if (!gl_FrontFacing) n = -n;
    float lighting = .19 + .81 * max(0., dot(n, normalize(vec3(.35, 1., .25))));
    float ripplePhase = world.z * 6.1 + sin(world.x * .34 + world.z * .15) * 2.7;
    float ripple = sin(ripplePhase) * exp(-fwidth(ripplePhase)*.8);
    float sediment = .96 + .035*sin(world.x*.35+world.z*.18);
    float detail = mix(1., sediment + .028 * ripple, sand);
    float grain = sin(world.y * 27. + sin(world.x * .63 + world.z * .28) * 2.);
    detail *= 1. - wood * (.07 + .05 * grain);
    float caustic = waterLight(world.xz*.49 + vec2(time*.025,-time*.018));
    vec3 color = baseColor * tint * detail * lighting * (.22 + daylight * .78);
    color += vec3(.30, .52, .43) * caustic * (.018 + daylight * .14) * max(.1, n.y);
    color += vec3(.012, .045, .05) * night;
    vec3 haze = mix(vec3(.012, .115, .16), vec3(.004, .017, .035), night);
    float fog = 1. - exp(-max(0., distanceToEye - 10.) * .021);
    color *= .76 + .24*smoothstep(-26.,-16.,world.y);
    color = mix(color, haze, fog);
    gl_FragColor = vec4(color, reveal);
    // The shared scene OutputPass applies tone mapping and display conversion.
  }
`;

export class SeabedScene {
  constructor(day, time) {
    this.day=day;
    this.time=time;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.reveal = { value: 0 };
    this.materials = [];
    const material = (color, sand = 0, sway = 0, wood = 0) => {
      const m = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
        side: THREE.DoubleSide, transparent: true, uniforms: { time, reveal: this.reveal, daylight: day.uniforms.daylight,
          night: day.uniforms.night, baseColor: {value:new THREE.Color(color)},
          sand: {value:sand}, sway: {value:sway}, wood: {value:wood} } });
      this.materials.push(m);
      return m;
    };
    const terrain = new THREE.PlaneGeometry(200, 200, 220, 220);
    terrain.rotateX(-Math.PI / 2);
    terrain.translate(0, 0, -45);
    const positions = terrain.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setY(i, sandHeight(positions.getX(i), positions.getZ(i)));
    terrain.computeVertexNormals();
    this.floor = new THREE.Mesh(terrain, material("#a9b9a5", 1));
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
    const habitats = Array.from({length:32}, () => {
      const z=9-random()*76;
      const x=(random()<.48?-1:1)*(5+random()*27);
      return {x,z};
    });
    this.rocks = new THREE.InstancedMesh(stone, material("#789a92"), 176);
    for (let i = 0; i < this.rocks.count; i++) {
      const patch = habitats[i%habitats.length];
      const x = patch.x+(random()-.5)*5, z = patch.z+(random()-.5)*4;
      const size = .10 + random() ** 2 * 1.05;
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
      const patch = habitats[Math.floor(i/24)%habitats.length];
      const x = patch.x + (random() - .5) * 5;
      const z = patch.z + (random() - .5) * 4;
      pose.position.set(x, sandHeight(x, z) - .06, z);
      const height = .25 + random() ** 1.5 * 1.1;
      pose.scale.set(.4 + random()*.65, height, 1);
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
    this.coral = new THREE.InstancedMesh(stem, material("#b88b89", 0, .018), 68);
    for (let i = 0; i < this.coral.count; i++) {
      const patch = habitats[Math.floor(i/4)%habitats.length];
      const x = patch.x+(random()-.5)*3;
      const z = patch.z+(random()-.5)*3;
      const angle = i * 2.399;
      const h = .18 + random() * .40;
      pose.position.set(x, sandHeight(x, z) -.03, z);
      pose.rotation.set(0, angle, 0);
      pose.scale.setScalar(h); pose.updateMatrix(); this.coral.setMatrixAt(i, pose.matrix);
    }
    this.group.add(this.coral);
    this.wreck = createShipwreck(material);
    this.wreck.position.set(0, sandHeight(0,-42) - .55, -42);
    this.wreck.rotation.set(.13,-.23,-.035);
    this.group.add(this.wreck);
    this.ruins = createSeabedRuins(material, sandHeight);
    this.group.add(this.ruins, createSeabedShafts(day, time, this.reveal));
    this.resize();
  }
  async prepare(renderer) {
    try {
      const models=await loadSeabedAssets(this.day,this.time,this.reveal,renderer);
      const oldWreck=this.wreck;
      this.wreck=models.wreck;
      this.wreck.position.copy(oldWreck.position);
      this.wreck.rotation.copy(oldWreck.rotation);
      this.group.remove(oldWreck);
      this.group.add(this.wreck);
      const oldStone=this.ruins.getObjectByName("ruin-stone");
      this.ruins.remove(oldStone);
      this.ruins.add(models.ruins);
      for(const root of [oldWreck,oldStone]) root.traverse(mesh=>{
        if(mesh.isMesh) {mesh.geometry.dispose();mesh.material.dispose();}
      });
      this.resize();
      this.group.userData.assetQuality="blender";
    } catch(error) {
      console.warn("Detailed seabed assets could not load; retaining the complete fallback scene.",error);
      this.group.userData.assetQuality="fallback";
    }
  }
  resize(width = typeof innerWidth === "number" ? innerWidth : 1280) {
    // Keep the complete silhouette in the mobile view's much narrower frustum.
    this.wreck.scale.setScalar(1.22 * THREE.MathUtils.clamp(width / 660, .50, 1));
    // Bring the flanking architecture into portrait view, retaining its height.
    this.ruins.scale.x = THREE.MathUtils.clamp(width / 780, .52, 1);
  }
  setDepth(depth) {
    this.group.visible = depth > .015;
    this.reveal.value = THREE.MathUtils.smoothstep(depth, .015, .22);
  }
}
