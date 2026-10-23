// Code-authored, editable SVG cover using the Collection's real application icons.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || "sharp");
const source = process.env.COLLECTION_SITE_ROOT || "../sites/collection/site";
const icons = {};
for (const id of ["texite", "paperead", "chartelis", "zipite"]) {
  const png = await sharp(path.join(source, `collection-assets/${id}-icon.png`)).resize(160, 160, { fit: "inside" }).png().toBuffer();
  icons[id] = `data:image/png;base64,${png.toString("base64")}`;
}
const tags = [
  { id: "texite", name: "Texite", text: "01 / WRITE", x: 827, y: 309, angle: 14, color: "#fdfbf4" },
  { id: "paperead", name: "Paperead", text: "02 / READ", x: 1115, y: 288, angle: -13, color: "#ff6a31" },
  { id: "chartelis", name: "Chartelis", text: "03 / CREATE", x: 974, y: 481, angle: -12, color: "#c9e4a0" },
  { id: "zipite", name: "Zipite", text: "04 / ORGANIZE", x: 1281, y: 464, angle: 13, color: "#dba6e3" },
];
const chainAnchors = [[1012, 261], [1267, 232], [1100, 354], [1276, 289]];
const chains = tags.map((t, i) => {
  const radians = t.angle * Math.PI / 180;
  const x = t.x + 113 + 94 * Math.sin(radians), y = t.y + 112 - 94 * Math.cos(radians);
  const [ax, ay] = chainAnchors[i];
  const curve = `M${ax} ${ay}C${ax + 32} ${(ay + y) / 2} ${x - 26} ${y - 45} ${x} ${y}`;
  return `<path d="${curve}" stroke="#63695f" stroke-width="10"/><path d="${curve}" stroke="url(#chrome)" stroke-width="7"/>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800">
<defs>
 <linearGradient id="paper" x2=".7" y2="1"><stop stop-color="#f4f3ef"/><stop offset="1" stop-color="#dcdedb"/></linearGradient>
 <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".19" stop-color="#91948e"/><stop offset=".31" stop-color="#fff"/><stop offset=".5" stop-color="#545953"/><stop offset=".62" stop-color="#f6f8f4"/><stop offset=".82" stop-color="#878c84"/><stop offset="1" stop-color="#fff"/></linearGradient>
 <filter id="shadow" x="-.5" y="-.5" width="2" height="2"><feDropShadow dx="7" dy="18" stdDeviation="15" flood-color="#20261c" flood-opacity=".22"/></filter>
 <filter id="soft"><feGaussianBlur stdDeviation="24"/></filter>
 <clipPath id="frame"><rect width="1600" height="800"/></clipPath>
</defs>
<g clip-path="url(#frame)">
<rect width="1600" height="800" fill="url(#paper)"/>
<path d="M775 112V688" stroke="#b8bdb4" stroke-width="1"/>
<path d="M64 111H1536M64 690H1536" stroke="#a8afa3" stroke-width="1"/>
<g font-family="Arial,sans-serif" font-size="17" letter-spacing="2" fill="#343d30">
 <text x="64" y="70">MCLARY / INDEPENDENT APPS</text><text x="1536" y="70" text-anchor="end">READ. WRITE. MAKE ROOM.</text>
 <text x="64" y="744">FOUR APPS. ONE CREATIVE COLLECTION.</text><text x="1536" y="744" text-anchor="end">EXPLORE THE COLLECTION ↗</text>
</g>
<g font-family="Arial,sans-serif" fill="#192017">
 <rect x="65" y="190" width="92" height="34" rx="17" fill="#20251f"/>
 <text x="111" y="213" text-anchor="middle" font-size="16" fill="#f2f3ec" letter-spacing="2">APPS</text>
 <text x="57" y="365" font-size="119" letter-spacing="-8">Collection<tspan fill="#ff6025">.</tspan></text>
 <text x="65" y="443" font-size="39" letter-spacing="-1.2">Small tools.</text>
 <text x="65" y="492" font-size="39" letter-spacing="-1.2">A little more possibility.</text>
 <rect x="66" y="550" width="229" height="55" rx="28" fill="#20251f"/>
 <text x="92" y="585" font-size="19" fill="#fff">Explore my apps</text>
 <path d="M253 572l12 8-12 8" fill="none" stroke="#fff" stroke-width="1.6"/>
</g>
<ellipse cx="1184" cy="627" rx="264" ry="29" fill="#737d67" opacity=".22" filter="url(#soft)"/>
<g fill="none" stroke="url(#chrome)" filter="url(#shadow)">
 <ellipse cx="1142" cy="244" rx="152" ry="120" transform="rotate(-24 1142 244)" stroke-width="20"/>
 <ellipse cx="1143" cy="243" rx="151" ry="120" transform="rotate(-24 1143 243)" stroke-width="3" stroke="#fff"/>
</g>
<g fill="none">${chains}</g>
${tags.map(t => `<g transform="translate(${t.x} ${t.y}) rotate(${t.angle} 113 112)">
 <g filter="url(#shadow)"><rect width="226" height="195" rx="22" fill="${t.color}"/>
 <rect x="2" y="2" width="222" height="191" rx="20" fill="none" stroke="#fff" stroke-opacity=".6"/>
 <circle cx="113" cy="18" r="7" fill="#5a6253"/><circle cx="113" cy="18" r="10" fill="none" stroke="url(#chrome)" stroke-width="3"/>
 <image href="${icons[t.id]}" x="71" y="42" width="84" height="84"/>
 <text x="113" y="153" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" letter-spacing="-.5" fill="#1c2419">${t.name}</text>
 <text x="113" y="177" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" letter-spacing="2" fill="#35432e">${t.text}</text>
 </g></g>`).join("")}
</g></svg>`;
await fs.writeFile("public/covers/collection.svg", svg);
await sharp(Buffer.from(svg)).webp({ quality: 92, effort: 6 }).toFile("public/covers/collection.webp");
console.log("Collection cover written: editable SVG + 1600×800 WebP.");
