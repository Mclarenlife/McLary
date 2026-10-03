import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {stepSpring,mountTitleMotion} from '../src/title-motion.js';

test('released letters overshoot and settle at different refresh rates',()=>{
 for(const hz of [30,60,144]){
  const state={x:18,y:-22,vx:100,vy:-80,tx:0,ty:0};
  let crossed=false;
  for(let i=0;i<hz*3;i++){
   stepSpring(state,1/hz);
   crossed ||= state.x<0;
   assert.ok(Math.abs(state.x)<40 && Math.abs(state.y)<40);
  }
  assert.ok(crossed,'spring should visibly recoil past its resting position');
  assert.ok(Math.abs(state.x)+Math.abs(state.y)+Math.abs(state.vx)+Math.abs(state.vy)<.001);
 }
});

test('title interaction ignores touch/reduced motion and disposes pending frames',async()=>{
 const win=new Window();
 win.document.body.innerHTML='<h1><span class="curiosity-letter"><span>A</span></span></h1>';
 const title=win.document.querySelector('h1'),slot=title.firstElementChild,ink=slot.firstElementChild;
 slot.getBoundingClientRect=()=>({left:100,top:100,width:40,height:90});
 let pending=new Map(),id=0;
 win.requestAnimationFrame=callback=>{pending.set(++id,callback);return id};
 win.cancelAnimationFrame=id=>pending.delete(id);
 const pref={matches:true};
 const dispose=mountTitleMotion(title,pref);
 const move=pointerType=>title.dispatchEvent(new win.PointerEvent('pointermove',{clientX:125,clientY:140,pointerType}));
 move('mouse');assert.equal(pending.size,0);
 pref.matches=false;move('touch');assert.equal(pending.size,0);
 move('mouse');assert.equal(pending.size,1);
 const callbacks=[...pending.values()];pending.clear();callbacks.forEach(callback=>callback(16));
 assert.match(ink.style.transform,/translate/);
 dispose();assert.equal(pending.size,0);assert.equal(ink.style.transform,'');
 move('mouse');assert.equal(pending.size,0);
 await win.happyDOM.abort();
});
