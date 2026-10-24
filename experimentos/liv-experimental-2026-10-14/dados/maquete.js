// Os dados do LIV Ipanema para o motor da maquete (tasks/painel/maquete-geral.md §3, MG-1). Tudo o que
// é deste empreendimento mora aqui: nomes, medidas, caminhos, unidades, tipologias, vistas próprias e
// acabamentos. O motor (viewer.js, renderer.js, interior-renderer.js e os módulos que eles carregam) lê
// este arquivo e não tem dado de imóvel nenhum; test_motor_sem_dados.mjs confere.
// É um módulo, e não um JSON, para carregar igual no navegador (inclusive Safari antigo), nos testes do
// Node e no otimizador da publicação. Os valores vieram do código de antes do MG-1, sem mudança.

// Dimensions are nominal estimates from the reconstructed rooms, between wall
// axes. Labels sit inside registered room outlines, without mirroring; adjacent
// bathrooms use opposite ends of their rooms to avoid covering one another.
// Canto: unidade.json + v1.5/miniaturas/liv-ipanema/interior/referencia.json.
// Meio: interiores/meio/{leitura,referencia}.json. L-shaped rooms use named parts.
const cantoMeasurements=[
  {name:'Suíte',x:.227,y:.413,widthMm:2700,depthMm:3550},
  {name:'Dormitório',x:.4695,y:.367,widthMm:2650,depthMm:2550},
  {name:'Banho suíte',x:.2475,y:.6155,widthMm:1350,depthMm:2400},
  {name:'Banho social',x:.3685,y:.7555,widthMm:1300,depthMm:2400},
  {name:'Jantar · trecho',x:.685,y:.469,widthMm:2100,depthMm:2350},
  {name:'Cozinha · faixa',x:.828,y:.65,widthMm:1050,depthMm:3900},
  {name:'Sala TV · trecho',x:.6045,y:.6465,widthMm:3900,depthMm:1550},
  {name:'Varanda/serviço',x:.733,y:.2935,widthMm:3150,depthMm:1500},
];
const meioMeasurements=[
  {name:'Suíte · quarto',x:.8345,y:.5325,widthMm:2600,depthMm:3250},
  {name:'Dormitório',x:.478,y:.416,widthMm:2650,depthMm:2600},
  {name:'Banho suíte',x:.658,y:.416,widthMm:1400,depthMm:2600},
  {name:'Banho social',x:.6175,y:.6815,widthMm:2300,depthMm:1400},
  {name:'Cozinha/jantar · trecho',x:.2275,y:.5735,widthMm:3000,depthMm:3850},
  {name:'Sala TV · trecho',x:.4375,y:.636,widthMm:1750,depthMm:2400},
  {name:'Varanda/serviço',x:.2275,y:.340,widthMm:3000,depthMm:1450},
];

