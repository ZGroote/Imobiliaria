import {carregar,documento,type FurnitureItem,type Leitura,type Session} from './modelo.ts'
import {CATALOGO_MOVEIS} from './catalogoMoveis.ts'

export type Floor=0|1
// A leitura normativa continua sendo arquitetura de um andar. O companion preserva
// o projeto editável completo, sem acrescentar móveis ao contrato M1-0/M1.1.
export type EditorState={schemaVersion:'1.0.0';activeFloor:Floor;floors:{floor:Floor;leitura:Leitura;furniture:FurnitureItem[]}[]}
export type EditorSessions={activeFloor:Floor;sessions:Record<number,Session>}
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v)
const keys=(value:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>k in value)
  &&Object.keys(value).every(k=>required.includes(k)||optional.includes(k))

function furnitureCopy(value:unknown):FurnitureItem[]{
  if(!Array.isArray(value)||value.length>200) throw new Error('Use até 200 móveis por andar.')
  const ids=new Set<string>()
  return value.map(item=>{
    if(!item||typeof item!=='object'||!keys(item,['id','tipoCatalogo','tipo3D','nome','xMm','yMm','widthMm','depthMm','rotDegrees'],['cor','alturaMm']))
      throw new Error('O móvel contém campos não suportados; nenhum dado foi descartado.')
    const f=item as FurnitureItem,def=CATALOGO_MOVEIS.find(d=>d.id===f.tipoCatalogo)
    const integer=(n:number,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max
    if(!/^m[1-9][0-9]*$/.test(f.id)||!Number.isSafeInteger(Number(f.id.slice(1)))||Number(f.id.slice(1))>=Number.MAX_SAFE_INTEGER
      ||ids.has(f.id)||!def||def.tipo3D!==f.tipo3D||typeof f.nome!=='string'||!f.nome.trim()||Array.from(f.nome).length>100
      ||!integer(f.xMm,-1000000,1000000)||!integer(f.yMm,-1000000,1000000)
      ||!integer(f.widthMm,1,10000)||!integer(f.depthMm,1,10000)||![0,90,180,270].includes(f.rotDegrees)
      ||(f.alturaMm!==undefined&&!integer(f.alturaMm,1,10000))||(f.cor!==undefined&&!/^#[0-9a-f]{6}$/i.test(f.cor)))
      throw new Error('O móvel tem identidade, tipo ou medidas inválidas.')
    ids.add(f.id)
    return {...f}
  })
}

export function documentoEditor(sessions:Record<number,Session>,activeFloor:Floor):EditorState{
  const floors:EditorState['floors']=[]
  for(const key of Object.keys(sessions)){
    if(key!=='0'&&key!=='1') throw new Error('O projeto contém um pavimento não suportado.')
    const floor=Number(key) as Floor,s=sessions[floor]
    if(!s.present.rooms.length&&!s.present.openings.length&&!s.present.furniture?.length) continue
    try{floors.push({floor,leitura:documento(s),furniture:furnitureCopy(s.present.furniture??[])})}
    catch(e){throw new Error(`${floor===0?'Térreo':'Superior'}: ${(e as Error).message}`)}
  }
  if(!floors.some(f=>f.floor===0)) throw new Error('Complete a planta do térreo antes de salvar o projeto.')
  if(!floors.some(f=>f.floor===activeFloor)) throw new Error('O andar ativo está vazio. Selecione um andar com planta.')
  return {schemaVersion:'1.0.0',activeFloor,floors:floors.sort((a,b)=>a.floor-b.floor)}
}
export const exportarEditor=(sessions:Record<number,Session>,activeFloor:Floor)=>JSON.stringify(JSON.parse(canonical(documentoEditor(sessions,activeFloor))),null,2)+'\n'

export function carregarEditorState(value:unknown,leitura?:Leitura):EditorSessions{
  if(!value||typeof value!=='object'||!keys(value as Record<string,unknown>,['schemaVersion','activeFloor','floors']))
    throw new Error('Formato de projeto não suportado; nenhum dado foi descartado.')
  const project=value as EditorState
  if(project.schemaVersion!=='1.0.0'||![0,1].includes(project.activeFloor)||!Array.isArray(project.floors)||!project.floors.length||project.floors.length>2)
    throw new Error('Versão ou pavimentos do projeto não suportados.')
  const sessions:Record<number,Session>={}
  for(const f of project.floors){
    if(!f||typeof f!=='object'||!keys(f,['floor','leitura','furniture'])||![0,1].includes(f.floor)||sessions[f.floor])
      throw new Error('O projeto contém pavimentos duplicados ou não suportados.')
    const s=carregar(f.leitura),furniture=furnitureCopy(f.furniture)
    sessions[f.floor]={...s,nextFurnitureId:Math.max(0,...furniture.map(m=>Number(m.id.slice(1))))+1,
      present:{...s.present,furniture}}
  }
  const restored=documentoEditor(sessions,project.activeFloor)
  if(canonical(restored)!==canonical(project)) throw new Error('O projeto contém conteúdo não suportado; nenhum dado foi descartado.')
  if(leitura&&canonical(documento(sessions[project.activeFloor]))!==canonical(leitura))
    throw new Error('A leitura salva não corresponde ao andar ativo do projeto.')
  return {activeFloor:project.activeFloor,sessions}
}

export function carregarSnapshot(leitura:Leitura,editorState?:EditorState):EditorSessions{
  return editorState===undefined?{activeFloor:0,sessions:{0:carregar(leitura)}}:carregarEditorState(editorState,leitura)
}
