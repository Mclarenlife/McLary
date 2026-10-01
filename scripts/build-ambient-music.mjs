import fs from "node:fs";

// Original eight-phrase score, 48 BPM, C major. No third-party recordings.
// Notes and diffuse echoes are summed on a circular timeline, including tails
// from the preceding repetition. AudioBufferSourceNode loops this exact PCM.
const rate = 22050,
  beat = 60 / 48,
  seconds = 48 * beat;
const length = Math.round(rate * seconds);
const channels = [new Float64Array(length), new Float64Array(length)];
const chords = [
  [48, 60, 64, 67],
  [43, 59, 62, 67],
  [45, 60, 64, 69],
  [41, 57, 60, 65],
  [50, 60, 65, 69],
  [40, 55, 59, 64],
  [41, 57, 60, 67],
  [43, 55, 62, 69],
];
const melody = [
  [76, 74],
  [71, 67],
  [72, 76],
  [69, 67],
  [69, 72],
  [71, 67],
  [69, 67],
  [74, 71],
];
const taps = [
  [0, 1, 0],
  [0.137, 0.13, -0.5],
  [0.293, 0.1, 0.5],
  [0.479, 0.075, -0.3],
  [0.731, 0.055, 0.4],
  [1.117, 0.035, -0.2],
  [1.613, 0.02, 0.2],
];
function note(midi, when, volume, pan, decay) {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const duration = 12;
  for (let i = 0; i < rate * duration; i++) {
    const t = i / rate,
      phase = 2 * Math.PI * frequency * t;
    const attack = 1 - Math.exp(-t / 0.24);
    const envelope =
      attack * Math.exp(-t / decay) * Math.max(0, 1 - (t / duration) ** 4);
    const tone =
      Math.sin(phase) +
      0.035 * Math.sin(phase * 2) * Math.exp(-t / 0.7) +
      0.008 * Math.sin(phase * 3) * Math.exp(-t / 0.35);
    const sample = tone * envelope * volume;
    for (const [delay, gain, spread] of taps) {
      const index = (Math.round((when + delay) * rate) + i) % length;
      const p = Math.max(-0.8, Math.min(0.8, pan + spread));
      channels[0][index] += sample * gain * Math.sqrt((1 - p) / 2);
      channels[1][index] += sample * gain * Math.sqrt((1 + p) / 2);
    }
  }
}
chords.forEach((chord, bar) => {
  const start = bar * 6 * beat;
  note(chord[0], start, 0.1, -0.08, 2.2);
  [1, 3].forEach((part, j) =>
    note(
      chord[part],
      start + (j * 3 + 0.7) * beat,
      0.065,
      (j % 2 ? 1 : -1) * 0.22,
      2.5,
    ),
  );
  note(melody[bar][0] - 12, start + 2.2 * beat, 0.055, -0.13, 3.8);
});
// One-pole low-pass, warmed for two cycles to preserve continuity at the seam.
const smoothing = 1 - Math.exp((-2 * Math.PI * 1200) / rate);
for (const channel of channels) {
  let state = 0;
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < length; i++) {
      state += (channel[i] - state) * smoothing;
      if (pass === 1) channel[i] = state;
    }
}
let peak = 0,
  energy = 0;
for (const channel of channels)
  for (const value of channel) peak = Math.max(peak, Math.abs(value));
const gain = 0.52 / peak;
const wav = Buffer.alloc(44 + length * 4);
wav.write("RIFF", 0);
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
wav.writeUInt32LE(length * 4, 40);
for (let i = 0; i < length; i++)
  for (let c = 0; c < 2; c++) {
    const value = channels[c][i] * gain;
    energy += value * value;
    wav.writeInt16LE(Math.round(value * 32767), 44 + i * 4 + c * 2);
  }
fs.mkdirSync("public/audio", { recursive: true });
fs.writeFileSync("public/audio/tidal-notes.wav", wav);
console.log({
  seconds,
  bytes: wav.length,
  peak: 0.52,
  rms: Math.sqrt(energy / (length * 2)),
  seam: channels.map((c) => Math.abs(c[0] - c[length - 1]) * gain),
});
