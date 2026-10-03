import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Local workspace keeps sub-sites beside Website; the GitHub source archive
// carries the same source under sites/ so a fresh clone can build independently.
const candidates = [
  process.env.FILES_SITE_ROOT,
  path.resolve(root, "../sites/FILES-site"),
  path.join(root, "sites/FILES-site"),
].filter(Boolean);
const source = candidates.find((dir) => existsSync(path.join(dir, "scripts/build.mjs")));
if (!source) throw new Error("FILES-site source missing. Set FILES_SITE_ROOT to its directory.");
execFileSync(process.execPath, ["scripts/build.mjs", "--base=/files/"], { cwd: source, stdio: "inherit" });
const destination = path.join(root, "build/files");
await mkdir(destination, { recursive: true });
await cp(path.join(source, "dist"), destination, { recursive: true });
console.log("FILES-site included at /files/.");

const bwCandidates = [
  process.env.BW_SITE_ROOT,
  path.resolve(root, "../sites/B&W"),
  path.join(root, "sites/B&W"),
].filter(Boolean);
const bwSource = bwCandidates.find((dir) => existsSync(path.join(dir, "index.html")));
if (!bwSource) throw new Error("B&W source missing. Set BW_SITE_ROOT to its directory.");
const bwDestination = path.join(root, "build/bw");
await mkdir(bwDestination, { recursive: true });
// This standalone site uses relative URLs, which also work under the Pages subpath.
for (const entry of ["index.html", "assets", "css", "js"]) {
  await cp(path.join(bwSource, entry), path.join(bwDestination, entry), { recursive: true });
}
console.log("B&W included at /bw/.");
