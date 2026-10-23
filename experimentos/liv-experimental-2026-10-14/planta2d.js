const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function constrainPlanView(view,area,image){
  const scale=clamp(view.scale,1,6),fit=Math.min(area.width/image.width,area.height/image.height);
  const limitX=Math.max(0,(image.width*fit*scale-area.width)/2);
  const limitY=Math.max(0,(image.height*fit*scale-area.height)/2);
  return {scale,x:clamp(view.x,-limitX,limitX),y:clamp(view.y,-limitY,limitY)};
}
export function zoomPlanView(view,factor,anchor,area,image){
  const scale=clamp(view.scale*factor,1,6),ratio=scale/view.scale;
  return constrainPlanView({scale,x:anchor.x-(anchor.x-view.x)*ratio,y:anchor.y-(anchor.y-view.y)*ratio},area,image);
}

// Keep both decoded images and each plan's zoom for the lifetime of the viewer.
export function createPlan2D(stage,controls){
  const records=new Map(),listeners=new Set();
  let active=null,disposed=false,measurementsVisible=false;
  function listen(element,type,handler,options){
    element?.addEventListener(type,handler,options);
    const remove=()=>{element?.removeEventListener(type,handler,options);listeners.delete(remove);};
    listeners.add(remove);return remove;
  }
  const area=()=>{const rect=stage.getBoundingClientRect();return {width:Math.max(1,rect.width),height:Math.max(1,rect.height)};};
  const size=record=>({width:record.image.naturalWidth||1,height:record.image.naturalHeight||1});
  function present(record){
    record.view=constrainPlanView(record.view,area(),size(record));
    const {scale,x,y}=record.view;
    record.image.style.transform=`translate(${x}px, ${y}px) scale(${scale})`;
    const bounds=area(),image=size(record),fit=Math.min(bounds.width/image.width,bounds.height/image.height);
    if(record.entry){
      record.entry.style.left=`calc(50% + ${x+(record.entryMarker.x-.5)*image.width*fit*scale}px)`;
      record.entry.style.top=`calc(50% + ${y+(record.entryMarker.y-.5)*image.height*fit*scale}px)`;
      record.entry.style.fontSize=`${Math.max(12,27*fit*scale)}px`;
    }
    if(record.measurements){
      // Match the contained image's drawn rectangle, not its full CSS box.
      // Labels stay legible while their anchors follow zoom and pan exactly.
      record.measurements.style.width=`${image.width*fit*scale}px`;
      record.measurements.style.height=`${image.height*fit*scale}px`;
      record.measurements.style.left=`calc(50% + ${x}px)`;
      record.measurements.style.top=`calc(50% + ${y}px)`;
      record.measurements.hidden=!measurementsVisible;
    }
    record.layer.dataset.scale=String(scale);
    record.layer.dataset.zoomed=String(scale>1);
    record.layer.dataset.details=String(scale>=1.5);
    if(active!==record.key)return;
    if(controls.value)controls.value.textContent=`${Math.round(scale*100)}%`;
    if(controls.out)controls.out.disabled=scale<=1;
    if(controls.in)controls.in.disabled=scale>=6;
    if(controls.measurements){
      controls.measurements.hidden=!record.measurements;
      controls.measurements.setAttribute('aria-pressed',String(measurementsVisible));
      controls.measurements.setAttribute('aria-label',`${measurementsVisible?'Ocultar':'Mostrar'} medidas estimadas da planta 2D`);
    }
    if(controls.measurementsNote)controls.measurementsNote.hidden=!measurementsVisible||!record.measurements;
  }
  function change(factor,anchor={x:0,y:0}){
    const record=records.get(active);if(!record?.loaded)return false;
    record.view=zoomPlanView(record.view,factor,anchor,area(),size(record));present(record);return true;
  }
  function reset(){const record=records.get(active);if(!record)return false;record.view={scale:1,x:0,y:0};present(record);return true;}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{const record=records.get(active);if(record)present(record);}):null;
  listen(controls.in,'click',()=>change(1.25));listen(controls.out,'click',()=>change(.8));listen(controls.reset,'click',reset);
  listen(controls.measurements,'click',()=>{
    const record=records.get(active);if(!record?.measurements)return;
    measurementsVisible=!measurementsVisible;present(record);
  });
  function prepare(key,spec){
    if(disposed)return Promise.reject(Error('Visualizador de plantas encerrado.'));
    if(records.has(key))return records.get(key).ready;
    const layer=document.createElement('div'),image=new Image();
    layer.className='plan2d-layer';layer.dataset.plan=key;layer.hidden=true;layer.tabIndex=0;
    layer.setAttribute('aria-label','Planta 2D: use + e − para ampliar e as setas para mover.');
    image.alt=spec.imageAlt;image.draggable=false;image.src=spec.image;layer.append(image);stage.append(layer);
    const record={key,layer,image,view:{scale:1,x:0,y:0},loaded:false,pointers:new Map(),gesture:null};records.set(key,record);
    // FUNDO-2D-20261023: recorta só a margem na exibição; o JPEG oficial permanece intacto.
    if(spec.imageMask){image.style.maskImage=`url("${spec.imageMask}")`;image.style.webkitMaskImage=image.style.maskImage;}
    if(spec.imageMask&&spec.entryMarker){
      const entry=document.createElement('span');entry.className='plan2d-entry';entry.textContent='▲';
      entry.setAttribute('role','img');entry.setAttribute('aria-label','Entrada do apartamento');layer.append(entry);
      record.entry=entry;record.entryMarker=spec.entryMarker;
    }
    if(spec.measurements?.length){
      const measures=document.createElement('div');measures.className='plan2d-measurements';measures.hidden=true;
      measures.setAttribute('role','group');measures.setAttribute('aria-label','Dimensões aproximadas dos ambientes, entre eixos das paredes');
      for(const item of spec.measurements){
        const label=document.createElement('span'),name=document.createElement('span'),value=document.createElement('strong');
        label.className='plan2d-measurement';label.style.left=`${item.x*100}%`;label.style.top=`${item.y*100}%`;
        name.textContent=item.name;
        const meters=mm=>(mm/1000).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
        value.textContent=`≈ ${meters(item.widthMm)} × ${meters(item.depthMm)} m`;
        label.append(name);label.append(value);measures.append(label);
      }
      layer.append(measures);record.measurements=measures;
    }
    const owned=[];
    const listenPlan=(type,handler,options)=>owned.push(listen(layer,type,handler,options));
    const point=event=>{const rect=layer.getBoundingClientRect();return {x:event.clientX-rect.left-rect.width/2,y:event.clientY-rect.top-rect.height/2};};
    function beginGesture(){
      const points=[...record.pointers.values()].slice(0,2);
      const origin=points.length===2?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
      record.gesture=origin?{view:{...record.view},origin,distance:points.length===2?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0}:null;
    }
    listenPlan('wheel',event=>{
      if(active!==key||!record.loaded)return;event.preventDefault();
      const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?area().height:1);
      change(Math.exp(-clamp(pixels,-250,250)*.002),point(event));
    },{passive:false});
    listenPlan('pointerdown',event=>{
      if(active!==key||event.button!==0)return;
      event.preventDefault();layer.focus?.({preventScroll:true});
      record.pointers.set(event.pointerId,point(event));layer.setPointerCapture(event.pointerId);beginGesture();
    });
    listenPlan('selectstart',event=>event.preventDefault());
    listenPlan('dragstart',event=>event.preventDefault());
    listenPlan('pointermove',event=>{
      if(active!==key||!record.pointers.has(event.pointerId))return;
      record.pointers.set(event.pointerId,point(event));const gesture=record.gesture,points=[...record.pointers.values()].slice(0,2);
      const center=points.length===2?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
      const factor=points.length===2&&gesture.distance>0?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)/gesture.distance:1;
      const scale=clamp(gesture.view.scale*factor,1,6),ratio=scale/gesture.view.scale;
      record.view=constrainPlanView({scale,x:center.x-(gesture.origin.x-gesture.view.x)*ratio,y:center.y-(gesture.origin.y-gesture.view.y)*ratio},area(),size(record));present(record);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listenPlan(type,event=>{record.pointers.delete(event.pointerId);beginGesture();});
    listenPlan('dblclick',event=>{if(active!==key)return;event.preventDefault();record.view.scale>1?reset():change(2,point(event));});
    listenPlan('keydown',event=>{
      if(active!==key)return;
      if(['+','=','-','_','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();
        if(['+','='].includes(event.key))change(1.25);
        else if(['-','_'].includes(event.key))change(.8);
        else if(['0','Home'].includes(event.key))reset();
        else {const step=event.shiftKey?80:32;record.view.x+=event.key==='ArrowLeft'?step:event.key==='ArrowRight'?-step:0;record.view.y+=event.key==='ArrowUp'?step:event.key==='ArrowDown'?-step:0;present(record);}
      }
    });
    record.ready=image.decode().then(()=>{
      if(disposed)throw Error('Visualizador de plantas encerrado.');record.loaded=true;layer.dataset.ready='true';present(record);return record;
    }).catch(error=>{if(records.get(key)===record)records.delete(key);for(const remove of owned)remove();image.src='';layer.remove();throw error;});
    return record.ready;
  }
  function hide(){
    active=null;observer?.disconnect();
    if(controls.measurements)controls.measurements.hidden=true;
    if(controls.measurementsNote)controls.measurementsNote.hidden=true;
    for(const record of records.values()){
      record.layer.hidden=true;record.gesture=null;
      for(const id of record.pointers.keys())if(record.layer.hasPointerCapture(id))record.layer.releasePointerCapture(id);
      record.pointers.clear();
    }
  }
  return {prepare,hide,reset,change,
    show(key){const record=records.get(key);if(!record?.loaded)return false;hide();active=key;record.layer.hidden=false;observer?.observe(stage);present(record);return true;},
    getImage:key=>records.get(key)?.image,
    getState:()=>({active,measurementsVisible,plans:Object.fromEntries([...records].map(([key,r])=>[key,{ready:r.loaded,...r.view}]))}),
    dispose(){disposed=true;hide();for(const remove of listeners)remove();for(const record of records.values()){record.image.src='';record.layer.remove();}records.clear();},
  };
}
