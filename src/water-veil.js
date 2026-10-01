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
  // A curved meniscus bends rays most near the boundary. The signed light term
  // gives a lit upper lip and a darker opposing lip, never a flat outlined ring.
  vec4 waterDrop(vec2 uv, vec2 center, vec2 radius, float phase, float depth, float aspect) {
    vec2 q = (uv - center) * vec2(aspect, 1.) / radius;
    q.x += sin(q.y * 2.7 + phase) * .11;
    q.y += sin(q.x * 3.1 - phase * .8) * .07;
    float d = length(q);
    vec2 normal = q / max(d, .001);
    float inside = 1. - smoothstep(.965, 1.025, d);
    float shoulder = smoothstep(.35, .94, d) * inside;
    float lip = exp(-pow((d - .965) / .037, 2.));
    float incidence = dot(normal, normalize(vec2(-.6, .8)));
    float light = lip * (max(incidence, 0.) * .85 - max(-incidence, 0.) * .45);
    vec2 bend = -normal * shoulder * depth;
    return vec4(bend, light, shoulder);
  }
  // Pixels outside the drops remain sharp. Broad pools and small droplets share
  // one screen-space field across the background and the paper renderer.
  vec4 waterLens(vec2 uv, float aspect) {
    float t = waterTime * .16;
    vec4 glass = vec4(0.);
    float shape = min(aspect, 1.45);
    glass += waterDrop(uv, vec2(.12 + sin(t*.43)*.025, .64 + sin(t*.6)*.035),
      vec2(.24*shape, .30), t, 24., aspect);
    glass += waterDrop(uv, vec2(.79 + sin(t*.51+2.)*.02, .34 + sin(t*.38)*.04),
      vec2(.23*shape, .24), t*.83+3., 21., aspect);
    glass += waterDrop(uv, vec2(.66, 1.02 + sin(t*.4)*.03),
      vec2(.28*shape, .19), t*.7+5., 19., aspect);
    for (int i = 0; i < 7; i++) {
      float f = float(i);
      vec2 center = vec2(fract(f*.381966+.28), fract(f*.618034+.19));
      center += vec2(sin(t*.7+f)*.007, sin(t*.4+f*1.7)*.016);
      float radius = .018 + fract(f*.437)*.025;
      glass += waterDrop(uv, center, vec2(radius, radius*1.17), t*.3+f, 8.+radius*90., aspect);
    }
    float boundary = mix(-.12, 1.12, waterCover);
    float covered = 1. - smoothstep(boundary - .085, boundary + .085,
      uv.y + sin(uv.x*9.+t)*.016);
    glass.xy *= min(waterStrength, 1.55);
    glass.zw = clamp(glass.zw, vec2(-.5, 0.), vec2(1., 1.));
    return glass * covered;
  }
`;
