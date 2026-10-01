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
  events = [];
  cancelAndHoldAtTime() {
    this.events = [];
  }
  cancelScheduledValues() {
    this.events = [];
  }
  linearRampToValueAtTime(value, time) {
    this.events.push({ value, time });
  }
  setValueAtTime(v) {
    this.value = this.target = v;
  }
  setTargetAtTime(v, time, timeConstant) {
    this.target = v;
    this.events.push({ value: v, time, timeConstant });
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
  player.submergedGain.gain.target === 1 &&
    player.surfaceGain.gain.target === 0,
  "A route change while loading is preserved",
);
assert(
  player.sources.sea.playbackRate.value === 2 ** (-5 / 12),
  "Direct Work playback uses the historical five-semitone pitch",
);
assert.equal(player.filter.frequency.value, 720);
assert.equal(player.depthFilter.frequency.value, 1050);
assert.equal(
  player.sources.underwater,
  undefined,
  "No differently pitched duplicate loop",
);
assert.equal(player.body.gain.value, 3);
assert.equal(player.reverb.normalize, false);
assert.equal(
  player.pitchDrift.gain.value,
  14,
  "Historical submerged drift depth is preserved",
);
assert.equal(player.driftOscillator.frequency.value, 0.16);
assert.equal(
  player.master.gain.target,
  0.2,
  "Master is quieter than the previous .36",
);
assert(
  player.wet.gain.value > player.dry.gain.value * 4,
  "Underwater mix favors the diffuse tail over direct notes",
);
const impulseSamples = player.reverb.buffer.getChannelData(0);
assert(
  impulseSamples
    .slice(0, Math.floor(player.context.sampleRate * 0.06))
    .every((x) => x === 0),
  "Wet reflections have real pre-delay",
);
assert(
  Math.abs(impulseSamples.reduce((sum, x) => sum + Math.abs(x), 0) - 1.6) <
    1e-5,
  "IR convolution level is explicitly bounded",
);
assert.notDeepEqual(
  impulseSamples,
  player.reverb.buffer.getChannelData(1),
  "Stereo reflections have different delays",
);
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
  player.filter.connections.includes(player.depthFilter) &&
    player.depthFilter.connections.includes(player.reverb) &&
    player.reverb.connections.includes(player.reverbTone) &&
    player.reverbTone.connections.includes(player.wet),
  "Filtered music feeds real convolution reverb",
);
player.transitionWater("work", "contact");
assert.equal(
  player.sources.sea.playbackRate.target,
  1,
  "Emerging restores the original rate monotonically",
);
assert.equal(starts, 3);
assert.equal(player.surfaceGain.gain.target, 1);
assert.equal(player.submergedGain.gain.target, 0);
assert.equal(
  player.sources.sea.detune.events.length,
  0,
  "No synthetic detune overshoot",
);
assert.equal(player.pitchDrift.gain.target, 0);
assert.equal([...player.effects][0].source.buffer, player.buffers.emerge);
player.transitionWater("contact", "work");
assert.equal(
  player.effects.size,
  1,
  "A new cue replaces the previous transient",
);
assert.equal([...player.effects][0].source.buffer, player.buffers.dive);
assert.equal(player.sources.sea.playbackRate.target, 2 ** (-5 / 12));
assert.deepEqual(
  player.sources.sea.playbackRate.events,
  [
    {
      value: 2 ** (-5 / 12),
      time: player.context.currentTime,
      timeConstant: 1.8 / 4,
    },
  ],
  "Historical single exponential glide, without a long recovery envelope",
);
assert.equal(player.pitchDrift.gain.target, 14);
player.context.currentTime += 60;
player.setScene("work", 0.25); // The navigation completion must retain the wet bus.
assert.equal(
  player.surfaceGain.gain.target,
  0,
  "Clean music remains muted after entry",
);
assert.equal(
  player.submergedGain.gain.target,
  1,
  "Underwater music persists after the cue ends",
);
assert(player.sources.sea.connections.includes(player.surfaceFilter));
assert(player.sources.sea.connections.includes(player.body));
assert(player.dry.connections.includes(player.submergedGain));
assert(player.wet.connections.includes(player.submergedGain));
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
assert.equal(player.surfaceGain.gain.target, 1);
assert.equal(player.submergedGain.gain.target, 0);
assert.equal(player.spaceFilter.frequency.value, 1800);
assert(player.sources.space.connections.includes(player.spaceFilter));
const waterCue = [...player.effects][0];
player.playUI("open");
assert.equal(
  [...player.effects].find((x) => x.kind === "ui").gain.gain.value,
  0.85,
  "UI cues are about 7 dB louder",
);
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
  "Re-enabling reuses all loops and does not replay old cues",
);
assert.equal(
  player.sources.sea.detune.events.length,
  0,
  "No queued detune cue can replay when unmuting",
);
assert.equal(
  player.pitchDrift.gain.target,
  14,
  "Unmuting retains the current underwater mix",
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
const directWork = new AmbientMusic("work");
assert.equal(directWork.surfaceGain.gain.value, 0);
assert.equal(
  directWork.submergedGain.gain.value,
  1,
  "Direct Work entry selects its persistent mix",
);
console.log(
  "Scene audio checks passed: PCM seams/headroom, preload race, routing, crossfade, cues, mute, and direct entry.",
);
