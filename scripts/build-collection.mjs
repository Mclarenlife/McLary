import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Use the current local exported site; the source repository carries the same
// snapshot for reproducible builds without the sibling authoring workspace.
const source = [process.env.COLLECTION_SITE_ROOT,
  path.resolve(root, "../sites/collection/site"), path.join(root, "sites/collection")]
  .filter(Boolean).find(dir => existsSync(path.join(dir, "index.html")));
if (!source) throw Error("Collection export missing. Set COLLECTION_SITE_ROOT to its site/ directory.");
const destination = path.join(root, "build/collection");
const base = "/collection/";
const excluded = new Set(["collection-assets/generate-media.mjs", "collection-assets/assets-manifest.json"]);
const prefixes = /(?<![\w/])\/(?:_next|branding|collection-assets|marketing-assets|media|draco)\//g;
await fs.mkdir(destination, { recursive: true });
let count = 0;
for (const name of await fs.readdir(source, { recursive: true })) {
  const relative = name.replaceAll("\\", "/");
  const from = path.join(source, name);
  if (!(await fs.stat(from)).isFile() || excluded.has(relative)) continue;
  const to = path.join(destination, name);
  await fs.mkdir(path.dirname(to), { recursive: true });
  if (/\.(html|js|css|svg)$/.test(name)) {
    let text = await fs.readFile(from, "utf8");
    text = text.replace(prefixes, match => base + match.slice(1));
    for (const file of ["branding.css", "local-runtime.js", "favicon.ico", "icon.png", "apple-icon.png", "manifest.webmanifest"])
      text = text.replace(new RegExp(`(?<![\\w/])/${file.replaceAll(".", "\\.")}`, "g"), base + file);
    // Home links in markup, client components and escaped Flight payloads.
    text = text.replace(/(href(?:=|:)\\*["'])\/(?=\\*["'])/g, "$1" + base);
    if (name === "local-runtime.js") {
      text = text.split("// Development-only audit")[0];
      text = text.replace("u.pathname==='/'", "u.pathname==='/collection/'");
    }
    if (name === "index.html") {
      text = text.replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://mclarenlife.github.io/collection/">');
      text = text.replaceAll("Butter creative platform graphic with design, motion, and editing tiles", "McLary’s APP Collection — Texite, Paperead, Chartelis and Zipite");
    }
    await fs.writeFile(to, text);
  } else await fs.copyFile(from, to);
  count++;
}
await fs.writeFile(path.join(destination, "manifest.webmanifest"), JSON.stringify({
  name: "McLary’s APP Collection", short_name: "Collection", start_url: base,
  scope: base, display: "browser", background_color: "#ebebeb", theme_color: "#ebebeb",
}));
console.log(`Collection included at ${base} (${count} files).`);
