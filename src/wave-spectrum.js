// Direction, angular frequency, speed and amplitude. Shared by the GPU surface
// and the boat's buoyancy so larger swells never leave the hull hovering.
export const waveSpectrum = [
  [0.94, 0.34, 0.18, -0.46, 0.32],
  [0.62, 0.78, 0.327, -0.61, 0.19],
  [-0.38, 0.92, 0.573, -0.83, 0.1],
  [0.87, -0.49, 1.113, -1.13, 0.053],
  [0.23, 0.97, 1.937, -1.54, 0.029],
  [-0.57, 0.82, 3.713, -2.1, 0.013],
];
const glslNumber = (value) =>
  Number.isInteger(value) ? `${value}.0` : String(value);
export const waveFieldGLSL = waveSpectrum
  .map(
    ([x, z, f, s, a]) =>
      `field += wave(p, vec2(${glslNumber(x)},${glslNumber(z)}),${glslNumber(f)},${glslNumber(s)},${glslNumber(a)});`,
  )
  .join("\n");

export function sampleWaveField(x, z, time, swell = 1) {
  let height = 0,
    dx = 0,
    dz = 0;
  for (const [vx, vz, f, s, a] of waveSpectrum) {
    const cx = -vz,
      cz = vx,
      cross = x * cx + z * cz;
    const packetPhase = cross * f * 0.19 + time * 0.11 + f * 7;
    const packet = 0.64 + 0.36 * Math.sin(packetPhase);
    const packetSlope = f * 0.19 * 0.36 * Math.cos(packetPhase);
    const bend = cross * f * 0.31 - time * 0.09;
    const phase = (x * vx + z * vz) * f + time * s + 0.65 * Math.sin(bend);
    const bendSlope = f * 0.31 * 0.65 * Math.cos(bend);
    height += Math.sin(phase) * a * packet;
    dx +=
      a *
      (Math.cos(phase) * (vx * f + cx * bendSlope) * packet +
        Math.sin(phase) * cx * packetSlope);
    dz +=
      a *
      (Math.cos(phase) * (vz * f + cz * bendSlope) * packet +
        Math.sin(phase) * cz * packetSlope);
  }
  return { height: height * swell, dx: dx * swell, dz: dz * swell };
}
