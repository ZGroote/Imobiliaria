// Suspend the legacy map's animation callbacks without rebuilding its scene.
export function createFrameScheduler(target){
  const request=target.requestAnimationFrame,cancel=target.cancelAnimationFrame,entries=new Map();
  let active=true,disposed=false;
  function schedule(entry){
    entry.handle=request.call(target,time=>{entries.delete(entry.id);entry.callback(time);});
  }
  target.requestAnimationFrame=callback=>{
    const entry={callback,handle:null,id:null};schedule(entry);entry.id=entry.handle;entries.set(entry.id,entry);
    if(!active){cancel.call(target,entry.handle);entry.handle=null;}
    return entry.id;
  };
  target.cancelAnimationFrame=id=>{
    const entry=entries.get(id);entries.delete(id);cancel.call(target,entry?.handle??id);
  };
  return {
    setActive(value){
      if(disposed||typeof value!=='boolean'||active===value)return;active=value;
      for(const entry of entries.values())if(active)schedule(entry);else {cancel.call(target,entry.handle);entry.handle=null;}
    },
    dispose(){disposed=true;for(const entry of entries.values())cancel.call(target,entry.handle);entries.clear();target.requestAnimationFrame=request;target.cancelAnimationFrame=cancel;},
  };
}
