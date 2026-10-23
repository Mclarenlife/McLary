// A small Canvas2D runner. No textures, audio, network requests or WebGL context.
export const RUN_WIDTH = 560;
const FLOOR = 122,
  BIRD_X = 58,
  GRAVITY = 1120,
  JUMP = 408;
export function createRun(best = 0) {
  return {
    mode: "idle",
    y: 0,
    vy: 0,
    distance: 0,
    score: 0,
    best,
    speed: 178,
    obstacles: [{ x: 400, width: 25, height: 23, kind: "rock" }],
    gap: 300,
    remainder: 0,
  };
}
export function jump(run) {
  if (run.mode !== "running")
    Object.assign(run, createRun(run.best), { mode: "running" });
  if (run.y === 0) run.vy = -JUMP;
}
export function advanceRun(run, delta, random = Math.random) {
  if (run.mode !== "running" || delta > 0.25) return;
  // Fixed steps keep touch/keyboard play identical at 30, 60 and 120 Hz.
  run.remainder += Math.max(0, delta);
  const step = 1 / 120;
  while (run.remainder + 1e-9 >= step && run.mode === "running") {
    run.remainder -= step;
    run.speed = Math.min(280, 178 + run.distance / 220);
    const travel = run.speed * step;
    run.distance += travel;
    run.score = Math.floor(run.distance / 12);
    run.vy += GRAVITY * step;
    run.y = Math.min(0, run.y + run.vy * step);
    if (run.y === 0) run.vy = 0;
    run.gap -= travel;
    if (run.gap <= 0) {
      run.obstacles.push({
        x: RUN_WIDTH + 24,
        width: 19 + random() * 10,
        height: 19 + random() * 12,
        kind: random() > 0.5 ? "buoy" : "rock",
      });
      // Even at maximum speed the next jump has a generous landing interval.
      run.gap = 260 + random() * 150;
    }
    for (const obstacle of run.obstacles) {
      obstacle.x -= travel;
      if (
        BIRD_X + 20 > obstacle.x + 3 &&
        BIRD_X + 4 < obstacle.x + obstacle.width - 3 &&
        run.y - 5 > -obstacle.height + 3
      ) {
        run.mode = "over";
        run.best = Math.max(run.best, run.score);
        break;
      }
    }
    run.obstacles = run.obstacles.filter(
      (obstacle) => obstacle.x + obstacle.width > -10,
    );
  }
}

