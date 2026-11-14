import {geometriaParedes,metros,relacoes,type Room,type Opening,type OpeningInput,type Wall} from './modelo'

type Props={rooms:Room[];openings:Opening[];mergedGroups?:string[][];paredesAtivas:boolean;paredeDestaque:string|null;
  selecionada:string|null;invalidIds:Set<string>;rascunho:{o:OpeningInput;ok:boolean}|null;ignorar:string|null;
  mmPorPx:number;onParedeTeclado:(wallId:string)=>void;onAberturaTeclado:(id:string)=>void;
  onNudgeAbertura?:(id:string,deltaMm:number)=>void}
function segmento(w:Wall,start=w.start,end=w.end){
  return w.axis==='x'?{x1:start,y1:-w.fixed,x2:end,y2:-w.fixed}:{x1:w.fixed,y1:-start,x2:w.fixed,y2:-end}
}
// Para dentro do cômodo dono da parede, já no SVG (y invertido): é onde a cota é desenhada.
const PARA_DENTRO:Record<string,[number,number]>={south:[0,-1],north:[0,1],west:[1,0],east:[-1,0]}
const teclaAtiva=(e:{key:string;preventDefault:()=>void},f:()=>void)=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();f()}
}

export default function ParedesEAberturas({rooms,openings,mergedGroups,paredesAtivas,paredeDestaque,selecionada,invalidIds,
  rascunho,ignorar,mmPorPx,onParedeTeclado,onAberturaTeclado,onNudgeAbertura}:Props){
  const walls=geometriaParedes(rooms),destaque=walls.find(w=>w.id===paredeDestaque)
  const doRascunho=rascunho&&walls.find(w=>w.id===rascunho.o.wallId)
  const rels=relacoes(rooms,mergedGroups)
  const mergedWalls=new Set(rels.filter(r=>r.kind==='merged').flatMap(r=>[r.wallA,r.wallB]))
  const aberturaSel=selecionada?openings.find(o=>o.id===selecionada):null
  const wallSel=aberturaSel?walls.find(w=>w.id===aberturaSel.wallId):null

  return <g>
    {paredesAtivas&&walls.filter(w=>!mergedWalls.has(w.id)).map(w=><g key={w.id} data-parede={w.id} role="button" tabIndex={0}
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
      const ehSel=selecionada===o.id
      return <g key={o.id} data-abertura={o.id} role="button" tabIndex={0} aria-pressed={ehSel}
        aria-label={(o.kind==='door'?'Porta ':'Janela ')+metros(o.widthMm)+' m, '+w.label}
        onKeyDown={e=>teclaAtiva(e,()=>onAberturaTeclado(o.id))}>
        <line {...pos} stroke="transparent" strokeWidth="36" vectorEffect="non-scaling-stroke" style={{cursor:'grab'}}/>
        <line {...pos} stroke="white" strokeWidth={ehSel?14:10} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
        <line {...pos} stroke={invalidIds.has(o.id)?'#be123c':o.kind==='door'?'#a16207':'#0369a1'}
          strokeWidth={ehSel?10:5} strokeDasharray={o.kind==='window'?'4 2':undefined}
          vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      </g>
    })}
    {rascunho&&doRascunho&&<Rascunho w={doRascunho} o={rascunho.o} ok={rascunho.ok} mmPorPx={mmPorPx}/>}
    {!rascunho&&aberturaSel&&wallSel&&<CotaAberturaSelecionada w={wallSel} o={aberturaSel} mmPorPx={mmPorPx} onNudgeAbertura={onNudgeAbertura}/>}
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

