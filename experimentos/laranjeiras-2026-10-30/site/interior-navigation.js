// FloorPlan's native 5 cm ownership grid supplies the same wall/opening axes as
// HouseMesh. Walking and routing use these axes, never an image-sized rectangle.
export function inside(poly,x,z) {
  let result=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}
export function shoelace(poly){return poly.reduce((a,p,i)=>{const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-q[0]*p[1];},0);}

export function createLayout(unit) {
  const source=unit.planta,points=source.comodos.flatMap(c=>c.poly);
  if(!points.length||!points.flat().every(Number.isFinite))throw Error('Contorno da unidade inválido.');
  const min=[0,1].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...points.map(p=>p[i])));
  const center=min.map((v,i)=>(v+max[i])/2),local=p=>[p[0]-center[0],p[1]-center[1]],pd=source.pe_direito||2.7;
  const floor=globalThis.FloorPlan.create({inside,shoelace,ESP:.13,ESQ_ANG:90*Math.PI/180,ESQ_MARCO:.03,fecharQuinas:true});
  const openings=[...(source.portas||[]).map(rec=>({rec,porta:true,p:rec.p,largura:rec.largura||.85,y0:rec.y0??0,y1:rec.y1??2.1})),
    ...(source.janelas||[]).map(rec=>({rec,porta:false,p:rec.p,largura:rec.largura||1.4,y0:rec.y0??1,y1:rec.y1??2.2}))];
  const grade=floor.paredesDaGrade(source.comodos,openings,pd);
  const rooms=source.comodos.map((c,i)=>{
    const poly=c.poly.map(local),xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);
    const wood=/^(su[ií]te|dormit[oó]rio|sala|circula)/i.test(c.nome||'');
    return {id:c.id||`ambiente-${i}`,name:c.nome,nome:c.nome,poly,area:Math.abs(shoelace(poly))/2,
      cx:poly.reduce((s,p)=>s+p[0],0)/poly.length,cz:poly.reduce((s,p)=>s+p[1],0)/poly.length,
      pisoTipo:wood?'madeira':'frio',piso:parseInt((unit.cores?.[wood?'piso_madeira':'piso_frio']||'#B4B5B1').replace('#',''),16),
      f:{u0:Math.min(...xs),u1:Math.max(...xs),v0:Math.min(...zs),v1:Math.max(...zs)}};
  });
  const walls=grade.paredes.map(w=>({...w,a:local(w.a),b:local(w.b)}));
  const joinery=[];
  for(const v of grade.vaos){
    const d=floor.decideVao(source.comodos,v,pd);if(!d)continue;
    const a=local(v.a),b=local(v.b),L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    // A porta sem parede pareada dá para fora do apartamento: é a entrada.
    joinery.push({id:v.src.rec?.id??null,entrada:Boolean(v.src.porta&&v.src.rec&&!v.src.rec.pairedWallId),tipo:d.tipo,lado:d.lado,eixo:d.eixo,porta:!!v.src.porta,y0:v.y0,y1:v.y1,
      a,b,L,ux:(b[0]-a[0])/L,uz:(b[1]-a[1])/L,nx:-(b[1]-a[1])/L,nz:(b[0]-a[0])/L,
      remateA:v.remateA,remateB:v.remateB});
  }
  return {id:unit.id,center,pd,unit,rooms,walls,joinery,bounds:{x0:min[0]-center[0],x1:max[0]-center[0],z0:min[1]-center[1],z1:max[1]-center[1]},
    house:{id:unit.id,unidade:unit,pd,ob:{cx:0,cz:0,ux:1,uz:0},comodos:rooms,
      contorno:rooms.map(c=>c.poly),paredes:walls,esquadrias:joinery}};
}

