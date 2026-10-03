import {siteMarkup} from '../src/site-path.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {architects,groups} from '../src/data.js';
import {resolveRoute} from '../src/routes.js';
import {homeView,detailView} from '../src/views.js';
import {blendColor} from '../src/color-lab.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
let sequence=0;
async function setup({path='/',motion=false,controlled=false,base='/'}={}){
 const window=new Window({url:`http://localhost:4173${path}`,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true,disableComputedStyleRendering:true}});
 window.document.write(siteMarkup(html.replace('name="site-base" content="/"', 'name="site-base" content="'+base+'"'),base));
 const animations=[];
 window.HTMLElement.prototype.animate=function(keyframes,options){
  let finish;const finished=controlled?new Promise(resolve=>{finish=resolve}):Promise.resolve();
  const entry={keyframes,options,target:this,finish:finish||(()=>{})};animations.push(entry);
  return{finished,cancel(){entry.finish()}};
 };
 window.matchMedia=()=>({matches:!motion});
 let y=0;Object.defineProperty(window,'scrollY',{get:()=>y});window.scrollTo=({top})=>{y=top};
 for(const key of ['window','document','history','location','IntersectionObserver','matchMedia'])globalThis[key]=key==='window'?window:window[key];
 globalThis.innerWidth=1440;globalThis.innerHeight=900;
 await import(`../src/app.js?test=${++sequence}`);
 return{window,document:window.document,animations,click:selector=>window.document.querySelector(selector).dispatchEvent(new window.MouseEvent('click',{bubbles:true,button:0,cancelable:true})),cleanup:()=>window.happyDOM.abort()};
}
test('all file links resolve and their image files exist',async()=>{
 const homepage=homeView();
 for(const a of architects){
  assert.ok(homepage.includes(`href="/cases/${a.id}"`));
  assert.equal(resolveRoute(`/cases/${a.id}/`).architect.id,a.id);
  const detail=detailView(a);
  for(const sibling of groups[a.group].ids)assert.ok(detail.includes(`href="/cases/${sibling}"`));
  const images=a.kind==='lesson'?[a.portrait,...a.works.map(w=>w[3])]:['portrait',0,1,2].map(suffix=>`/assets/${a.id}-${suffix}.avif`);
  for(const image of images)assert.ok((await stat(new URL(`..${image}`,import.meta.url))).size>100);
 }
 assert.equal(resolveRoute('/cases/not-real').type,'not-found');
 assert.equal(resolveRoute('/cases/frank-gehry/extra').type,'not-found');
});
test('photography files render lesson content and diagrams without architect biography fields',async()=>{
 for(const id of ['frank-lloyd-wright','irving-gill']){
  const app=await setup({path:`/cases/${id}`});
  const lesson=app.document.querySelector('.lesson-dossier');
  assert.ok(lesson);
  assert.equal(lesson.querySelectorAll('.lesson-practice').length,3);
  assert.equal(lesson.querySelectorAll('.identity dt').length,3);
  assert.doesNotMatch(lesson.textContent,/Born:|Died:|undefined|Fallingwater|Dodge House|AMERICAN MODERNISM/);
  for(const img of lesson.querySelectorAll('img'))assert.match(img.src,/\/assets\/(camera|composition)-.*\.svg$/);
  app.click('.photo-button');
  assert.equal(app.document.querySelector('#lightbox img').getAttribute('src'),lesson.querySelector('.photo-button').dataset.photo);
  await app.cleanup();
 }
});

test('the color collection has five complete lessons and switches between all its tabs',async()=>{
 const app=await setup();
 const ids=['frank-gehry','color-relationships','color-palette','color-contrast','color-blending'];
 assert.equal(app.document.querySelector('[data-group="1"] .folder-tabs').getAttribute('aria-label'),'色彩知识');
 assert.equal(app.document.querySelectorAll('[data-group="1"] .file-leaves').length,5);
 app.click('a[href="/cases/frank-gehry"]');
 for(const id of ids){
  if(app.window.location.pathname!==`/cases/${id}`)app.click(`.case-tabs a[href="/cases/${id}"]`);
  const lesson=app.document.querySelector('.lesson-dossier');
  assert.equal(app.document.querySelectorAll('.case-tabs .folder-tab').length,5);
  assert.ok(lesson.classList.contains('color-dossier'));
  assert.equal(lesson.querySelectorAll('.chromatic-chapter').length,5);
  assert.equal(lesson.querySelectorAll('.chromatic-question').length,5);
  assert.equal(lesson.querySelectorAll('.chromatic-swatches figure').length,4);
  assert.ok(lesson.querySelector('.chromatic-takeaway'));
  for(const link of lesson.querySelectorAll('.chromatic-contents a'))assert.ok(lesson.querySelector(link.getAttribute('href')));
  assert.equal(lesson.querySelectorAll('.lesson-practice').length,architects.find(a=>a.id===id).works.length);
  assert.match(lesson.querySelector('.lesson-kicker').textContent,/COLOR/);
  assert.doesNotMatch(lesson.textContent,/Born:|Died:|undefined|PHOTOGRAPHY|摄影学习档案|Guggenheim|Frank Gehry/);
  for(const img of lesson.querySelectorAll('img'))assert.match(img.src,/\/assets\/color-.*\.svg$/);
  assert.equal(app.document.querySelector('.next-folder-preview').getAttribute('href'),'/cases/louis-kahn');
 }
 app.click('.brand');
 assert.equal(app.document.querySelectorAll('[data-group="1"] .folder-tabs .folder-tab').length,5);
 await app.cleanup();
});

