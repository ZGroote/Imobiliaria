// The Planta 2D of a single-unit property (MG-3), drawn from the registered plan (dados.planta) by the v16
// floor-plan.js: walls come from the same 5 cm grid and doors open to the same side as in the 3D interior.
// SVG, so it stays sharp at any zoom and screen density.
import '../../v1.5/renderizador-v16-moveis/interior/floor-plan.js';

// The v16 values: wall thickness of the maquete page, door frame and leaf opening of interior/openings.js.
const ESP=.13,ESQ_ANG=78*Math.PI/180,ESQ_MARCO=.03,CUT=1.2;
function inside(poly,x,z){
  let result=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,zi]=poly[i],[xj,zj]=poly[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)result=!result;
  }
  return result;
}
// Twice the signed area, as the v16 shoelace.
const shoelace=poly=>poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
const FP=globalThis.FloorPlan.create({inside,shoelace,ESP,ESQ_ANG,ESQ_MARCO});
const escape=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const f=v=>v.toFixed(1);
const TEXT='rgba(231,235,240,';

// The point farthest from the room's border: inside even an L-shaped room, and its clearance is the label width.
function roomyPoint(poly){
  const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),step=Math.max(x1-x0,z1-z0)/22;
  let best={x:(x0+x1)/2,z:(z0+z1)/2,d:0};
  for(let x=x0+step/2;x<x1;x+=step)for(let z=z0+step/2;z<z1;z+=step){
    if(!inside(poly,x,z))continue;
    let d=Infinity;
    poly.forEach((a,i)=>{
      const b=poly[(i+1)%poly.length],vx=b[0]-a[0],vz=b[1]-a[1],l2=vx*vx+vz*vz;
      const t=l2?Math.max(0,Math.min(1,((x-a[0])*vx+(z-a[1])*vz)/l2)):0;
      d=Math.min(d,Math.hypot(a[0]+vx*t-x,a[1]+vz*t-z));
    });
    if(d>best.d)best={x,z,d};
  }
  return best;
}

export function desenharPlanta(planta,largura,altura){
  const pd=planta.pe_direito??2.6;
  const openings=[
    ...(planta.portas??[]).map(v=>({rec:v,porta:true,p:v.p,largura:v.largura??.85,y0:v.y0??0,y1:v.y1??2.1})),
    ...(planta.janelas??[]).map(v=>({rec:v,porta:false,p:v.p,largura:v.largura??1.4,y0:v.y0??1,y1:v.y1??2.2})),
  ];
  const {paredes,vaos}=FP.paredesDaGrade(planta.comodos,openings,pd);
  const points=planta.comodos.flatMap(c=>c.poly),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
  // The bottom strip is the scale bar's.
  const M=16,MB=28,scale=Math.min((largura-2*M)/(x1-x0),(altura-M-MB)/(z1-z0));
  const ox=largura/2-(x0+x1)/2*scale,oy=(M+altura-MB)/2-(z0+z1)/2*scale;
  const X=x=>ox+x*scale,Y=z=>oy+z*scale,wall=Math.max(1.5,ESP*scale);
  const line=(cls,a,b,stroke,width,cap='butt')=>
    `<line class="${cls}" x1="${f(X(a[0]))}" y1="${f(Y(a[1]))}" x2="${f(X(b[0]))}" y2="${f(Y(b[1]))}" stroke="${stroke}" stroke-width="${f(width)}" stroke-linecap="${cap}"/>`;
  const out=[];
  for(const c of planta.comodos)out.push(`<polygon class="comodo" points="${c.poly.map(p=>`${f(X(p[0]))},${f(Y(p[1]))}`).join(' ')}" `+
    `fill="${c.piso==='frio'?'rgba(150,170,190,.15)':'rgba(190,150,105,.17)'}"/>`);
  // A plan is a cut at 1.2 m: only the wall pieces that cross it (no sill, no lintel).
  for(const w of paredes)if(w.y0<CUT&&w.y1>CUT)out.push(line('parede',w.a,w.b,'#E7EBF0',wall,'square'));
  for(const v of vaos){
    const d=FP.decideVao(planta.comodos,v,pd);
    if(!d||d.tipo==='vao')continue;                              // a passage has no leaf
    if(d.tipo!=='giro'){out.push(line(v.src.porta?'correr':'janela',v.a,v.b,'#6FC6F5',Math.max(1.2,wall/2)));continue;}
    // Swing door, open at 90°: the leaf from the hinge into the side it opens to, and the arc it sweeps.
    const size=Math.hypot(v.b[0]-v.a[0],v.b[1]-v.a[1]),hinge=d.eixo?v.b:v.a,closed=d.eixo?v.a:v.b,sign=d.eixo?-1:1;
    const leaf=[hinge[0]+v.nx*d.lado*size,hinge[1]+v.nz*d.lado*size];
    out.push(line('folha',hinge,leaf,`${TEXT}.6)`,1.4));
    out.push(`<path class="arco" d="M ${f(X(closed[0]))} ${f(Y(closed[1]))} A ${f(size*scale)} ${f(size*scale)} 0 0 ${d.lado*sign>0?1:0} `+
      `${f(X(leaf[0]))} ${f(Y(leaf[1]))}" fill="none" stroke="${TEXT}.34)" stroke-width="1"/>`);
  }
  // The label fits the room or is not written; the area needs room for a second line.
  for(const c of planta.comodos){
    const p=roomyPoint(c.poly),name=escape(c.nome),area=c.area??Math.abs(shoelace(c.poly))/2;
    let size=Math.min(scale*.4,2*p.d*scale*.9/(.54*name.length),p.d*scale*.8);
    const named=size>=6.5;size=Math.max(6.5,Math.min(size,20));
    const small=Math.max(6,size*.74),y=Y(p.z)+(named?-size*.08:small*.36);
    if(named)out.push(`<text class="rotulo" x="${f(X(p.x))}" y="${f(y)}" text-anchor="middle" font-family="system-ui,sans-serif" `+
      `font-size="${f(size)}" fill="${TEXT}.82)">${name}</text>`);
    if(area>.4&&small*3.6<2*p.d*scale)out.push(`<text class="area" x="${f(X(p.x))}" y="${f(y+small*1.18)}" text-anchor="middle" `+
      `font-family="system-ui,sans-serif" font-size="${f(small)}" fill="${TEXT}.48)">${area.toFixed(1).replace('.',',')} m²</text>`);
  }
  // The scale bar: the nearest round step to a fifth of the width, redrawn at the drawing's scale. It and
  // its label stay inside the bottom strip: above the bar, the label fell on a plan that reaches the strip.
  const step=[1,2,5,10,20].filter(m=>m*scale<=(largura-2*M)*.2).pop()??1;
  const bx=M+2,by=altura-12,bw=step*scale;
  out.push(`<path class="escala" d="M ${bx} ${by-4} V ${by+4} M ${bx} ${by} H ${f(bx+bw)} M ${f(bx+bw)} ${by-4} V ${by+4}" `+
    `fill="none" stroke="${TEXT}.45)" stroke-width="1.5"/>`,
    `<text x="${f(bx+bw+6)}" y="${by+4}" font-family="system-ui,sans-serif" font-size="11" fill="${TEXT}.6)">${step} m</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" `+
    `role="img" aria-label="Planta baixa">${out.join('')}</svg>`;
}
