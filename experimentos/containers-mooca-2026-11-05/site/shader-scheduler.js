// O fallback do Three espera repaint; iframe estacionado pode não repintar durante a compilação.
export function installShaderScheduler(scope=globalThis){
  if(typeof scope.scheduler?.yield==='function')return()=>{};
  const previous=Object.getOwnPropertyDescriptor(scope,'scheduler'),created=!scope.scheduler;
  const scheduler=scope.scheduler||{},channel=new scope.MessageChannel(),pending=[];
  const originalYield=Object.getOwnPropertyDescriptor(scheduler,'yield');
  let disposed=false;
  const yieldTask=()=>disposed?Promise.resolve():new Promise(resolve=>{pending.push(resolve);channel.port2.postMessage(0);});
  channel.port1.onmessage=()=>pending.shift()?.();
  try{
    Object.defineProperty(scheduler,'yield',{value:yieldTask,configurable:true,writable:true});
    if(created)Object.defineProperty(scope,'scheduler',{value:scheduler,configurable:true,writable:true});
  }catch{
    channel.port1.close();channel.port2.close();return()=>{};
  }
  return()=>{
    if(disposed)return;disposed=true;channel.port1.close();channel.port2.close();
    for(const resolve of pending.splice(0))resolve();
    if(scheduler.yield===yieldTask){if(originalYield)Object.defineProperty(scheduler,'yield',originalYield);else delete scheduler.yield;}
    if(created&&scope.scheduler===scheduler){if(previous)Object.defineProperty(scope,'scheduler',previous);else delete scope.scheduler;}
  };
}
