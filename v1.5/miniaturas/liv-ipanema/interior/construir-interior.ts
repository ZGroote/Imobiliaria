/**
 * LIV Ipanema: captura da planta pública através das APIs reais do construtor.
 * Não escreve Firestore e não fabrica o contrato nominal/companion à mão.
 * Executar com Node >=24: node construir-interior.ts
 */
import {writeFileSync, readFileSync, mkdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve, dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {deepStrictEqual} from 'node:assert'
import {iniciar, aplicar, documento, exportar, exportarMoveis, problemas, type Session} from '../../../../painel/src/components/construtor-planta/modelo.ts'
import {exportarEditor, carregarEditorState} from '../../../../painel/src/components/construtor-planta/editorDocument.ts'
import {CATALOGO_MOVEIS} from '../../../../painel/src/components/construtor-planta/catalogoMoveis.ts'

const pasta=dirname(fileURLToPath(import.meta.url))
mkdirSync(pasta,{recursive:true})
const fonte=resolve(pasta,'../referencias/planta-47-59.jpg')
const pxMm=11 // escala uniforme aproximada; a publicidade não fornece cotas
const grid=50
const X=(pixel:number)=>Math.round((pixel-105)*pxMm/grid)*grid
const Y=(pixel:number)=>Math.round((pixel-225)*pxMm/grid)*grid
const pd=2700 // inferido; não é medida divulgada pela incorporadora
let s:Session=iniciar('liv-ipanema-planta-47-59-referencia')
const quad=(x0:number,y0:number,x1:number,y1:number)=>({xMm:X(x0),yMm:Y(y0),widthMm:X(x1)-X(x0),depthMm:Y(y1)-Y(y0)})
const add=(name:string,rect:[number,number,number,number])=>{
  const id='c'+s.nextId
  s=aplicar(s,{type:'add',name,ceilingHeightMm:pd,...quad(...rect)})
  return id
}
const suite=add('Suíte',[105,250,349,576])
const dormit=add('Dormitório 01',[349,250,590,484])
const banhoSuite=add('Banho suíte',[187,576,308,795])
const banho=add('Banho',[308,576,429,795])
const socialFirst='c'+s.nextId
s=aplicar(s,{type:'add-poligono',name:'Sala integrada',ceilingHeightMm:pd,retangulos:[
  quad(349,484,590,576), // circulação e conexão à sala
  quad(590,362,780,576), // jantar
  quad(780,362,876,717), // bancada/cozinha aberta
  quad(429,576,780,717), // TV e entrada
  quad(429,717,650,795), // extensão da sala TV
]})
const socialA=socialFirst, socialB='c6', socialC='c7', socialD='c8'
const varanda=add('Varanda / serviço',[590,225,876,362])

function opening(roomId:string,side:'north'|'south'|'east'|'west',lo:number,hi:number,kind:'door'|'window',heightMm:number,sillMm=0){
  const room=s.present.rooms.find(r=>r.id===roomId)!
  const along=(side==='north'||side==='south')?X:Y
  const start=(side==='north'||side==='south')?room.xMm:room.yMm
  s=aplicar(s,{type:'opening-add',kind,wallId:roomId+'-'+side,
    offsetMm:along(lo)-start,widthMm:along(hi)-along(lo),heightMm,sillMm})
}
opening(suite,'east',494,564,'door',2100) // suíte → circulação
opening(dormit,'north',363,433,'door',2100)
opening(banhoSuite,'south',204,267,'door',2100)
opening(banho,'south',349,414,'door',2100)
opening(socialD,'north',680,755,'door',2100) // entrada do apartamento
opening(varanda,'north',637,775,'door',2200) // sala → varanda/serviço
opening(suite,'west',365,465,'window',1200,1000)
opening(dormit,'south',398,502,'window',1200,1000)
opening(banhoSuite,'west',724,768,'window',700,1500)
opening(varanda,'south',600,797,'window',1150,1050)

// O catálogo do editor conserva os modelos e dimensões da mesma mobília do renderer.
// Pontos são centros e giros em quartos de volta, como no construtor.
function furniture(catalogId:string,cx:number,cy:number,rotDegrees=0,widthMm?:number,depthMm?:number,cor?:string,nome?:string){
  const def=CATALOGO_MOVEIS.find(d=>d.id===catalogId)
  if(!def) throw new Error('Catálogo não contém '+catalogId)
  s=aplicar(s,{type:'furniture-add',item:{tipoCatalogo:def.id,tipo3D:def.tipo3D,nome:nome??def.nome,
    xMm:X(cx),yMm:Y(cy),widthMm:widthMm??def.widthMm,depthMm:depthMm??def.depthMm,
    alturaMm:def.alturaMm,rotDegrees,cor:cor??def.corPadrao}})
}
furniture('cama-casal',204,439,90,1500,1900,'#AAC0B4','Cama da suíte')
furniture('guardaroupa',223,279,0,2300,450,'#A28B6B','Armário da suíte')
furniture('criado',141,344,0,450,450,'#B3A58F')
furniture('criado',141,527,0,450,450,'#B3A58F')
furniture('cama-solteiro',539,351,0,900,1950,'#99B7AA','Cama do dormitório')
furniture('guardaroupa',371,327,90,1400,450,'#A28B6B','Armário do dormitório')
furniture('escrivaninha',513,461,180,1100,450,'#A28B6B','Bancada do dormitório')
furniture('sofa-3',602,695,270,1950,900,'#BAC3C8','Sofá da sala TV')
furniture('rack-tv',452,693,90,1800,350,'#A28B6B','Rack da sala TV')
furniture('tapete-sala',529,696,0,1700,1950,'#D4D1C7')
furniture('mesa-jantar-4',676,481,0,1400,900,'#C7C7BB','Mesa de jantar')
furniture('poltrona',634,427,0,450,450,'#D6D6CC','Cadeira de jantar 1')
furniture('poltrona',702,427,0,450,450,'#D6D6CC','Cadeira de jantar 2')
furniture('poltrona',634,530,180,450,450,'#D6D6CC','Cadeira de jantar 3')
furniture('poltrona',702,530,180,450,450,'#D6D6CC','Cadeira de jantar 4')
furniture('fogao',842,402,270,600,600,'#5D6367')
furniture('pia-cozinha',842,536,270,2100,600,'#C5C3BD','Bancada e cuba da cozinha')
furniture('geladeira',839,667,270,700,700,'#D6D9DA')
furniture('gabinete-banheiro',281,625,270,650,400,'#C8C5BF','Lavatório suíte')
furniture('vaso-sanitario',270,682,270,450,650,'#F2F1EE')
furniture('box-chuveiro',247,757,0,1150,650,'#DDE5E4','Box suíte')
furniture('gabinete-banheiro',335,625,90,650,400,'#C8C5BF','Lavatório social')
furniture('vaso-sanitario',355,682,90,450,650,'#F2F1EE')
furniture('box-chuveiro',371,757,0,1100,650,'#DDE5E4','Box social')
furniture('mesa-jantar-4',705,290,0,950,950,'#C1AB88','Mesa da varanda')
furniture('poltrona',683,244,0,450,450,'#8E9D96','Cadeira da varanda 1')
furniture('poltrona',662,307,90,450,450,'#8E9D96','Cadeira da varanda 2')
furniture('maquina-lavar',839,257,270,600,600,'#DCE2E4')
furniture('tanque-lavar',839,306,270,600,600,'#DADBD5')

const errors=problemas(s.present)
if(errors.length) throw new Error(JSON.stringify(errors,null,2))
const leitura=documento(s)
const companion=exportarEditor({0:s},0)
const restored=carregarEditorState(JSON.parse(companion),leitura)
if(exportarEditor(restored.sessions,restored.activeFloor)!==companion) throw new Error('Round-trip do projeto divergiu.')
deepStrictEqual(documento(restored.sessions[0]),documento(s),'Round-trip da leitura divergiu.')
deepStrictEqual(JSON.parse(exportarMoveis(restored.sessions[0])),JSON.parse(exportarMoveis(s)),'Round-trip dos móveis divergiu.')
writeFileSync(resolve(pasta,'leitura.json'),exportar(s),'utf8')
writeFileSync(resolve(pasta,'projeto-planta.json'),companion,'utf8')
writeFileSync(resolve(pasta,'moveis.json'),exportarMoveis(s),'utf8')
const contexto={schema:1,propertyId:'liv-ipanema-referencia-47-59',agencyId:'referencia-publica-local',andar:0,
  ficha:{titulo:'LIV Ipanema · planta de referência 47,59 m²',empreendimento:'LIV Ipanema',area_util_m2:47.59,
    quartos:2,suites:1,banheiros:2,observacao:'Reconstrução local da planta publicitária; medidas inferidas. Sem unidade comercial selecionada.'},
  cores:{parede:'#E2DED5',piso_frio:'#B4B5B1',piso_madeira:'#B89369',teto:'#F2F0EC'},
  lote:{predio:{largura_m:47.7,profundidade_m:12.7,pavimentos:17}}}
writeFileSync(resolve(pasta,'contexto.json'),JSON.stringify(contexto,null,2)+'\n','utf8')
const area=s.present.rooms.reduce((a,r)=>a+r.widthMm*r.depthMm/1e6,0)
const referencia={titulo:'Planta pública LIV Ipanema 47,59 m²',site:'https://www.livonincorporadora.com.br/produtos/liv-ipanema/',
  imagem:'../referencias/planta-47-59.jpg',imagemSha256:createHash('sha256').update(readFileSync(fonte)).digest('hex'),
  tamanhoImagem:[1000,1000],registro:{origemPx:[105,225],eixos:'x para direita; y para baixo na imagem',mmPorPixel:pxMm,gradeMm:grid},
  areaPublicadaM2:47.59,areaContornoNominalAproximadaM2:Number(area.toFixed(4)),peDireitoMm:pd,
  limites:['A planta publicitária não fornece cotas; escala, altura, vãos e dimensões de móveis são aproximações.',
    'A área nominal entre eixos de paredes não é medição de área útil e não foi deformada para igualar a área publicada.',
    'Sala TV, jantar, circulação e cozinha formam o contorno integrado observado; varanda e serviço compartilham o mesmo recinto.',
    'Materiais e móveis usam o catálogo existente do construtor; o desenho público não fornece especificação executiva.'],
  construtor:{modelo:'painel/src/components/construtor-planta/modelo.ts',editor:'painel/src/components/construtor-planta/editorDocument.ts',
    apis:['iniciar','aplicar','documento','exportar','exportarMoveis','exportarEditor','carregarEditorState'],roundTrip:true},
  contagens:{partes:s.present.rooms.length,gruposMesclados:s.present.mergedGroups?.length??0,aberturas:s.present.openings.length,moveis:s.present.furniture?.length??0},
  pontosObservados:{suite:[105,250,349,576],dormitorio:[349,250,590,484],banhoSuite:[187,576,308,795],banhoSocial:[308,576,429,795],varandaServico:[590,225,876,362]}}
writeFileSync(resolve(pasta,'referencia.json'),JSON.stringify(referencia,null,2)+'\n','utf8')
console.log(JSON.stringify({ok:true,roundTrip:true,areaNominalM2:area,...referencia.contagens}))
