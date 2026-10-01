import assert from "node:assert/strict";
import fs from "node:fs";
import { AmbientMusic, prepareSceneAudio } from "../src/ambient-music.js";
for (const [name, seconds, loop] of [
  ["tidal-notes", 60, true],
  ["distant-orbit", 72, true],
  ["water-entry", 2.4, false],
  ["water-emerge", 2.2, false],
]) {
  const wav = fs.readFileSync(`public/audio/${name}.wav`);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt16LE(22), 2);
  const rate = wav.readUInt32LE(24),
    frames = wav.readUInt32LE(40) / 4;
  assert.equal(frames / rate, seconds);
  let peak = 0,
    energy = 0;
  for (let i = 44; i < wav.length; i += 2) {
    const v = wav.readInt16LE(i) / 32768;
    peak = Math.max(peak, Math.abs(v));
    energy += v * v;
  }
  assert(peak > 0.3 && peak < 0.55, "Non-silent audio retains headroom");
  assert(Math.sqrt(energy / (frames * 2)) < 0.18, "Keep average level gentle");
  for (let c = 0; c < 2; c++) {
    const sample = (i) => wav.readInt16LE(44 + i * 4 + c * 2);
    if (!loop) {
      assert(
        Math.abs(sample(0)) < 2 && Math.abs(sample(frames - 1)) < 2,
        "Effects begin and end silently",
      );
      continue;
    }
    let localStep = 0;
    for (let i = 1; i < 150; i++)
      localStep = Math.max(
        localStep,
        Math.abs(sample(i) - sample(i - 1)),
        Math.abs(sample(frames - i) - sample(frames - i - 1)),
      );
    assert(
      Math.abs(sample(0) - sample(frames - 1)) < localStep * 1.5,
      "Loop seam does not introduce a click",
    );
  }
  console.log(name, { seconds, peak, rms: Math.sqrt(energy / (frames * 2)) });
}
class Param {
  value = 0;
  target = 0;
  cancelAndHoldAtTime() {}
  cancelScheduledValues() {}
  setValueAtTime(v) {
    this.value = this.target = v;
  }
  setTargetAtTime(v) {
    this.target = v;
  }
}
class Node {
  connections = [];
  connect(n) {
    this.connections.push(n);
    return n;
  }
  disconnect() {
    this.connections = [];
  }
}
let starts = 0,
  resumes = 0,
  fetches = 0;
const pending = [];
globalThis.fetch = () => {
  fetches++;
  return new Promise((resolve) =>
    pending.push(() =>
      resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
    ),
  );
};
globalThis.AudioContext = class {
  currentTime = 0;
  sampleRate = 22050;
  destination = {};
  state = "suspended";
  createGain() {
    return Object.assign(new Node(), { gain: new Param() });
  }
  createBiquadFilter() {
    return Object.assign(new Node(), {
      frequency: new Param(),
      Q: new Param(),
      gain: new Param(),
    });
  }
  createConvolver() {
    return new Node();
  }
  createOscillator() {
    return Object.assign(new Node(), { frequency: new Param(), start() {} });
  }
  createBuffer(n, length) {
    const data = Array.from({ length: n }, () => new Float32Array(length));
    return { getChannelData: (c) => data[c] };
  }
  resume() {
    resumes++;
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 60 });
  }
  createBufferSource() {
    return Object.assign(new Node(), {
      playbackRate: new Param(),
      detune: new Param(),
      start() {
        starts++;
      },
      stop() {
        this.stopped = true;
      },
    });
  }
};
const preload = prepareSceneAudio();
assert.equal(fetches, 4);
assert.equal(resumes, 0, "Preloading never unlocks audio");
const player = new AmbientMusic("index");
const enabling = player.setEnabled(true);
await Promise.resolve();
assert.equal(resumes, 1, "Unlock in the gesture before the fetch resolves");
assert.equal(fetches, 4, "Preload and player share requests");
player.setScene("work", 0);
await player.setEnabled(false);
pending.forEach((release) => release());
await preload;
await enabling;
assert.equal(starts, 0, "Muted while loading prevents delayed playback");
await Promise.all([player.setEnabled(true), player.setEnabled(true)]);
assert.equal(
  starts,
  2,
  "Exactly one persistent source per background, even on rapid toggles",
);
assert(player.sources.sea.loop && player.sources.space.loop);
assert(
  Math.abs(player.filter.frequency.target - 300) < 1e-8,
  "A route change while loading is preserved",
);
assert(
  Math.abs(player.sources.sea.playbackRate.value - 2 ** (-5 / 12)) < 1e-8,
  "Direct underwater playback starts five semitones lower",
);
assert(player.pitchDrift.connections.includes(player.sources.sea.detune));
assert.equal(player.pitchDrift.gain.target, 14);
assert.equal(player.body.gain.target, 4.5);
assert.equal(
  player.master.gain.target,
  0.2,
  "Master is quieter than the previous .36",
);
assert(
  player.wet.gain.target > player.dry.gain.target * 2,
  "Underwater mix favors the diffuse tail over direct notes",
);
const impulseSamples = player.reverb.buffer.getChannelData(0);
let earlyEnergy = 0,
  lateEnergy = 0;
