import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=[process.env.TEXITE_SITE_ROOT,path.resolve(root,"../sites/Texite site"),path.join(root,"sites/Texite-site")]
  .filter(Boolean).find(dir=>existsSync(path.join(dir,"workbench/index.html")));
if(!source) throw new Error("Texite site missing. Set TEXITE_SITE_ROOT to its directory.");
// The supplied workbench is already compiled with relative URLs. Package the
// current site files, rather than an older dist/ or a rebuilt desktop app.
const destination=path.join(root,"build/texite");
await mkdir(destination,{recursive:true});
for(const entry of ["index.html","styles.css","app.js","guide.html","credits.html","templates.html","typography.css","theme.js","assets","examples","workbench"])
  await cp(path.join(source,entry),path.join(destination,entry),{recursive:true});
console.log("Texite interactive website included at /texite/.");
