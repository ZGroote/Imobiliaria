export function distribution(values){
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  const at=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]:null;
  return {count:sorted.length,p50:at(.5),p95:at(.95),max:sorted.at(-1)??null};
}
// Records submissions to the renderer. These are not GPU execution timings.
export function observeRenderer(api,win,{limit=12000}={}){
  const renderer=api.renderer,original=renderer.render,started=win.performance.now();
  const gaps=[],costs=[];let last=null,count=0,dropped=0,stopped=false,memoryAt=-Infinity,result=null;
  const peak={rendererTrackedBytes:null,jsHeapEstimateBytes:null},initial=api.camera?.position.toArray();
  const document=win.document;let hidden=document.hidden,hiddenAt=hidden?started:null,hiddenMs=0;
  const visibility=()=>{
    const now=win.performance.now();
    if(hiddenAt!==null)hiddenMs+=now-hiddenAt;
    hidden=document.hidden;hiddenAt=hidden?now:null;last=null;
  };
  document.addEventListener('visibilitychange',visibility);
  function memory(now){
    if(now-memoryAt<250)return;memoryAt=now;
    for(const [key,value] of [['rendererTrackedBytes',renderer.info.memory.total],
      ['jsHeapEstimateBytes',win.performance.memory?.usedJSHeapSize]]){
      if(Number.isFinite(value))peak[key]=Math.max(peak[key]??0,value);
    }
  }
  function observed(...args){
    const now=win.performance.now();memory(now);
    let value;
    try{value=original.apply(this,args);return value;}
    finally{
      if(!stopped&&!hidden){
        count++;const elapsed=win.performance.now()-now;
        if(costs.length<limit){costs.push(elapsed);if(last!==null)gaps.push(now-last);}else dropped++;
        last=now;
      }
    }
  }
  renderer.render=observed;
  return {stop(){
    if(result)return result;
    if(!stopped){stopped=true;if(renderer.render===observed)renderer.render=original;document.removeEventListener('visibilitychange',visibility);}
    const now=win.performance.now();memory(now);
    const position=api.camera?.position.toArray();
    result={backend:api.backend,durationMs:now-started,hiddenMs:hiddenMs+(hiddenAt===null?0:now-hiddenAt),
      submissions:count,droppedSamples:dropped,submissionIntervalMs:distribution(gaps),
      cpuSubmitMs:distribution(costs),intervalsOver33Ms:gaps.filter(v=>v>33.34).length,
      intervalMeaning:'Cadência de submissão, incluindo trabalho CPU; não é tempo GPU ou FPS garantido.',
      cameraDisplacementMeters:initial&&position?Math.hypot(...initial.map((v,i)=>position[i]-v)):null,
      canvas:[renderer.domElement.width,renderer.domElement.height],pixelRatio:renderer.getPixelRatio(),
      memoryPeakSampled:peak,memoryMeaning:'Contabilidade do renderer e estimativa do heap JS; não mede VRAM total ou pico exato.',
      error:api.error||null,disposed:api.disposed||false};
    return result;
  }};
}
export function resourceTimings(win){
  return [...win.performance.getEntriesByType('navigation'),...win.performance.getEntriesByType('resource')]
    .filter(entry=>entry.initiatorType!=='iframe').slice(0,1500).map(entry=>({
      path:new URL(entry.name,win.location.href).pathname,type:entry.initiatorType||'navigation',
      durationMs:entry.duration,transferBytes:entry.transferSize,encodedBytes:entry.encodedBodySize,
      decodedBytes:entry.decodedBodySize,workerStartMs:entry.workerStart,deliveryType:entry.deliveryType||null
    }));
}
