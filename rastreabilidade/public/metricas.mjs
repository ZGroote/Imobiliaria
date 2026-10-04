// One principal section at a time. Monotonic elapsed time is never extrapolated.
export function createMetrics({now, emit, page, section='carregando', heartbeatMs=15000, idleMs=60000}) {
  let allowed=false, shown=true, running=false, last=now(), touched=last, sent=last, credit=0;
  function advance() {
    const time=now();
    if(running) credit+=Math.max(0,Math.min(time,touched+idleMs)-last);
    last=time;
    return time;
  }
  function output(type) {
    emit({type,page,section,activeMs:Math.min(30000,Math.floor(credit))});
    credit=0;sent=last;
  }
  function resume() {
    if(allowed&&shown&&!running&&last<touched+idleMs) { running=true;output('view'); }
  }
  return {
    consent(value) {
      advance();allowed=Boolean(value);
      if(!allowed) { running=false;credit=0;return; }
      touched=last;resume();
    },
    activity() { advance();touched=last;resume(); },
    visible(value) {
      advance();shown=Boolean(value);
      if(!shown&&running) {output('pause');running=false;}
      if(shown) {touched=last;resume();}
    },
    context(nextPage,nextSection) {
      advance();
      if(page===nextPage&&section===nextSection)return;
      if(running)output('pause');
      page=nextPage;section=nextSection;
      if(running)output('view');
    },
    tick() {
      advance();
      if(!running)return;
      if(last>=touched+idleMs) {output('pause');running=false;}
      else if(last-sent>=heartbeatMs)output('heartbeat');
    },
    pause() {advance();if(running)output('pause');running=false;},
  };
}

// A failed payload stays at the front, including its original sequence number.
export function createDelivery({send,initial=[],nextSeq=1,retried=[],recover,changed=()=>{},failed=()=>{}}) {
  const items=initial.slice(0,64).map(item=>Object.freeze({...item}));
  const recovered=new Set(retried);
  let sequence=Math.max(nextSeq,...items.map(item=>item.seq+1)),draining=null,closed=false;
  const snapshot=()=>({items:items.map(item=>({...item})),nextSeq:sequence,retried:[...recovered]});
  return {
    // Offline backlog is bounded. New deltas are discarded without consuming seq.
    add(payload) {if(closed||items.length>=64)return false;items.push(Object.freeze({...payload,seq:sequence++}));changed(snapshot());return true;},
    pending:()=>items.map(item=>({...item})),
    snapshot,
    clear() {closed=true;items.length=0;recovered.clear();changed(snapshot());},
    drain() {
      if(draining)return draining;
      draining=(async()=>{
        while(items.length&&!closed) {
          const item=items[0];
          try {
            const response=await send(item);
            if(response.seq!==item.seq||typeof response.accepted!=='boolean')throw Error('Resposta de métricas inválida');
            if(closed)break;
            items.shift();recovered.delete(item.seq);changed(snapshot());
          } catch(error) {
            if(closed)break;
            if(error.code==='EVENT_CONFLICT'&&recover) {
              if(recovered.has(item.seq)) {items.shift();recovered.delete(item.seq);changed(snapshot());continue;}
              try {
                const next=await recover();
                if(!Number.isSafeInteger(next)||next<1)throw Error('Sequência inválida');
                if(closed)break;
                for(let i=0;i<items.length;i++)items[i]=Object.freeze({...items[i],seq:next+i});
                recovered.add(next);sequence=next+items.length;changed(snapshot());continue;
              }catch(recoveryError){if(!closed)failed(recoveryError);break;}
            }
            failed(error);break;
          }
        }
      })().finally(()=>{draining=null;});
      return draining;
    },
  };
}
