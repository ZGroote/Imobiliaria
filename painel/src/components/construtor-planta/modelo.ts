// Feedback local e edição. O gate normativo continua sendo pipeline.validar_leitura.
export type Room = {id:string; name:string; xMm:number; yMm:number; widthMm:number; depthMm:number}
export type OpeningInput = {kind:'door'|'window';wallId:string;offsetMm:number;widthMm:number;heightMm:number;sillMm:number}
export type Opening = OpeningInput & {id:string;pairedWallId?:string}
export type Layout = {rooms:Room[]; openings:Opening[]; ceilingHeightMm:number|null; mergedGroups?:string[][]}
export type Session = {id:string; revision:number; nextId:number; nextOpeningId:number; present:Layout; past:Layout[]; future:Layout[]}
type Measures = {name:string; widthMm:number; depthMm:number; ceilingHeightMm:number}
// `add` sem posição mantém o comportamento antigo (à direita do conjunto); com posição, é o
// cômodo solto na planta (M1.1-B), em mm inteiro como qualquer gesto.
// M1.1-C2: `merge` une dois cômodos encostados em um só; `unmerge` desfaz a união.
export type Action = ({type:'add'; xMm?:number; yMm?:number} & Measures) | ({type:'edit'; id:string} & Measures)
  | {type:'move'; id:string; xMm:number; yMm:number} | {type:'delete'; id:string}
  | ({type:'opening-add'} & OpeningInput) | ({type:'opening-edit';id:string} & OpeningInput)
  | {type:'opening-delete';id:string}
  | {type:'merge'; roomAId:string; roomBId:string} | {type:'unmerge'; roomId:string}
export type Problem = {code:string; message:string; ids:string[]}
const declared = () => ({kind:'declared' as const, referenceIds:[] as string[]})
const integer = (n:number, min:number, max:number) => Number.isSafeInteger(n) && n>=min && n<=max

export function normalizeGroups(groups?: string[][]): string[][] {
  if (!groups) return []
  return groups
    .map(g => Array.from(new Set(g)).sort())
    .filter(g => g.length >= 2)
    .sort((a, b) => a[0].localeCompare(b[0]))
}
export function mesmoGrupoMesclado(groups: string[][] | undefined, roomAId: string, roomBId: string): boolean {
  if (!groups || roomAId === roomBId) return false
  return groups.some(g => g.includes(roomAId) && g.includes(roomBId))
}
export function grupoDoComodo(groups: string[][] | undefined, roomId: string): string[] {
  if (!groups) return []
  const g = groups.find(group => group.includes(roomId))
  return g ? g.filter(id => id !== roomId) : []
}

