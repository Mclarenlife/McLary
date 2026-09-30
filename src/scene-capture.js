// Capture the live renderers and the small, accessible HTML interface into one
// GPU texture. Glyph positions come from DOM ranges, preserving the real layout.
export function captureViewport(canvas, beforeCapture) {
  const width = innerWidth,
    height = innerHeight;
  const dpr = Math.min(devicePixelRatio, 1.5);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  beforeCapture?.();
  const paintCanvas = (element) => {
    if (!element || !element.width || !element.height) return;
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height)
      ctx.drawImage(element, rect.x, rect.y, rect.width, rect.height);
  };
  paintCanvas(document.querySelector("#scene canvas"));
  paintCanvas(document.querySelector("main .gallery-canvas"));
  const transparent = (color) =>
    !color || color === "transparent" || color === "rgba(0, 0, 0, 0)";
  const svg = (element, rect, style) => {
    const box = element.viewBox.baseVal;
    ctx.save();
    ctx.translate(rect.x, rect.y);
    ctx.scale(rect.width / box.width, rect.height / box.height);
    ctx.translate(-box.x, -box.y);
    ctx.strokeStyle = style.color;
    ctx.fillStyle = style.color;
    ctx.lineWidth = Number(element.getAttribute("stroke-width")) || 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const node of element.children) {
      if (node.tagName === "path")
        ctx.stroke(new Path2D(node.getAttribute("d")));
      if (node.tagName === "circle") {
        ctx.beginPath();
        ctx.arc(
          Number(node.getAttribute("cx")),
          Number(node.getAttribute("cy")),
          Number(node.getAttribute("r")),
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  const range = document.createRange();
  const text = (node, style) => {
    ctx.fillStyle = style.color;
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const metrics = ctx.measureText("Hg");
    const ascent =
      metrics.fontBoundingBoxAscent || parseFloat(style.fontSize) * 0.8;
    for (let index = 0; index < node.textContent.length; index++) {
      let glyph = node.textContent[index];
      if (/\s/.test(glyph)) continue;
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > height)
        continue;
      if (style.textTransform === "uppercase") glyph = glyph.toUpperCase();
      else if (style.textTransform === "lowercase") glyph = glyph.toLowerCase();
      ctx.fillText(glyph, rect.x, rect.y + ascent);
    }
  };
  const paint = (element) => {
    if (!(element instanceof Element)) return;
    const style = getComputedStyle(element);
    const alpha = Number(style.opacity);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      alpha < 0.01 ||
      ["CANVAS", "DIALOG"].includes(element.tagName)
    )
      return;
    const rect = element.getBoundingClientRect();
    if (
      (rect.width <= 2 && rect.height <= 2) ||
      rect.bottom < 0 ||
      rect.top > height
    )
      return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (element.tagName.toLowerCase() === "svg") {
      svg(element, rect, style);
      ctx.restore();
      return;
    }
    const radius = style.borderRadius.includes("%")
      ? (Math.min(rect.width, rect.height) * parseFloat(style.borderRadius)) /
        100
      : parseFloat(style.borderRadius) || 0;
    const shape = () => {
      ctx.beginPath();
      ctx.roundRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        Math.min(radius, rect.width / 2, rect.height / 2),
      );
    };
    if (!transparent(style.backgroundColor)) {
      shape();
      ctx.fillStyle = style.backgroundColor;
      ctx.fill();
    }
    const border = parseFloat(style.borderTopWidth);
    if (border > 0 && !transparent(style.borderTopColor)) {
      shape();
      ctx.lineWidth = border;
      ctx.strokeStyle = style.borderTopColor;
      ctx.stroke();
    }
    if (
      element instanceof HTMLImageElement &&
      element.complete &&
      element.naturalWidth
    )
      ctx.drawImage(element, rect.x, rect.y, rect.width, rect.height);
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text(child, style);
      else paint(child);
    }
    ctx.restore();
  };
  // The project canvas is already composited above; native hidden fallback cards
  // are skipped by their computed display/visibility/opacity.
  [...document.querySelector("#app").children]
    .sort(
      (a, b) =>
        (parseInt(getComputedStyle(a).zIndex) || 0) -
        (parseInt(getComputedStyle(b).zIndex) || 0),
    )
    .forEach(paint);
  return canvas;
}
