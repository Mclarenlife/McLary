import { mkdir, readFile, writeFile } from "node:fs/promises";
const html = await readFile("build/index.html", "utf8");
for (const route of ["work", "contact", "playground"]) {
  await mkdir(`build/${route}`, { recursive: true });
  await writeFile(`build/${route}/index.html`, html);
}
for (const [oldPage, newPage] of Object.entries({
  projects: "work",
  about: "contact",
  world: "playground",
})) {
  await mkdir(`build/${oldPage}`, { recursive: true });
  await writeFile(
    `build/${oldPage}/index.html`,
    `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/${newPage}/"><title>McLary</title></head><body><a href="/${newPage}/">Continue to McLary</a></body></html>`,
  );
}