export function metrosParaMm(text:string,allowZero=false):number {
  const match=/^(\d+)(?:[.,](\d{1,3}))?$/.exec(text.trim())
  if(!match) throw new Error('Use metros com até três casas decimais, como 4,20.')
  const n=Number(match[1])*1000+Number((match[2]??'').padEnd(3,'0'))
  if(!integer(n,allowZero?0:1,1000000)) throw new Error(allowZero?'Use de zero a 1.000 m.':'A medida deve ser maior que zero e até 1.000 m.')
  return n
}
export const metros = (mm:number) => {
  const whole=Math.trunc(Math.abs(mm)/1000), rest=String(Math.abs(mm%1000)).padStart(3,'0').replace(/0+$/,'')
  return (mm<0?'-':'')+(rest ? whole+','+rest : String(whole))
}
export const iniciar = (id:string):Session => ({
  id, revision:1, nextId:1, nextOpeningId:1, present:{rooms:[],openings:[],ceilingHeightMm:null}, past:[], future:[],
})
export function aplicar(s:Session,a:Action):Session {
  if(a.type==='merge'){
    const {roomAId,roomBId}=a
    if(roomAId===roomBId) throw new Error('Selecione dois cômodos diferentes para mesclar.')
    const roomA=s.present.rooms.find(r=>r.id===roomAId), roomB=s.present.rooms.find(r=>r.id===roomBId)
    if(!roomA||!roomB) throw new Error('Selecione cômodos existentes.')
    const rels=relacoes(s.present.rooms, s.present.mergedGroups)
    const pA=new Set(Object.values(paredes(roomAId))), pB=new Set(Object.values(paredes(roomBId)))
    const contato=rels.filter(r=>(pA.has(r.wallA)&&pB.has(r.wallB))||(pA.has(r.wallB)&&pB.has(r.wallA)))
    if(!contato.length) throw new Error('Os cômodos precisam estar encostados parede com parede para mesclar.')

    const paredesContato=new Set(contato.flatMap(c=>[c.wallA,c.wallB]))
    const aberturaNaDivisoria=s.present.openings.find(o=>paredesContato.has(o.wallId)||(o.pairedWallId&&paredesContato.has(o.pairedWallId)))
    if(aberturaNaDivisoria) throw new Error('Remova as portas e janelas da parede divisória antes de mesclar.')

    const curGroups=s.present.mergedGroups?s.present.mergedGroups.map(g=>[...g]):[]
    const gAIdx=curGroups.findIndex(g=>g.includes(roomAId)), gBIdx=curGroups.findIndex(g=>g.includes(roomBId))
    let nextGroups:string[][]
    if(gAIdx>=0&&gBIdx>=0){
      if(gAIdx===gBIdx) throw new Error('Os cômodos já estão mesclados.')
      const merged=Array.from(new Set([...curGroups[gAIdx],...curGroups[gBIdx]]))
      nextGroups=curGroups.filter((_,idx)=>idx!==gAIdx&&idx!==gBIdx).concat([merged])
    }else if(gAIdx>=0){
      curGroups[gAIdx].push(roomBId)
      nextGroups=curGroups
    }else if(gBIdx>=0){
      curGroups[gBIdx].push(roomAId)
      nextGroups=curGroups
    }else{
      curGroups.push([roomAId,roomBId])
      nextGroups=curGroups
    }
    const targetName=roomA.name.trim()
    const members=new Set(nextGroups.find(g=>g.includes(roomAId))!)
    const updatedRooms=s.present.rooms.map(r=>members.has(r.id)?{...r,name:targetName}:r)
    const normalized=normalizeGroups(nextGroups)
    const nextLayout:Layout={...s.present,rooms:updatedRooms,mergedGroups:normalized.length?normalized:undefined}
    const shapeErrors=problemas(nextLayout).filter(p=>p.code==='MERGED_SHAPE')
    if(shapeErrors.length) throw new Error('A união desses cômodos geraria um formato inválido (com buraco ou vértice isolado).')
    return confirmar(s,nextLayout,s.nextId,s.nextOpeningId)
  }
  if(a.type==='unmerge'){
    const {roomId}=a
    const curGroups=s.present.mergedGroups?s.present.mergedGroups.map(g=>[...g]):[]
    const gIdx=curGroups.findIndex(g=>g.includes(roomId))
    if(gIdx<0) throw new Error('O cômodo não está mesclado.')
    curGroups[gIdx]=curGroups[gIdx].filter(id=>id!==roomId)
    const normalized=normalizeGroups(curGroups)
    return confirmar(s,{...s.present,mergedGroups:normalized.length?normalized:undefined},s.nextId,s.nextOpeningId)
  }
  if(a.type==='opening-add'||a.type==='opening-edit'||a.type==='opening-delete'){
    let openings=s.present.openings
    if(a.type!=='opening-add'&&!openings.some(o=>o.id===a.id)) throw new Error('Selecione uma abertura existente.')
    if(a.type==='opening-delete') openings=openings.filter(o=>o.id!==a.id)
    else{
      if(a.type==='opening-add'&&openings.length>=400) throw new Error('O limite é de 400 aberturas.')
      const opening:Opening={id:a.type==='opening-add'?'a'+s.nextOpeningId:a.id,
        kind:a.kind,wallId:a.wallId,offsetMm:a.offsetMm,widthMm:a.widthMm,heightMm:a.heightMm,sillMm:a.sillMm}
      const paired=parDaAbertura(s.present.rooms,opening,s.present.mergedGroups)
      if(paired.error) throw new Error(paired.error)
      if(paired.id) opening.pairedWallId=paired.id
      openings=a.type==='opening-add'?[...openings,opening]:openings.map(o=>o.id===a.id?opening:o)
      const errors=problemasAberturas({...s.present,openings}).filter(e=>e.ids.includes(opening.id))
      if(errors.length) throw new Error(errors.map(e=>e.message).join(' '))
    }
    return confirmar(s,{...s.present,openings},s.nextId,s.nextOpeningId+(a.type==='opening-add'?1:0))
  }
  let rooms=s.present.rooms, ceilingHeightMm=s.present.ceilingHeightMm
  let mergedGroups=s.present.mergedGroups
  if(a.type==='add'||a.type==='edit'){
    if(!a.name.trim() || a.name.trim().length>100) throw new Error('Informe um nome com até 100 caracteres.')
    if(![a.widthMm,a.depthMm,a.ceilingHeightMm].every(n=>integer(n,1,1000000)))
      throw new Error('Declare largura, profundidade e pé-direito válidos.')
    ceilingHeightMm=a.ceilingHeightMm
  }
  if(a.type==='add'){
    if(rooms.length>=100) throw new Error('O limite desta planta é de 100 cômodos.')
    const solto=a.xMm!==undefined||a.yMm!==undefined
    if(solto&&!(Number.isSafeInteger(a.xMm)&&Number.isSafeInteger(a.yMm)))
      throw new Error('A posição precisa usar milímetros inteiros.')
    const xMm=solto?a.xMm!:rooms.length ? Math.max(...rooms.map(r=>r.xMm+r.widthMm))+500 : 0
    rooms=[...rooms,{id:'c'+s.nextId,name:a.name.trim(),widthMm:a.widthMm,depthMm:a.depthMm,xMm,yMm:solto?a.yMm!:0}]
  }else{
    if(!rooms.some(r=>r.id===a.id)) throw new Error('Selecione um cômodo existente.')
    if(a.type==='delete'){
      rooms=rooms.filter(r=>r.id!==a.id)
      if(mergedGroups){
        const nextGroups=mergedGroups.map(g=>g.filter(id=>id!==a.id))
        const normalized=normalizeGroups(nextGroups)
        mergedGroups=normalized.length?normalized:undefined
      }
    }
    if(a.type==='edit'){
      const g=grupoDoComodo(mergedGroups,a.id)
      const targetIds=new Set([a.id,...g])
      rooms=rooms.map(r=>{
        if(r.id===a.id) return {...r,name:a.name.trim(),widthMm:a.widthMm,depthMm:a.depthMm}
        if(targetIds.has(r.id)) return {...r,name:a.name.trim()}
        return r
      })
    }
    if(a.type==='move'){
      if(!Number.isSafeInteger(a.xMm)||!Number.isSafeInteger(a.yMm)) throw new Error('A posição precisa usar milímetros inteiros.')
      rooms=rooms.map(r=>r.id===a.id?{...r,xMm:a.xMm,yMm:a.yMm}:r)
    }
  }
  // Excluir dono remove suas aberturas na mesma ação; undo restaura tudo. As demais
  // acompanham a geometria nova (reparear).
  const proprias=a.type==='delete'?s.present.openings.filter(o=>!Object.values(paredes(a.id)).includes(o.wallId)):s.present.openings
  return confirmar(s,{rooms,openings:reparear(rooms,proprias,mergedGroups),ceilingHeightMm,mergedGroups},s.nextId+(a.type==='add'?1:0),s.nextOpeningId)
}
function confirmar(s:Session,present:Layout,nextId:number,nextOpeningId:number):Session{
  if(JSON.stringify(present)===JSON.stringify(s.present)) return s
  return {...s,present,revision:s.revision+1,nextId,nextOpeningId,past:[...s.past,s.present],future:[]}
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
export type Wall = {id:string;roomId:string;label:string;axis:'x'|'y';fixed:number;start:number;end:number}
export function geometriaParedes(rooms:Room[]):Wall[]{
  return rooms.flatMap(r=>[
    {id:r.id+'-south',roomId:r.id,label:r.name+' — Sul',axis:'x' as const,fixed:r.yMm,start:r.xMm,end:r.xMm+r.widthMm},
    {id:r.id+'-north',roomId:r.id,label:r.name+' — Norte',axis:'x' as const,fixed:r.yMm+r.depthMm,start:r.xMm,end:r.xMm+r.widthMm},
    {id:r.id+'-west',roomId:r.id,label:r.name+' — Oeste',axis:'y' as const,fixed:r.xMm,start:r.yMm,end:r.yMm+r.depthMm},
    {id:r.id+'-east',roomId:r.id,label:r.name+' — Leste',axis:'y' as const,fixed:r.xMm+r.widthMm,start:r.yMm,end:r.yMm+r.depthMm},
  ])
}

// A parede mais próxima de um ponto (mm), até `tolerancia`; `t` é a posição ao longo dela desde
// o início. Em parede compartilhada vence a do cômodo onde o ponto está; empate, ordem de ID.
export function paredeProxima(rooms:Room[],xMm:number,yMm:number,tolerancia:number):{wall:Wall;t:number}|null{
  let melhor:{wall:Wall;t:number;d:number;dentro:boolean}|null=null
  for(const w of geometriaParedes(rooms)){
    const [u,v]=w.axis==='x'?[xMm,yMm]:[yMm,xMm]
    const t=Math.min(Math.max(u,w.start),w.end),d=Math.hypot(u-t,v-w.fixed)
    if(d>tolerancia) continue
    const r=rooms.find(r=>r.id===w.roomId)!
    const dentro=xMm>=r.xMm&&xMm<=r.xMm+r.widthMm&&yMm>=r.yMm&&yMm<=r.yMm+r.depthMm
    const empate=melhor&&Math.abs(d-melhor.d)<=1e-9
    if(!melhor||d<melhor.d-1e-9||(empate&&(dentro!==melhor.dentro?dentro:w.id<melhor.wall.id)))
      melhor={wall:w,t:t-w.start,d,dentro}
  }
  return melhor&&{wall:melhor.wall,t:melhor.t}
}
// Distância desde o início da parede que centraliza a abertura em `t`: a 1 cm, dentro da parede.
export function distanciaSugerida(wall:Wall,t:number,widthMm:number){
  return Math.min(Math.max(0,wall.end-wall.start-widthMm),Math.max(0,Math.round((t-widthMm/2)/10)*10))
}
// Mesma origem nominal de M1-0: coordenada crescente nas quatro paredes.
export function parDaAbertura(rooms:Room[],o:OpeningInput,mergedGroups?:string[][]):{id?:string;error?:string}{
  const walls=geometriaParedes(rooms), w=walls.find(w=>w.id===o.wallId)
  if(!w) return {error:'Selecione uma parede existente.'}
  const lo=w.start+o.offsetMm,hi=lo+o.widthMm
  const rels=relacoes(rooms,mergedGroups)
  const touched=rels.filter(r=>r.wallA===w.id||r.wallB===w.id).map(r=>{
    const other=walls.find(p=>p.id===(r.wallA===w.id?r.wallB:r.wallA))!
    return {id:other.id,start:Math.max(w.start,other.start),end:Math.min(w.end,other.end),kind:r.kind}
  }).filter(p=>overlap(lo,hi,p.start,p.end))
  if(!touched.length) return {}
  if(touched.some(p=>p.kind==='merged')) return {error:'A abertura está em um trecho mesclado (sem parede interna).'}
  if(touched.length===1&&touched[0].start<=lo&&hi<=touched[0].end) return {id:touched[0].id}
  return {error:'A abertura cruza o limite de um trecho compartilhado. Ajuste posição ou largura.'}
}
// O par é da geometria, não da abertura. Quando um cômodo encosta, se afasta ou some, a
// abertura acompanha: a que passa a ficar entre dois cômodos é comum aos dois, a que deixa de
// ficar dá para fora (decisão do usuário em 01/10/2026, revendo a regra do M1-C). Medidas e
// posição não mudam. Abertura que cruza o limite entre trecho interno e externo não tem par
// possível: fica como está e continua apontada em problemasAberturas.
function reparear(rooms:Room[],openings:Opening[],mergedGroups?:string[][]):Opening[]{
  return openings.map(o=>{
    const par=parDaAbertura(rooms,o,mergedGroups)
    if(par.error) return o
    const {pairedWallId:_,...resto}=o
    return par.id?{...resto,pairedWallId:par.id}:resto
  })
}
export function problemasAberturas(layout:Layout):Problem[]{
  const errors:Problem[]=[],walls=geometriaParedes(layout.rooms)
  const physical:{o:Opening;w:Wall;lo:number;hi:number}[]=[]
  for(const o of layout.openings){
    const messages:string[]=[],w=walls.find(w=>w.id===o.wallId)
    if(!w){errors.push({code:'INVALID_OPENING',message:o.id+': parede inexistente.',ids:[o.id]});continue}
    if(![o.offsetMm,o.sillMm].every(n=>integer(n,0,1000000))||![o.widthMm,o.heightMm].every(n=>integer(n,1,1000000)))
      messages.push('Informe medidas inteiras válidas em milímetros.')
    if(o.offsetMm+o.widthMm>w.end-w.start) messages.push('A abertura ultrapassa o comprimento da parede.')
    if(layout.ceilingHeightMm===null||o.sillMm+o.heightMm>layout.ceilingHeightMm) messages.push('A abertura ultrapassa o pé-direito.')
    if(o.kind==='door'&&o.sillMm!==0) messages.push('Porta precisa ter peitoril zero.')
    if(o.kind!=='door'&&o.kind!=='window') messages.push('Selecione Porta ou Janela.')
    const paired=parDaAbertura(layout.rooms,o,layout.mergedGroups)
    if(paired.error) messages.push(paired.error)
    else if(paired.id!==o.pairedWallId) messages.push('O par da parede mudou ou é inválido; revise e aplique a abertura.')
    if(messages.length){errors.push({code:'INVALID_OPENING',message:o.id+': '+messages.join(' '),ids:[o.id,w.roomId]});continue}
    const lo=w.start+o.offsetMm,hi=lo+o.widthMm
    for(const other of physical) if(w.axis===other.w.axis&&w.fixed===other.w.fixed
      &&overlap(lo,hi,other.lo,other.hi)&&overlap(o.sillMm,o.sillMm+o.heightMm,other.o.sillMm,other.o.sillMm+other.o.heightMm))
      errors.push({code:'OPENING_OVERLAP',message:o.id+' e '+other.o.id+': aberturas sobrepostas.',ids:[o.id,other.o.id,w.roomId,other.w.roomId]})
    physical.push({o,w,lo,hi})
  }
  return errors
}
export function relacoes(rooms:Room[],mergedGroups?:string[][]){
  const result:{id:string; kind:'adjacent'|'merged'; wallA:string; wallB:string; provenance:ReturnType<typeof declared>}[]=[]
  const push=(a:string,b:string,rA:string,rB:string)=>{
    const [wallA,wallB]=[a,b].sort()
    const isMerged=mesmoGrupoMesclado(mergedGroups,rA,rB)
    result.push({id:'rel-'+wallA+'--'+wallB,kind:isMerged?'merged':'adjacent',wallA,wallB,provenance:declared()})
  }
  for(let i=0;i<rooms.length;i++) for(let j=i+1;j<rooms.length;j++){
    const a=rooms[i],b=rooms[j]
    if(overlap(a.yMm,a.yMm+a.depthMm,b.yMm,b.yMm+b.depthMm)){
      if(a.xMm+a.widthMm===b.xMm) push(a.id+'-east',b.id+'-west',a.id,b.id)
      if(b.xMm+b.widthMm===a.xMm) push(b.id+'-east',a.id+'-west',b.id,a.id)
    }
    if(overlap(a.xMm,a.xMm+a.widthMm,b.xMm,b.xMm+b.widthMm)){
      if(a.yMm+a.depthMm===b.yMm) push(a.id+'-north',b.id+'-south',a.id,b.id)
      if(b.yMm+b.depthMm===a.yMm) push(b.id+'-north',a.id+'-south',b.id,a.id)
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

export function contorno(retangulos: [number, number, number, number][]): [number, number][] | null {
  const xs = Array.from(new Set(retangulos.flatMap(r => [r[0], r[2]]))).sort((a, b) => a - b)
  const ys = Array.from(new Set(retangulos.flatMap(r => [r[1], r[3]]))).sort((a, b) => a - b)
  const cheio = new Set<string>()
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      if (retangulos.some(r => r[0] <= xs[i] && xs[i + 1] <= r[2] && r[1] <= ys[j] && ys[j + 1] <= r[3])) {
        cheio.add(`${i},${j}`)
      }
    }
  }
  const seguinte = new Map<string, [number, number]>()
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      if (!cheio.has(`${i},${j}`)) continue
      const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1]
      const vizinhas: [[number, number], [number, number], [number, number]][] = [
        [[i, j - 1], [x0, y0], [x1, y0]],
        [[i + 1, j], [x1, y0], [x1, y1]],
        [[i, j + 1], [x1, y1], [x0, y1]],
        [[i - 1, j], [x0, y1], [x0, y0]],
      ]
      for (const [viz, a, b] of vizinhas) {
        if (!cheio.has(`${viz[0]},${viz[1]}`)) {
          seguinte.set(`${a[0]},${a[1]}`, b)
        }
      }
    }
  }
  if (!seguinte.size) return null
  const pontos = Array.from(seguinte.keys()).map(k => k.split(',').map(Number) as [number, number])
  pontos.sort((a, b) => a[1] !== b[1] ? a[1] - b[1] : a[0] - b[0])
  const inicio = pontos[0]
  const laco: [number, number][] = [inicio]
  let proximo = seguinte.get(`${inicio[0]},${inicio[1]}`)
  while (proximo && (proximo[0] !== inicio[0] || proximo[1] !== inicio[1]) && laco.length < seguinte.size) {
    laco.push(proximo)
    proximo = seguinte.get(`${proximo[0]},${proximo[1]}`)
  }
  if (!proximo || proximo[0] !== inicio[0] || proximo[1] !== inicio[1] || laco.length !== seguinte.size) {
    return null
  }
  const n = laco.length
  return laco.filter((pt, k) => {
    const prev = laco[(k - 1 + n) % n]
    const next = laco[(k + 1) % n]
    return !(
      (prev[0] === pt[0] && pt[0] === next[0]) ||
      (prev[1] === pt[1] && pt[1] === next[1])
    )
  })
}

