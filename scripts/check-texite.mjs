import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { projects } from "../src/content.js";

const root=path.resolve("build/texite");
const project=projects.find(p=>p.id==="texite");
assert.equal(project?.url,"/texite/");
assert((await fs.stat(path.join("build",project.image))).size>0);
const walk=async dir=>(await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name)))).flat();
const files=await walk(root);
let references=0;
for(const file of files) {
 assert((await fs.stat(file)).size<25*1024*1024,`Oversized asset: ${file}`);
 if(!/\.(html|css)$/.test(file))continue;
 const text=await fs.readFile(file,"utf8");
 const refs=file.endsWith(".html")?[...text.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]):[...text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)].map(m=>m[1]);
 for(const ref of refs) {
  if(/^(?:[a-z]+:|\/\/|#)/i.test(ref))continue;
  assert(!ref.startsWith("/"),`Root-relative link breaks /texite/: ${ref}`);
  const target=path.resolve(path.dirname(file),decodeURIComponent(ref.split(/[?#]/)[0]));
  assert(target===root||target.startsWith(root+path.sep),`Reference escapes site: ${ref}`);
  assert(await fs.stat(target).catch(()=>null),`Missing ${ref} from ${file}`);references++;
 }
}
const html=await fs.readFile(path.join(root,"index.html"),"utf8");
const frames=[...html.matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"/g)];
assert.deepEqual(frames.map(m=>m[1]),["workbench/"]);
for(const asset of ["workbench/demo/main.tex","workbench/demo/before.pdf","workbench/demo/after.pdf","examples/research-note.zip"])
 assert((await fs.stat(path.join(root,asset))).size>0);
console.log(`Texite checks passed: ${files.length} files, ${references} local references, portable workbench, examples and portfolio cover.`);