function distanceToSegment(x,z,a,b,trimA=0,trimB=0){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;
  const t=Math.max(trimA/length,Math.min(1-trimB/length,((x-a[0])*dx+(z-a[1])*dz)/(length*length)));
  return Math.hypot(a[0]+t*dx-x,a[1]+t*dz-z);
}
function trimmed(a,b,amountA=0,amountB=0){
  const d=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
  return [[a[0]+(b[0]-a[0])*amountA/d,a[1]+(b[1]-a[1])*amountA/d],
    [b[0]-(b[0]-a[0])*amountB/d,b[1]-(b[1]-a[1])*amountB/d]];
}
function segmentDistance(a,b,c,d){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
  return Math.min(distanceToSegment(...a,c,d),distanceToSegment(...b,c,d),distanceToSegment(...c,a,b),distanceToSegment(...d,a,b));
}
function crossesBox(a,b,hw,hd){
  let lo=0,hi=1;
  for(const [axis,half]of [[0,hw-1e-7],[1,hd-1e-7]]){
    const delta=b[axis]-a[axis];
    if(Math.abs(delta)<1e-12){if(Math.abs(a[axis])>=half)return false;continue;}
    const t0=(-half-a[axis])/delta,t1=(half-a[axis])/delta;
    lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;
  }
  return hi>=0&&lo<=1;
}
const overhead=new Set(['aereo','coifa','cortina','ripado','tv','rack','box']);

