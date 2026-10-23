import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './packages/workbench/App';
import {saveProject,loadProjects,createProjectBackup,archiveProjects} from './packages/platform/storage';
import './packages/ui/styles.css';
import './packages/ui/navigation.css';
import './packages/ui/polish.css';
import './tour.css';
import {installTour} from './tour';
import type {Project} from './packages/core/model';
import type {AIEvent} from './packages/core/ai';
import {demonstrationVariant} from './fixtures';
import {presetEdit} from './preset-ai';

const send=(event:string,extra:Record<string,unknown>={})=>parent.postMessage({type:'texite-demo',event,...extra},location.origin);
const read=async(file:string)=>{const r=await fetch('./demo/'+file);if(!r.ok)throw Error('无法载入示例资源');return r.text();};
const [before,after,bib,image]=await Promise.all([read('main.tex'),read('main-after.tex'),read('references.bib'),fetch('./demo/figures/comparison.png').then(r=>r.arrayBuffer())]);
const base64=btoa(Array.from(new Uint8Array(image),b=>String.fromCharCode(b)).join(''));
const fresh=():Project=>({id:'website-research-example',name:'实验记录',engine:'pdflatex',revision:0,updatedAt:Date.now(),mainFile:'main.tex',activeFile:'main.tex',files:[{path:'main.tex',content:before},{path:'references.bib',content:bib},{path:'figures/comparison.png',content:base64,binary:true}]});
const stored=await loadProjects();if(!stored.projects.length)await saveProject(fresh());
let current=stored.projects.find(p=>p.id===stored.lastId)||stored.projects[0]||fresh();
let compileCancelled=false,aiGeneration=0;
let activeRun:{runId:string;projectId:string}|null=null;
const listeners=new Set<(e:AIEvent)=>void>();
const pending=new Map<string,(result:any)=>void>();
const emit=(event:AIEvent)=>listeners.forEach(fn=>fn(event));
const getCurrent=async()=>{const data=await loadProjects();return data.projects.find(p=>p.id===data.lastId)||current;};
const notify=(text:string)=>send('notice',{text});
window.texite={
 platform:'win32',
 windowControl:async(action)=>send('window-control',{action}),
 listProjects:async()=>[],reopenProject:async()=>null,
 saveProject:async(project)=>{current=structuredClone(project);return {};},
 saveAIProject:async(project)=>{current=structuredClone(project);},
 restoreProject:async(project)=>{current=structuredClone(project);},
 importProject:async(project)=>project,
 openProject:async()=>{notify('网页体验不会打开电脑文件夹；可以使用软件中的导入 ZIP，或下载桌面版。');return null;},
 detectEngines:async()=>({bundled:false,latexmk:false,engines:{pdflatex:false,xelatex:false,lualatex:false,tectonic:false},details:{pdflatex:'网页示例回放，不运行编译器'}}),
 listRuntime:async()=>[],chooseRuntimePack:async()=>null,installRuntimePack:async()=>[],removeRuntimeModule:async()=>[],restoreDefaultRuntime:async()=>[],
 onCompileLog:()=>()=>{},cancelCompile:async()=>{compileCancelled=true;},
 chat:{get:async()=>({baseURL:'',model:''}),save:async()=>{throw Error('官网只提供预设流程。请在桌面版中配置真实 API。');},start:async()=>{throw Error('官网不连接真实模型。');},cancel:async()=>{}},
 compile:async(project)=>{
   compileCancelled=false;await new Promise(resolve=>setTimeout(resolve,650));
   const variant=demonstrationVariant(project,{before,after,bib,image:base64});
   const response=await fetch('./demo/'+variant+'.pdf');
   if(!response.ok)throw Error('模拟预览资源加载失败，请刷新后重试。');
   const pdf=new Uint8Array(await response.arrayBuffer());
   if(compileCancelled)return {success:false,cancelled:true,revision:project.revision,log:''};
   const message='网页未加载编译器，结果为模拟演示';
   send('pdf',{variant});send('notice',{text:message});
   return {success:true,compilerLabel:message,revision:project.revision,pdf:Array.from(pdf),log:message+'。\n预览使用预制示例 PDF，不保证对应当前源码。请在桌面版编译正式文稿。'};
 },
 ai:{
   connect:async()=>({connected:true,authenticated:true,version:'官网预设演示 · 不连接真实 Codex',account:'本地预设操作流程，不发送内容到网络',models:[{id:'website-preset',label:'预设演示（非模型）',isDefault:true}]}),
   chooseBinary:async()=>{notify('这里是预设演示，不会连接本机 Codex。');return null;},disconnect:async()=>{},clearHistory:async()=>{},
   onEvent:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},
   reply:async(id,result)=>{pending.get(id)?.(result);pending.delete(id);},
   cancel:async()=>{aiGeneration++;for(const resolve of pending.values())resolve({success:false});pending.clear();if(activeRun){emit({type:'done',...activeRun,status:'interrupted'});activeRun=null;}},
   start:async(input)=>{
     const generation=++aiGeneration;
     activeRun={runId:input.runId,projectId:input.projectId};
     const fire=(event:any)=>{if(generation===aiGeneration){emit({...event,runId:input.runId,projectId:input.projectId});if(event.type==='done')activeRun=null;}};
     const project=await getCurrent();
     if(input.readOnly){fire({type:'text',delta:'【对话预设回答】这份示例先介绍问题与 MAE 指标，再用表格和图展示结果，最后说明限制。建议在分享前检查引用，并为项目创建备份。此回答为网页预设，不连接真实 AI，也不修改文件。'});fire({type:'done',status:'completed'});return;}
     let context:any={};try{context=JSON.parse(input.context);}catch{}
     const path=context.inlineEdit?context.activeFile:project.mainFile;
     const original=project.files.find(f=>f.path===path)?.content||'';
     let edit;try{edit=presetEdit(original,context.inlineEdit);}catch(error){fire({type:'text',delta:'【预设演示】'+(error as Error).message});fire({type:'done',status:'completed'});return;}
     fire({type:'text',delta:edit.reply});
     await new Promise(resolve=>setTimeout(resolve,700));if(generation!==aiGeneration)return;
     const requestId=crypto.randomUUID();const result=new Promise<any>(resolve=>pending.set(requestId,resolve));
     fire({type:'tool',requestId,tool:'texite_apply_changes',arguments:{changes:[{path,before:original,after:edit.after}]}});
     const applied=await result;if(generation!==aiGeneration)return;
     fire({type:'text',delta:applied.success?'\n示例修改已写入文稿，可查看差异或撤回。':'\n当前文稿已有变化，修改未应用。'});fire({type:'done',status:applied.success?'completed':'failed'});
   }
 }
};
for(const [key,value] of Object.entries({appearance:'light',palette:'mono',font:'jetbrains','sidebar-width':200,'ui-size':'medium'})){if(localStorage.getItem('texite-website-'+key)===null)localStorage.setItem('texite-website-'+key,JSON.stringify(value));}
createRoot(document.getElementById('root')!).render(<App/>);
installTour({send,before,after,getCurrent,backup:async()=>createProjectBackup(await getCurrent(),'官网演示前自动备份'),reset:async()=>{await createProjectBackup(await getCurrent(),'重置示例前自动备份');await archiveProjects([fresh().id],false);await saveProject({...fresh(),revision:current.revision+1});location.reload();}});