// Cota em tempo real e setinhas para a abertura selecionada
function CotaAberturaSelecionada({w,o,mmPorPx,onNudgeAbertura}:{w:Wall;o:Opening;mmPorPx:number;onNudgeAbertura?:(id:string,deltaMm:number)=>void}){
  const a=w.start+o.offsetMm
  const c=segmento(w,w.start,a)
  const s=segmento(w,a,a+o.widthMm)
  const rem=segmento(w,a+o.widthMm,w.end)
  const [nx,ny]=PARA_DENTRO[w.id.slice(w.id.lastIndexOf('-')+1)]??[0,0]
  const d=26*mmPorPx,tick=6*mmPorPx
  const cotaInicio={x1:c.x1+nx*d,y1:c.y1+ny*d,x2:c.x2+nx*d,y2:c.y2+ny*d}
  const cotaLargura={x1:s.x1+nx*d,y1:s.y1+ny*d,x2:s.x2+nx*d,y2:s.y2+ny*d}
  const cotaResto={x1:rem.x1+nx*d,y1:rem.y1+ny*d,x2:rem.x2+nx*d,y2:rem.y2+ny*d}
  const sobraMm=(w.end-w.start)-(o.offsetMm+o.widthMm)
  const canto=segmento(w,w.start,w.start)

  // Direção ao longo da parede para setinhas
  const isX=w.axis==='x'
  const setaRecuar=isX?'◀':'▼'
  const setaAvancar=isX?'▶':'▲'

  // Posições dos botões de setinha
  const btnRecuar={
    x:isX?s.x1-22*mmPorPx:s.x1+nx*26*mmPorPx,
    y:isX?s.y1+ny*26*mmPorPx:s.y1+22*mmPorPx
  }
  const btnAvancar={
    x:isX?s.x2+22*mmPorPx:s.x2+nx*26*mmPorPx,
    y:isX?s.y2+ny*26*mmPorPx:s.y2-22*mmPorPx
  }
  const rBtn=14*mmPorPx

  return <g>
    {/* Marcador do canto de referência ● */}
    <circle cx={canto.x1} cy={canto.y1} r={7*mmPorPx} fill="#0f766e" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    <text x={canto.x1+nx*16*mmPorPx} y={canto.y1+ny*16*mmPorPx} fontSize={12*mmPorPx} textAnchor="middle" dominantBaseline="middle"
      fill="#0f766e" fontWeight="700" stroke="white" strokeWidth={3*mmPorPx} paintOrder="stroke" pointerEvents="none">
      ● Canto
    </text>

    {/* Cota do canto ● até o início da abertura */}
    {o.offsetMm>0&&<g pointerEvents="none">
      <line {...cotaInicio} stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      {[[cotaInicio.x1,cotaInicio.y1],[cotaInicio.x2,cotaInicio.y2]].map(([x,y],i)=><line key={i} x1={x-nx*tick} y1={y-ny*tick}
        x2={x+nx*tick} y2={y+ny*tick} stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
      <text x={(cotaInicio.x1+cotaInicio.x2)/2+nx*16*mmPorPx} y={(cotaInicio.y1+cotaInicio.y2)/2+ny*16*mmPorPx}
        fontSize={13*mmPorPx} textAnchor="middle" dominantBaseline="middle" fill="#0f766e" fontWeight="700"
        stroke="white" strokeWidth={4*mmPorPx} paintOrder="stroke">{metros(o.offsetMm)} m</text>
    </g>}

    {/* Cota da largura da própria abertura */}
    <g pointerEvents="none">
      <line {...cotaLargura} stroke="#334155" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      {[[cotaLargura.x1,cotaLargura.y1],[cotaLargura.x2,cotaLargura.y2]].map(([x,y],i)=><line key={i} x1={x-nx*tick} y1={y-ny*tick}
        x2={x+nx*tick} y2={y+ny*tick} stroke="#334155" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
      <text x={(cotaLargura.x1+cotaLargura.x2)/2+nx*16*mmPorPx} y={(cotaLargura.y1+cotaLargura.y2)/2+ny*16*mmPorPx}
        fontSize={13*mmPorPx} textAnchor="middle" dominantBaseline="middle" fill="#0f172a" fontWeight="700"
        stroke="white" strokeWidth={4*mmPorPx} paintOrder="stroke">{metros(o.widthMm)} m</text>
    </g>

    {/* Cota do restante da parede até o canto final */}
    {sobraMm>100&&<g pointerEvents="none">
      <line {...cotaResto} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"/>
      {[[cotaResto.x1,cotaResto.y1],[cotaResto.x2,cotaResto.y2]].map(([x,y],i)=><line key={i} x1={x-nx*tick} y1={y-ny*tick}
        x2={x+nx*tick} y2={y+ny*tick} stroke="#94a3b8" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
      <text x={(cotaResto.x1+cotaResto.x2)/2+nx*16*mmPorPx} y={(cotaResto.y1+cotaResto.y2)/2+ny*16*mmPorPx}
        fontSize={11*mmPorPx} textAnchor="middle" dominantBaseline="middle" fill="#64748b"
        stroke="white" strokeWidth={3*mmPorPx} paintOrder="stroke">{metros(sobraMm)} m</text>
    </g>}

    {/* Setinhas interativas SVG */}
    {onNudgeAbertura&&<g>
      <g role="button" tabIndex={0} aria-label="Recuar 5 cm" style={{cursor:'pointer'}}
        onPointerDown={e=>{e.stopPropagation();onNudgeAbertura(o.id,-50)}}
        onClick={e=>e.stopPropagation()}>
        <circle cx={btnRecuar.x} cy={btnRecuar.y} r={rBtn} fill="#0f766e" stroke="white" strokeWidth={2*mmPorPx} vectorEffect="non-scaling-stroke"/>
        <text x={btnRecuar.x} y={btnRecuar.y+1*mmPorPx} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={13*mmPorPx} fontWeight="900" pointerEvents="none">{setaRecuar}</text>
      </g>
      <g role="button" tabIndex={0} aria-label="Avançar 5 cm" style={{cursor:'pointer'}}
        onPointerDown={e=>{e.stopPropagation();onNudgeAbertura(o.id,50)}}
        onClick={e=>e.stopPropagation()}>
        <circle cx={btnAvancar.x} cy={btnAvancar.y} r={rBtn} fill="#0f766e" stroke="white" strokeWidth={2*mmPorPx} vectorEffect="non-scaling-stroke"/>
        <text x={btnAvancar.x} y={btnAvancar.y+1*mmPorPx} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={13*mmPorPx} fontWeight="900" pointerEvents="none">{setaAvancar}</text>
      </g>
    </g>}
  </g>
}