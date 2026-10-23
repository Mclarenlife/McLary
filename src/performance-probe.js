// Opt-in local diagnostics. Vite removes this recorder from production builds.
const enabled = import.meta.env?.DEV && new URLSearchParams(location.search).has("profile");
const windows = new Map();
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];

export function profileFrame(renderer, label) {
  if (!enabled) return null;
  renderer.info.autoReset = false;
  renderer.info.reset();
  const now = performance.now();
  let window = windows.get(renderer);
  if (!window || window.label !== label) {
    window = { label, start: now, previous: now, intervals: [], cpu: [], calls: [], triangles: [] };
    windows.set(renderer, window);
  }
  if (now > window.previous) window.intervals.push(now - window.previous);
  window.previous = now;
  return () => {
    window.cpu.push(performance.now() - now);
    window.calls.push(renderer.info.render.calls);
    window.triangles.push(renderer.info.render.triangles);
    if (now - window.start < 6000 || window.cpu.length < 12) return;
    const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
    const report = {
      label, viewport: [innerWidth, innerHeight], dpr: renderer.getPixelRatio(),
      samples: window.cpu.length, fps: +(1000 / mean(window.intervals)).toFixed(1),
      frameP95: +percentile(window.intervals, .95).toFixed(2),
      cpuMean: +mean(window.cpu).toFixed(2), cpuP95: +percentile(window.cpu, .95).toFixed(2),
      calls: Math.round(mean(window.calls)), triangles: Math.round(mean(window.triangles)),
      textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
    };
    console.info("PERF " + JSON.stringify(report));
    renderer.domElement.dataset.performance = JSON.stringify(report);
    windows.delete(renderer);
  };
}
