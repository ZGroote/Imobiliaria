// Feedback local e edição. O gate normativo continua sendo pipeline.validar_leitura.
export type Room = {id:string; name:string; xMm:number; yMm:number; widthMm:number; depthMm:number}
export type Layout = {rooms:Room[]; ceilingHeightMm:number|null}
export type Session = {id:string; revision:number; nextId:number; present:Layout; past:Layout[]; future:Layout[]}
type Measures = {name:string; widthMm:number; depthMm:number; ceilingHeightMm:number}
export type Action = ({type:'add'} & Measures) | ({type:'edit'; id:string} & Measures)
  | {type:'move'; id:string; xMm:number; yMm:number} | {type:'delete'; id:string}
export type Problem = {code:string; message:string; ids:string[]}
const declared = () => ({kind:'declared' as const, referenceIds:[] as string[]})
const integer = (n:number, min:number, max:number) => Number.isSafeInteger(n) && n>=min && n<=max

export function metrosParaMm(text:string):number {
  const match=/^(\d+)(?:[.,](\d{1,3}))?$/.exec(text.trim())
  if(!match) throw new Error('Use metros com até três casas decimais, como 4,20.')
  const n=Number(match[1])*1000+Number((match[2]??'').padEnd(3,'0'))
  if(!integer(n,1,1000000)) throw new Error('A medida deve ser maior que zero e até 1.000 m.')
  return n
}
export const metros = (mm:number) => {
  const whole=Math.trunc(Math.abs(mm)/1000), rest=String(Math.abs(mm%1000)).padStart(3,'0').replace(/0+$/,'')
  return (mm<0?'-':'')+(rest ? whole+','+rest : String(whole))
}
export const iniciar = (id:string):Session => ({
  id, revision:1, nextId:1, present:{rooms:[],ceilingHeightMm:null}, past:[], future:[],
})
export function aplicar(s:Session,a:Action):Session {
  let rooms=s.present.rooms, ceilingHeightMm=s.present.ceilingHeightMm
  if(a.type==='add'||a.type==='edit'){
    if(!a.name.trim() || a.name.trim().length>100) throw new Error('Informe um nome com até 100 caracteres.')
    if(![a.widthMm,a.depthMm,a.ceilingHeightMm].every(n=>integer(n,1,1000000)))
      throw new Error('Declare largura, profundidade e pé-direito válidos.')
    ceilingHeightMm=a.ceilingHeightMm
  }
  if(a.type==='add'){
    if(rooms.length>=100) throw new Error('O limite desta planta é de 100 cômodos.')
    const xMm=rooms.length ? Math.max(...rooms.map(r=>r.xMm+r.widthMm))+500 : 0
    rooms=[...rooms,{id:'c'+s.nextId,name:a.name.trim(),widthMm:a.widthMm,depthMm:a.depthMm,xMm,yMm:0}]
  }else{
    if(!rooms.some(r=>r.id===a.id)) throw new Error('Selecione um cômodo existente.')
    if(a.type==='delete') rooms=rooms.filter(r=>r.id!==a.id)
    if(a.type==='edit') rooms=rooms.map(r=>r.id===a.id?{...r,name:a.name.trim(),widthMm:a.widthMm,depthMm:a.depthMm}:r)
    if(a.type==='move'){
      if(!Number.isSafeInteger(a.xMm)||!Number.isSafeInteger(a.yMm)) throw new Error('A posição precisa usar milímetros inteiros.')
      rooms=rooms.map(r=>r.id===a.id?{...r,xMm:a.xMm,yMm:a.yMm}:r)
    }
  }
  const present={rooms,ceilingHeightMm}
  if(JSON.stringify(present)===JSON.stringify(s.present)) return s
  return {...s,present,revision:s.revision+1,nextId:s.nextId+(a.type==='add'?1:0),past:[...s.past,s.present],future:[]}
}
export function desfazer(s:Session):Session {
  if(!s.past.length) return s
  return {...s,present:s.past[s.past.length-1],past:s.past.slice(0,-1),future:[s.present,...s.future],revision:s.revision+1}
}
export function refazer(s:Session):Session {
  if(!s.future.length) return s
  return {...s,present:s.future[0],past:[...s.past,s.present],future:s.future.slice(1),revision:s.revision+1}
}
const overlap = (a:number,b:number,c:number,d:number) => Math.max(a,c)<Math.min(b,d)
export const paredes = (id:string) => ({south:id+'-south',east:id+'-east',north:id+'-north',west:id+'-west'})
export function relacoes(rooms:Room[]){
  const result:{id:string; kind:'adjacent'; wallA:string; wallB:string; provenance:ReturnType<typeof declared>}[]=[]
  const push=(a:string,b:string)=>{
    const [wallA,wallB]=[a,b].sort()
    result.push({id:'rel-'+wallA+'--'+wallB,kind:'adjacent',wallA,wallB,provenance:declared()})
  }
  for(let i=0;i<rooms.length;i++) for(let j=i+1;j<rooms.length;j++){
    const a=rooms[i],b=rooms[j]
    if(overlap(a.yMm,a.yMm+a.depthMm,b.yMm,b.yMm+b.depthMm)){
      if(a.xMm+a.widthMm===b.xMm) push(a.id+'-east',b.id+'-west')
      if(b.xMm+b.widthMm===a.xMm) push(b.id+'-east',a.id+'-west')
    }
    if(overlap(a.xMm,a.xMm+a.widthMm,b.xMm,b.xMm+b.widthMm)){
      if(a.yMm+a.depthMm===b.yMm) push(a.id+'-north',b.id+'-south')
      if(b.yMm+b.depthMm===a.yMm) push(b.id+'-north',a.id+'-south')
    }
  }
  return result.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)
}
export function snap(rooms:Room[],id:string,xMm:number,yMm:number,tolerance:number){
  const r=rooms.find(r=>r.id===id)
  if(!r) return {xMm,yMm}
  // Ordem fixa resolve empates sem depender da ordem da lista.
  const others=rooms.filter(r=>r.id!==id).sort((a,b)=>a.id<b.id?-1:1)
  const nearest=(value:number,targets:number[])=>{
    let best=value,distance=tolerance+1
    for(const t of targets) if(Math.abs(t-value)<=tolerance && Math.abs(t-value)<distance){
      best=t;distance=Math.abs(t-value)
    }
    return best
  }
  const xs=others.filter(o=>overlap(yMm,yMm+r.depthMm,o.yMm,o.yMm+o.depthMm))
    .flatMap(o=>[o.xMm-r.widthMm,o.xMm+o.widthMm])
  xMm=nearest(xMm,xs)
  const ys=others.filter(o=>overlap(xMm,xMm+r.widthMm,o.xMm,o.xMm+o.widthMm))
    .flatMap(o=>[o.yMm-r.depthMm,o.yMm+o.depthMm])
  yMm=nearest(yMm,ys)
  // Depois do contato entre paredes, alinhe suas extremidades próximas.
  // Sem contato positivo, não há atração só por vértice ou por grade.
  xMm=nearest(xMm,others.filter(o=>(yMm===o.yMm+o.depthMm||yMm+r.depthMm===o.yMm)
    &&overlap(xMm,xMm+r.widthMm,o.xMm,o.xMm+o.widthMm)).flatMap(o=>[o.xMm,o.xMm+o.widthMm-r.widthMm]))
  yMm=nearest(yMm,others.filter(o=>(xMm===o.xMm+o.widthMm||xMm+r.widthMm===o.xMm)
    &&overlap(yMm,yMm+r.depthMm,o.yMm,o.yMm+o.depthMm)).flatMap(o=>[o.yMm,o.yMm+o.depthMm-r.depthMm]))
  return {xMm,yMm}
}
export function problemas(layout:Layout):Problem[]{
  const {rooms,ceilingHeightMm}=layout, result:Problem[]=[]
  if(!rooms.length) result.push({code:'EMPTY',message:'Adicione o primeiro cômodo.',ids:[]})
  if(ceilingHeightMm===null) result.push({code:'HEIGHT_REQUIRED',message:'Declare o pé-direito da planta.',ids:[]})
  for(const r of rooms) if(!integer(r.xMm,-1000000,1000000)||!integer(r.yMm,-1000000,1000000))
    result.push({code:'INVALID_POSITION',message:r.name+': posição fora do limite.',ids:[r.id]})
  for(let i=0;i<rooms.length;i++) for(let j=i+1;j<rooms.length;j++){
    const a=rooms[i],b=rooms[j]
    if(overlap(a.xMm,a.xMm+a.widthMm,b.xMm,b.xMm+b.widthMm)&&overlap(a.yMm,a.yMm+a.depthMm,b.yMm,b.yMm+b.depthMm))
      result.push({code:'ROOM_OVERLAP',message:a.name+' e '+b.name+': cômodos sobrepostos.',ids:[a.id,b.id]})
  }
  const edges=relacoes(rooms).map(r=>[r.wallA.replace(/-(south|north|east|west)$/,''),r.wallB.replace(/-(south|north|east|west)$/,'')])
  const seen=new Set(rooms.length?[rooms[0].id]:[])
  let changed=true
  while(changed){
    changed=false
    for(const [a,b] of edges) if(seen.has(a)!==seen.has(b)){seen.add(a);seen.add(b);changed=true}
  }
  for(const r of rooms) if(!seen.has(r.id))
    result.push({code:'DISCONNECTED_ROOM',message:r.name+': encoste uma parede no conjunto.',ids:[r.id]})
  return result
}
export function exportar(s:Session):string {
  const errors=problemas(s.present)
  if(errors.length) throw new Error(errors.map(e=>e.message).join(' '))
  return JSON.stringify({
    schemaVersion:'1.0.0',id:s.id,revision:s.revision,unit:'mm',geometry:'orthogonal-rectangles',
    ceilingHeightMm:s.present.ceilingHeightMm,provenance:declared(),references:[],
    rooms:s.present.rooms.map(r=>({...r,walls:paredes(r.id),provenance:declared()})),
    relations:relacoes(s.present.rooms),openings:[],
  },null,2)+'\n'
}
