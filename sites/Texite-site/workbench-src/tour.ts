import {EditorView} from '@codemirror/view';
import {Transaction} from '@codemirror/state';
import type {Project} from './packages/core/model';
import {originalSentence,revisedSentence} from './fixtures';
import {demoPassages} from './preset-ai';
type Options={send:(event:string,data?:Record<string,unknown>)=>void;before:string;after:string;getCurrent:()=>Promise<Project>;backup:()=>Promise<unknown>;reset:()=>Promise<void>};
export const scenes=['write','tools','search','references','history','ai','settings'];
export function installTour(options:Options){
 const cursor=document.createElement('div');cursor.className='tour-cursor';cursor.setAttribute('aria-hidden','true');cursor.innerHTML='<svg viewBox="0 0 38 46"><path d="M4 2 5 34 13 26 20 42 27 39 20 24 32 24Z" fill="#202521" stroke="white" stroke-width="2.5" stroke-linejoin="round"/></svg>';
 const ring=document.createElement('div');ring.className='tour-ring';
 const label=document.createElement('div');label.className='tour-step-label';label.setAttribute('aria-hidden','true');
 const focusBox=document.createElement('div');focusBox.className='tour-focus-frame';focusBox.setAttribute('aria-hidden','true');document.body.append(cursor,ring,label,focusBox);
 let settingsOpenedByTour=false;
 let generation=0,playing=false,scene='write',x=650,y=650,animation:Animation|null=null;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
 const assertActive=(run:number)=>{if(run!==generation)throw new DOMException('Stopped','AbortError');};
 const visible=(element:HTMLElement)=>element.getBoundingClientRect().width>0;
 const findButton=(name:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(e=>visible(e)&&(e.getAttribute('aria-label')===name||e.title===name||e.textContent?.trim()===name));
 const waitElement=async(get:()=>HTMLElement|undefined|null,run:number)=>{for(let i=0;i<100;i++){assertActive(run);const e=get();if(e&&visible(e)&&!(e as HTMLButtonElement).disabled)return e;await sleep(100);}throw Error('当前步骤的控件尚未就绪。请关闭弹窗后重播，已编辑内容会保留。');};
 const pause=async(ms:number,run:number)=>{await sleep(ms);assertActive(run);};
 const closeTools=()=>findButton('关闭编辑工具')?.click();
 function clean(){animation?.cancel();animation=null;cursor.classList.remove('show');label.classList.remove('show');ring.classList.remove('click');focusBox.classList.remove('show');document.querySelectorAll('.tour-target,.tour-typing').forEach(e=>e.classList.remove('tour-target','tour-typing'));}
 function stop(message='你已接手操作，演示已停止。'){if(!playing)return;playing=false;generation++;clean();void window.texite?.ai?.cancel();options.send('stopped',{text:message});}
 async function movePoint(nextX:number,nextY:number,run:number,hint?:string){
   assertActive(run);cursor.classList.add('show');animation=cursor.animate([{transform:`translate(${x}px,${y}px)`},{transform:`translate(${nextX}px,${nextY}px)`}],{duration:reduced()?0:700,easing:'cubic-bezier(.22,.7,.24,1)',fill:'forwards'});
   await animation.finished.catch(()=>{});assertActive(run);x=nextX;y=nextY;cursor.style.transform=`translate(${x}px,${y}px)`;animation.cancel();animation=null;
   if(hint){label.textContent=hint;label.style.left=Math.max(10,Math.min(innerWidth-340,x-30))+'px';label.style.top=Math.min(innerHeight-70,y+35)+'px';label.classList.add('show');}
 }
 async function move(element:HTMLElement,run:number,hint?:string){element.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced()?'instant':'smooth'});await pause(350,run);const r=element.getBoundingClientRect();await movePoint(r.left+r.width*.5,r.top+r.height*.5,run,hint);element.classList.add('tour-target');await pause(450,run);}
 function pulse(){ring.style.left=x+'px';ring.style.top=y+'px';ring.classList.remove('click');void ring.offsetWidth;ring.classList.add('click');}
 async function clickElement(element:HTMLElement,run:number,hint?:string){await move(element,run,hint);pulse();element.click();await pause(600,run);element.classList.remove('tour-target');label.classList.remove('show');}
 const click=async(name:string,run:number,hint?:string)=>clickElement(await waitElement(()=>findButton(name),run),run,hint||name);
 function inputValue(input:HTMLInputElement|HTMLTextAreaElement,value:string){const prototype=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}
 async function type(input:HTMLInputElement|HTMLTextAreaElement,text:string,run:number,hint='输入内容'){
   await move(input,run,hint);input.focus({preventScroll:true});const number=input instanceof HTMLInputElement&&input.type==='number';if(!number)input.select();input.classList.add('tour-typing');await pause(550,run);
   if(number)inputValue(input,text);else{inputValue(input,'');for(let i=1;i<=text.length;i++){assertActive(run);inputValue(input,text.slice(0,i));input.setSelectionRange(i,i);await sleep(reduced()?0:22);}}
   await pause(650,run);input.classList.remove('tour-target','tour-typing');label.classList.remove('show');
 }
 const input=async(name:string,run:number)=>await waitElement(()=>document.querySelector<HTMLInputElement|HTMLTextAreaElement>(`input[aria-label="${name}"],textarea[aria-label="${name}"]`),run) as HTMLInputElement|HTMLTextAreaElement;
 function editor(){const dom=[...document.querySelectorAll<HTMLElement>('.cm-editor')].find(visible);const view=dom&&EditorView.findFromDOM(dom);if(!view)throw Error('请先打开 main.tex 的 Code 编辑器。');return view;}
 async function selectCode(from:number,to:number,run:number,hint:string,popup=false){
   closeTools();const view=editor();view.dispatch({effects:EditorView.scrollIntoView(from,{y:'center'})});await pause(450,run);const start=view.coordsAtPos(from);if(!start)throw Error('未找到示例文字的位置。');
   await movePoint(start.left,(start.top+start.bottom)/2,run,hint);pulse();view.focus();view.dispatch({selection:{anchor:from}});
   if(to!==from){const end=view.coordsAtPos(to);const moving=(end?movePoint(end.left,(end.top+end.bottom)/2,run,'拖动鼠标选中这段文字'):Promise.resolve()).catch(()=>{});for(let i=1;i<=7;i++){assertActive(run);view.dispatch({selection:{anchor:from,head:Math.round(from+(to-from)*i/7)}});await pause(reduced()?0:85,run);}await moving;assertActive(run);}
   await pause(650,run);label.classList.remove('show');if(popup){view.contentDOM.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:x,clientY:y}));await pause(450,run);}
 }
 async function codeType(text:string,run:number){const view=editor();closeTools();view.focus();for(const char of text){assertActive(run);view.dispatch({...view.state.replaceSelection(char),annotations:Transaction.userEvent.of('input.type')});await sleep(reduced()?0:25);}await pause(650,run);}
 async function frameSelection(run:number,text='已定位到对应内容'){
   const view=editor(),pos=view.state.selection.main.from;view.dispatch({effects:EditorView.scrollIntoView(pos,{y:'center'})});await pause(450,run);const c=view.coordsAtPos(pos),r=view.scrollDOM.getBoundingClientRect();if(!c)return;
   focusBox.style.cssText=`left:${r.left+4}px;top:${c.top-6}px;width:${r.width-15}px;height:${Math.max(34,c.bottom-c.top+12)}px`;focusBox.dataset.label=text;focusBox.classList.add('show');await pause(2800,run);focusBox.classList.remove('show');
 }
 function passage(){const source=editor().state.doc.toString(),text=demoPassages.find(t=>source.includes(t));if(!text)throw Error('示例结果段落已被自定义修改，请先备份并重置示例后重播。');return {text,from:source.indexOf(text),to:source.indexOf(text)+text.length};}
 async function contextMenu(pos:number,run:number){await selectCode(pos,pos,run,'把光标放在插入位置');const view=editor(),c=view.coordsAtPos(pos)!;await movePoint(c.left,(c.top+c.bottom)/2,run,'鼠标右键：打开插入工具');pulse();view.contentDOM.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,buttons:2,clientX:c.left+1,clientY:(c.top+c.bottom)/2}));await pause(700,run);label.classList.remove('show');}
 function closeTourSettings(){if(settingsOpenedByTour){if(document.querySelector('.settings-dialog'))findButton('关闭弹窗')?.click();settingsOpenedByTour=false;}}
 async function selectScene(next:string){if(playing)return;if(next!=='settings')closeTourSettings();
   if(next==='settings'){findButton('关闭 AI 面板')?.click();if(![...document.querySelectorAll<HTMLElement>('[role="dialog"]')].some(visible)){findButton('设置')?.click();settingsOpenedByTour=true;}options.send('scene',{scene:next});return;}const panel=({history:'修改历史',search:'项目搜索',references:'参考文献'} as Record<string,string>)[next]||'项目文件';findButton(panel)?.click();if(next==='ai'){if(findButton('AI 助手')?.getAttribute('aria-pressed')!=='true')findButton('AI 助手')?.click();}else findButton('关闭 AI 面板')?.click();options.send('scene',{scene:next});}
 async function prepare(run:number){
   closeTools();closeTourSettings();await pause(250,run);if([...document.querySelectorAll<HTMLElement>('[role="dialog"]')].some(visible))throw Error('请先关闭当前弹窗，再开始演示。');findButton('关闭 AI 面板')?.click();findButton('返回编辑')?.click();findButton('展开侧栏')?.click();
   await pause(500,run);const project=await options.getCurrent();assertActive(run);if(project.id!=='website-research-example')throw Error('请打开“实验记录”示例后播放演示。');await options.backup();assertActive(run);findButton('拆分')?.click();await click('项目文件',run);await click('main.tex',run);await click('Code',run);findButton('PDF')?.click();
 }
 async function editTitle(run:number){const source=editor().state.doc.toString(),match=/\\title\{([^}]+)\}/.exec(source);if(!match)throw Error('未找到示例标题。');const start=match.index+7;await selectCode(start,start+match[1].length,run,'选中标题，在 Code 模式输入');await codeType(match[1].includes('Carefully')?'A Small Experiment, Clearly Reported':'A Small Experiment, Carefully Reviewed',run);}
 async function editVisual(run:number){
   await click('Visual',run,'切换到 Visual，直接编辑正文');const paragraph=await waitElement(()=>[...document.querySelectorAll<HTMLElement>('.visual-content')].find(e=>demoPassages.some(t=>e.textContent?.includes(t.split('\n')[0]))),run);await clickElement(paragraph,run,'点击结果段落');
   const field=await waitElement(()=>document.querySelector<HTMLTextAreaElement>('.visual-block textarea'),run) as HTMLTextAreaElement;const known=demoPassages.find(t=>field.value.includes(t));if(!known)throw Error('示例结果段落已变化。');await type(field,field.value.replace(known,known===originalSentence?revisedSentence:originalSentence),run,'在 Visual 中改写这段文字');
 }
 async function waitAI(run:number){for(let i=0;i<100;i++){await pause(100,run);if(!findButton('停止 AI 任务')&&document.querySelector('.ai-reply'))return;}throw Error('预设任务未完成，请停止后重试。');}
 type Step={text:string;act:()=>Promise<unknown>};
 function steps(kind:string,run:number):Step[]{
   const step=(text:string,act:()=>Promise<unknown>)=>({text,act});
   if(kind==='settings')return [
     step('打开设置，从外观与主题开始；演示不会改动你的偏好。',async()=>{await click('设置',run);settingsOpenedByTour=true;await click('外观与主题',run);await move(await waitElement(()=>document.querySelector<HTMLElement>('[role="radiogroup"][aria-label="外观"]'),run),run,'浅色、深色，或跟随系统');await pause(1600,run);}),
     step('同一页还可以选择界面字号，编辑器文字另行设置。',async()=>{await move(await waitElement(()=>document.querySelector<HTMLElement>('[role="radiogroup"][aria-label="界面字号"]'),run),run,'界面字号：小、中、大');await pause(2000,run);}),
     step('编辑器文字：正文、语法配色与字体各自可调。',async()=>{await click('编辑器文字',run);await move(await waitElement(()=>document.querySelector<HTMLElement>('.editor-color-cards'),run),run,'正文和语法文字可以分别配色');await pause(1600,run);await move(await waitElement(()=>document.querySelector<HTMLElement>('[role="radiogroup"][aria-label="编辑字体"]'),run),run,'选择字体，右侧实时预览');await pause(2000,run);}),
     step('编译设置：桌面版可选引擎与主文件，网页仅模拟编译。',async()=>{await click('编译设置',run);await move(await waitElement(()=>document.querySelector<HTMLElement>('.engine-note'),run),run,'网页未加载编译器，结果为模拟演示');await pause(2200,run);}),
     step('同步与存储：了解桌面版 WebDAV 与项目保存位置，查看存储清理。',async()=>{await click('同步与存储',run);await move(await waitElement(()=>document.querySelector<HTMLElement>('#settings-panel-sync .settings-note'),run),run,'此处仅浏览，不连接服务或清理数据');await pause(2600,run);}),
     step('关于：查看版本、更新日志与项目链接。',async()=>{await click('关于',run);await move(await waitElement(()=>document.querySelector<HTMLElement>('.about-brand'),run),run,'版本与项目链接');await pause(1500,run);await move(await waitElement(()=>document.querySelector<HTMLElement>('.about-changelog h3'),run),run,'更新日志');await pause(2000,run);}),
     step('关闭设置，回到文稿；你可以自行尝试外观与字体。',async()=>{await click('关闭弹窗',run);settingsOpenedByTour=false;})
   ];
   if(kind==='write')return [
     step('在 Code 模式选中标题，逐字输入新标题。',()=>editTitle(run)),
     step('切换 Visual，直接修改结果段落。',()=>editVisual(run)),
     step('切回 Code：刚才的文字已经同步到源码。',async()=>{await click('Code',run);const p=passage();await selectCode(p.from,p.to,run,'查看同步后的源码');await frameSelection(run,'Visual 修改已同步到源码');}),
     step('点击编译，查看模拟排版结果。',async()=>{await click('编译文稿',run);await pause(1800,run);}),
     step('右侧显示模拟 PDF；网页未加载真实编译器。',async()=>{await move(await waitElement(()=>document.querySelector<HTMLElement>('.preview-container .preview-notice'),run),run,'网页未加载编译器，结果为模拟演示');await pause(1800,run);})
   ];
   if(kind==='tools')return [
     step('在正文空白处点击右键，打开插入表格。',async()=>{const pos=editor().state.doc.toString().indexOf('\\subsection{Before sharing}');if(pos<0)throw Error('未找到插入示例的位置。');await contextMenu(pos,run);await click('插入表格',run);}),
     step('设置两行两列，并勾选三线表。',async()=>{await type(await input('表格行数',run),'2',run);await type(await input('表格列数',run),'2',run);await clickElement(await waitElement(()=>[...document.querySelectorAll<HTMLLabelElement>('.insert-form label')].find(e=>e.textContent?.trim()==='三线表'),run),run,'勾选三线表');await click('插入表格代码',run);await frameSelection(run,'表格代码已插入');}),
     step('再次右键，打开符号选择窗口。',async()=>{await contextMenu(editor().state.selection.main.head,run);await click('插入符号',run);await type(await input('搜索符号',run),'alpha',run,'搜索 alpha');}),
     step('点击 α，插入对应的 LaTeX 符号命令。',async()=>{await click('插入 \\alpha',run,'点击 α');await frameSelection(run,'符号命令已插入');}),
     step('拖动鼠标选中结果段落，弹出行内 AI 输入框。',async()=>{const p=passage();await selectCode(p.from,p.to,run,'选中需要修改的文字',true);}),
     step('输入修改要求并发送；使用预设内容，不连接真实 AI。',async()=>{await type(await input('行内 AI 指令',run),'把这段结果表述改得更谨慎，说明示例数据的限制。',run);await click('执行行内 AI 指令',run);await waitAI(run);}),
     step('查看预设回答：只改选中文字，保留其余内容。',async()=>{await move(await waitElement(()=>[...document.querySelectorAll<HTMLElement>('.ai-reply')].at(-1),run),run,'这是预设回答，并未调用真实 AI');await pause(1800,run);await click('关闭 AI 面板',run);const p=passage();await selectCode(p.from,p.to,run,'查看修改后的段落');await frameSelection(run,'选中的段落已更新');})
   ];
   if(kind==='search')return [
     step('打开项目搜索，先选择搜索范围。',async()=>{await click('项目搜索',run);await clickElement(await waitElement(()=>document.querySelector<HTMLElement>('.search-scope-button'),run),run,'限定搜索文件');}),
     step('清除选择，只勾选 main.tex。',async()=>{await click('清除选择',run);await clickElement(await waitElement(()=>[...document.querySelectorAll<HTMLLabelElement>('.scope-file-list label')].find(e=>e.textContent?.trim()==='main.tex'),run),run,'只搜索 main.tex');await click('应用范围',run);}),
     step('输入 synthetic，查找包含该词的正文。',async()=>{await type(await input('搜索项目内容',run),'synthetic',run,'搜索 synthetic');}),
     step('点击查找结果；方框标出编辑器跳转到的对应行。',async()=>{await clickElement(await waitElement(()=>document.querySelector<HTMLElement>('.project-search>button:not(.search-scope-button)'),run),run,'点击结果，定位到源码');await frameSelection(run,'查找结果对应的源码位置');})
   ];
   if(kind==='references')return [
     step('先把光标放在正文中需要引用的位置。',async()=>{const source=editor().state.doc.toString(),prefix='A useful reference: ';let pos=source.indexOf(prefix);if(pos<0){pos=source.indexOf('\\bibliographystyle');if(pos<0)throw Error('未找到示例参考文献区域。');await selectCode(pos,pos,run,'添加一行引用说明');await codeType(prefix+'.\n',run);}else{const start=pos+prefix.length,end=editor().state.doc.lineAt(start).to;await selectCode(start,end,run,'准备新的引用位置');await codeType('.',run);}await selectCode(pos+prefix.length,pos+prefix.length,run,'点击需要插入引用的位置',true);closeTools();}),
     step('打开参考文献面板，按作者检索。',async()=>{await click('参考文献',run);await type(await input('搜索参考文献',run),'Lamport',run,'查找 Lamport 的文献');}),
     step('找到目标文献，点击“插入引用”。',async()=>{const button=await waitElement(()=>[...document.querySelectorAll<HTMLElement>('.reference-list>button')].find(e=>e.textContent?.includes('latex1994')),run);await clickElement(button.querySelector<HTMLElement>('.reference-insert')||button,run,'插入引用');}),
     step('引用命令已写入刚才的光标位置。',async()=>{await frameSelection(run,'已插入 \\cite{latex1994}');})
   ];
   if(kind==='history')return [
     step('打开历史面板，备份整个项目并添加备注。',async()=>{await click('修改历史',run);await click('备份当前项目',run);await type(await input('备份备注',run),'演示：修改标题前',run);await click('保存备份',run);}),
     step('修改标题，生成一条新的文件修改记录。',async()=>{await click('项目文件',run);await editTitle(run);await pause(900,run);}),
     step('在修改历史中打开本次记录，查看增删差异。',async()=>{await click('修改历史',run);await clickElement(await waitElement(()=>document.querySelector<HTMLElement>('.history-list>button'),run),run,'查看修改差异');}),
     step('先预览恢复差异，再保留当前版本并恢复。',async()=>{await click('恢复到修改前',run);await pause(2200,run);await click('保留当前版本并恢复',run);}),
     step('项目备份还能一键还原整份项目。',async()=>{await clickElement(await waitElement(()=>[...document.querySelectorAll<HTMLButtonElement>('.backup-row button')].find(e=>e.getAttribute('aria-label')==='还原备份 演示：修改标题前'),run),run,'还原备份；当前版本会自动保留');await pause(1800,run);findButton('返回编辑')?.click();})
   ];
   return [
     step('打开 AI 助手，启用本地预设演示。',async()=>{await click('AI 助手',run);await click('Agent',run);if(findButton('启用预设演示'))await click('启用预设演示',run);}),
     step('输入明确要求，让 Agent 修改示例结果段落。',async()=>{await type(await input('发送给 Codex 的指令',run),'将结果表述改得更谨慎，保留 LaTeX 命令。',run);await click('发送 AI 指令',run);await waitAI(run);}),
     step('打开修改差异，核对新增和删除内容。',async()=>{await clickElement(await waitElement(()=>[...document.querySelectorAll<HTMLElement>('.ai-changes')].at(-1),run),run,'查看本次修改差异');await pause(2300,run);}),
     step('不满意时，撤回整次修改。',async()=>{await click('撤回整次修改',run);await pause(1000,run);findButton('关闭弹窗')?.click();}),
     step('切换到对话模式，询问文稿结构。',async()=>{await click('对话',run);const service=findButton('对话服务');if(service&&!service.textContent?.includes('Codex')){await clickElement(service,run,'选择 Codex 预设演示');await clickElement(await waitElement(()=>[...document.querySelectorAll<HTMLElement>('[role="option"]')].find(e=>e.textContent?.trim()==='Codex'),run),run,'Codex');}await type(await input('发送给 Codex 的指令',run),'请解释这份文稿的结构，并给出检查建议。',run);await click('发送 AI 指令',run);await waitAI(run);}),
     step('对话只回答问题，不修改文稿；回答同样为预设内容。',async()=>{await move(await waitElement(()=>[...document.querySelectorAll<HTMLElement>('.ai-reply')].at(-1),run),run,'预设对话回答 · 不修改文件');await pause(2200,run);})
   ];
 }
 async function play(next:string){
   stop();playing=true;scene=next;const run=++generation;options.send('started',{scene});
   try{const flow=steps(scene,run),total=flow.length+1;options.send('step',{step:1,total,text:'先自动备份当前示例，再开始演示。'});await prepare(run);for(let i=0;i<flow.length;i++){assertActive(run);options.send('step',{step:i+2,total,text:flow[i].text});await flow[i].act();assertActive(run);}await pause(1200,run);playing=false;clean();options.send('finished',{text:'演示结束，可以直接接手操作，也可以选择下一项功能。'});}catch(error){if((error as Error).name==='AbortError')return;stop((error as Error).message);}
 }
 document.addEventListener('pointerdown',event=>{if(event.isTrusted)stop();},true);document.addEventListener('keydown',event=>{if(event.isTrusted)stop();},true);
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='texite-demo-command')return;const {command,scene:next}=event.data;if(command==='play'&&scenes.includes(next))void play(next);if(command==='stop')stop('演示已停止，当前操作结果已保留。');if(command==='scene'&&scenes.includes(next))void selectScene(next);if(command==='reset'){stop();void options.reset();}});
 void (async()=>{for(let i=0;i<100;i++){const compile=findButton('编译文稿');if(compile&&document.querySelector('.cm-editor')){compile.click();options.send('ready');return;}const space=document.querySelector<HTMLElement>('.project-space');if(space&&!space.hidden&&visible(space)){options.send('ready');return;}await sleep(100);}options.send('notice',{text:'工作区加载较慢，请刷新后重试。'});})();
}
