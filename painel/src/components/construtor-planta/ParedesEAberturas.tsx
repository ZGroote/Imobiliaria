import {geometriaParedes,metros,type Room,type Opening,type OpeningInput,type Wall} from './modelo'

type Props={rooms:Room[];openings:Opening[];paredesAtivas:boolean;paredeDestaque:string|null;
  selecionada:string|null;invalidIds:Set<string>;rascunho:{o:OpeningInput;ok:boolean}|null;ignorar:string|null;
  mmPorPx:number;onParedeTeclado:(wallId:string)=>void;onAberturaTeclado:(id:string)=>void}
function segmento(w:Wall,start=w.start,end=w.end){
  return w.axis==='x'?{x1:start,y1:-w.fixed,x2:end,y2:-w.fixed}:{x1:w.fixed,y1:-start,x2:w.fixed,y2:-end}
}
// Para dentro do cômodo dono da parede, já no SVG (y invertido): é onde a cota é desenhada.
const PARA_DENTRO:Record<string,[number,number]>={south:[0,-1],north:[0,1],west:[1,0],east:[-1,0]}
const teclaAtiva=(e:{key:string;preventDefault:()=>void},f:()=>void)=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();f()}
}

export default function ParedesEAberturas({rooms,openings,paredesAtivas,paredeDestaque,selecionada,invalidIds,
  rascunho,ignorar,mmPorPx,onParedeTeclado,onAberturaTeclado}:Props){
  const walls=geometriaParedes(rooms),destaque=walls.find(w=>w.id===paredeDestaque)
  const doRascunho=rascunho&&walls.find(w=>w.id===rascunho.o.wallId)
  return <g>
    {paredesAtivas&&walls.map(w=><g key={w.id} data-parede={w.id} role="button" tabIndex={0}
      aria-label={'Parede '+w.label} onKeyDown={e=>teclaAtiva(e,()=>onParedeTeclado(w.id))}>
      <line {...segmento(w)} stroke="transparent" strokeWidth="28" vectorEffect="non-scaling-stroke"/>
      <line {...segmento(w)} pointerEvents="none" stroke="#0f766e" strokeOpacity=".6" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
    </g>)}
    {destaque&&<g pointerEvents="none">
      <line {...segmento(destaque)} stroke="#0f766e" strokeWidth="6" vectorEffect="non-scaling-stroke"/>
      <circle cx={segmento(destaque).x1} cy={segmento(destaque).y1} r={7*mmPorPx} fill="#0f766e" stroke="white"
        strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    </g>}
    {openings.filter(o=>o.id!==ignorar).map(o=>{
      const w=walls.find(w=>w.id===o.wallId);if(!w) return null
      const pos=segmento(w,w.start+o.offsetMm,w.start+o.offsetMm+o.widthMm)
      return <g key={o.id} data-abertura={o.id} role="button" tabIndex={0} aria-pressed={selecionada===o.id}
        aria-label={(o.kind==='door'?'Porta ':'Janela ')+metros(o.widthMm)+' m, '+w.label}
        onKeyDown={e=>teclaAtiva(e,()=>onAberturaTeclado(o.id))}>
        <line {...pos} stroke="transparent" strokeWidth="28" vectorEffect="non-scaling-stroke"/>
        <line {...pos} stroke="white" strokeWidth="10" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
        <line {...pos} stroke={invalidIds.has(o.id)?'#be123c':o.kind==='door'?'#a16207':'#0369a1'}
          strokeWidth={selecionada===o.id?9:5} strokeDasharray={o.kind==='window'?'4 2':undefined}
          vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      </g>
    })}
    {rascunho&&doRascunho&&<Rascunho w={doRascunho} o={rascunho.o} ok={rascunho.ok} mmPorPx={mmPorPx}/>}
  </g>
}

// A abertura ainda não confirmada e a cota do canto ● até ela.
function Rascunho({w,o,ok,mmPorPx}:{w:Wall;o:OpeningInput;ok:boolean;mmPorPx:number}){
  const a=w.start+o.offsetMm,s=segmento(w,a,a+o.widthMm),c=segmento(w,w.start,a)
  const [nx,ny]=PARA_DENTRO[w.id.slice(w.id.lastIndexOf('-')+1)]??[0,0]
  const d=24*mmPorPx,tick=5*mmPorPx
  const cota={x1:c.x1+nx*d,y1:c.y1+ny*d,x2:c.x2+nx*d,y2:c.y2+ny*d}
  const cor=!ok?'#be123c':o.kind==='door'?'#a16207':'#0369a1'
  return <g pointerEvents="none">
    <line {...s} stroke="white" strokeWidth="13" vectorEffect="non-scaling-stroke"/>
    <line {...s} stroke={cor} strokeWidth="8" strokeDasharray={o.kind==='window'?'5 3':undefined} vectorEffect="non-scaling-stroke"/>
    {o.offsetMm>0&&<>
      <line {...cota} stroke="#334155" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
      {[[cota.x1,cota.y1],[cota.x2,cota.y2]].map(([x,y],i)=><line key={i} x1={x-nx*tick} y1={y-ny*tick}
        x2={x+nx*tick} y2={y+ny*tick} stroke="#334155" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
      <text x={(cota.x1+cota.x2)/2+nx*16*mmPorPx} y={(cota.y1+cota.y2)/2+ny*16*mmPorPx} fontSize={14*mmPorPx}
        textAnchor="middle" dominantBaseline="middle" fill="#0f172a" stroke="white" strokeWidth={4*mmPorPx}
        paintOrder="stroke">{metros(o.offsetMm)} m</text>
    </>}
  </g>
}