export function mountLoadingGame(host) {
  host.innerHTML = `<div class="loading-game-heading"><span>SHORE RUN</span><span class="loading-game-score" aria-hidden="true">HI 0000&nbsp;&nbsp; 0000</span></div><button class="loading-game-play" type="button" aria-label="开始海岸跳跃小游戏" aria-describedby="loading-game-hint"><canvas aria-hidden="true"></canvas></button><p class="loading-game-hint" id="loading-game-hint" role="status">点击画面 / 空格键，跳过礁石</p>`;
  const button = host.querySelector("button"),
    canvas = host.querySelector("canvas");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    host.remove();
    return { dispose() {} };
  }
  const hint = host.querySelector(".loading-game-hint"),
    score = host.querySelector(".loading-game-score");
  let run = createRun(),
    frame = 0,
    previous = 0,
    drawn = 0,
    paused = false,
    disposed = false;
  let ratio = 1,
    lastScore = "";
  const ink = "#363b39",
    muted = "#99a39c",
    sea = "#c2ccc3";

  function drawBird() {
    const x = BIRD_X,
      y = FLOOR + run.y;
    const stride =
      run.mode === "running" && run.y === 0
        ? Math.sin(run.distance * 0.16) * 4
        : 0;
    context.fillStyle = ink;
    // A little sandpiper, drawn with crisp blocks rather than downloaded artwork.
    context.fillRect(x + 2, y - 21, 19, 13);
    context.fillRect(x + 17, y - 31, 10, 16);
    context.fillRect(x + 24, y - 25, 10, 3);
    context.fillRect(x - 4, y - 22, 9, 5);
    context.fillStyle = "#eeded8";
    context.fillRect(x + 23, y - 28, 2, 2);
    context.fillStyle = "#89988b";
    context.fillRect(x + 5, y - 18, 10, 5);
    context.strokeStyle = ink;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + 7, y - 8);
    context.lineTo(x + 7 + stride, y - 1);
    context.lineTo(x + 11 + stride, y - 1);
    context.moveTo(x + 17, y - 8);
    context.lineTo(x + 17 - stride, y - 1);
    context.lineTo(x + 21 - stride, y - 1);
    context.stroke();
  }
  function draw() {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, RUN_WIDTH, 154);
    context.lineWidth = 1;
    context.strokeStyle = sea;
    context.beginPath();
    context.moveTo(0, 81);
    context.lineTo(RUN_WIDTH, 81);
    context.stroke();
    // Slow, sparse distant waves; the foreground carries the running motion.
    for (let i = 0; i < 9; i++) {
      const x = ((((i * 83 - run.distance * 0.15) % 620) + 620) % 620) - 30;
      context.beginPath();
      context.moveTo(x, 91 + (i % 3) * 6);
      context.lineTo(x + 17 + (i % 3) * 8, 91 + (i % 3) * 6);
      context.stroke();
    }
    context.strokeStyle = muted;
    context.beginPath();
    context.arc(449, 40, 13, Math.PI, 0);
    context.stroke();
    context.beginPath();
    context.moveTo(426, 41);
    context.lineTo(472, 41);
    context.stroke();
    context.strokeStyle = ink;
    context.beginPath();
    context.moveTo(0, FLOOR);
    context.lineTo(RUN_WIDTH, FLOOR);
    context.stroke();
    context.fillStyle = muted;
    for (let i = 0; i < 17; i++) {
      const x = (((i * 43 - run.distance) % 731) + 731) % 731;
      context.fillRect(x, FLOOR + 8 + (i % 3) * 5, i % 2 ? 5 : 2, 1);
    }
    for (const obstacle of run.obstacles) {
      const { x, width: w, height: h, kind } = obstacle;
      context.fillStyle = ink;
      if (kind === "buoy") {
        context.fillRect(x + 3, FLOOR - h + 6, w - 6, h - 6);
        context.fillRect(x + w / 2 - 2, FLOOR - h, 4, 7);
        context.fillStyle = "#eeded8";
        context.fillRect(x + 3, FLOOR - h + 12, w - 6, 4);
      } else {
        context.beginPath();
        context.moveTo(x, FLOOR);
        context.lineTo(x + 3, FLOOR - h * 0.65);
        context.lineTo(x + w * 0.5, FLOOR - h);
        context.lineTo(x + w - 3, FLOOR - h * 0.55);
        context.lineTo(x + w, FLOOR);
        context.closePath();
        context.fill();
      }
    }
    drawBird();
    if (run.mode !== "running" || paused) {
      context.fillStyle = ink;
      context.font = "11px ui-monospace, monospace";
      context.textAlign = "center";
      context.fillText(
        paused
          ? "PAUSED"
          : run.mode === "over"
            ? "ONE MORE WAVE?"
            : "A LITTLE RUN BEFORE THE DIVE",
        280,
        50,
      );
    }
    const text = `HI ${String(run.best).padStart(4, "0")}   ${String(run.score).padStart(4, "0")}`;
    if (lastScore !== text) {
      score.textContent = text;
      lastScore = text;
    }
    button.dataset.state = paused ? "paused" : run.mode;
  }
  function tick(now) {
    frame = 0;
    if (disposed || paused || run.mode !== "running") return;
    const delta = previous ? (now - previous) / 1000 : 0;
    previous = now;
    advanceRun(run, delta);
    // Small 2D surface, capped at 30 draws/s while the 3D assets are preparing.
    if (now - drawn >= 1000 / 30 || run.mode === "over") {
      draw();
      drawn = now;
    }
    if (run.mode === "over") {
      hint.textContent = `本次 ${run.score} 分 · 点击 / 空格键，再来一次`;
      button.setAttribute("aria-label", "重新开始海岸跳跃小游戏");
    } else frame = requestAnimationFrame(tick);
  }
  function play() {
    if (disposed || document.hidden) return;
    paused = false;
    jump(run);
    hint.textContent = "点击画面 / 空格键，跳过礁石";
    button.setAttribute("aria-label", "跳跃，避开礁石和浮标");
    if (!frame) {
      previous = 0;
      frame = requestAnimationFrame(tick);
    }
    draw();
  }
  function key(event) {
    if ([" ", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!event.repeat) play();
    }
  }
  function pageKey(event) {
    // Space also works before focusing the game; never steal Enter/Space from
    // either website-entry button or any other interactive control.
    if (
      event.target.closest?.("button,a,input,textarea,select,[contenteditable]")
    )
      return;
    if (
      event.target === document.body ||
      host.closest(".intro")?.contains(event.target)
    )
      key(event);
  }
  function visibility() {
    if (document.hidden && run.mode === "running") {
      paused = true;
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      hint.textContent = "已暂停 · 点击画面 / 空格键继续";
      button.setAttribute("aria-label", "继续海岸跳跃小游戏");
      draw();
    }
  }
  function resize() {
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = RUN_WIDTH * ratio;
    canvas.height = 154 * ratio;
    draw();
  }
  button.addEventListener("click", play);
  button.addEventListener("keydown", key);
  document.addEventListener("keydown", pageKey);
  document.addEventListener("visibilitychange", visibility);
  resize();
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      button.removeEventListener("click", play);
      button.removeEventListener("keydown", key);
      document.removeEventListener("keydown", pageKey);
      document.removeEventListener("visibilitychange", visibility);
      // Keep the last frame during the intro fade; removal releases its backing store.
    },
  };
}
