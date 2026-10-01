// Authored stereo impulse response for the submerged sound design, not a field recording.
// Each delayed reflection is progressively darker and more diffuse.
export function createUnderwaterImpulse(ctx) {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(2, Math.round(rate * 3.2), rate);
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let tap = 0; tap < 18; tap++) {
      const delay =
        0.065 +
        tap * 0.067 +
        tap * tap * 0.005 +
        channel * (0.004 + (tap % 3) * 0.003);
      const level = Math.exp(-delay / 1.05);
      const alpha = 1 - Math.exp((-2 * Math.PI * (1600 - tap * 55)) / rate);
      for (let scatter = 0; scatter < 3; scatter++) {
        const start = Math.round(
          (delay + scatter * (0.003 + tap * 0.0003)) * rate,
        );
        let reflection = alpha * level * [0.5, 0.3, 0.2][scatter];
        for (let j = 0; j < rate * 0.025 && start + j < samples.length; j++) {
          samples[start + j] += reflection;
          reflection *= 1 - alpha;
        }
      }
    }
    // Known DC gain caps convolution peaks and makes dry/wet levels predictable.
    const sum = samples.reduce((total, value) => total + Math.abs(value), 0);
    for (let i = 0; i < samples.length; i++) samples[i] *= 1.6 / sum;
  }
  return buffer;
}
