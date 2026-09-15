import fs from "node:fs/promises";
import path from "node:path";
const issues = [];
async function walk(dir) {
  return (
    await Promise.all(
      (await fs.readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name),
      ),
    )
  ).flat();
}
const files = await walk("build");
for (const route of ["", "work/", "contact/", "playground/"])
  if (!files.includes(path.join("build", route, "index.html")))
    issues.push(`Missing route: ${route}`);
for (const file of files) {
  if (/\.(html|js|css)$/.test(file)) {
    const text = await fs.readFile(file, "utf8");
    if (/unseen\.co|wp-content|<iframe/i.test(text))
      issues.push(`Old-site reference: ${file}`);
  }
  if ((await fs.stat(file)).size > 25 * 1024 * 1024)
    issues.push(`Oversized asset: ${file}`);
}
const html = await fs.readFile("build/index.html", "utf8");
for (const m of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g))
  if (!(await fs.stat("build" + m[1]).catch(() => null)))
    issues.push(`Missing resource: ${m[1]}`);
console.log(
  JSON.stringify(
    { routes: 4, files: files.length, originalSiteReferences: 0, issues },
    null,
    2,
  ),
);
if (issues.length) process.exitCode = 1;
