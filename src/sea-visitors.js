import * as THREE from "three";
import { loadMarineModel } from "./marine-models.js";

// The whole body bends continuously: lateral shark propulsion, vertical whale
// propulsion, and the turtle's paired rowing flippers.
const bend = (kind) => /* glsl */ `
  uniform float swimTime;
  vec3 swim(vec3 p) {
    ${
      kind === "turtle"
        ? `
      float fin = smoothstep(.55, 1.65, abs(p.z));
      p.y += sin(swimTime * 1.65 - abs(p.z) * 1.15) * fin * .34;
      p.x += cos(swimTime * 1.65 - abs(p.z)) * fin * .09;
    `
        : `
      float tail = pow(1. - smoothstep(-3.4, 1.5, p.x), 2.);
      p.${kind === "whale" ? "y" : "z"} += sin(swimTime * ${kind === "whale" ? "1.5" : "2.5"} + p.x * 1.35) * tail * .40;
    `
    }
    return p;
  }
`;

export class SeaVisitors {
  constructor() {
    this.group = new THREE.Group();
    this.time = 0;
    this.swimTime = { value: 0 };
    this.creatures = ["whale", "shark", "turtle"].map((kind) => {
      const creature = new THREE.Group();
      creature.userData.kind = kind;
      creature.visible = false;
      this.group.add(creature);
      return creature;
    });
  }
  async prepare() {
    await Promise.all(
      this.creatures.map(async (creature) => {
        const kind = creature.userData.kind;
        const model = await loadMarineModel(kind);
        model.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const material = mesh.material;
          material.fog = false;
          material.roughness = Math.max(0.4, material.roughness);
          material.onBeforeCompile = (shader) => {
            shader.uniforms.swimTime = this.swimTime;
            shader.vertexShader = bend(kind) + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <begin_vertex>",
              `vec3 transformed = swim(position);`,
            );
            shader.vertexShader = shader.vertexShader.replace(
              "#include <beginnormal_vertex>",
              `
            vec3 base = swim(position);
            vec3 dx = (swim(position+vec3(.005,0,0))-base)/.005;
            vec3 dy = (swim(position+vec3(0,.005,0))-base)/.005;
            vec3 dz = (swim(position+vec3(0,0,.005))-base)/.005;
            vec3 objectNormal = normalize(mat3(cross(dy,dz),cross(dz,dx),cross(dx,dy))*normal);
          `,
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <opaque_fragment>",
              `
            float depthHaze = 1.-exp(-length(vViewPosition)*.024);
            outgoingLight = mix(outgoingLight*.65, vec3(.016,.13,.17), depthHaze*.80);
            #include <opaque_fragment>
          `,
            );
          };
          material.customProgramCacheKey = () => `marine-swim-${kind}-v1`;
          mesh.frustumCulled = false;
        });
        creature.add(model);
      }),
    );
  }
  update(delta) {
    this.time += delta;
    this.swimTime.value = this.time;
    const cycle = this.time % 86;
    this.creatures.forEach((creature, i) => {
      const start = [4, 32, 57][i],
        duration = [23, 19, 23][i];
      const progress = (cycle - start) / duration;
      creature.visible = progress >= 0 && progress <= 1;
      if (!creature.visible) return;
      const direction = i === 1 ? -1 : 1;
      creature.position.set(
        (-37 + progress * 74) * direction,
        [15.6, 12.6, 11.6][i] + Math.sin(progress * Math.PI * 2) * 1.3,
        [-29, -17, -13][i],
      );
      creature.rotation.set(
        i === 2 ? 0.42 : 0.04,
        direction === 1 ? -0.22 : Math.PI + 0.22,
        Math.cos(progress * Math.PI * 2) * 0.04,
      );
      creature.scale.setScalar([1.45, 1.05, 1.15][i]);
    });
  }
}
