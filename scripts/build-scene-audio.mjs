import fs from "node:fs";
// Original procedural score and water Foley; no external recordings.
const rate = 22050;
let seed = 1717;
const random = () =>
  ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
function write(name, channels, peak) {
  const frames = channels[0].length;
  let max = 0;
  for (const c of channels) for (const v of c) max = Math.max(max, Math.abs(v));
  const wav = Buffer.alloc(44 + frames * 4);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < 2; c++)
      wav.writeInt16LE(
        Math.round((channels[c][i] / max) * peak * 32767),
        44 + i * 4 + c * 2,
      );
  fs.writeFileSync(`public/audio/${name}.wav`, wav);
  console.log(name, { seconds: frames / rate, peak, bytes: wav.length });
}
const space = [new Float64Array(rate * 72), new Float64Array(rate * 72)];
function tone(pitch, start, duration, level, pan, bell = false) {
  const hz = midi(pitch);
  for (let i = 0; i < duration * rate; i++) {
    const t = i / rate,
      u = t / duration;
    const envelope = bell
      ? (1 - Math.exp(-t / 0.3)) * Math.exp(-t / 3.4) * (1 - u) ** 2
      : Math.sin(Math.PI * u) ** 2;
    const phase = 2 * Math.PI * hz * t;
    const sample =
      level *
      envelope *
      (Math.sin(phase + 0.12 * Math.sin(t * 0.7)) +
        0.12 * Math.sin(phase * (bell ? 2.003 : 2)));
    const index = (Math.round(start * rate) + i) % space[0].length;
    space[0][index] += sample * Math.sqrt((1 - pan) / 2);
    space[1][index] += sample * Math.sqrt((1 + pan) / 2);
  }
}
[
  [48, 55, 62],
  [44, 51, 58],
  [51, 58, 65],
  [46, 53, 60],
  [48, 55, 62],
  [43, 50, 57],
].forEach((chord, i) => {
  chord.forEach((pitch, j) =>
    tone(pitch, i * 12 + j * 0.7, 20, 0.05, (j - 1) * 0.4),
  );
  tone(chord[2] + 12, i * 12 + 5, 12, 0.09, Math.sin(i * 2) * 0.45, true);
});
write("distant-orbit", space, 0.42);
for (const entering of [true, false]) {
  const duration = entering ? 2.4 : 2.2;
  const channels = [
    new Float64Array(Math.round(rate * duration)),
    new Float64Array(Math.round(rate * duration)),
  ];
  for (let c = 0; c < 2; c++) {
    let low = 0;
    for (let i = 0; i < channels[c].length; i++) {
      const t = i / rate,
        u = t / duration;
      const cutoff = entering
        ? 2400 * Math.exp(-u * 5) + 160
        : 200 + 2400 * u ** 0.7;
      low += (random() - low) * (1 - Math.exp((-2 * Math.PI * cutoff) / rate));
      channels[c][i] =
        low * Math.sin(Math.PI * u) ** 1.7 * Math.exp(-u * 2) * 0.65;
    }
    // Short, irregular resonances evoke bubbles without a rhythmic pulse.
    for (let b = 0; b < 12; b++) {
      const start = 0.18 + b * 0.135 + random() * 0.025,
        frequency = 180 + (random() + 1) * 170;
      for (let i = 0; i < rate * 0.2; i++) {
        const t = i / rate,
          index = Math.round(start * rate) + i;
        if (index >= channels[c].length) break;
        const phase =
          2 * Math.PI * frequency * (t + (entering ? 1.8 : 3) * t * t);
        channels[c][index] +=
          Math.sin(phase) *
          (1 - Math.exp(-t / 0.004)) *
          Math.exp(-t / 0.028) *
          0.085;
      }
    }
  }
  write(entering ? "water-entry" : "water-emerge", channels, 0.38);
}