export function createNavigation(layout,furniture=()=>[],{radius=.3,step=.05}={}) {
  const within=(x,z)=>layout.rooms.some(c=>inside(c.poly,x,z));
  function free(x,z){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!within(x,z))return false;
    for(const w of layout.walls){
      if(w.y0>=1.2)continue;
      if(distanceToSegment(x,z,w.a,w.b,w.pa?.14:0,w.pb?.14:0)<radius+.065-1e-7)return false;
    }
    for(const v of layout.joinery){
      const f=v.folha;if(!f)continue;
      const a=[f.x+f.dx*.12,f.z+f.dz*.12],b=[f.x+f.dx*f.larg,f.z+f.dz*f.larg];
      if(distanceToSegment(x,z,a,b)<.215)return false;
    }
    for(const m of furniture()){
      if(m.h<.35||overhead.has(m.tipo))continue;
      const a=-m.rotation*Math.PI/2,dx=x-m.position[0],dz=z-m.position[1];
      const u=dx*Math.cos(a)-dz*Math.sin(a),v=dx*Math.sin(a)+dz*Math.cos(a);
      if(Math.abs(u)<m.w/2+radius*.8-1e-7&&Math.abs(v)<m.d/2+radius*.8-1e-7)return false;
    }
    return true;
  }
  function segment(a,b){
    // Continuous swept tests prevent a compacted diagonal route grazing a
    // furniture corner between the discrete samples used for floor containment.
    for(const w of layout.walls){
      if(w.y0>=1.2)continue;
      const [c,d]=trimmed(w.a,w.b,w.pa?.14:0,w.pb?.14:0);
      if(segmentDistance(a,b,c,d)<radius+.065-1e-7)return false;
    }
    for(const v of layout.joinery){
      const f=v.folha;if(!f)continue;
      if(segmentDistance(a,b,[f.x+f.dx*.12,f.z+f.dz*.12],[f.x+f.dx*f.larg,f.z+f.dz*f.larg])<.215-1e-7)return false;
    }
    for(const m of furniture()){
      if(m.h<.35||overhead.has(m.tipo))continue;
      const theta=-m.rotation*Math.PI/2,c=Math.cos(theta),s=Math.sin(theta);
      const local=p=>{const x=p[0]-m.position[0],z=p[1]-m.position[1];return [x*c-z*s,x*s+z*c];};
      if(crossesBox(local(a),local(b),m.w/2+radius*.8,m.d/2+radius*.8))return false;
    }
    const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.025));
    for(let i=0;i<=n;i++)if(!free(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;
    return true;
  }
  function move(a,dx,dz){
    const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.025));let p=[...a];
    for(let i=0;i<n;i++){
      if(segment(p,[p[0]+dx/n,p[1]+dz/n]))p=[p[0]+dx/n,p[1]+dz/n];
      else {
        if(segment(p,[p[0]+dx/n,p[1]]))p[0]+=dx/n;
        if(segment(p,[p[0],p[1]+dz/n]))p[1]+=dz/n;
      }
    }
    return p;
  }
  let grid=null,lastRoutes=null;
  function buildGrid(){
    const b=layout.bounds,nx=Math.ceil((b.x1-b.x0)/step)+1,nz=Math.ceil((b.z1-b.z0)/step)+1,valid=new Uint8Array(nx*nz);
    const point=id=>[b.x0+(id%nz)*step,b.z0+Math.floor(id/nz)*step];
    // Index uses X as the slow dimension to keep neighbors deterministic.
    const at=id=>[b.x0+Math.floor(id/nz)*step,b.z0+(id%nz)*step];
    for(let x=0;x<nx;x++)for(let z=0;z<nz;z++)valid[x*nz+z]=free(b.x0+x*step,b.z0+z*step)?1:0;
    grid={nx,nz,valid,at};return grid;
  }
  function nearest(p,room=null){
    const g=grid||buildGrid();let best=-1,distance=Infinity;
    for(let i=0;i<g.valid.length;i++)if(g.valid[i]){
      const q=g.at(i);if(room&&!inside(room.poly,...q))continue;
      const d=(q[0]-p[0])**2+(q[1]-p[1])**2;
      if(d<distance&&(!free(...p)||segment(p,q))){best=i;distance=d;}
    }
    return best;
  }
  function entry(){
    const room=layout.rooms.find(r=>/^(sala|estar|living)/i.test(r.name))||layout.rooms[0];
    // Laranjeiras: o Tour começa logo depois da porta de entrada (90 cm para dentro), como numa visita;
    // o centro da sala punha a câmera colada no sofá. Sem porta de entrada, vale o centro da sala.
    const door=layout.joinery.find(j=>j.entrada);
    if(door){
      const mid=[(door.a[0]+door.b[0])/2,(door.a[1]+door.b[1])/2];
      for(const s of [1,-1]){
        const p=[mid[0]+door.nx*.9*s,mid[1]+door.nz*.9*s],inner=layout.rooms.find(r=>inside(r.poly,...p));
        if(!inner)continue;
        const id=nearest(p,inner);
        if(id>=0)return grid.at(id);
      }
    }
    const id=nearest([room.cx,room.cz],room);
    if(id<0)throw Error('A unidade não possui entrada caminhável na sala.');
    return grid.at(id);
  }
  function flood(start){
    const g=grid||buildGrid(),id=nearest(start),parents=new Int32Array(g.valid.length).fill(-2),queue=new Int32Array(g.valid.length);
    if(id<0)return {parents,start:-1};let head=0,tail=0;queue[tail++]=id;parents[id]=-1;
    while(head<tail){
      const current=queue[head++],x=Math.floor(current/g.nz),z=current%g.nz;
      for(const [xx,zz]of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){
        if(xx<0||zz<0||xx>=g.nx||zz>=g.nz)continue;
        const next=xx*g.nz+zz;if(!g.valid[next]||parents[next]!==-2)continue;
        if(!segment(g.at(current),g.at(next)))continue;
        parents[next]=current;queue[tail++]=next;
      }
    }
    return {parents,start:id};
  }
  function routes(start){
    if(lastRoutes&&start[0]===lastRoutes.start[0]&&start[1]===lastRoutes.start[1])return structuredClone(lastRoutes.value);
    const g=grid||buildGrid(),f=flood(start);
    const value=layout.rooms.map(room=>{
      let best=-1,score=Infinity;
      for(let id=0;id<g.valid.length;id++)if(f.parents[id]!==-2){
        const p=g.at(id);if(!inside(room.poly,...p))continue;
        const d=(p[0]-room.cx)**2+(p[1]-room.cz)**2;if(d<score){score=d;best=id;}
      }
      const path=[];if(best>=0){for(let id=best;id>=0;id=f.parents[id])path.push(g.at(id));path.reverse();path.unshift([...start]);}
      const compact=[];let at=0;if(path.length)compact.push(path[0]);
      while(at<path.length-1){let next=at+1;while(next+1<path.length&&segment(path[at],path[next+1]))next++;compact.push(path[next]);at=next;}
      return {id:room.id,name:room.name,reachable:best>=0,target:best>=0?g.at(best):null,path:compact};
    });
    lastRoutes={start:[...start],value};return structuredClone(value);
  }
  function direction(p){
    let longest=-1,yaw=0;
    for(let k=0;k<36;k++){
      const a=k*Math.PI/18,dx=Math.sin(a),dz=Math.cos(a);let t=.15;
      while(t<12&&within(p[0]+dx*t,p[1]+dz*t)&&!layout.walls.some(w=>w.y0<1.62&&w.y1>1.62&&distanceToSegment(p[0]+dx*t,p[1]+dz*t,w.a,w.b)<.095))t+=.15;
      if(t>longest){longest=t;yaw=Math.atan2(-dx,-dz);}
    }
    return yaw;
  }
  return {free,segment,move,entry,routes,direction,invalidate(){grid=null;lastRoutes=null;},radius,step};
}