export function problemas(layout:Layout):Problem[]{
  const {rooms,ceilingHeightMm,mergedGroups}=layout, result:Problem[]=[]
  if(!rooms.length) result.push({code:'EMPTY',message:'Adicione o primeiro cômodo.',ids:[]})
  if(ceilingHeightMm===null) result.push({code:'HEIGHT_REQUIRED',message:'Declare o pé-direito da planta.',ids:[]})
  for(const r of rooms) if(!integer(r.xMm,-1000000,1000000)||!integer(r.yMm,-1000000,1000000))
    result.push({code:'INVALID_POSITION',message:r.name+': posição fora do limite.',ids:[r.id]})
  for(let i=0;i<rooms.length;i++) for(let j=i+1;j<rooms.length;j++){
    const a=rooms[i],b=rooms[j]
    if(overlap(a.xMm,a.xMm+a.widthMm,b.xMm,b.xMm+b.widthMm)&&overlap(a.yMm,a.yMm+a.depthMm,b.yMm,b.yMm+b.depthMm))
      result.push({code:'ROOM_OVERLAP',message:a.name+' e '+b.name+': cômodos sobrepostos.',ids:[a.id,b.id]})
  }
  const rels = relacoes(rooms, mergedGroups)
  const edges=rels.map(r=>[r.wallA.replace(/-(south|north|east|west)$/,''),r.wallB.replace(/-(south|north|east|west)$/,'')])
  const seen=new Set(rooms.length?[rooms[0].id]:[])
  let changed=true
  while(changed){
    changed=false
    for(const [a,b] of edges) if(seen.has(a)!==seen.has(b)){seen.add(a);seen.add(b);changed=true}
  }
  for(const r of rooms) if(!seen.has(r.id))
    result.push({code:'DISCONNECTED_ROOM',message:r.name+': encoste uma parede no conjunto.',ids:[r.id]})

  if(mergedGroups && mergedGroups.length){
    for(const g of mergedGroups){
      const gRooms = g.map(id => rooms.find(r => r.id === id)).filter(Boolean) as Room[]
      if(gRooms.length < 2) continue
      const nome0 = gRooms[0].name.trim()
      for(const r of gRooms){
        if(r.name.trim() !== nome0)
          result.push({code:'MERGED_NAME_MISMATCH',message:r.name+': partes do mesmo cômodo devem ter o mesmo nome.',ids:[r.id]})
      }
      const rects: [number, number, number, number][] = gRooms.map(r => [r.xMm, r.yMm, r.xMm + r.widthMm, r.yMm + r.depthMm])
      if(contorno(rects) === null){
        result.push({code:'MERGED_SHAPE',message:gRooms[0].name+': formato de cômodo mesclado inválido.',ids:gRooms.map(r=>r.id)})
      }
    }
  }

  return [...result,...problemasAberturas(layout)]
}
export function documento(s:Session) {
  const errors=problemas(s.present)
  if(errors.length) throw new Error(errors.map(e=>e.message).join(' '))
  const rels = relacoes(s.present.rooms, s.present.mergedGroups)
  const hasMerged = rels.some(r => r.kind === 'merged')
  return {
    schemaVersion: hasMerged ? ('1.1.0' as const) : ('1.0.0' as const),
    id:s.id,revision:s.revision,unit:'mm' as const,geometry:'orthogonal-rectangles' as const,
    ceilingHeightMm:s.present.ceilingHeightMm,provenance:declared(),references:[],
    rooms:s.present.rooms.map(r=>({...r,walls:paredes(r.id),provenance:declared()})),
    relations:rels,openings:s.present.openings.map(o=>({...o,provenance:declared()})),
  }
}
export type Leitura=ReturnType<typeof documento>
export const exportar=(s:Session)=>JSON.stringify(documento(s),null,2)+'\n'
const sorted=(v:unknown):unknown=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'
  ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,sorted(x)])):v
