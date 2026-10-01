// Shared screen-space bubbles refract both the sea and the paper renderer.
export const BUBBLE_COUNT = 40;
const fract = (x) => x - Math.floor(x);
export function bubbleAt(index, time) {
  const seed = fract(index * 0.754877666 + 0.17);
  const delay = fract(index * 0.618033989) * 1.1;
  const age = Math.max(0, time - delay);
  const speed = 0.28 + fract(index * 0.56984029) * 0.23;
  const radius = 0.012 + seed * seed * 0.028;
  return [
    0.045 +
      fract(index * 0.381966011 + 0.23) * 0.91 +
      Math.sin(time * 0.7 + index * 2.3) * 0.014,
    -0.1 + age * speed + age * age * 0.023,
    radius,
    1 + Math.sin(time * 1.7 + index * 1.3) * 0.06,
  ];
}
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
      waterBubbles: { value: new Float32Array(BUBBLE_COUNT * 4) },
      bubblePresence: { value: 0 },
    };
    this.refreshBubbles();
  }
  refreshBubbles() {
    for (let i = 0; i < BUBBLE_COUNT; i++)
      this.uniforms.waterBubbles.value.set(
        bubbleAt(i, this.burstAge ?? -1),
        i * 4,
      );
  }
  settle(page) {
    const entering = page === "work" && this.page !== "work";
    this.page = page;
    this.crossing = null;
    this.uniforms.waterCover.value = page === "work" ? 1 : 0;
    this.uniforms.waterStrength.value = 1;
    if (entering) this.burst();
    else if (page !== "work") this.stopBubbles();
  }
  burst(delay = 0) {
    this.burstAge = -delay;
    this.uniforms.bubblePresence.value = 1;
    this.refreshBubbles();
  }
  stopBubbles() {
    this.burstAge = null;
    this.uniforms.bubblePresence.value = 0;
  }
  cross(direction) {
    if (direction > 0) this.page = "work";
    this.crossing = { direction, elapsed: 0 };
    this.uniforms.waterCover.value = direction > 0 ? 0 : 1;
    if (direction > 0) this.burst(0.38);
    else this.stopBubbles();
  }
  update(delta, reduced) {
    if (reduced) {
      if (this.crossing)
        this.settle(this.crossing.direction > 0 ? "work" : "index");
      this.stopBubbles();
      return;
    }
    this.uniforms.waterTime.value += delta;
    if (this.burstAge !== null && this.burstAge !== undefined) {
      this.burstAge += delta;
      this.refreshBubbles();
      if (this.burstAge > 5.8) this.stopBubbles();
    }
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
  uniform float bubblePresence;
  uniform vec4 waterBubbles[${BUBBLE_COUNT}];
  vec4 bubbleLens(vec2 uv, vec4 bubble, float aspect) {
    vec2 q = (uv - bubble.xy) * vec2(aspect, bubble.w) / bubble.z;
    // Most pixels are outside each small lens: avoid expensive optical work.
    if (abs(q.x) > 1.05 || abs(q.y) > 1.05) return vec4(0.);
    float angle = atan(q.y, q.x + .000001);
    q *= 1. + .028 * sin(angle * 3. + waterTime * 1.2 + bubble.x * 11.);
    float d = length(q);
    if (d > 1.05) return vec4(0.);
    vec2 normal = q / max(d, .001);
    float inside = 1. - smoothstep(.94, 1.04, d);
    float z = sqrt(max(0., 1. - d*d));
    // Refraction spans the curved interior, with a clear axial center and a
    // stronger grazing rim. Broad curvature avoids an empty outlined circle.
    float fresnel = pow(1. - z, 3.);
    float shoulder = d * (.78 * z + fresnel * .85) * inside;
    float lip = exp(-pow((d - .973) / .025, 2.));
    float incidence = dot(normal, normalize(vec2(-.6, .8)));
    float light = lip * (.1 + max(incidence, 0.) * .48 - max(-incidence, 0.) * .14);
    vec2 highlight = (q - vec2(-.38,.58)) * vec2(1.1, 1.8);
    float glint = exp(-dot(highlight, highlight) * 48.) * .85;
    float reflection = pow(max(dot(vec3(q, z), normalize(vec3(-.45,.65,.6))), 0.), 22.) * .2;
    light += (glint + reflection) * inside;
    // Air in water produces a diverging lens with a stronger curved rim.
    vec2 bend = normal * shoulder * (8. + bubble.z * 360.);
    float film = smoothstep(.06, .55, d) * (.35 + fresnel * .65) * inside;
    return vec4(bend, light, film);
  }
  // Independent sizes, rising speeds and sideways drift avoid rows or a looped sheet.
  vec4 waterLens(vec2 uv, float aspect) {
    if (bubblePresence < .5) return vec4(0.);
    float t = waterTime * .16;
    vec4 glass = vec4(0.);
    for (int i = 0; i < ${BUBBLE_COUNT}; i++)
      glass += bubbleLens(uv, waterBubbles[i], aspect);
    float boundary = mix(-.12, 1.12, waterCover);
    float covered = 1. - smoothstep(boundary - .085, boundary + .085,
      uv.y + sin(uv.x*9.+t)*.016);
    glass.xy *= min(waterStrength, 1.55);
    glass.zw = clamp(glass.zw, vec2(-.5, 0.), vec2(1., 1.));
    return glass * covered;
  }
  // A broad, soft film spectrum follows the curved interior and grazing rim.
  vec3 bubbleSpectrum(vec4 lens) {
    if (lens.w < .00001) return vec3(0.);
    float phase = atan(lens.y, lens.x + .000001) * 1.5 + length(lens.xy) * .28 + waterTime * .3;
    vec3 spectrum = .5 + .5 * cos(phase + vec3(0., 2.1, 4.2));
    // Signed tint stays visible against light cards without whitening the core.
    return (spectrum - .4) * lens.w * .20;
  }
`;
