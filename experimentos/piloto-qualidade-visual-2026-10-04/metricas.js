/* Instrumentação local do piloto. Nenhuma informação é enviada ou persistida. */
(()=>{
  'use strict';
  const output=document.createElement('output');output.id='piloto-metricas';output.hidden=true;document.body.append(output);
  const errors=[], measures=new Map();let previous=null,key='',lastWrite=-Infinity,firstObserved=null,changedAt=0;
  const pct=(a,p)=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(2);};
  window.addEventListener('error',e=>errors.push({message:e.message||'Recurso indisponível',file:e.filename?new URL(e.filename,location.href).pathname:null}));
  window.addEventListener('unhandledrejection',e=>errors.push({message:String(e.reason?.message||e.reason)}));
  document.addEventListener('visibilitychange',()=>{previous=null;});
  function observe(now){
    const q=window.__maq,v=window.__pilotoVisual;
    if(q&&v){
      const s=v.snapshot(),effectiveWall=Boolean(s.enabled&&s.wallsEnabled);
      const next=q.modo()+'|'+String(s.enabled)+(typeof s.wallsEnabled==='boolean'?'|paredes:'+effectiveWall:'');
      if(firstObserved===null&&q.ren.info.render.calls>0)firstObserved=now;
      if(key!==next){key=next;previous=null;changedAt=now;}
      let m=measures.get(key);if(!m){m={frames:[],maxStartupMs:0};measures.set(key,m);}
      if(previous!==null&&document.visibilityState==='visible'){
        const delta=now-previous;
        if(now-changedAt>1000){if(m.frames.length<900)m.frames.push(delta);}else m.maxStartupMs=Math.max(m.maxStartupMs,delta);
      }
      previous=document.visibilityState==='visible'?now:null;
      if(now-lastWrite>400){
        lastWrite=now;
        const sampling={};for(const [k,a] of measures)sampling[k]={samples:a.frames.length,p50Ms:pct(a.frames,.5),p95Ms:pct(a.frames,.95),maxMs:a.frames.length?+Math.max(...a.frames).toFixed(2):null,startupMaxMs:+a.maxStartupMs.toFixed(2)};
        const renderer=q.ren.getContext().getParameter(q.ren.getContext().RENDERER);
        output.textContent=JSON.stringify({release:window.__pilotoRelease,mode:q.modo(),visual:s,camera:q.cam.position.toArray(),target:q.alvo.toArray(),
          drawCalls:q.ren.info.render.calls,triangles:q.ren.info.render.triangles,textures:q.ren.info.memory.textures,geometries:q.ren.info.memory.geometries,
          pixelRatio:q.ren.getPixelRatio(),firstObservedFrameMs:firstObserved===null?null:+firstObserved.toFixed(2),
          viewport:{width:innerWidth,height:innerHeight},visibility:document.visibilityState,renderer,sampling,errors:errors.slice(-15)});
      }
    }
    requestAnimationFrame(observe);
  }
  requestAnimationFrame(observe);
})();
