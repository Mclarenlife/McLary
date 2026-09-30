import assert from "node:assert/strict";
import fs from "node:fs";
import { AmbientMusic } from "../src/ambient-music.js";

const wav = fs.readFileSync("public/audio/tidal-notes.wav");
assert.equal(wav.toString("ascii", 0, 4), "RIFF");
assert.equal(wav.readUInt16LE(22), 2);
const rate = wav.readUInt32LE(24),
  frames = wav.readUInt32LE(40) / 4;
assert.equal(frames / rate, 30);
let peak = 0,
  energy = 0;
for (let i = 44; i < wav.length; i += 2) {
  const v = wav.readInt16LE(i) / 32768;
  peak = Math.max(peak, Math.abs(v));
  energy += v * v;
}
assert(
  peak > 0.4 && peak < 0.55,
  "Music must have headroom and non-silent content",
);
assert(
  Math.sqrt(energy / (frames * 2)) < 0.18,
  "Keep the loop gentle before the player volume is applied",
);
for (let c = 0; c < 2; c++) {
  const sample = (i) => wav.readInt16LE(44 + i * 4 + c * 2);
  const seam = Math.abs(sample(0) - sample(frames - 1));
  let localStep = 0;
  for (let i = 1; i < 150; i++)
    localStep = Math.max(
      localStep,
      Math.abs(sample(i) - sample(i - 1)),
      Math.abs(sample(frames - i) - sample(frames - i - 1)),
    );
  assert(
    seam < localStep * 1.5,
    "The loop seam must not introduce a click-sized discontinuity",
  );
}
let releaseFetch,
  starts = 0,
  resumes = 0;
globalThis.fetch = () =>
  new Promise((resolve) => {
    releaseFetch = () =>
      resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  });
globalThis.AudioContext = class {
  currentTime = 0;
  destination = {};
  createGain() {
    return {
      gain: { value: 0, cancelScheduledValues() {}, setTargetAtTime() {} },
      connect() {},
    };
  }
  resume() {
    resumes++;
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 30 });
  }
  createBufferSource() {
    return {
      connect() {},
      start() {
        starts++;
      },
    };
  }
};
const player = new AmbientMusic();
const enabling = player.setEnabled(true);
await Promise.resolve();
assert.equal(
  resumes,
  1,
  "Unlock audio immediately in the gesture, before fetching",
);
await player.setEnabled(false);
releaseFetch();
await enabling;
assert.equal(
  starts,
  0,
  "Turning sound off while loading must prevent late playback",
);
await player.setEnabled(true);
await player.setEnabled(true);
assert.equal(
  starts,
  1,
  "Repeated enabling must not layer multiple copies of the loop",
);
assert.equal(player.source.loop, true);
await player.setEnabled(false);
clearTimeout(player.suspendTimer);
console.log(
  "Music checks passed: 30-second stereo PCM, headroom, continuous seam, gesture unlock and rapid-toggle safety.",
);
