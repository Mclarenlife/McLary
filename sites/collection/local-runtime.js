// Local adaptation layer. The visual and animation implementation lives in the
// archived public Butter bundles; this file does not recreate their effects.
window.__localAudit={errors:[],resources:[]};
addEventListener('error',e=>{const s=e.message||e.target?.src||'resource error';window.__localAudit.errors.push(s.startsWith('data:')?'Codec capability probe':s);},true);
addEventListener('unhandledrejection',e=>window.__localAudit.errors.push(String(e.reason)));
// Home wordmarks return to the top while preserving the current static page.
document.addEventListener('click',e=>{
 const a=e.target.closest?.('a[href]');if(!a)return;
 const u=new URL(a.href,location.href);
 if(u.origin===location.origin&&u.pathname==='/'&&!u.hash){
   e.preventDefault();e.stopImmediatePropagation();window.scrollTo({top:0,behavior:'smooth'});
 }
},true);
// Development-only audit, collected locally by the preview server.
if(new URLSearchParams(location.search).has('audit'))setInterval(()=>{fetch('/__audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timestamp:new Date().toISOString(),url:location.href,width:innerWidth,height:innerHeight,scroll:scrollY,overflow:document.documentElement.scrollWidth-innerWidth,title:document.title,canvas:document.querySelectorAll('canvas').length,images:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,ready:v.readyState,time:v.currentTime,paused:v.paused,error:v.error?.code})),errors:window.__localAudit.errors.slice(-20)})}).catch(()=>{});},5000);
