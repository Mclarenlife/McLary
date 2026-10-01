// Shared optical state: the sea and the separate paper renderer see one water layer.
const smooth = (x) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
export class WaterVeilState {
  constructor() {
    this.uniforms = {
      waterCover: { value: 0 },
      waterStrength: { value: 1 },
      waterTime: { value: 0 },
    };
  }
  settle(page) {
    this.crossing = null;
    this.uniforms.waterCover.value = page === "work" ? 1 : 0;
    this.uniforms.waterStrength.value = 1;
  }
  cross(direction) {
    this.crossing = { direction, elapsed: 0 };
    this.uniforms.waterCover.value = direction > 0 ? 0 : 1;
  }
  update(delta, reduced) {
    if (reduced) {
      if (this.crossing)
        this.settle(this.crossing.direction > 0 ? "work" : "index");
      return;
    }
    this.uniforms.waterTime.value += delta;
    if (!this.crossing) return;
    this.crossing.elapsed += delta;
    const { direction, elapsed } = this.crossing;
    const travel = smooth((elapsed - 0.38) / (direction > 0 ? 1.2 : 2.25));
    this.uniforms.waterCover.value = direction > 0 ? travel : 1 - travel;
    this.uniforms.waterStrength.value =
      1 +
      1.25 *
        smooth((elapsed - 0.38) / 0.35) *
        (1 - smooth((elapsed - 1.05) / 1.7));
    if (elapsed >= 3.15) this.settle(direction > 0 ? "work" : "index");
  }
}
export const waterVeil = new WaterVeilState();

export const waterVeilGLSL = /* glsl */ `
  uniform float waterCover;
  uniform float waterStrength;
  uniform float waterTime;
  // uv has its origin at the bottom: decreasing cover clears top to bottom.
  vec3 waterLens(vec2 uv, float aspect) {
    float t = waterTime * .34;
    vec2 p = vec2(uv.x * aspect, uv.y);
    float a = sin(p.x * 5.4 + p.y * 3.1 - t);
    float b = sin(p.x * -3.7 + p.y * 7.8 + t * .73 + a * .7);
    float c = sin(p.x * 8.3 - p.y * 4.2 - t * .61 + b * .5);
    float wave = a * .5 + b * .32 + c * .18;
    float boundary = mix(-.12, 1.12, waterCover);
    float covered = 1. - smoothstep(boundary - .085, boundary + .085,
      uv.y + wave * .022);
    float focus = .5 + .5 * sin(p.x * 4.1 + p.y * 5.7 + t * .9 + wave);
    vec2 displacement = vec2(b * .7 + c * .3, a * .55 - c * .45);
    return vec3(displacement * (2.1 + focus * 2.8), .85 + focus * 1.8)
      * covered * waterStrength;
  }
`;