test('blend math honors opacity, neutral colors and order-dependent overlay',()=>{
 assert.equal(blendColor('#000000','#ffffff','normal',.5),'#808080');
 for(const mode of ['normal','multiply','screen','overlay'])assert.equal(blendColor('#246f8f','#ef984d',mode,0),'#246f8f');
 assert.equal(blendColor('#246f8f','#ffffff','multiply',1),'#246f8f');
 assert.equal(blendColor('#246f8f','#000000','screen',1),'#246f8f');
 assert.equal(blendColor('#804020','#80c0ff','multiply',1),'#403020');
 assert.equal(blendColor('#804020','#80c0ff','screen',1),'#c0d0ff');
 assert.equal(blendColor('#404040','#c0c0c0','overlay',1),'#606060');
 assert.equal(blendColor('#c0c0c0','#404040','overlay',1),'#a1a1a1');
});

test('racing collection provides four complete field notebooks and preserves group navigation',async()=>{
 const ids=['louis-kahn','i-m-pei','paul-rudolph','race-practice'];
 const app=await setup();
 assert.equal(app.document.querySelector('[data-group="2"] .folder-tabs').getAttribute('aria-label'),'赛车技巧');
 assert.equal(app.document.querySelectorAll('[data-group="2"] .file-leaves').length,4);
 app.click('a[href="/cases/louis-kahn"]');
 for(const id of ids){
  if(app.window.location.pathname!==`/cases/${id}`)app.click(`.case-tabs a[href="/cases/${id}"]`);
  const paper=app.document.querySelector('.racing-dossier');
  assert.ok(paper);
  assert.equal(paper.querySelectorAll('.race-chapter').length,5);
  assert.equal(paper.querySelectorAll('.race-drill li').length,15);
  assert.equal(paper.querySelectorAll('.race-diagnosis').length,5);
  assert.ok(paper.querySelector('.race-debrief'));
  assert.doesNotMatch(paper.textContent,/undefined|Born:|Died:|Salk Institute|Louvre Pyramid/);
  for(const link of paper.querySelectorAll('.race-contents a'))assert.ok(paper.querySelector(link.getAttribute('href')));
  for(const img of paper.querySelectorAll('img'))assert.match(img.src,/\/assets\/racing-.*\.svg$/);
  assert.equal(app.document.querySelector('.next-folder-preview').getAttribute('href'),'/cases/mary-colter');
  app.click('.race-hero .photo-button');
  assert.match(app.document.querySelector('#lightbox img').src,/racing-.*\.svg$/);
  app.click('.lightbox-close');
 }
 await app.cleanup();
});

test('flight collection switches all four notebooks and loops to the photography collection',async()=>{
 const app=await setup();
 assert.equal(app.document.querySelector('[data-group="3"] .folder-tabs').getAttribute('aria-label'),'飞行驾驶技巧');
 for(const id of ['mary-colter','louis-sullivan','flight-navigation','flight-instruments']){
  app.click(`a[href="/cases/${id}"]`);
  const paper=app.document.querySelector('.flight-dossier');
  assert.ok(paper);assert.equal(paper.querySelectorAll('.flight-chapter').length,4);
  assert.equal(paper.querySelectorAll('.flight-exercise li').length,12);
  assert.equal(paper.querySelectorAll('.flight-question').length,4);
  assert.equal(app.document.querySelectorAll('.case-tabs .folder-tab').length,4);
  assert.doesNotMatch(paper.textContent,/undefined|Born:|Died:|Mary Colter|Louis Sullivan/);
  for(const link of paper.querySelectorAll('.flight-contents a'))assert.ok(paper.querySelector(link.getAttribute('href')));
  assert.equal(app.document.querySelector('.next-folder-preview').getAttribute('href'),'/cases/frank-lloyd-wright');
  app.click('.flight-hero .photo-button');
  assert.match(app.document.querySelector('#lightbox img').src,/flight-.*\.svg$/);
  app.click('.lightbox-close');
 }
 app.click('.brand');assert.equal(app.document.querySelectorAll('[data-group="3"] .file-leaves').length,4);
 await app.cleanup();
});

