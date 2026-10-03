import {siteMarkup} from '../src/site-path.js';
import {cp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {architects} from '../src/data.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const a of architects)for(const source of a.kind==='lesson'?[a.portrait,...a.works.map(w=>w[3])]:['portrait',0,1,2].map(suffix=>`/assets/${a.id}-${suffix}.avif`)) {
 const asset=path.join(root,source.replace(/^\//,''));
 if((await stat(asset)).size<100)throw new Error(`Missing or empty asset: ${asset}`);
}
const option=process.argv.find(arg=>arg.startsWith('--base='))?.slice(7)||'/';
if(!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(option))throw new Error('Base must be / or a path such as /files/');
const dist=path.join(root,'dist');await mkdir(dist,{recursive:true});
for(const file of ['index.html','favicon.svg','src','assets'])await cp(path.join(root,file),path.join(dist,file),{recursive:true});
const html=siteMarkup((await readFile(path.join(root,'index.html'),'utf8')).replace('name="site-base" content="/"',`name="site-base" content="${option}"`),option);
await writeFile(path.join(dist,'index.html'),html);
for(const route of ['about',...architects.map(a=>`cases/${a.id}`)]){
 await mkdir(path.join(dist,route),{recursive:true});
 await writeFile(path.join(dist,route,'index.html'),html);
}
await writeFile(path.join(dist,'404.html'),html);
console.log(`Built ${architects.length+2} routes with local lesson diagrams, archive images and font → dist/`);
