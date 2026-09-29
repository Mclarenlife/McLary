import gsap from "gsap";

// Inverse sampling rotates counterclockwise, so the visible image winds clockwise.
// The centre turns more than the rim: this bends the picture into a spiral.
export function vortexOffset(x, y) {
  const radius2 = x * x + y * y;
  const angle = -1.7 * Math.exp(-radius2 * 0.45);
  const pinch = 1 + 0.14 * Math.exp(-radius2 * 0.4);
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return [(x * c - y * s) * pinch - x, (x * s + y * c) * pinch - y];
}

// A single compositor surface contains both WebGL canvases and all the UI.
// Filtering that surface keeps lettering, cards and scenery in the same lens.
export class SingularityTransition {
  constructor() {
    this.stage = document.createElement("div");
    this.stage.className = "singularity-stage";
    this.world = document.createElement("div");
    this.world.className = "singularity-world";
    document.body.prepend(this.stage);
    this.stage.append(this.world);
    this.world.append(...document.querySelectorAll("#scene,#grain,#app"));
    this.light = document.createElement("canvas");
    this.light.className = "singularity-light";
    this.light.setAttribute("aria-hidden", "true");
    this.stage.append(this.light);
    this.context = this.light.getContext("2d");
    this.filters = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    this.filters.setAttribute("class", "singularity-filters");
    this.filters.setAttribute("aria-hidden", "true");
    this.filters.innerHTML = `<defs><filter id="singularity-lens" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feImage result="field" preserveAspectRatio="none"/>
      <feDisplacementMap in="SourceGraphic" in2="field" xChannelSelector="R" yChannelSelector="G" scale="0" result="red-warp"/>
      <feColorMatrix in="red-warp" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
      <feDisplacementMap in="SourceGraphic" in2="field" xChannelSelector="R" yChannelSelector="G" scale="0" result="green-warp"/>
      <feColorMatrix in="green-warp" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
      <feDisplacementMap in="SourceGraphic" in2="field" xChannelSelector="R" yChannelSelector="G" scale="0" result="blue-warp"/>
      <feColorMatrix in="blue-warp" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
      <feBlend in="red" in2="green" mode="screen" result="rg"/>
      <feBlend in="rg" in2="blue" mode="screen"/>
    </filter></defs>`;
    document.body.append(this.filters);
    this.maps = [...this.filters.querySelectorAll("feDisplacementMap")];
    this.makeField();
  }

