import {originalSentence,revisedSentence} from './fixtures.ts';
export const inlineRevision='In this synthetic comparison, the larger training set has a lower error. Further experiments are needed before drawing a general conclusion.';
export const demoPassages=[originalSentence,revisedSentence,inlineRevision];
export function presetEdit(source:string,scope?:{from:number;to:number}){
  const normalized=source.replace(/\r\n/g,'\n');
  if(scope){
    const {from,to}=scope;
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<=from||to>source.length)throw Error('请选中示例的结果段落后重试。');
    const selected=source.slice(from,to);
    if(!demoPassages.includes(selected.replace(/\r\n/g,'\n')))throw Error('此处演示预设的结果段落润色，不修改其他自定义文字。');
    const replacement=selected===inlineRevision?revisedSentence:inlineRevision;
    return {after:source.slice(0,from)+replacement+source.slice(to),reply:'【行内 AI 预设演示】已只修改选中的结果描述，补充示例数据的限制。选区外的命令和正文保持不变。'};
  }
  const passage=demoPassages.find(text=>normalized.includes(text));
  if(!passage)throw Error('请使用示例的结果段落体验预设修改。自定义正文不会被覆盖。');
  const replacement=passage===revisedSentence?inlineRevision:revisedSentence;
  // Match the original line endings without changing unrelated content.
  const exact=source.includes(passage)?passage:passage.replace(/\n/g,'\r\n');
  return {after:source.replace(exact,replacement),reply:'【AI 助手预设演示】已调整结果描述，避免将这组示例数据写成普遍结论。请核对差异，也可以撤回整次修改。'};
}