impulseSamples.forEach((sample, i) => {
  if (i > player.context.sampleRate * 0.5) lateEnergy += sample * sample;
  else earlyEnergy += sample * sample;
});
assert(
  lateEnergy / (earlyEnergy + lateEnergy) > 0.15,
  "Audible late reverb lasts beyond the note attack",
);
assert(
  player.filter.connections.includes(player.reverb) &&
    player.reverb.connections.includes(player.reverbTone) &&
    player.reverbTone.connections.includes(player.wet),
  "Filtered music feeds real convolution reverb",
);
player.transitionWater("work", "contact");
assert.equal(
  player.sources.sea.playbackRate.target,
  1,
  "Emerging restores original pitch",
);
assert.equal(
  player.pitchDrift.gain.target,
  0,
  "Surface music has no underwater pitch drift",
);
assert.equal(player.body.gain.target, 0);
assert.equal(starts, 3);
assert.equal(player.filter.frequency.target, 2600);
assert.equal(player.wet.gain.target, 0);
assert.equal([...player.effects][0].source.buffer, player.buffers.emerge);
player.transitionWater("contact", "work");
assert.equal(
  player.effects.size,
  1,
  "A new cue replaces the previous transient",
);
assert.equal([...player.effects][0].source.buffer, player.buffers.dive);
player.setFlight(0, "work");
const low = player.spaceGain.gain.target;
player.setFlight(0.5, "work");
const middle = player.spaceGain.gain.target;
assert(low < middle && middle < 1);
assert(
  Math.abs(player.seaGain.gain.target ** 2 + middle ** 2 - 1) < 1e-10,
  "Equal-power crossfade avoids a midpoint volume dip",
);
player.setFlight(1, "work");
assert.equal(player.spaceGain.gain.target, 1);
player.setFlight(0, "contact");
assert.equal(player.spaceGain.gain.target, 0);
assert.equal(player.filter.frequency.target, 2600);
assert.equal(player.spaceFilter.frequency.value, 1800);
assert(player.sources.space.connections.includes(player.spaceFilter));
const waterCue = [...player.effects][0];
player.playUI("open");
assert.equal(
  player.effects.size,
  2,
  "UI feedback does not cut off water Foley",
);
assert(!waterCue.source.stopped);
const uiStart = starts;
player.playUI("close");
assert.equal(starts, uiStart, "Rapid repeated clicks do not pile up sounds");
player.context.currentTime += 0.3;
player.playUI("close");
assert.equal(player.effects.size, 2, "Replace only the previous UI cue");
assert(!waterCue.source.stopped);
for (const buffer of Object.values(player.uiBuffers)) {
  const samples = buffer.getChannelData(0);
  assert(Math.abs(samples[0]) < 1e-6 && Math.abs(samples.at(-1)) < 1e-6);
  assert(Math.max(...samples) < 0.3, "Feedback remains subtle");
}
player.setScene("gallery", 0);
assert.equal(player.spaceGain.gain.target, 1);
const beforeMute = starts;
await player.setEnabled(false);
assert.equal(player.effects.size, 0);
player.transitionWater("index", "work");
player.context.currentTime += 0.3;
player.playUI("select");
assert.equal(starts, beforeMute, "Mute covers transition effects");
await player.setEnabled(true);
assert.equal(
  starts,
  beforeMute,
  "Re-enabling reuses both loops and does not replay old cues",
);
await player.setEnabled(false);
clearTimeout(player.suspendTimer);
const direct = new AmbientMusic("gallery");
assert.equal(direct.spaceGain.gain.value, 1);
assert.equal(
  direct.master.gain.value,
  0,
  "Direct links remain silent until enabled",
);
console.log(
  "Scene audio checks passed: PCM seams/headroom, preload race, routing, crossfade, cues, mute, and direct entry.",
);
