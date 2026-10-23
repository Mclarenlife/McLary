// Resolution is a rendering budget, independent of CSS layout and animation time.
export function renderSettings(width, height, nativeDpr = 1, touch = false, scale = 1) {
  const mobile = touch || width <= 700;
  const cap = mobile ? 1.35 : 1.7;
  const pixels = mobile ? 1_800_000 : 4_500_000;
  return {
    mobile,
    dpr: Math.min(nativeDpr, cap, Math.sqrt(pixels / Math.max(1, width * height))) * scale,
    shadow: mobile ? 1024 : 2048,
  };
}

export class FrameBudget {
  constructor() { this.scale = 1; this.reset(); }
  reset() { this.last = 0; this.elapsed = 0; this.frames = 0; }
  sample(now, paused = false) {
    if (paused) { this.reset(); return false; }
    const dt = this.last ? now - this.last : 0;
    this.last = now;
    // Ignore tab restoration, loading and debugger pauses.
    if (dt <= 0 || dt > 250) { this.elapsed = 0; this.frames = 0; return false; }
    this.elapsed += dt; this.frames++;
    if (this.elapsed < 4000) return false;
    const slow = this.elapsed / this.frames > 26;
    this.elapsed = 0; this.frames = 0;
    if (!slow || this.scale <= .75) return false;
    // Only step down during this visit: no quality oscillation or repeated reallocations.
    this.scale = Math.max(.75, this.scale - .125);
    return true;
  }
}

const budget = new FrameBudget();
const listeners = new Set();
export const renderBudget = {
  settings() {
    return renderSettings(innerWidth, innerHeight, devicePixelRatio,
      matchMedia("(pointer: coarse)").matches, budget.scale);
  },
  subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
  refresh() { for (const callback of listeners) callback(this.settings()); },
  sample(now, paused) { if (budget.sample(now, paused)) this.refresh(); },
};
