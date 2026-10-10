/**
 * LIV Ipanema: Planta 2 de meio, traçada pela API real do construtor.
 * Fonte comercial sem cotas executivas. Não atribui apartamento/final ou garden.
 * node experimentos/liv-ipanema-webgpu-2026-10-09/interiores/meio/construir-meio.ts
 */
import {copyFileSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {deepStrictEqual} from 'node:assert'
import {execFileSync} from 'node:child_process'
import {iniciar,aplicar,documento,exportar,exportarMoveis,problemas,type Session} from '../../../../painel/src/components/construtor-planta/modelo.ts'
import {exportarEditor,carregarEditorState} from '../../../../painel/src/components/construtor-planta/editorDocument.ts'
import {CATALOGO_MOVEIS} from '../../../../painel/src/components/construtor-planta/catalogoMoveis.ts'

const pasta=dirname(fileURLToPath(import.meta.url)),raiz=resolve(pasta,'../../../..'),exp=resolve(pasta,'../..')
mkdirSync(pasta,{recursive:true})
const fonte=resolve(raiz,'v1.5/miniaturas/liv-ipanema/referencias/planta-tipo.jpg')
const fonteSHA='bc846b68c7ce1204578336829d205ea3c60aee80258429aed6f45d331a3e032a'
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex')
if(hash(readFileSync(fonte))!==fonteSHA)throw Error('A imagem oficial de meio mudou; revisar o registro antes de regenerar.')
const imagem2d=resolve(exp,'plantas2d/meio.jpg')
mkdirSync(dirname(imagem2d),{recursive:true});copyFileSync(fonte,imagem2d)

// Coordenadas lidas entre eixos aparentes das paredes da imagem 1000x1000.
// A escala usa o componente de varanda 4,41 m² do extremo inferior publicado.
// Isso fornece uma estimativa uniforme, não uma cota nem uma área útil validada.
const registroVaranda:[number,number,number,number]=[95,275,360,405]
const pxMm=Math.sqrt(4.41*1e6/((registroVaranda[2]-registroVaranda[0])*(registroVaranda[3]-registroVaranda[1])))
const origem=[95,275],grid=50,pd=2700
const X=(pixel:number)=>Math.round((pixel-origem[0])*pxMm/grid)*grid
const Y=(pixel:number)=>Math.round((pixel-origem[1])*pxMm/grid)*grid
type Rect=[number,number,number,number]
const quad=(r:Rect)=>({xMm:X(r[0]),yMm:Y(r[1]),widthMm:X(r[2])-X(r[0]),depthMm:Y(r[3])-Y(r[1])})
let s:Session=iniciar('liv-ipanema-planta-meio-referencia')
function add(name:string,r:Rect){
  const id='c'+s.nextId
  s=aplicar(s,{type:'add',name,ceilingHeightMm:pd,...quad(r)})
  return id
}
function polygon(name:string,rects:Rect[]){
  const previous=new Set(s.present.rooms.map(r=>r.id))
  s=aplicar(s,{type:'add-poligono',name,ceilingHeightMm:pd,retangulos:rects.map(quad)})
  return s.present.rooms.filter(r=>!previous.has(r.id)).map(r=>r.id)
}
const pontos={
  varandaServico:registroVaranda,
  dormitorio:[360,302,596,530] as Rect,
  banhoSuite:[596,302,720,530] as Rect,
  suite:[[720,389,949,676],[596,530,720,621]] as Rect[],
  banhoSocial:[515,621,720,742] as Rect,
  salaIntegrada:[[95,405,360,742],[360,530,515,742],[515,530,596,621]] as Rect[],
  vazioNaoHabitavel:[720,676,854,742] as Rect,
}
// Suíte em L: o vestíbulo pertence à suíte e não à circulação pública.
const [suiteQuarto,suiteVestibulo]=polygon('Suíte',pontos.suite)
const dormitorio=add('Dormitório 01',pontos.dormitorio)
const banhoSuite=add('Banho suíte',pontos.banhoSuite)
const banhoSocial=add('Banho',pontos.banhoSocial)
// Cozinha, jantar, TV e circulação têm piso contínuo e não recebem divisórias.
const [salaEsquerda,salaTV,circulacao]=polygon('Sala integrada',pontos.salaIntegrada)
const varanda=add('Varanda / serviço',pontos.varandaServico)

function opening(roomId:string,side:'north'|'south'|'east'|'west',lo:number,hi:number,
                 kind:'door'|'window',heightMm:number,sillMm=0){
  const room=s.present.rooms.find(r=>r.id===roomId)!
  const along=side==='north'||side==='south'?X:Y
  const start=side==='north'||side==='south'?room.xMm:room.yMm
  s=aplicar(s,{type:'opening-add',kind,wallId:roomId+'-'+side,
    offsetMm:along(lo)-start,widthMm:along(hi)-along(lo),heightMm,sillMm})
}
// No construtor, north é o lado de maior y; nomes não expressam orientação solar.
opening(suiteVestibulo,'west',547,617,'door',2100)
opening(dormitorio,'north',528,596,'door',2100)
opening(banhoSuite,'north',610,673,'door',2100)
opening(banhoSocial,'south',530,590,'door',2100)
opening(salaEsquerda,'north',236,305,'door',2100)
opening(varanda,'north',173,347,'door',2200)
opening(suiteQuarto,'south',786,883,'window',1200,1000)
opening(dormitorio,'south',434,534,'window',1200,1000)
opening(banhoSuite,'south',648,694,'window',700,1500)
opening(banhoSocial,'east',685,725,'window',700,1500)
opening(varanda,'south',168,350,'window',1150,1050)

// Móveis do mesmo catálogo, posicionados para a distribuição própria de meio.
function furniture(catalogId:string,cx:number,cy:number,rotDegrees=0,
                   widthMm?:number,depthMm?:number,cor?:string,nome?:string){
  const def=CATALOGO_MOVEIS.find(d=>d.id===catalogId)
  if(!def)throw Error('Catálogo não contém '+catalogId)
  s=aplicar(s,{type:'furniture-add',item:{tipoCatalogo:def.id,tipo3D:def.tipo3D,nome:nome??def.nome,
    xMm:X(cx),yMm:Y(cy),widthMm:widthMm??def.widthMm,depthMm:depthMm??def.depthMm,
    alturaMm:def.alturaMm,rotDegrees,cor:cor??def.corPadrao}})
}
furniture('cama-casal',843,531,270,1500,1900,'#AAC0B4','Cama da suíte')
furniture('guardaroupa',843,651,0,2150,400,'#A28B6B','Armário da suíte')
furniture('criado',922,445,0,400,400,'#B3A58F','Criado da suíte 1')
furniture('criado',922,615,0,400,400,'#B3A58F','Criado da suíte 2')
furniture('cama-solteiro',412,399,0,900,1950,'#99B7AA','Cama do dormitório')
furniture('guardaroupa',571,381,90,1650,400,'#A28B6B','Armário do dormitório')
furniture('escrivaninha',451,506,180,1500,350,'#A28B6B','Bancada do dormitório')
furniture('sofa-3',417,697,180,1750,800,'#BAC3C8','Sofá da sala TV')
furniture('rack-tv',428,549,0,1600,300,'#A28B6B','Rack da sala TV')
furniture('tapete-sala',417,634,0,1700,1700,'#D4D1C7')
furniture('mesa-jantar-4',275,512,0,1200,900,'#C7C7BB','Mesa de jantar')
furniture('poltrona',244,459,0,400,400,'#D6D6CC','Cadeira de jantar 1')
furniture('poltrona',313,459,0,400,400,'#D6D6CC','Cadeira de jantar 2')
furniture('poltrona',244,565,180,400,400,'#D6D6CC','Cadeira de jantar 3')
furniture('poltrona',313,565,180,400,400,'#D6D6CC','Cadeira de jantar 4')
furniture('fogao',128,446,90,600,600,'#5D6367')
furniture('pia-cozinha',128,564,90,1750,600,'#C5C3BD','Bancada e cuba da cozinha')
furniture('geladeira',128,705,90,650,650,'#D6D9DA')
furniture('gabinete-banheiro',640,439,0,600,400,'#C8C5BF','Lavatório suíte')
furniture('vaso-sanitario',686,490,180,450,600,'#F2F1EE','Vaso da suíte')
furniture('box-chuveiro',662,352,0,1100,800,'#DDE5E4','Box suíte')
furniture('gabinete-banheiro',610,712,180,600,400,'#C8C5BF','Lavatório social')
furniture('vaso-sanitario',680,697,180,450,600,'#F2F1EE','Vaso social')
furniture('box-chuveiro',551,679,90,1000,700,'#DDE5E4','Box social')
// Pequeno ajuste ilustrativo de 10 cm do conjunto para liberar a passagem da varanda.
furniture('mesa-jantar-4',252,349,0,950,950,'#C1AB88','Mesa da varanda')
furniture('poltrona',260,301,0,400,400,'#8E9D96','Cadeira da varanda 1')
furniture('poltrona',203,368,90,400,400,'#8E9D96','Cadeira da varanda 2')
furniture('maquina-lavar',124,304,90,600,600,'#DCE2E4')
furniture('tanque-lavar',124,372,90,600,600,'#DADBD5')

const errors=problemas(s.present)
if(errors.length)throw Error(JSON.stringify(errors,null,2))
const leitura=documento(s),companion=exportarEditor({0:s},0)
const restored=carregarEditorState(JSON.parse(companion),leitura)
if(exportarEditor(restored.sessions,restored.activeFloor)!==companion)throw Error('Round-trip do projeto divergiu.')
deepStrictEqual(documento(restored.sessions[0]),leitura,'Round-trip da leitura divergiu.')
deepStrictEqual(JSON.parse(exportarMoveis(restored.sessions[0])),JSON.parse(exportarMoveis(s)),'Round-trip dos móveis divergiu.')
writeFileSync(resolve(pasta,'leitura.json'),exportar(s),'utf8')
writeFileSync(resolve(pasta,'projeto-planta.json'),companion,'utf8')
writeFileSync(resolve(pasta,'moveis.json'),exportarMoveis(s),'utf8')
const contexto={schema:1,propertyId:'liv-ipanema-planta-meio-referencia',agencyId:'referencia-publica-local',andar:0,
  ficha:{titulo:'LIV Ipanema · planta de meio · 47,5 a 47,89 m²',empreendimento:'LIV Ipanema',
    area_publicada_min_m2:47.5,area_publicada_max_m2:47.89,quartos:2,suites:1,banheiros:2,
    observacao:'Reconstrução ilustrativa da Planta 2 de meio. Medidas inferidas; sem final, unidade comercial ou garden atribuído.'},
  cores:{parede:'#E2DED5',piso_frio:'#B4B5B1',piso_madeira:'#B89369',teto:'#F2F0EC'},
  lote:{predio:{largura_m:47.7,profundidade_m:12.7,pavimentos:17}}}
writeFileSync(resolve(pasta,'contexto.json'),JSON.stringify(contexto,null,2)+'\n','utf8')

const area=s.present.rooms.reduce((a,r)=>a+r.widthMm*r.depthMm/1e6,0)
const inputsSHA256=Object.fromEntries(['leitura.json','projeto-planta.json','moveis.json','contexto.json']
  .map(name=>[name,hash(readFileSync(resolve(pasta,name)))]))
const referencia={titulo:'LIV Ipanema · Planta 2 · apartamentos de meio',tipologia:'meio',
  site:'https://www.livonincorporadora.com.br/produtos/liv-ipanema/',
  book:{url:'https://www.livonincorporadora.com.br/wp-content/uploads/2024/08/BOOK_LIV_Ipanema.pdf',pagina:14,
    sha256:'c7dae676c82eab758370e386cea7fe6bd31dded9fa436eb53ebdfe70be7bb50b'},
  imagem:'../../plantas2d/meio.jpg',imagemOrigem:'v1.5/miniaturas/liv-ipanema/referencias/planta-tipo.jpg',
  imagemSha256:fonteSHA,tamanhoImagem:[1000,1000],
  registro:{origemPx:origem,eixos:'x para direita; y para baixo na imagem',mmPorPixel:pxMm,gradeMm:grid,
    metodoEscala:'Escala uniforme estimada pela caixa aparente da varanda e componente publicado de 4,41 m²; sem cotas executivas.',
    caixaCalibracaoPx:registroVaranda,areaCalibracaoPublicadaM2:4.41},
  areaPublicadaIntervaloM2:[47.5,47.89],
  componentesPublicadosM2:[{apartamento:43.1,varanda:4.41},{apartamento:43.39,varanda:4.51}],
  areaContornoNominalAproximadaM2:Number(area.toFixed(4)),peDireitoMm:pd,
  limites:['A fonte comercial confirma uma tipologia distinta de canto; não é um espelhamento da planta existente.',
    'A publicidade não fornece cotas. Escala, eixos de paredes, pé-direito, altura/largura de vãos e móveis são aproximações.',
    'A escala usa o extremo inferior do componente varanda, sem atribuir a área de 47,5 m² a uma unidade ou final.',
    'A área nominal entre eixos tem base diferente da área publicada e não foi deformada para igualar o intervalo comercial.',
    'No extremo inferior, os componentes impressos somam 47,51 m², enquanto o total publicado é 47,5 m²; conservar ambos.',
    'O retângulo branco sob a suíte não foi tratado como ambiente habitável ou passagem; uso técnico exato não confirmado.',
    'Sala, cozinha, jantar e circulação formam um contorno mesclado; quarto e vestíbulo da suíte formam outro.',
    'O índice 0 é técnico da exportação. Esta reconstrução não representa configuração garden, pavimento comercial ou unidade à venda.',
    'Não reutilizar o atlas de canto nesta geometria. A integração deve usar luz própria ou materiais com iluminação dinâmica.'],
  construtor:{modelo:'painel/src/components/construtor-planta/modelo.ts',editor:'painel/src/components/construtor-planta/editorDocument.ts',
    apis:['iniciar','aplicar','documento','exportar','exportarMoveis','exportarEditor','carregarEditorState'],roundTrip:true},
  captura:{construtorSHA256:hash(readFileSync(fileURLToPath(import.meta.url))),inputsSHA256},
  conversao:{status:'PENDING',script:'exportar-meio.py'},
  contagens:{partes:s.present.rooms.length,gruposMesclados:s.present.mergedGroups?.length??0,
    aberturas:s.present.openings.length,moveis:s.present.furniture?.length??0},pontosObservados:pontos}
writeFileSync(resolve(pasta,'referencia.json'),JSON.stringify(referencia,null,2)+'\n','utf8')
// Exportador reutilizável valida o vínculo da captura, gera unidade e conferência 2D.
const conversao=JSON.parse(execFileSync('python',[resolve(pasta,'exportar-meio.py')],{cwd:raiz,encoding:'utf8'}).trim())
console.log(JSON.stringify({ok:true,roundTrip:true,mmPorPixel:pxMm,areaNominalM2:area,...referencia.contagens,...conversao}))