export default {
  schema:'maquete-dados-v1',
  nome:'LIV Ipanema',
  cidade:'São Carlos',                               // a mensagem de interesse do apartamento
  nomeCurto:'LIV',                                   // nomes internos de materiais, grupos e luzes
  arquivo:'liv-ipanema',                             // prefixo dos PNG que a maquete baixa
  pagina:'maquete-liv-ipanema.html',                 // a página de entrada deste imóvel
  paginaPreservada:'site-baseline/maquete-liv-ipanema.html', // a versão antiga, oferecida se o 3D falhar
  mapa:{pagina:'mapa-liv-ipanema-5km.html',titulo:'Mapa do entorno do LIV Ipanema, limitado a 5 km',
    runtime:'mapa-runtime/mapa-liv-ipanema-5km.html',preparar:['site-baseline/quintais/']},

  // Paths for a complete exterior edition. Runtime manifests bind actual identities.
  edicoes:{
    base:{assets:'assets-prova/',units:'unidades.json',glb:'site-baseline/liv-ipanema.glb',nome:'LIV — exterior da base preservada'},
    contorno:{assets:'modelo/variante/assets/',units:'modelo/unidades-contorno.json',glb:'modelo/variante/liv-contorno.glb',nome:'LIV — contorno em estudo'},
    entrada:{assets:'modelo/entrada/candidato/assets/',units:'modelo/entrada/unidades-entrada.json',glb:'modelo/entrada/candidato/liv-contorno.glb',nome:'LIV — entrada em estudo',
      vagas:'modelo/entrada/candidato/vagas.json'},   // as 175 vagas da implantação oficial (vagas_oficiais.py),
  },
  edicaoPadrao:'base',                               // a do renderizador sem ?geometria
  edicaoDaMaquete:'entrada',
  // o que o service worker de preparação pode baixar antes (Tour, mapa, Planta 2D), além dos modelos das edições
  transferencias:{pastas:['site-baseline/','plantas2d/','interiores/','mapa-runtime/']},                         // a que a página da maquete abre sem ?geometria

  // O prédio: pavimentos 0 (térreo) a 16, o pavimento piloto do cadastro técnico e o espelho dele.
  predio:{
    pavimentos:17,
    pavimentoPiloto:1,
    alturaPavimentoM:2.85,
    idUnidade:'liv-ipanema/pavimento-modelo-{pavimento}/final-{final}',
    gardenNoTerreo:true,
    // só a primeira face desta caixa seleciona um apartamento (picking.js)
    caixaDoClique:{min:[-23.85,0,-7.02],max:[23.85,48.45,7.02]},
    reconciliacao:{publishedUnits:170,publishedParkingSpaces:175,paginaDaFonte:16,
      limitations:['Posições repetidas com o espaçamento do modelo, sem cotas executivas.',
        'Numeração comercial, tipologia e espelhamento por final não confirmados.',
        'Gardens do térreo existem na fonte; limites e áreas por final continuam pendentes.']},
  },

  // O cadastro técnico do pavimento piloto e o que ele tem de cumprir (unidades.js).
  unidades:{
    esquemas:['liv-pilot-units-v1','liv-pilot-units-v2'],esquemaComContorno:'liv-pilot-units-v2',
    quantidade:10,final:'^0[1-9]$|^10$',idPiloto:'liv-ipanema/pavimento-modelo-01/final-{final}',
    confianca:'inferido',faixaY:[3.02,5.68],meiaLarguraX:23.85,alturaDoClique:4.35,
    envelope:{minY:0,maxY:48.45,meiaLarguraX:23.85,meiaProfundidadeZ:7.5},
  },
  // Os dois lados da fachada. `interno` é a face junto do núcleo; `externo`, a da fachada.
  lados:{
    lazer:{sinal:1,par:true,rotulo:'Lado do lazer',interno:.16,externo:{base:7.02,contorno:6.35}},
    estacionamento:{sinal:-1,par:false,rotulo:'Lado do estacionamento',interno:-.16,externo:{base:-7.02,contorno:-6.35}},
  },

  // Catalog choices describe the published layouts; no final/unit assignment is inferred.
  tipologias:{
    canto:{id:'canto',label:'Canto',area:'47,59 m²',image:'plantas2d/canto.jpg',
      imageMask:'plantas2d/canto-recorte.svg',entryMarker:{x:.7255,y:.737},
      imageAlt:'Planta 1 de canto do LIV Ipanema, área publicada 47,59 m², incluindo varanda',measurements:cantoMeasurements,
      planSHA256:'a25114ef2c6fb455b38c787ae6b3c8420c81b534e19031a8cc0a34e4e1d95971'},
    meio:{id:'meio',label:'Meio',area:'47,5–47,89 m²',image:'plantas2d/meio.jpg',
      imageMask:'plantas2d/meio-recorte.svg',entryMarker:{x:.267,y:.7625},
      imageAlt:'Planta 2 de meio do LIV Ipanema, área publicada de 47,5 a 47,89 m², incluindo varanda',measurements:meioMeasurements,
      planSHA256:'bc846b68c7ce1204578336829d205ea3c60aee80258429aed6f45d331a3e032a',tourEmSplat:true},
  },

  // As vistas que vêm da própria cena exportada, e as que este imóvel acrescenta.
  vistasDaCena:{perspectiva:'Perspectiva',fachada:'Fachada',aerea:'Aérea',portaria:'Portaria',implantacao:'Implantação'},
  vistasExtras:{
    // Detail view of the two balcony stacks at the gate end of the published face.
    // Coordinates use the source-locked model; no commercial unit is assigned.
    varandas:{rotulo:'Varandas',fov:34,alvo:[-16.25,24.5,5.55],r:24,th:.08,ph:1.53,limites:{min:[-21,20.0,4.2],max:[-11.5,29.0,6.9]}},
    // Canopy, vehicle portal and sign in the approximate source-locked site model.
    // These bounds frame the access; they are not surveyed building dimensions.
    acesso:{rotulo:'Acesso de perto',fov:50,alvo:[-29.85,2.5,42.3],r:28,th:-.18,ph:1.585,limites:{min:[-36.9,.1,35.5],max:[-22.8,4.55,49.1]},
      // na edição "entrada", os limites saem dos volumes com estes materiais
      materiaisPorEdicao:{entrada:'MAT-entrada-'}},
  },
  // O enquadramento de um pavimento e da fachada inteira (cameras.js, sem os limites medidos da torre).
  vistaDoPavimento:{meiaLargura:26,alturaMinima:10,profundidade:7.02},
  vistaDaFachada:{altura:48.45,meiaAlturaMinima:25.7,meiaLargura:26,profundidade:7.02},

  // Appearance calibration from the official balcony render. The RGBM proof keeps
  // its original finish; the integrated viewer opts into this isolated profile.
  acabamentos:{
    modelo:'89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919',
    pintura:{malha:'Blender / esquadrias-varandas-esquadria / torre 0',torre:0,
      cor:[0.01850022003054619,0.02518685907125473,0.024157632142305374],metalness:1,roughness:.38,
      nome:'LIV — esquadrias e guarda-corpos pintados',acabamento:'painted-frames-v1',metalnessDepois:0,roughnessDepois:.55},
    acesso:[
      {malha:'Blender / SITE-implantacao-site-vidro / torre -1',torre:-1,
        cor:[0.040915198624134064,0.08228270709514618,0.07818742096424103],metalness:.25,roughness:.16,
        rotulo:'vidros da implantação',acabamento:'entry-glass-v1',roughnessDepois:.16},
      {malha:'Blender / LIV-IPANEMA-tipografia / torre -1',torre:-1,
        cor:[0.01850022003054619,0.02518685907125473,0.024157632142305374],metalness:1,roughness:.38,
        rotulo:'letreiro pintado',acabamento:'entry-lettering-v1',roughnessDepois:.65},
    ],
  },
};
