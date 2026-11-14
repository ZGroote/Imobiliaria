/**
 * Vistas da Quinze: traça uma planta humanizada pela API real do construtor
 * (mesmo caminho do Meio do LIV, interiores/meio/construir-meio.ts), lendo os
 * pontos de <tipologia>/planta.json em vez de tê-los no código.
 * node experimentos/vistas-da-quinze-2026-11-07/interiores/construir.ts <tipologia>
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {deepStrictEqual} from 'node:assert'
import {execFileSync} from 'node:child_process'
import {iniciar,aplicar,documento,exportar,exportarMoveis,problemas,type Session} from '../../../painel/src/components/construtor-planta/modelo.ts'
import {exportarEditor,carregarEditorState} from '../../../painel/src/components/construtor-planta/editorDocument.ts'
import {CATALOGO_MOVEIS} from '../../../painel/src/components/construtor-planta/catalogoMoveis.ts'

type Rect=[number,number,number,number]
type Lado='north'|'south'|'east'|'west'
type Spec={id:string,titulo:string,imagem:string,imagemSha256:string,
  calibracao:{areaM2:number,contornoFacesPx:Rect[],conferencia:string[]},
  origemPx:[number,number],gradeMm:number,peDireitoMm:number,
  comodos:{nome:string,partes:Rect[]}[],
  aberturas:{comodo:string,parte?:number,lado:Lado,de:number,ate:number,tipo:'door'|'window',alturaMm:number,peitorilMm?:number}[],
  moveis:{catalogo:string,x:number,y:number,rot?:number,w?:number,d?:number,cor?:string,nome?:string,h?:number}[],
  ficha:Record<string,unknown>,cores:Record<string,string>,lote:Record<string,unknown>,limites:string[],
  base?:string,jardim?:unknown,comparacao?:unknown}

const tipologia=process.argv[2]
if(!tipologia)throw Error('Uso: node construir.ts <tipologia>')
const aqui=dirname(fileURLToPath(import.meta.url)),pasta=resolve(aqui,tipologia),raiz=resolve(aqui,'../../..')
const lerSpec=(nome:string):Spec=>JSON.parse(readFileSync(resolve(aqui,nome,'planta.json'),'utf8'))
// O térreo é o apartamento do tipo mais o jardim: herda o traçado da base e troca ficha e limites.
let spec=lerSpec(tipologia)
if(spec.base)spec={...lerSpec(spec.base),...spec}
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex')
const imagem=resolve(pasta,spec.imagem)
if(hash(readFileSync(imagem))!==spec.imagemSha256)throw Error('A imagem do caderno mudou; revisar planta.json antes de regenerar.')

// Escala uniforme: área das faces internas do contorno (px²) contra a área do book (m²).
const areaPx=spec.calibracao.contornoFacesPx.reduce((a,[x0,y0,x1,y1])=>a+(x1-x0)*(y1-y0),0)
const pxMm=Math.sqrt(spec.calibracao.areaM2*1e6/areaPx)
const [ox,oy]=spec.origemPx,grid=spec.gradeMm
const X=(p:number)=>Math.round((p-ox)*pxMm/grid)*grid
const Y=(p:number)=>Math.round((p-oy)*pxMm/grid)*grid
const quad=(r:Rect)=>({xMm:X(r[0]),yMm:Y(r[1]),widthMm:X(r[2])-X(r[0]),depthMm:Y(r[3])-Y(r[1])})

let s:Session=iniciar(spec.id)
const partes=new Map<string,string[]>()
for(const c of spec.comodos){
  const antes=new Set(s.present.rooms.map(r=>r.id))
  s=c.partes.length===1
    ?aplicar(s,{type:'add',name:c.nome,ceilingHeightMm:spec.peDireitoMm,...quad(c.partes[0])})
    :aplicar(s,{type:'add-poligono',name:c.nome,ceilingHeightMm:spec.peDireitoMm,retangulos:c.partes.map(quad)})
  partes.set(c.nome,s.present.rooms.filter(r=>!antes.has(r.id)).map(r=>r.id))
}
// No construtor, north é o lado de maior y (embaixo na imagem); não é orientação solar.
for(const a of spec.aberturas){
  const roomId=partes.get(a.comodo)?.[a.parte??0]
  if(!roomId)throw Error('Cômodo ou parte inexistente: '+a.comodo+' '+(a.parte??0))
  const room=s.present.rooms.find(r=>r.id===roomId)!
  const horizontal=a.lado==='north'||a.lado==='south'
  const along=horizontal?X:Y,start=horizontal?room.xMm:room.yMm
  s=aplicar(s,{type:'opening-add',kind:a.tipo,wallId:roomId+'-'+a.lado,
    offsetMm:along(a.de)-start,widthMm:along(a.ate)-along(a.de),heightMm:a.alturaMm,sillMm:a.peitorilMm??0})
}
for(const m of spec.moveis){
  const def=CATALOGO_MOVEIS.find(d=>d.id===m.catalogo)
  if(!def)throw Error('Catálogo não contém '+m.catalogo)
  s=aplicar(s,{type:'furniture-add',item:{tipoCatalogo:def.id,tipo3D:def.tipo3D,nome:m.nome??def.nome,
    xMm:X(m.x),yMm:Y(m.y),widthMm:m.w??def.widthMm,depthMm:m.d??def.depthMm,
    alturaMm:m.h??def.alturaMm,rotDegrees:m.rot??0,cor:m.cor??def.corPadrao}})
}

const erros=problemas(s.present)
if(erros.length)throw Error(JSON.stringify(erros,null,2))
const leitura=documento(s),companion=exportarEditor({0:s},0)
const restored=carregarEditorState(JSON.parse(companion),leitura)
if(exportarEditor(restored.sessions,restored.activeFloor)!==companion)throw Error('Round-trip do projeto divergiu.')
deepStrictEqual(documento(restored.sessions[0]),leitura,'Round-trip da leitura divergiu.')
deepStrictEqual(JSON.parse(exportarMoveis(restored.sessions[0])),JSON.parse(exportarMoveis(s)),'Round-trip dos móveis divergiu.')
writeFileSync(resolve(pasta,'leitura.json'),exportar(s),'utf8')
writeFileSync(resolve(pasta,'projeto-planta.json'),companion,'utf8')
writeFileSync(resolve(pasta,'moveis.json'),exportarMoveis(s),'utf8')
const contexto={schema:1,propertyId:spec.id,agencyId:'referencia-publica-local',andar:0,
  ficha:spec.ficha,cores:spec.cores,lote:spec.lote}
writeFileSync(resolve(pasta,'contexto.json'),JSON.stringify(contexto,null,2)+'\n','utf8')

const area=s.present.rooms.reduce((a,r)=>a+r.widthMm*r.depthMm/1e6,0)
const inputsSHA256=Object.fromEntries(['planta.json','leitura.json','projeto-planta.json','moveis.json','contexto.json']
  .map(n=>[n,hash(readFileSync(resolve(pasta,n)))]))
const referencia={titulo:spec.titulo,tipologia,imagem:spec.imagem,imagemSha256:spec.imagemSha256,
  registro:{origemPx:spec.origemPx,eixos:'x para direita; y para baixo na imagem',mmPorPixel:pxMm,gradeMm:grid,
    metodoEscala:'Área das faces internas do contorno contra a área do book; sem cotas.',
    contornoFacesPx:spec.calibracao.contornoFacesPx,areaCalibracaoM2:spec.calibracao.areaM2,
    conferencia:spec.calibracao.conferencia},
  areaContornoNominalAproximadaM2:Number(area.toFixed(4)),peDireitoMm:spec.peDireitoMm,limites:spec.limites,
  base:spec.base,jardim:spec.jardim,comparacao:spec.comparacao,
  captura:{construtorSHA256:hash(readFileSync(fileURLToPath(import.meta.url))),inputsSHA256},
  contagens:{partes:s.present.rooms.length,aberturas:s.present.openings.length,moveis:s.present.furniture?.length??0}}
writeFileSync(resolve(pasta,'referencia.json'),JSON.stringify(referencia,null,2)+'\n','utf8')
const conversao=JSON.parse(execFileSync('python',[resolve(aqui,'exportar.py'),tipologia],{cwd:raiz,encoding:'utf8'}).trim())
console.log(JSON.stringify({ok:true,tipologia,mmPorPixel:pxMm,areaNominalM2:area,...referencia.contagens,...conversao}))
