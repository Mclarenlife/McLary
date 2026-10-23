import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','guide.html','credits.html','templates.html','typography.css','theme.js']) await copyFile(file,`dist/${file}`);
for(const dir of ['assets','examples','workbench']) await cp(dir,`dist/${dir}`,{recursive:true});
console.log('Static website ready in dist/');
