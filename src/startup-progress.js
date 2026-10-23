// Weighted preparation milestones, not a byte-download percentage or a timer.
export const STARTUP_STAGES = {
  setup: [5, "Building scenes"],
  fonts: [2, "Loading type"],
  work: [10, "Preparing projects"],
  ocean: [12, "Preparing the ocean"],
  wildlife: [8, "Preparing marine life"],
  seabed: [20, "Preparing the seabed"],
  maps: [17, "Loading globe maps"],
  photos: [6, "Loading photographs"],
  shaders: [11, "Compiling scene materials"],
  transition: [3, "Preparing transitions"],
  audio: [6, "Loading sound"],
};

export class StartupProgress {
  constructor(render, clock = () => performance.now()) {
    this.clock = clock;
    this.started = clock();
    this.render = render;
    this.stages = Object.fromEntries(
      Object.entries(STARTUP_STAGES).map(([id, [weight, label]]) => [
        id,
        { weight, label, value: 0, state: "pending" },
      ]),
    );
    this.complete = false;
    this.emit();
  }
  update(id, value) {
    if (this.complete) return;
    const stage = this.stages[id];
    if (stage.started === undefined) stage.started = this.clock();
    stage.value = Math.max(stage.value, Math.min(1, Math.max(0, value)));
    stage.state = stage.value === 1 ? "ready" : "active";
    if (stage.value === 1 && stage.finished === undefined)
      stage.finished = this.clock();
    this.emit();
  }
  async run(id, operation) {
    this.update(id, 0);
    try {
      const result = await operation((value) => this.update(id, value));
      this.update(id, 1);
      return result;
    } catch (error) {
      const stage = this.stages[id];
      stage.value = 1;
      stage.state = "fallback";
      stage.finished = this.clock();
      this.emit();
      throw error;
    }
  }
  snapshot() {
    const stages = Object.values(this.stages);
    const active = stages
      .filter((s) => s.state === "active")
      .sort((a, b) => a.started - b.started)[0];
    return {
      value: this.complete
        ? 1
        : Math.min(
            0.99,
            stages.reduce((n, s) => n + s.weight * s.value, 0) / 100,
          ),
      label: this.complete
        ? "Your space is ready"
        : (active?.label ??
          stages.find((s) => s.state === "pending")?.label ??
          "Finishing preparation"),
      elapsed: Math.floor((this.clock() - this.started) / 1000),
      done: stages.filter((s) => s.value === 1).length,
      total: stages.length,
    };
  }
  emit() {
    this.render(this.snapshot());
  }
  finish() {
    this.complete = true;
    this.emit();
    return {
      totalMs: Math.round(this.clock() - this.started),
      stages: Object.fromEntries(
        Object.entries(this.stages).map(([id, s]) => [
          id,
          {
            state: s.state,
            startMs: Math.round((s.started ?? this.started) - this.started),
            durationMs: Math.round(
              (s.finished ?? this.clock()) - (s.started ?? this.started),
            ),
          },
        ]),
      ),
    };
  }
}

// Yield between texture uploads so loading UI and the minigame can repaint.
export const yieldToBrowser = () =>
  new Promise((resolve) => setTimeout(resolve, 0));