  makeField(width = innerWidth, height = innerHeight) {
    this.fieldAspect = width / height;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    const field = context.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        // Cover the filter's padded bounds too. A transparent displacement field
        // outside the viewport would sample a second, detached copy of its edge.
        const u = (((x + 0.5) / 128 - 1) * 2 * width) / Math.min(width, height);
        const v =
          (((y + 0.5) / 128 - 1) * 2 * height) / Math.min(width, height);
        const [dx, dy] = vortexOffset(u, v);
        const i = (y * 256 + x) * 4;
        field.data[i] = (0.5 + dx / 4) * 255;
        field.data[i + 1] = (0.5 + dy / 4) * 255;
        field.data[i + 2] = 128;
        field.data[i + 3] = 255;
      }
    }
    context.putImageData(field, 0, 0);
    this.filters
      .querySelector("feImage")
      .setAttribute("href", canvas.toDataURL());
  }

  start(swap, onComplete) {
    this.cancel();
    this.swapped = false;
    this.swap = swap;
    this.onComplete = onComplete;
    this.width = innerWidth;
    this.height = innerHeight;
    if (this.fieldAspect !== this.width / this.height)
      this.makeField(this.width, this.height);
    const dpr = Math.min(devicePixelRatio, 1.5);
    this.light.width = Math.round(this.width * dpr);
    this.light.height = Math.round(this.height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const filter = this.filters.querySelector("filter");
    const field = this.filters.querySelector("feImage");
    for (const [key, value] of Object.entries({
      x: -this.width * 0.5,
      y: -this.height * 0.5,
      width: this.width * 2,
      height: this.height * 2,
    }))
      filter.setAttribute(key, value);
    for (const [key, value] of Object.entries({
      x: -this.width * 0.5,
      y: -this.height * 0.5,
      width: this.width * 2,
      height: this.height * 2,
    }))
      field.setAttribute(key, value);
    this.state = {
      scale: 1,
      turn: 0,
      warp: 0,
      split: 0,
      core: 0,
      burst: 0,
      round: 0,
    };
    this.stage.classList.add("is-active");
    document.documentElement.classList.add("singularity-active");
    this.world.inert = true;
    this.update();
    this.timeline = gsap.timeline({
      onUpdate: () => this.update(),
      onComplete: () => this.finish(),
    });
    // Tension, accelerating implosion, a held point, then a fast release that settles.
    this.timeline
      .to(this.state, {
        scale: 1.035,
        turn: 3,
        warp: 0.025,
        split: 0.18,
        duration: 0.3,
        ease: "sine.inOut",
      })
      .to(this.state, {
        scale: 0.009,
        turn: 180,
        split: 1,
        core: 1,
        round: 50,
        duration: 1.12,
        ease: "power3.in",
      })
      .call(() => {
        this.stage.dataset.phase = "singularity";
        this.world.style.visibility = "hidden";
        this.commit();
      })
      .to(this.state, {
        core: 1.2,
        duration: 0.2,
        ease: "sine.inOut",
      })
      .call(() => {
        this.stage.dataset.phase = "burst";
        this.world.style.visibility = "";
      })
      .to(this.state, {
        scale: 1.035,
        turn: 355,
        warp: 0.03,
        split: 0.2,
        core: 0,
        round: 0,
        burst: 1,
        duration: 1.18,
        ease: "expo.out",
      })
      .to(this.state, {
        scale: 1,
        turn: 360,
        warp: 0,
        split: 0,
        duration: 0.6,
        ease: "sine.inOut",
      });
    // Wind the centre before the picture becomes small, so the spiral remains
    // visible instead of reading as a rigid rectangle spinning away.
    this.timeline.to(
      this.state,
      { warp: 1, duration: 0.8, ease: "power2.inOut" },
      0.3,
    );
    this.stage.dataset.phase = "collapse";
    return this.timeline;
  }

  commit() {
    if (this.swapped) return;
    this.swapped = true;
    this.swap?.();
  }

  update() {
    const s = this.state;
    this.world.style.transform = `scale(${s.scale}) rotate(${s.turn}deg)`;
    this.world.style.borderRadius = `${Math.sqrt(s.round / 50) * 50}%`;
    const strength = Math.min(this.width, this.height);
    this.maps.forEach((map, i) => {
      map.setAttribute(
        "scale",
        strength * s.warp * 2 + (i - 1) * strength * s.split * 0.035,
      );
    });
    this.drawLight();
  }

  drawLight() {
    const ctx = this.context;
    const s = this.state;
    const w = this.width,
      h = this.height;
    const size = Math.min(w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.globalCompositeOperation = "screen";
    if (s.core > 0.001) {
      const r = size * (0.08 + s.core * 0.05);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      glow.addColorStop(0, `rgba(255,249,235,${Math.min(1, s.core)})`);
      glow.addColorStop(0.025, `rgba(207,231,255,${s.core * 0.9})`);
      glow.addColorStop(0.12, `rgba(109,162,247,${s.core * 0.45})`);
      glow.addColorStop(0.4, `rgba(155,90,204,${s.core * 0.12})`);
      glow.addColorStop(1, "rgba(89,124,207,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    if (this.stage.dataset.phase === "burst" && s.burst > 0 && s.burst < 1) {
      const progress = s.burst;
      const r = Math.hypot(w, h) * 0.6 * progress;
      const alpha = Math.pow(1 - progress, 2) * 0.62;
      const glow = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.08);
      glow.addColorStop(0, "rgba(81,132,228,0)");
      glow.addColorStop(0.6, `rgba(116,181,255,${alpha * 0.35})`);
      glow.addColorStop(0.78, `rgba(210,230,255,${alpha})`);
      glow.addColorStop(0.86, `rgba(227,119,175,${alpha * 0.55})`);
      glow.addColorStop(1, "rgba(106,101,200,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
    }
    ctx.restore();
  }

  finish() {
    const done = this.onComplete;
    this.cancel();
    done?.();
  }

  cancel() {
    this.timeline?.kill();
    this.timeline = null;
    this.stage.classList.remove("is-active");
    delete this.stage.dataset.phase;
    document.documentElement.classList.remove("singularity-active");
    this.world.inert = false;
    this.world.removeAttribute("style");
    this.swap = null;
    this.onComplete = null;
  }

  complete() {
    if (!this.timeline) return;
    this.commit();
    this.finish();
  }
}
