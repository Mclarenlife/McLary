import { createUnderwaterImpulse } from "./underwater-impulse.js";
const assets = {
  sea: "/audio/tidal-notes.wav?v=3",
  space: "/audio/distant-orbit.wav?v=2",
  dive: "/audio/water-entry.wav?v=1",
  emerge: "/audio/water-emerge.wav?v=1",
};
let prepared;
export function prepareSceneAudio() {
  return (prepared ??= Promise.all(
    Object.entries(assets).map(async ([id, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Audio unavailable: ${id}`);
      return [id, await response.arrayBuffer()];
    }),
  )
    .then(Object.fromEntries)
    .catch((error) => {
      prepared = null;
      throw error;
    }));
}
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
export class AmbientMusic {
  constructor(page = "index") {
    this.context = new AudioContext();
    const ctx = this.context;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.seaGain = ctx.createGain();
    this.seaGain.connect(this.master);
    // Two persistent mixes from one source. The clean surface path is fully muted
    // underwater, rather than relying on a temporary transition filter.
    this.surfaceGain = ctx.createGain();
    this.surfaceGain.connect(this.seaGain);
    this.submergedGain = ctx.createGain();
    this.submergedGain.connect(this.seaGain);
    this.surfaceFilter = ctx.createBiquadFilter();
    this.surfaceFilter.type = "lowpass";
    this.surfaceFilter.frequency.value = 2600;
    this.surfaceFilter.Q.value = 0.55;
    this.surfaceFilter.connect(this.surfaceGain);
    this.spaceGain = ctx.createGain();
    this.spaceGain.connect(this.master);
    this.spaceFilter = ctx.createBiquadFilter();
    this.spaceFilter.type = "lowpass";
    this.spaceFilter.frequency.value = 1800;
    this.spaceFilter.Q.value = 0.5;
    this.spaceFilter.connect(this.spaceGain);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.55;
    this.filter.frequency.value = 720;
    this.depthFilter = ctx.createBiquadFilter();
    this.depthFilter.type = "lowpass";
    this.depthFilter.frequency.value = 1050;
    this.depthFilter.Q.value = 0.5;
    this.body = ctx.createBiquadFilter();
    this.body.type = "lowshelf";
    this.body.frequency.value = 220;
    this.body.gain.value = 3;
    this.body.connect(this.filter);
    this.filter.connect(this.depthFilter);
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.dry.gain.value = 0.22;
    this.wet.gain.value = 1.05;
    this.pitchDrift = ctx.createGain();
    this.pitchDrift.gain.value = 0;
    this.reverb = ctx.createConvolver();
    this.reverb.normalize = false;
    this.reverb.buffer = createUnderwaterImpulse(ctx);
    this.reverbTone = ctx.createBiquadFilter();
    this.reverbTone.type = "lowpass";
    this.reverbTone.frequency.value = 1100;
    this.reverbTone.Q.value = 0.5;
    this.depthFilter.connect(this.dry);
    this.dry.connect(this.submergedGain);
    this.depthFilter.connect(this.reverb);
    this.reverb.connect(this.reverbTone);
    this.reverbTone.connect(this.wet);
    this.wet.connect(this.submergedGain);
    this.effects = new Set();
    this.enabled = false;
    this.setScene(page, 0);
  }
  ramp(param, value, duration) {
    const now = this.context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else {
      const held = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(held, now);
    }
    if (duration)
      param.setTargetAtTime(value, now, Math.max(0.015, duration / 4));
    else param.setValueAtTime(value, now);
  }
  mix(space, submerged, duration) {
    // Match 5516e61: one exponential playback-rate glide, no detune overshoot
    // or second pitch-shifted loop beating against the original during a fade.
    this.seaRate = 2 ** ((-5 * submerged) / 12);
    if (this.sources?.sea)
      this.ramp(this.sources.sea.playbackRate, this.seaRate, duration);
    this.ramp(this.pitchDrift.gain, submerged * 14, duration);
    this.ramp(this.seaGain.gain, Math.cos((space * Math.PI) / 2), duration);
    this.ramp(this.spaceGain.gain, Math.sin((space * Math.PI) / 2), duration);
    this.ramp(this.surfaceGain.gain, submerged ? 0 : 1, duration);
    this.ramp(this.submergedGain.gain, submerged ? 1 : 0, duration);
  }
  setScene(page, duration = 0.6) {
    this.page = page;
    this.mix(page === "gallery" ? 1 : 0, page === "work" ? 1 : 0, duration);
  }
  setFlight(progress, surfacePage) {
    const space = smooth((progress - 0.04) / 0.9);
    this.mix(space, surfacePage === "work" ? 1 : 0, 0.16);
  }
  transitionWater(from, to, duration = 1.8) {
    this.setScene(to, duration);
    if (["index", "contact"].includes(from) && to === "work") {
      this.playEffect("dive");
    } else if (from === "work" && ["index", "contact"].includes(to)) {
      this.playEffect("emerge");
    }
  }
  stopEffects(kind) {
    for (const effect of this.effects) {
      if (kind && effect.kind !== kind) continue;
      const { source, gain } = effect;
      this.ramp(gain.gain, 0, 0.06);
      source.stop(this.context.currentTime + 0.12);
      this.effects.delete(effect);
    }
  }
  playEffect(id) {
    if (!this.enabled || !this.buffers || this.context.state !== "running")
      return;
    this.playBuffer(this.buffers[id], 0.65, "water");
  }
  playUI(action = "open") {
    if (!this.enabled || this.context.state !== "running") return;
    const now = this.context.currentTime;
    if (now - (this.lastUI ?? -1) < 0.08) return;
    this.lastUI = now;
    this.uiBuffers ??= {};
    if (!this.uiBuffers[action]) {
      const rate = this.context.sampleRate;
      const buffer = this.context.createBuffer(
        1,
        Math.round(rate * 0.22),
        rate,
      );
      const samples = buffer.getChannelData(0);
      const frequency = { open: 280, close: 220, select: 330 }[action] ?? 280;
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate,
          u = i / (samples.length - 1);
        const phase = 2 * Math.PI * frequency * (t - 0.3 * t * t);
        // A rounded wooden/water drop, without a sharp click or bright bell.
        samples[i] =
          (Math.sin(phase) + 0.08 * Math.sin(phase * 2)) *
          Math.sin(Math.PI * u) ** 2 *
          Math.exp(-t * 18) *
          0.65;
      }
      this.uiBuffers[action] = buffer;
    }
    this.playBuffer(this.uiBuffers[action], 0.85, "ui");
  }
  playBuffer(buffer, level, kind) {
    this.stopEffects(kind);
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = level;
    source.connect(gain);
    gain.connect(this.master);
    const effect = { source, gain, kind };
    this.effects.add(effect);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.effects.delete(effect);
    };
    source.start();
  }
  async setEnabled(enabled) {
    this.enabled = enabled;
    clearTimeout(this.suspendTimer);
    if (!enabled) {
      this.ramp(this.master.gain, 0, 0.24);
      this.stopEffects();
      this.suspendTimer = setTimeout(() => {
        if (!this.enabled) this.context.suspend().catch(() => {});
      }, 450);
      return;
    }
    // Resume within the gesture before loading, including mobile Safari.
    await this.context.resume();
    this.bufferPromise ??= prepareSceneAudio()
      .then(async (data) => {
        const decoded = await Promise.all(
          Object.entries(data).map(async ([id, bytes]) => [
            id,
            await this.context.decodeAudioData(bytes.slice(0)),
          ]),
        );
        return Object.fromEntries(decoded);
      })
      .catch((error) => {
        this.bufferPromise = null;
        throw error;
      });
    this.buffers = await this.bufferPromise;
    if (!this.enabled) return;
    if (!this.sources) {
      this.sources = {};
      const start = this.context.currentTime;
      for (const [id, target] of [
        ["sea", this.surfaceFilter],
        ["space", this.spaceFilter],
      ]) {
        const source = this.context.createBufferSource();
        source.buffer = this.buffers[id];
        source.loop = true;
        source.playbackRate.value = id === "sea" ? this.seaRate : 1;
        if (id === "sea") {
          this.pitchDrift.connect(source.detune);
          source.connect(this.body);
        }
        source.connect(target);
        source.start(start);
        this.sources[id] = source;
      }
      this.driftOscillator = this.context.createOscillator();
      this.driftOscillator.type = "sine";
      this.driftOscillator.frequency.value = 0.16;
      this.driftOscillator.connect(this.pitchDrift);
      this.driftOscillator.start(start);
    }
    // Previously .36: roughly 5 dB quieter before scene processing.
    this.ramp(this.master.gain, 0.2, 1.2);
  }
}
