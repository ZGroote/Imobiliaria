import {geometriaParedes,type Room,type Opening,type Wall} from './modelo'

type Props={rooms:Room[];openings:Opening[];active:boolean;wallId:string|null;openingId:string|null;invalidIds:Set<string>;
  onSelect:(wallId:string,openingId?:string)=>void}
function segment(w:Wall,start=w.start,end=w.end){
  return w.axis==='x'?{x1:start,y1:-w.fixed,x2:end,y2:-w.fixed}:{x1:w.fixed,y1:-start,x2:w.fixed,y2:-end}
}
export default function ParedesEAberturas({rooms,openings,active,wallId,openingId,invalidIds,onSelect}:Props){
  const walls=geometriaParedes(rooms),selected=walls.find(w=>w.id===wallId)
  return <g>
    {active&&walls.map(w=><g key={w.id} role="button" tabIndex={0} aria-label={'Parede '+w.label} aria-pressed={wallId===w.id}
      onClick={()=>onSelect(w.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(w.id)}}}>
      <line {...segment(w)} stroke="transparent" strokeWidth="22" vectorEffect="non-scaling-stroke"/>
      <line {...segment(w)} pointerEvents="none" stroke={wallId===w.id?'#0f766e':'#64748b'} strokeWidth={wallId===w.id?5:2} vectorEffect="non-scaling-stroke"/>
    </g>)}
    {openings.map(o=>{
      const w=walls.find(w=>w.id===o.wallId);if(!w) return null
      const pos=segment(w,w.start+o.offsetMm,w.start+o.offsetMm+o.widthMm)
      return <g key={o.id} role={active?'button':undefined} tabIndex={active?0:undefined} pointerEvents={active?'auto':'none'}
        aria-label={(o.kind==='door'?'Porta ':'Janela ')+o.id} aria-pressed={openingId===o.id}
        onClick={()=>{if(active) onSelect(o.wallId,o.id)}}
        onKeyDown={e=>{if(active&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(o.wallId,o.id)}}}>
        <line {...pos} stroke="transparent" strokeWidth="26" vectorEffect="non-scaling-stroke"/>
        <line {...pos} stroke="white" strokeWidth="10" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
        <line {...pos} stroke={invalidIds.has(o.id)?'#be123c':o.kind==='door'?'#a16207':'#0369a1'}
          strokeWidth={openingId===o.id?7:5} strokeDasharray={o.kind==='window'?'4 2':undefined} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      </g>
    })}
    {active&&selected&&<circle cx={segment(selected).x1} cy={segment(selected).y1} r="65" fill="#0f766e" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
  </g>
}
