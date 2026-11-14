const fit=(area,image)=>Math.min(area.width/image.width,area.height/image.height);
export function planToScreen(point,view,area,image){
  const scale=fit(area,image)*view.scale;
  return {x:(point.x-image.width/2)*scale+view.x,y:(point.y-image.height/2)*scale+view.y};
}
export function screenToPlan(point,view,area,image){
  const scale=fit(area,image)*view.scale;
  return {x:(point.x-view.x)/scale+image.width/2,y:(point.y-view.y)/scale+image.height/2};
}
export function snapPlanPoint(point,spec,pixelsPerImagePixel){
  let corner=null,cornerDistance=12/pixelsPerImagePixel;
  for(const path of spec.paths)for(const [x,y]of path){
    const distance=Math.hypot(point.x-x,point.y-y);
    if(distance<=cornerDistance){cornerDistance=distance;corner={x,y,snap:'corner'};}
  }
  if(corner)return corner;
  let wall=null,wallDistance=8/pixelsPerImagePixel;
  for(const path of spec.paths)for(let i=0;i<path.length;i++){
    const a=path[i],b=path[(i+1)%path.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
    if(!length)continue;
    const t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.y-a[1])*dy)/length));
    const x=a[0]+dx*t,y=a[1]+dy*t,distance=Math.hypot(point.x-x,point.y-y);
    if(distance<=wallDistance){wallDistance=distance;wall={x,y,snap:'wall'};}
  }
  return wall||{...point,snap:null};
}
export const planDistance=(a,b,mmPerPixel)=>Math.hypot(b.x-a.x,b.y-a.y)*mmPerPixel/1000;
export const distanceLabel=meters=>'≈ '+meters.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' m';

export function drawPlanRuler(record,area){
  const svg=record.rulerOverlay;if(!svg)return;const document=svg.ownerDocument;
  svg.innerHTML='';svg.setAttribute('viewBox',`0 0 ${area.width} ${area.height}`);
  const node=(tag,attributes,parent=svg)=>{
    const element=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,value]of Object.entries(attributes))element.setAttribute(key,String(value));
    parent.append(element);return element;
  };
  const toScreen=point=>{const p=planToScreen(point,record.view,area,record.rulerSpec);return {x:p.x+area.width/2,y:p.y+area.height/2};};
  const segment=(measure,preview=false)=>{
    const a=toScreen(measure.a),b=toScreen(measure.b),length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<1)return;
    const group=node('g',{'class':'plan2d-ruler-segment'+(preview?' is-preview':''),'data-distance':planDistance(measure.a,measure.b,record.rulerSpec.mmPerPixel).toFixed(4)});
    node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y},group);
    const nx=-(b.y-a.y)/length*7,ny=(b.x-a.x)/length*7;
    for(const p of [a,b]){
      node('line',{x1:p.x-nx,y1:p.y-ny,x2:p.x+nx,y2:p.y+ny},group);
      node('circle',{cx:p.x,cy:p.y,r:3},group);
    }
    const text=distanceLabel(planDistance(measure.a,measure.b,record.rulerSpec.mmPerPixel)),width=text.length*7+14;
    const x=Math.max(width/2+3,Math.min(area.width-width/2-3,(a.x+b.x)/2));
    const y=Math.max(18,Math.min(area.height-18,(a.y+b.y)/2-18));
    node('rect',{x:x-width/2,y:y-12,width,height:24,rx:4},group);
    node('text',{x,y:y+4,'text-anchor':'middle'},group).textContent=text;
  };
  for(const measure of record.rulerMeasures)segment(measure);
  if(record.rulerStart&&record.rulerPreview)segment({a:record.rulerStart,b:record.rulerPreview},true);
  for(const p of [record.rulerStart,record.rulerPreview].filter(Boolean)){
    const screen=toScreen(p);node('circle',{cx:screen.x,cy:screen.y,r:p.snap?7:5,'class':p.snap?'plan2d-ruler-snap':'plan2d-ruler-point'});
  }
}