test('wind experiment distinguishes headwind, tailwind, left/right crosswind and calm',async()=>{
 const app=await setup({path:'/cases/flight-navigation'});
 const set=(selector,value)=>{const input=app.document.querySelector(selector);input.value=String(value);input.dispatchEvent(new app.window.Event('input',{bubbles:true}));};
 const read=key=>app.document.querySelector(`[data-${key}]`).textContent;
 for(const [angle,head,cross,label] of [[0,'20.0 kt','0.0 kt','无侧风'],[30,'17.3 kt','10.0 kt','右侧来风分量'],[-30,'17.3 kt','10.0 kt','左侧来风分量'],[90,'0.0 kt','20.0 kt','右侧来风分量'],[180,'20.0 kt','0.0 kt','无侧风']]){
  set('#wind-angle',angle);assert.equal(read('head-value'),head);assert.equal(read('cross-value'),cross);assert.equal(read('cross-label'),label);
  assert.equal(read('head-label'),angle===180?'顺风分量':'逆风分量');
 }
 set('#wind-speed',0);assert.equal(read('head-value'),'0.0 kt');assert.equal(read('cross-value'),'0.0 kt');assert.equal(read('cross-label'),'无侧风');
 assert.equal(app.document.querySelector('[data-wind-arrow]').getAttribute('d'),'M160 160L160 160');
 await app.cleanup();
});

test('chapter navigation preserves the paper without switching folders',async()=>{
 const app=await setup({path:'/cases/louis-kahn',motion:true,controlled:true});
 const paper=app.document.querySelector('.racing-dossier');
 let scrolled=false;paper.querySelector('#race-01-2').scrollIntoView=()=>{scrolled=true};
 app.window.history.pushState({},'','/cases/louis-kahn#race-01-2');
 app.window.dispatchEvent(new app.window.PopStateEvent('popstate',{state:{}}));
 assert.equal(app.document.querySelector('.racing-dossier'),paper);
 assert.equal(app.animations.length,0);assert.ok(scrolled);
 await app.cleanup();
});

test('grip budget updates the ideal force allocation without treating it as pedal input',async()=>{
 const app=await setup({path:'/cases/louis-kahn'});
 const slider=app.document.querySelector('#grip-demand');
 for(const [input,output] of [[0,'100%'],[60,'80%'],[100,'0%']]){
  slider.value=String(input);slider.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  assert.equal(app.document.querySelector('[data-grip-remaining]').textContent,output);
  assert.equal(app.document.querySelector('[data-grip-lateral]').textContent,`${input}%`);
 }
 assert.match(app.document.querySelector('.grip-lab>small').textContent,/不是.*踏板比例/);
 await app.cleanup();
});

test('the blending lab responds to controls and swapping colors',async()=>{
 const app=await setup({path:'/cases/color-blending'});
 const lab=app.document.querySelector('.color-lab');
 const set=(name,value)=>{const input=lab.querySelector(`[name="${name}"]`);input.value=value;input.dispatchEvent(new app.window.Event('input',{bubbles:true}));};
 set('backdrop','#000000');set('source','#ffffff');set('opacity','50');
 assert.equal(lab.querySelector('[data-hex="result"]').textContent,'#808080');
 set('mode','multiply');assert.equal(lab.querySelector('[data-hex="result"]').textContent,'#000000');
 set('backdrop','#404040');set('source','#c0c0c0');set('opacity','100');set('mode','overlay');
 assert.equal(lab.querySelector('[data-hex="result"]').textContent,'#606060');
 app.click('.color-lab-swap');assert.equal(lab.querySelector('[data-hex="result"]').textContent,'#A1A1A1');
 assert.match(lab.querySelector('[data-formula]').textContent,/2BS/);
 await app.cleanup();
});

test('both bottom links advance to the first file in the next home-row collection',async()=>{
 const expected=['frank-gehry','louis-kahn','mary-colter','frank-lloyd-wright'];
 for(const architect of architects){
  const app=await setup({path:`/cases/${architect.id}`});
  const preview=app.document.querySelector('.next-folder-preview');
  const destination=architects.find(a=>a.id===expected[architect.group]);
  assert.equal(preview.getAttribute('href'),`/cases/${destination.id}`);
  assert.equal(preview.querySelector('h2').textContent,destination.name);
  assert.equal(preview.style.getPropertyValue('--case'),destination.color);
  assert.equal(app.document.querySelector('.next-file').getAttribute('href'),preview.getAttribute('href'));
  app.click('.next-folder-preview');
  assert.equal(app.document.querySelector('h1').textContent,destination.name);
  await app.cleanup();
 }
});