// Recebe somente snapshot já validado no servidor; round-trip impede perda silenciosa
// de campos M1-0 que esta UI ainda não edita (referências, IDs de paredes externos etc.).
export function carregar(leitura:Leitura | any):Session{
  try{
    if(leitura.schemaVersion!=='1.0.0' && leitura.schemaVersion!=='1.1.0') throw new Error()
    const rooms=leitura.rooms.map((r:any)=>({id:r.id,name:r.name,xMm:r.xMm,yMm:r.yMm,widthMm:r.widthMm,depthMm:r.depthMm}))
    const openings=leitura.openings.map(({provenance,...o}:any)=>({...o}))
    if(rooms.some((r:any)=>!/^c[1-9][0-9]*$/.test(r.id))||openings.some((o:any)=>!/^a[1-9][0-9]*$/.test(o.id))) throw new Error()

    let mergedGroups: string[][] | undefined
    if (leitura.schemaVersion === '1.1.0' && Array.isArray(leitura.relations)) {
      const mergedPairs: [string, string][] = []
      for (const rel of leitura.relations) {
        if (rel.kind === 'merged') {
          const roomA = rel.wallA.replace(/-(south|north|east|west)$/, '')
          const roomB = rel.wallB.replace(/-(south|north|east|west)$/, '')
          mergedPairs.push([roomA, roomB])
        }
      }
      if (mergedPairs.length) {
        const groups: Set<string>[] = []
        for (const [a, b] of mergedPairs) {
          const found = groups.filter(g => g.has(a) || g.has(b))
          if (found.length === 0) {
            groups.push(new Set([a, b]))
          } else if (found.length === 1) {
            found[0].add(a)
            found[0].add(b)
          } else {
            const union = new Set([a, b])
            for (const f of found) {
              for (const item of f) union.add(item)
              groups.splice(groups.indexOf(f), 1)
            }
            groups.push(union)
          }
        }
        mergedGroups = groups.map(g => Array.from(g).sort())
      }
    }

    const normalized = normalizeGroups(mergedGroups)
    const s:Session={...iniciar(leitura.id),revision:leitura.revision,
      nextId:Math.max(0,...rooms.map((r:any)=>Number(r.id.slice(1))))+1,
      nextOpeningId:Math.max(0,...openings.map((o:any)=>Number(o.id.slice(1))))+1,
      present:{rooms,openings,ceilingHeightMm:leitura.ceilingHeightMm,mergedGroups:normalized.length?normalized:undefined}}
    if(JSON.stringify(sorted(documento(s)))!==JSON.stringify(sorted(leitura))) throw new Error()
    return s
  }catch{throw new Error('Esta leitura contém conteúdo não suportado pelo editor; nenhum dado foi descartado.')}
}