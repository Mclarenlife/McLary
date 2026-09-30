export class AmbientMusic {
  constructor() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    this.enabled = false;
  }
  async setEnabled(enabled) {
    this.enabled = enabled;
    clearTimeout(this.suspendTimer);
    if (!enabled) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.06);
      this.suspendTimer = setTimeout(() => {
        if (!this.enabled) this.context.suspend().catch(() => {});
      }, 450);
      return;
    }
    // Unlock in the user's click before fetching/decoding, including mobile Safari.
    await this.context.resume();
    if (!this.bufferPromise) {
      this.bufferPromise = fetch("/audio/tidal-notes.wav?v=2")
        .then((response) => {
          if (!response.ok) throw new Error("Music unavailable");
          return response.arrayBuffer();
        })
        .then((data) => this.context.decodeAudioData(data))
        .catch((error) => {
          this.bufferPromise = null;
          throw error;
        });
    }
    const buffer = await this.bufferPromise;
    if (!this.enabled) return;
    if (!this.source) {
      this.source = this.context.createBufferSource();
      this.source.buffer = buffer;
      this.source.loop = true;
      this.source.connect(this.master);
      this.source.start();
    }
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0.36, this.context.currentTime, 0.3);
  }
}