test('home collection labels stay minimal and returning restores scroll and focus',async()=>{
 const app=await setup();
 assert.equal(app.document.querySelector('[data-group="2"] .category-label').textContent,'赛车技巧');
 assert.equal(app.document.querySelectorAll('.group-description,.category-toggle').length,0);
 app.window.scrollTo({top:210});
 app.click('a[href="/cases/louis-kahn"]');
 assert.equal(app.document.body.dataset.view,'case');
 assert.equal(app.document.querySelector('h1').textContent,'驾驶与抓地');
 assert.equal(app.window.scrollY,0);
 app.click('.back-link');
 assert.equal(app.document.body.dataset.view,'home');
 assert.equal(app.document.querySelector('[data-group="2"] .category-label').textContent,'赛车技巧');
 assert.equal(app.document.querySelectorAll('.group-description,.category-toggle').length,0);
 assert.equal(app.window.scrollY,210);
 assert.equal(app.document.activeElement.getAttribute('href'),'/cases/louis-kahn');

 await app.cleanup();
});
test('switching files updates URL, active tab, images and title',async()=>{
 const app=await setup({path:'/cases/louis-kahn'});
 app.click('.case-tabs a[href="/cases/i-m-pei"]');
 assert.equal(app.window.location.pathname,'/cases/i-m-pei');
 assert.equal(app.document.querySelector('h1').textContent,'刹车与走线');
 assert.equal(app.document.querySelector('.case-tabs [aria-current="page"]').textContent,'刹车与走线');
 assert.match(app.document.querySelector('.race-hero img').src,/racing-line/ );
 assert.match(app.document.title,/刹车与走线/);
 app.click('.next-file');assert.equal(app.document.querySelector('h1').textContent,'操纵与姿态');
 await app.cleanup();
});
test('keyboard escape closes a file and arrow keys move between tabs',async()=>{
 const app=await setup({path:'/cases/i-m-pei'});
 const active=app.document.querySelector('.case-tabs [aria-current="page"]');active.focus();
 active.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 assert.equal(app.document.activeElement.textContent,'弯道与出弯');
 app.document.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(app.document.body.dataset.view,'home');
 await app.cleanup();
});
test('rapid animated navigation finishes on the last requested file',async()=>{
 const app=await setup({motion:true});
 app.click('a[href="/cases/frank-lloyd-wright"]');
 app.click('a[href="/cases/irving-gill"]');
 await new Promise(resolve=>setTimeout(resolve,650));
 assert.equal(app.document.querySelector('h1').textContent,'构图基础');
 assert.equal(app.window.location.pathname,'/cases/irving-gill');
 assert.equal(app.document.querySelectorAll('.folder-motion,.folder-selection').length,0);
 assert.ok(app.animations.some(a=>a.keyframes.some(f=>f.transform?.includes('rotateY(-180deg)'))));
 assert.equal(app.document.querySelector('.dossier').classList.contains('paper-enter'),false);
 await app.cleanup();
});
test('popstate restores route and saved scroll position',async()=>{
 const app=await setup({path:'/cases/frank-gehry'});
 app.window.history.pushState({scroll:173},'','/');
 app.window.dispatchEvent(new app.window.PopStateEvent('popstate',{state:{scroll:173}}));
 assert.equal(app.document.body.dataset.view,'home');
 assert.equal(app.window.scrollY,173);
 await app.cleanup();
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('a sibling document changes only under its fully closed old cover',async()=>{
 const app=await setup({path:'/cases/louis-kahn',motion:true,controlled:true});
 app.click('.case-tabs a[href="/cases/i-m-pei"]');
 assert.equal(app.document.querySelector('h1').textContent,'驾驶与抓地');
 assert.equal(app.document.querySelector('.folder-motion').dataset.phase,'closing');
 app.animations.slice().forEach(a=>a.finish());await settle();
 assert.equal(app.document.querySelector('.folder-motion').dataset.phase,'closed');
 assert.equal(app.document.querySelector('h1').textContent,'刹车与走线');
 assert.equal(app.document.querySelector('.folder-motion-cover').style.background,'#c85632');
 app.animations.slice().forEach(a=>a.finish());await settle();
 assert.equal(app.document.querySelector('.folder-motion').dataset.phase,'opening');
 app.animations.slice().forEach(a=>a.finish());await settle();
 assert.equal(app.document.querySelectorAll('.folder-motion').length,0);
 assert.equal(app.document.querySelector('.dossier').style.visibility,'');
 await app.cleanup();
});

test('returning during a closing cover cancels it without leaving an overlay',async()=>{
 const app=await setup({path:'/cases/louis-kahn',motion:true,controlled:true});
 app.click('.case-tabs a[href="/cases/i-m-pei"]');
 app.click('.back-link');
 for(let i=0;i<5;i++){app.animations.slice().forEach(a=>a.finish());await settle()}
 assert.equal(app.window.location.pathname,'/');
 assert.equal(app.document.body.dataset.view,'home');
 assert.equal(app.document.querySelectorAll('.folder-motion,.folder-selection').length,0);
 assert.equal(app.document.body.classList.contains('folder-motion-running'),false);
 await app.cleanup();
});

test('next-folder scrolling requires an extra deliberate scroll at the bottom',async()=>{
 const app=await setup({path:'/cases/irving-gill'});
 Object.defineProperty(app.document.documentElement,'scrollHeight',{value:2000,configurable:true});
 app.window.innerHeight=900;
 app.window.scrollTo({top:900});
 app.window.dispatchEvent(new app.window.WheelEvent('wheel',{deltaY:300}));
 assert.equal(app.window.location.pathname,'/cases/irving-gill');
 app.window.scrollTo({top:1100});
 app.window.dispatchEvent(new app.window.WheelEvent('wheel',{deltaY:100}));
 assert.equal(app.window.location.pathname,'/cases/irving-gill');
 app.window.dispatchEvent(new app.window.WheelEvent('wheel',{deltaY:100}));
 assert.equal(app.window.location.pathname,'/cases/frank-gehry');
 assert.equal(app.document.querySelector('h1').textContent,'色彩基础');
 await app.cleanup();
});

test('the next color block expands while its title moves farther and paper appears later',async()=>{
 const app=await setup({path:'/cases/mary-colter',motion:true,controlled:true});
 const main=app.document.querySelector('main');
 const preview=main.querySelector('.next-folder-preview');
 assert.equal(preview.querySelector('.dossier'),null);
 preview.getBoundingClientRect=()=>({top:490,left:0,width:1000,height:240});
 preview.querySelector('h2').getBoundingClientRect=()=>({top:522,left:32,width:600,height:50});
 app.click('.next-folder-preview');
 const block=app.animations.find(a=>a.target.classList.contains('next-morph-block'));
 const title=app.animations.find(a=>a.target.classList.contains('next-morph-title'));
 const paper=app.animations.find(a=>a.target===main.querySelector('.open-folder'));
 assert.equal(app.document.querySelector('.next-folder-morph .dossier'),null);
 assert.equal(block.keyframes[0].top,'490px');
 assert.equal(block.keyframes[0].height,'240px');
 assert.ok(parseFloat(block.keyframes[1].height)>240);
 assert.match(title.keyframes[0].transform,/translate\(32px,522px\)/);
 assert.equal(title.keyframes[1].transform,'translate(0px,0px) scale(1)');
 assert.ok(paper.options.delay>0);
 assert.equal(paper.keyframes[0].opacity,0);
 assert.equal(main.style.visibility,'hidden');
 app.animations.forEach(a=>a.finish());await settle();
 assert.equal(main.style.visibility,'');
 assert.equal(paper.target,main.querySelector('.open-folder'));
 assert.equal(paper.target.style.zIndex,'');
 assert.equal(paper.target.style.visibility,'');
 assert.equal(app.document.querySelectorAll('.folder-motion').length,0);
 assert.equal(app.window.location.pathname,'/cases/frank-lloyd-wright');
 await app.cleanup();
});

test('home opening moves other folders down and animates the intro before replacing the page',async()=>{
 const app=await setup({motion:true,controlled:true});
 const selected=app.document.querySelector('[data-group="2"]');
 app.click('a[href="/cases/louis-kahn"]');
 assert.ok(app.document.querySelector('.intro'));
 const departures=app.animations.filter(a=>a.target.classList.contains('folder-group'));
 assert.equal(departures.length,3);
 for(const motion of departures){
  assert.notEqual(motion.target,selected);
  assert.match(motion.keyframes[1].transform,/translateY\([1-9][0-9]*px\)/);
  assert.equal(motion.keyframes[1].opacity,undefined);
 }
 const intro=app.animations.filter(a=>a.target.matches('.intro h1,.intro p'));
 assert.equal(intro.length,1);
 assert.ok(intro.every(a=>a.keyframes[1].opacity===0&&a.keyframes[1].transform.includes('-')));
 assert.ok(!app.animations.some(a=>a.target.matches('main')));
 for(let i=0;i<5;i++){app.animations.slice().forEach(a=>a.finish());await settle()}
 assert.equal(app.document.querySelector('h1').textContent,'驾驶与抓地');
 assert.equal(app.document.querySelectorAll('.folder-motion,.folder-selection').length,0);
 await app.cleanup();
});

test('opening preserves the resting folder height while its sibling retracts then emerges',async()=>{
 const app=await setup({motion:true,controlled:true});
 const group=app.document.querySelector('[data-group="0"]');
 const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 const originalBounds=app.window.HTMLElement.prototype.getBoundingClientRect;
 app.window.HTMLElement.prototype.getBoundingClientRect=function(){
  if(this.matches('.folder-surface'))return rect(80,400,1100,59);
  if(this.matches('.folder-back'))return rect(80,400,1100,650);
  if(this.matches('.open-folder'))return rect(0,240,1000,3000);
  return originalBounds.call(this);
 };
 const sibling=group.querySelector('a[href="/cases/irving-gill"]');
 app.click('a[href="/cases/frank-lloyd-wright"]');
 const body=group.querySelector('.home-folder-body');
 assert.ok(body);
 assert.equal(parseFloat(body.style.height),650);
 assert.equal(group.querySelector('.folder-tabs').style.clipPath,'inset(-30px -30px 0 -30px)');
 const retract=app.animations.find(a=>a.target===sibling);
 assert.match(retract.keyframes[1].transform,/translateY\([1-9][0-9]*px\)/);
 assert.equal(retract.keyframes[1].opacity,undefined);
 app.animations.slice().forEach(a=>a.finish());await settle();
 const redTab=app.document.querySelector('.case-tabs a[href="/cases/irving-gill"]');
 const paper=app.document.querySelector('.dossier');
 assert.equal(app.document.querySelectorAll('.dossier').length,1);
 assert.equal(app.document.querySelectorAll('.folder-motion .case-tabs').length,0);
 assert.equal(app.animations.some(a=>a.target===redTab),false);
 const turn=app.animations.find(a=>a.target.classList.contains('folder-motion-book'));
 const scales=turn.keyframes[0].transform.match(/scale\(([^,]+),([^)]*)\)/).slice(1).map(Number);
 assert.equal(parseFloat(turn.target.style.width)*scales[0],650);
 assert.equal(parseFloat(turn.target.style.height)*scales[1],1100);
 assert.match(turn.keyframes[0].transform,/translate\(80px,1050px\) rotate\(-90deg\)/);
 app.animations.slice().forEach(a=>a.finish());await settle();
 const reveal=app.animations.find(a=>a.target===redTab);
 assert.equal(app.document.querySelector('.folder-motion').dataset.phase,'opening');
 assert.equal(app.document.querySelector('.dossier'),paper);
 assert.equal(reveal.keyframes[0].transform,'translateX(-110%)');
 assert.equal(reveal.keyframes.at(-1).transform,'translate(0,0)');
 assert.ok(!app.animations.some(a=>a.target.classList.contains('folder-selection')&&a.keyframes.some(f=>f.height)));
 app.animations.slice().forEach(a=>a.finish());await settle();
 assert.equal(app.document.querySelectorAll('.home-folder-body,.folder-motion,.folder-selection').length,0);
 assert.equal(app.document.querySelector('.open-folder').style.visibility,'');
 await app.cleanup();
});

test('a rotating tab matches the measured horizontal start and vertical destination bounds',async()=>{
 const app=await setup({motion:true,controlled:true});
 const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 app.window.HTMLElement.prototype.getBoundingClientRect=function(){
  if(this.matches('.folder-surface'))return rect(80,405,1100,59);
  if(this.matches('.folder-back'))return rect(80,405,1100,650);
  if(this.matches('.open-folder'))return rect(0,240,1000,3000);
  if(this.matches('.case-tabs .active'))return rect(998,544,47,200);
  if(this.matches('.folder-tabs a[href="/cases/irving-gill"]'))return rect(400,350,200,55);
  return rect(0,0,0,0);
 };
 const computed=app.window.getComputedStyle.bind(app.window);
 app.window.getComputedStyle=el=>el.matches('.folder-tab')?{fontSize:'26px',lineHeight:'31.2px',fontFamily:'Georgia',writingMode:el.closest('.case-tabs')?'vertical-rl':'horizontal-tb',paddingTop:'0px',paddingRight:'0px',paddingBottom:'0px',paddingLeft:'0px',filter:'none'}:computed(el);
 app.click('a[href="/cases/irving-gill"]');
 app.animations.slice().forEach(a=>a.finish());await settle();
 const motion=app.animations.find(a=>a.target.classList.contains('motion-tab-face'));
 const [start,end]=motion.keyframes;
 const turn=app.animations.find(a=>a.target.classList.contains('folder-motion-book'));
 const scale=1100/parseFloat(turn.target.style.height);
 const depthScale=650/1000;
 assert.ok(Math.abs(parseFloat(start.width)*scale-200)<.001);
 assert.ok(Math.abs(parseFloat(start.height)*scale-55)<.001);
 assert.ok(Math.abs(80+parseFloat(start.top)*scale-400)<.001);
 assert.ok(Math.abs(405+(1000-parseFloat(start.left))*depthScale-350)<.001);
 assert.equal(start.transform,`rotate(90deg) scaleY(${scale/depthScale})`);
 assert.equal(parseFloat(end.left)-parseFloat(end.height),998);
 assert.equal(parseFloat(end.top)+240,544);
 assert.equal(end.width,'200px');assert.equal(end.height,'47px');
 assert.equal(end.transform,'rotate(90deg)');
 assert.equal(app.document.querySelector('.open-folder').style.visibility,'hidden');
 assert.equal(app.document.querySelectorAll('.folder-motion .dossier,.folder-motion .case-tabs').length,0);
 assert.equal(app.document.querySelectorAll('.folder-motion-tab,.selected-folder-tab').length,0);
 app.animations.slice().forEach(a=>a.finish());await settle();
 app.animations.slice().forEach(a=>a.finish());await settle();
 assert.equal(app.document.querySelectorAll('.motion-tab-face').length,0);
 assert.equal(app.document.querySelector('.open-folder').style.visibility,'');
 await app.cleanup();
});

test('hover keeps its resting hit region while tilted and clears when the pointer leaves',async()=>{
 const app=await setup();
 const main=app.document.querySelector('main');
 const tab=main.querySelector('a[href="/cases/louis-kahn"]');
 const group=tab.closest('.folder-group');
 tab.getBoundingClientRect=()=>({left:100,top:100,right:300,bottom:147});
 tab.dispatchEvent(new app.window.PointerEvent('pointerover',{bubbles:true,pointerType:'touch'}));
 assert.equal(group.classList.contains('is-peeking'),false);
 tab.dispatchEvent(new app.window.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
 assert.equal(group.classList.contains('is-peeking'),true);
 tab.getBoundingClientRect=()=>({left:100,top:70,right:300,bottom:117});
 main.dispatchEvent(new app.window.PointerEvent('pointermove',{bubbles:true,clientX:200,clientY:130}));
 assert.equal(group.classList.contains('is-peeking'),true);
 main.dispatchEvent(new app.window.PointerEvent('pointermove',{bubbles:true,clientX:400,clientY:300}));
 assert.equal(group.classList.contains('is-peeking'),false);
 await app.cleanup();
});

test('every tab selects its own back and front leaves, including siblings on the right',async()=>{
 const app=await setup();
 for(const a of architects){
  const tab=app.document.querySelector(`.folder-tabs a[href="/cases/${a.id}"]`);
  tab.dispatchEvent(new app.window.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
  const selected=app.document.querySelectorAll('.file-leaves.is-selected');
  assert.equal(selected.length,1);
  assert.equal(selected[0].dataset.file,a.id);
  assert.equal(selected[0].style.getPropertyValue('--leaf-color'),a.color);
  assert.ok(selected[0].querySelector('.folder-back-sheet'));
  assert.ok(selected[0].querySelector('.folder-front-sheet'));
  const group=tab.closest('.folder-group');
  const files=[...group.querySelectorAll('.file-leaves')];
  const index=files.indexOf(selected[0]);
  files.forEach((file,i)=>{
   assert.equal(file.classList.contains('is-pushed'),i<index);
   assert.equal(file.style.getPropertyValue('--leaf-order'),String(files.length-i));
  });
  const siblings=[...group.querySelectorAll('.folder-tab')];
  assert.deepEqual(siblings.map(t=>t.classList.contains('is-pushed')),siblings.map((_,i)=>i<index));
 }
 app.document.querySelector('main').dispatchEvent(new app.window.PointerEvent('pointerleave'));
 assert.equal(app.document.querySelectorAll('.file-leaves.is-selected,.is-peeking,.is-pushed').length,0);
 assert.equal(app.document.querySelector('.archive-bottom').style.backgroundColor,'');
 await app.cleanup();
});

test('the header brand returns home with staggered folder and intro entrances',async()=>{
 const app=await setup({path:'/cases/irving-gill',motion:true,controlled:true});
 app.click('.brand');
 for(let i=0;i<3&&!app.animations.some(a=>a.target.matches('.intro h1'));i++){
  app.animations.slice().forEach(a=>a.finish());await settle();
 }
 const arrivals=app.animations.filter(a=>a.target.matches('.folder-group,.archive-bottom'));
 assert.equal(arrivals.length,4);
 arrivals.forEach((a,i)=>{
  assert.ok(!a.target.matches('[data-group="0"]'));
  assert.match(a.keyframes[0].transform,/translateY\([1-9][0-9]*px\)/);
  assert.equal(a.keyframes[1].transform,'translateY(-7px)');
  assert.equal(a.keyframes[2].transform,'translateY(0)');
  if(i)assert.ok(a.options.delay>arrivals[i-1].options.delay);
 });
 const intro=app.animations.filter(a=>a.target.matches('.intro h1,.intro p'));
 assert.equal(intro.length,1);
 assert.ok(intro.every(a=>a.keyframes[0].opacity===0&&a.keyframes.at(-1).opacity===1));
 const sibling=app.document.querySelector('[data-group="0"] a[href="/cases/frank-lloyd-wright"]');
 const leaf=app.document.querySelector('[data-file="frank-lloyd-wright"]');
 for(const node of [sibling,leaf]){
  const arrival=app.animations.find(a=>a.target===node);
  assert.ok(arrival);
  assert.match(arrival.keyframes[0].transform,/translateY\([1-9][0-9]*px\)/);
  assert.equal(arrival.keyframes.at(-1).transform,'translateY(0)');
 }
 assert.equal(leaf.style.getPropertyValue('--leaf-order'),'2');
 app.animations.slice().forEach(a=>a.finish());await settle();
 assert.equal(app.document.body.dataset.view,'home');
 assert.equal(app.document.querySelectorAll('.folder-motion').length,0);
 await app.cleanup();
});

test('returning from the last color file retracts live tabs before rotating and restores all four siblings',async()=>{
 const app=await setup({path:'/cases/color-blending',motion:true,controlled:true});
 const paper=app.document.querySelector('.dossier');
 const tabs=[...app.document.querySelectorAll('.case-tabs .folder-tab:not(.active)')];
 app.click('.brand');
 assert.equal(app.document.querySelector('.dossier'),paper);
 assert.equal(app.document.body.dataset.view,'case');
 assert.equal(app.document.querySelector('.folder-motion-book'),null);
 assert.equal(app.document.querySelectorAll('.folder-motion .dossier,.folder-motion .case-tabs').length,0);
 for(const tab of tabs){
  const retract=app.animations.find(a=>a.target===tab);
  assert.equal(retract.keyframes[0].transform,'translate(0,0)');
  assert.equal(retract.keyframes.at(-1).transform,'translateX(-110%)');
 }
 app.animations.slice().forEach(a=>a.finish());await settle();
 assert.equal(app.document.querySelector('main').style.visibility,'hidden');
 app.animations.slice().forEach(a=>a.finish());await settle();
 const siblings=[...app.document.querySelectorAll('[data-group="1"] .folder-tab')].filter(t=>!t.href.endsWith('/color-blending'));
 assert.equal(siblings.length,4);
 siblings.forEach((tab,i)=>{
  const arrival=app.animations.find(a=>a.target===tab);
  assert.ok(arrival);
  assert.equal(arrival.options.delay,80+i*65);
  assert.ok(!arrival.keyframes.some(frame=>frame.opacity!==undefined));
 });
 app.animations.slice().forEach(a=>a.finish());await settle();
 assert.equal(app.document.querySelectorAll('.folder-motion').length,0);
 assert.equal(app.document.querySelector('main').style.visibility,'');
 await app.cleanup();
});

test('clicking an open front leaf settles it before measuring the opening animation',async()=>{
 const app=await setup({motion:true,controlled:true});
 const group=app.document.querySelector('[data-group="0"]');
 const front=group.querySelector('.folder-surface');
 assert.ok(group.querySelector('.folder-back .folder-tab'));
 assert.equal(front.querySelector('.folder-tab'),null);
 group.classList.add('is-peeking');
 const computed=app.window.getComputedStyle.bind(app.window);
 const tilt='matrix3d(1, 0, 0, 0, 0, .9945, -.1045, 0, 0, .1045, .9945, 0, 0, 0, 0, 1)';
 app.window.getComputedStyle=el=>el===front?{transform:tilt}:computed(el);
 app.click('a[href="/cases/frank-lloyd-wright"]');
 assert.equal(app.document.querySelector('.home-folder-body'),null);
 assert.deepEqual(app.animations[0].keyframes,[{transform:tilt},{transform:'none'}]);
 app.animations[0].finish();await settle();
 assert.ok(app.document.querySelector('.home-folder-body'));
 for(let i=0;i<5;i++){app.animations.slice().forEach(a=>a.finish());await settle()}
 assert.equal(app.document.querySelector('h1').textContent,'相机使用基础');
 assert.equal(app.document.querySelectorAll('.folder-motion,.is-peeking').length,0);
 await app.cleanup();
});


test('GitHub Pages prefix preserves folder navigation, media, About and Escape',async()=>{
 const app=await setup({path:'/files/',base:'/files/'});
 assert.equal(app.document.querySelector('.brand').getAttribute('href'),'/files/');
 app.click('a[href="/files/cases/frank-lloyd-wright"]');
 assert.equal(app.window.location.pathname,'/files/cases/frank-lloyd-wright');
 assert.equal(app.document.querySelector('h1').textContent,'相机使用基础');
 for(const image of app.document.querySelectorAll('main img'))assert.ok(image.getAttribute('src').startsWith('/files/assets/'));
 const photo=app.document.querySelector('[data-photo]');
 app.click('[data-photo]');
 assert.equal(app.document.querySelector('#lightbox img').getAttribute('src'),photo.dataset.photo);
 app.click('.lightbox-close');
 app.document.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(app.window.location.pathname,'/files/');
 app.click('.about-link');assert.equal(app.window.location.pathname,'/files/about');
 app.click('.brand');assert.equal(app.window.location.pathname,'/files/');
 await app.cleanup();
});

test('GitHub Pages detail deep links render correctly on a fresh load',async()=>{
 const app=await setup({path:'/files/cases/color-blending/',base:'/files/'});
 assert.equal(app.document.body.dataset.view,'case');
 assert.ok(app.document.querySelector('.color-lab'));
 assert.ok(app.document.querySelector('a[href="/files/cases/color-contrast"]'));
 await app.cleanup();
});
