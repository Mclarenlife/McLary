import type {Project} from './packages/core/model';
export const originalSentence='The larger training set gives a lower error in this example.';
export const revisedSentence='The larger set has lower error in this synthetic comparison.\nThis does not establish a general result.';
export const normalizeSource=(text:string)=>text.replace(/\r\n/g,'\n').trim();
export function replaceDemonstrationSentence(block:string){
  if(block.includes(revisedSentence))return block.replace(revisedSentence,originalSentence);
  if(block.includes(originalSentence))return block.replace(originalSentence,revisedSentence);
  throw Error('这段示例已被自定义修改。请先导出文稿，再使用设备下方的重置按钮重播。');
}
export function fixtureVariant(project:Project,fixture:{before:string;after:string;bib:string;image:string}){
  if(project.mainFile!=='main.tex'||project.engine!=='pdflatex')return null;
  if(project.files.find(f=>f.path==='references.bib')?.content!==fixture.bib||project.files.find(f=>f.path==='figures/comparison.png')?.content!==fixture.image)return null;
  const source=normalizeSource(project.files.find(f=>f.path==='main.tex')?.content||'');
  return source===normalizeSource(fixture.before)?'before':source===normalizeSource(fixture.after)?'after':null;
}
// The website deliberately simulates compilation using a prepared sample PDF.
// A non-matching document still gets a preview, always labelled as a simulation.
export function demonstrationVariant(project:Project,fixture:{before:string;after:string;bib:string;image:string}){
  const exact=fixtureVariant(project,fixture);
  if(exact)return exact;
  const source=normalizeSource(project.files.find(f=>f.path===project.mainFile)?.content||'');
  return source.includes(revisedSentence)?'after':'before';
}
