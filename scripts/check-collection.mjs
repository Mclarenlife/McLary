import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { projects } from "../src/content.js";
const root = "build/collection";
const files = (await fs.readdir(root, { recursive: true })).filter(f => /\.(html|js|css)$/.test(f));
const refs = new Set();
for (const file of files) {
  const text = (await fs.readFile(path.join(root, file), "utf8")).replace(/\\+"/g, '"');
  for (const match of text.matchAll(/["'(](\/collection\/[^"'<>\s\\)]+\.(?:js|css|png|svg|jpg|webp|avif|glb|mp4|webm|wasm|woff2|ico))(?:\?[^"'<>\s\\)]*)?["')]/g)) refs.add(decodeURIComponent(match[1]));
}
for (const ref of refs) assert(await fs.stat("build" + ref).catch(() => false), `Missing collection asset: ${ref}`);
const html = await fs.readFile(`${root}/index.html`, "utf8");
assert(html.includes('href="https://mclarenlife.github.io/collection/"'));
assert(html.includes('href="/collection/"'));
assert(!(await fs.readFile(`${root}/local-runtime.js`, "utf8")).includes('/__audit'));
assert.equal(projects.find(p => p.id === "collection").url, "/collection/");
assert.equal(projects.find(p => p.id === "collection").category, "APPs");
assert.equal(projects.find(p => p.id === "texite").category, "APPs");
assert.equal(projects.find(p => p.id === "files-archive").category, "Docs");
assert.equal(projects.find(p => p.id === "bw-toolbox").category, "Tools");
console.log(`Collection: ${refs.size} static asset references, subpath home links, canonical URL and four project categories passed.`);
