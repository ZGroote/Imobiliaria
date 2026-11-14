import {screenToPlan,snapPlanPoint,planDistance,distanceLabel,drawPlanRuler} from './plan-ruler.js';
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
  let active=null,disposed=false,measurementsVisible=false,rulerEnabled=false;
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
    record.layer.dataset.ruler=String(rulerEnabled&&active===record.key);
    if(record.rulerOverlay)drawPlanRuler(record,bounds);
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
    if(controls.ruler){controls.ruler.hidden=!record.rulerSpec;controls.ruler.setAttribute('aria-pressed',String(rulerEnabled));controls.ruler.setAttribute('aria-label',rulerEnabled?'Encerrar régua':'Medir entre dois pontos na planta 2D');}
    if(controls.rulerControls)controls.rulerControls.hidden=!rulerEnabled||!record.rulerSpec;
    const hasMeasures=Boolean(record.rulerStart||record.rulerMeasures.length);
    if(controls.rulerUndo)controls.rulerUndo.disabled=!hasMeasures;
    if(controls.rulerClear)controls.rulerClear.disabled=!hasMeasures;
  }
  const rulerHint=(text,short)=>{if(controls.rulerHint){controls.rulerHint.textContent=text;controls.rulerHint.setAttribute('data-mobile',short||'Toque em dois pontos · Medida aproximada.');}};
  const rulerHelp='Marque dois pontos. Perto de cantos e paredes, a régua encaixa automaticamente. Medidas aproximadas.';
  function rulerPoint(record,point){
    const spec=record.rulerSpec;if(!spec)return null;
    if(point.x<0||point.y<0||point.x>spec.width||point.y>spec.height)return null;
    const bounds=area(),scale=Math.min(bounds.width/spec.width,bounds.height/spec.height)*record.view.scale;
    return snapPlanPoint(point,spec,scale);
  }
  function markPoint(record,point){
    const snapped=rulerPoint(record,point);if(!snapped)return false;
    record.rulerCursor={...snapped};record.rulerPreview=null;
    if(!record.rulerStart){
      record.rulerStart=snapped;
      rulerHint('Primeiro ponto marcado'+(snapped.snap==='corner'?' no canto da parede':snapped.snap==='wall'?' na parede':'')+'. Marque o segundo ponto.','Marque o segundo ponto.');
    }else{
      const distance=planDistance(record.rulerStart,snapped,record.rulerSpec.mmPerPixel);
      if(distance<.02){rulerHint('Escolha um segundo ponto diferente do primeiro.');return false;}
      record.rulerMeasures.push({a:record.rulerStart,b:snapped});record.rulerStart=null;
      rulerHint(distanceLabel(distance)+'. Marque outros dois pontos para medir novamente. Medida aproximada.',distanceLabel(distance)+' · Marque mais dois pontos.');
    }
    present(record);return true;
  }
  function setRuler(enabled){
    const record=records.get(active);if(!record?.rulerSpec)return;
    rulerEnabled=enabled;record.rulerStart=record.rulerPreview=record.rulerCursor=null;
    rulerHint(rulerHelp);present(record);if(enabled)record.layer.focus?.({preventScroll:true});
  }
  function undoMeasure(){
    const record=records.get(active);if(!record)return;
    if(record.rulerStart)record.rulerStart=null;else record.rulerMeasures.pop();
    record.rulerPreview=null;rulerHint(rulerHelp);present(record);
  }
  function change(factor,anchor={x:0,y:0}){
    const record=records.get(active);if(!record?.loaded)return false;
    record.view=zoomPlanView(record.view,factor,anchor,area(),size(record));present(record);return true;
  }
  function reset(){const record=records.get(active);if(!record)return false;record.view={scale:1,x:0,y:0};present(record);return true;}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{const record=records.get(active);if(record){record.rulerPreview=null;present(record);}}):null;
  listen(controls.in,'click',()=>change(1.25));listen(controls.out,'click',()=>change(.8));listen(controls.reset,'click',reset);
  listen(controls.measurements,'click',()=>{
    const record=records.get(active);if(!record?.measurements)return;
    measurementsVisible=!measurementsVisible;present(record);
  });
  listen(controls.ruler,'click',()=>setRuler(!rulerEnabled));
  listen(controls.rulerDone,'click',()=>setRuler(false));
  listen(controls.rulerUndo,'click',undoMeasure);
  listen(controls.rulerClear,'click',()=>{
    const record=records.get(active);if(!record)return;
    record.rulerMeasures=[];record.rulerStart=record.rulerPreview=null;rulerHint(rulerHelp);present(record);
  });
  function prepare(key,spec){
    if(disposed)return Promise.reject(Error('Visualizador de plantas encerrado.'));
    if(records.has(key))return records.get(key).ready;
    const layer=document.createElement('div'),image=new Image();
    layer.className='plan2d-layer';layer.dataset.plan=key;layer.hidden=true;layer.tabIndex=0;
    layer.setAttribute('aria-label','Planta 2D: use + e − para ampliar e as setas para mover.');
    image.alt=spec.imageAlt;image.draggable=false;image.src=spec.image;layer.append(image);stage.append(layer);
    const record={key,layer,image,view:{scale:1,x:0,y:0},loaded:false,pointers:new Map(),gesture:null,
      rulerSpec:spec.ruler,rulerMeasures:[],rulerStart:null,rulerPreview:null,rulerCursor:null,tap:null};records.set(key,record);
    if(spec.ruler){
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','plan2d-ruler-overlay');
      svg.setAttribute('aria-hidden','true');layer.append(svg);record.rulerOverlay=svg;
    }
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
      record.rulerPreview=null;
      record.tap=record.pointers.size?null:{id:event.pointerId,point:point(event)};
      record.pointers.set(event.pointerId,point(event));layer.setPointerCapture(event.pointerId);beginGesture();
    });
    listenPlan('selectstart',event=>event.preventDefault());
    listenPlan('dragstart',event=>event.preventDefault());
    listenPlan('pointermove',event=>{
      if(active!==key)return;
      if(!record.pointers.has(event.pointerId)){
        if(rulerEnabled&&record.rulerSpec&&event.pointerType!=='touch'){
          record.rulerCursor=screenToPlan(point(event),record.view,area(),record.rulerSpec);
          record.rulerPreview=rulerPoint(record,record.rulerCursor);present(record);
        }
        return;
      }
      if(record.tap&&Math.hypot(point(event).x-record.tap.point.x,point(event).y-record.tap.point.y)>6)record.tap=null;
      record.pointers.set(event.pointerId,point(event));const gesture=record.gesture,points=[...record.pointers.values()].slice(0,2);
      const center=points.length===2?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
      const factor=points.length===2&&gesture.distance>0?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)/gesture.distance:1;
      const scale=clamp(gesture.view.scale*factor,1,6),ratio=scale/gesture.view.scale;
      record.view=constrainPlanView({scale,x:center.x-(gesture.origin.x-gesture.view.x)*ratio,y:center.y-(gesture.origin.y-gesture.view.y)*ratio},area(),size(record));present(record);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listenPlan(type,event=>{
      if(type==='pointerup'&&active===key&&rulerEnabled&&record.tap?.id===event.pointerId&&record.pointers.size===1)
        markPoint(record,screenToPlan(point(event),record.view,area(),record.rulerSpec));
      record.tap=null;record.pointers.delete(event.pointerId);beginGesture();
    });
    listenPlan('dblclick',event=>{if(active!==key)return;event.preventDefault();if(!rulerEnabled)record.view.scale>1?reset():change(2,point(event));});
    listenPlan('keydown',event=>{
      if(active!==key)return;
      if(rulerEnabled&&record.rulerSpec&&['Enter',' ','Escape','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();
        if(['Backspace','Delete'].includes(event.key))undoMeasure();
        else if(event.key==='Escape'){record.rulerStart=record.rulerPreview=null;rulerHint(rulerHelp);present(record);}
        else{
          const spec=record.rulerSpec;record.rulerCursor??={x:spec.width/2,y:spec.height/2};
          if(['Enter',' '].includes(event.key))markPoint(record,record.rulerCursor);
          else{
            const bounds=area(),step=(event.shiftKey?20:4)/(Math.min(bounds.width/spec.width,bounds.height/spec.height)*record.view.scale);
            record.rulerCursor.x=clamp(record.rulerCursor.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),0,spec.width);
            record.rulerCursor.y=clamp(record.rulerCursor.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0),0,spec.height);
            record.rulerPreview=rulerPoint(record,record.rulerCursor);present(record);
          }
        }
        return;
      }
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
    active=null;rulerEnabled=false;observer?.disconnect();
    if(controls.measurements)controls.measurements.hidden=true;
    if(controls.measurementsNote)controls.measurementsNote.hidden=true;
    if(controls.ruler)controls.ruler.hidden=true;if(controls.rulerControls)controls.rulerControls.hidden=true;
    for(const record of records.values()){
      record.layer.hidden=true;record.gesture=null;record.tap=null;record.rulerStart=record.rulerPreview=null;
      for(const id of record.pointers.keys())if(record.layer.hasPointerCapture(id))record.layer.releasePointerCapture(id);
      record.pointers.clear();
    }
  }
  return {prepare,hide,reset,change,
    show(key){const record=records.get(key);if(!record?.loaded)return false;hide();active=key;record.layer.hidden=false;observer?.observe(stage);present(record);return true;},
    getImage:key=>records.get(key)?.image,
    getState:()=>({active,measurementsVisible,rulerEnabled,plans:Object.fromEntries([...records].map(([key,r])=>[key,{ready:r.loaded,...r.view,rulerMeasures:r.rulerMeasures.map(m=>({a:{...m.a},b:{...m.b}}))}]))}),
    dispose(){disposed=true;hide();for(const remove of listeners)remove();for(const record of records.values()){record.image.src='';record.layer.remove();}records.clear();},
  };
}
