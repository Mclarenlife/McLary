const assets = {
  sea: "/audio/tidal-notes.wav?v=2",
  space: "/audio/distant-orbit.wav?v=1",
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
    this.spaceGain = ctx.createGain();
    this.spaceGain.connect(this.master);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.55;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.reverb = ctx.createConvolver();
    const impulse = ctx.createBuffer(
      2,
      Math.round(ctx.sampleRate * 1.8),
      ctx.sampleRate,
    );
    let seed = 93;
    for (let c = 0; c < 2; c++) {
      const samples = impulse.getChannelData(c);
      let low = 0;
      for (let i = 0; i < samples.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        low += ((seed / 4294967296) * 2 - 1 - low) * 0.13;
        samples[i] =
          low * Math.exp((-i / ctx.sampleRate) * 4) * (1 - i / samples.length);
      }
    }
    this.reverb.buffer = impulse;
    this.filter.connect(this.dry);
    this.dry.connect(this.seaGain);
    this.filter.connect(this.reverb);
    this.reverb.connect(this.wet);
    this.wet.connect(this.seaGain);
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
    this.ramp(this.seaGain.gain, Math.cos((space * Math.PI) / 2), duration);
    this.ramp(this.spaceGain.gain, Math.sin((space * Math.PI) / 2), duration);
    this.ramp(
      this.filter.frequency,
      11000 * (700 / 11000) ** submerged,
      duration,
    );
    this.ramp(this.dry.gain, 1 - submerged * 0.15, duration);
    this.ramp(this.wet.gain, submerged * 0.48, duration);
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
    if (["index", "contact"].includes(from) && to === "work")
      this.playEffect("dive");
    else if (from === "work" && ["index", "contact"].includes(to))
      this.playEffect("emerge");
  }
  stopEffects() {
    for (const { source, gain } of this.effects) {
      this.ramp(gain.gain, 0, 0.06);
      source.stop(this.context.currentTime + 0.12);
    }
    this.effects.clear();
  }
  playEffect(id) {
    if (!this.enabled || !this.buffers || this.context.state !== "running")
      return;
    this.stopEffects();
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = this.buffers[id];
    gain.gain.value = 0.65;
    source.connect(gain);
    gain.connect(this.master);
    const effect = { source, gain };
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
        ["sea", this.filter],
        ["space", this.spaceGain],
      ]) {
        const source = this.context.createBufferSource();
        source.buffer = this.buffers[id];
        source.loop = true;
        source.connect(target);
        source.start(start);
        this.sources[id] = source;
      }
    }
    // Previously .36: roughly 5 dB quieter before scene processing.
    this.ramp(this.master.gain, 0.2, 1.2);
  }
}
