import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','0159611:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('function baseDaCasa(pl) {'),app.indexOf('/* ---- rótulos de cômodo'));

const planta=id=>({id,cx:20,cz:-30,mx:20,mz:-30,andar:3,h:2.9,pd:2.7,area:64.4,
  rec:{r:[[10,-40],[30,-40],[30,-20],[10,-20]],name:'Bloco A',lote:false,lancamento:false},
  comodos:[{cx:18,cz:-28,nome:'Sala'},{cx:24,cz:-33,nome:'Quarto'}],
  furo:{cx:20,cz:-30,r:14},ob:{hu:7.5},moveis:[{tipo:'cama'}],
  unidade:{id:'u-'+id,ficha:{empreendimento:'Monte das Colinas',titulo:'Apto 39',area_util:62}},
  W:(u,v)=>[u,v]});

function fixture(modular) {
  const log=[];
  const el=new Map();
  const node=id=>{
    if(el.has(id)) return el.get(id);
    const e={id,textContent:'',hidden:undefined,attrs:{},className:'',
      classList:{list:new Set(),add(c){this.list.add(c);},remove(c){this.list.delete(c);},
        toggle(c,on){const v=on===undefined?!this.list.has(c):!!on;v?this.list.add(c):this.list.delete(c);return v;}},
      style:{},setAttribute(k,v){this.attrs[k]=v;},firstElementChild:null};
    e.parentNode={insertBefore:(novo,ref)=>log.push(['insert',novo.id||novo.className,ref.id])};
    el.set(id,e); return e;
  };
  const ctx=vm.createContext({console,performance:{now:()=>1000},innerWidth:900,innerHeight:600,
    document:{createElement:tag=>{const e=node('novo-'+tag);e.id='';return e;},body:node('body')},
    $:node, TOQUE:false, OLHO:1.62, LV:3.15, CORTE_OFF:1e6, CORTE_OMBRO:1.55,
    NEAR_CASA:0.15, FAR_CASA:6000, NEAR_CIDADE:1, FAR_CIDADE:20000, FOV_CIDADE:55,
    fovInterior:p=>{log.push(['fov',p]);return p?70:64;},
    terrainY:(x,z)=>(x+z)/100, streamUpdate:f=>log.push(['stream',f]), sujaSombra:()=>log.push(['sombra']),
    plantaDaUnidade:(rec,u)=>rec.semPlanta?null:planta(u.id),
    unidadeDoPredio:rec=>rec.unidade||null, predioDaUnidade:u=>({confirmado:false}),
    geoDaCasa:null,  // trocado por um Group real depois do three, abaixo
    leMoveis:id=>{log.push(['leMoveis',id]);return null;},
    poeNaCena:m=>log.push(['poe',m.tipo]), criaRotulos:pl=>log.push(['rotulos',pl.id]),
    pontoDeEntrada:pl=>{log.push(['entrada',pl.id]);return [18.5,-27.5];},
    melhorDirecao:(x,z)=>{log.push(['rumo',x,z]);return 0.8;},
    livre:(x,z)=>x>0, acendeInterior:pl=>log.push(['acende',pl.id]), apagaInterior:()=>log.push(['apaga']),
    sondaDeAmbiente:pl=>log.push(['sonda',pl.id]), soltaSonda:()=>log.push(['solta']),
    modoMoveis:on=>log.push(['modo',on]), mostraJoy:on=>log.push(['joy',on]),
    pintaCatalogo:()=>log.push(['catalogo']), pintaEditor:()=>log.push(['editor']),
    fechaPerto:v=>log.push(['perto',v]), setPins:on=>log.push(['pins',on]), closePoiSheet:()=>log.push(['poi']),
    hsheet:node('hsheet'), usheet:node('usheet'), ipanel:node('ipanel'),
    houseBeacon:node('beacon'), housesBox:node('housesBox'), log:(...a)=>log.push(a)});
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(`geoDaCasa=(pl,teto)=>{log('casa',pl.id,teto);const g=new THREE.Group();g.name='casa';return g;};
    var camera=new THREE.PerspectiveCamera(55,1.5,1,20000);
    camera.position.set(100,200,300);
    var target=new THREE.Vector3(5,0,6), sph=new THREE.Spherical(900,0.9,0.4);
    var gInteriores=new THREE.Group(), CORTE=new THREE.Plane(new THREE.Vector3(0,-1,0),1e6);
    var uFuro={value:new THREE.Vector4()}, BAKE={fila:{pendente:true}};
    var selBox=new THREE.Mesh(); selBox.visible=true;
    var INT={luzes:[],lamps:[],pool:[],on:false,fp:false,orbita:false,pl:null,raiz:null,casa:null,
      moveis:[],sel:7,teto:false,baseY:0,voo:null,corteAlvo:1e6,salvo:null,rotulos:[{el:{remove(){}}}]};
    var FP={pos:new THREE.Vector3(),yaw:0,pitch:-0.05,mov:{x:0,z:0}};
    var reliefAmount=0.8, poeTipo='sofa';
    var quatOlhando=(de,para)=>{const m=new THREE.Matrix4().lookAt(de,para,new THREE.Vector3(0,1,0));
      return new THREE.Quaternion().setFromRotationMatrix(m);};`,ctx);
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/interior/entry.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.api=InteriorEntry.create({THREE, document, $, camera, target, sph,
      gInteriores, INT, FP, TOQUE, OLHO, LV, CORTE, CORTE_OFF, CORTE_OMBRO, NEAR_CASA, FAR_CASA,
      NEAR_CIDADE, FAR_CIDADE, FOV_CIDADE, fovInterior, terrainY, getRelevo:()=>reliefAmount,
      streamUpdate, sujaSombra, uFuro, selBox, BAKE, plantaDaUnidade, unidadeDoPredio,
      predioDaUnidade, geoDaCasa, leMoveis, poeNaCena, criaRotulos, pontoDeEntrada,
      melhorDirecao, livre, quatOlhando, acendeInterior, apagaInterior, sondaDeAmbiente,
      soltaSonda, modoMoveis, mostraJoy, pintaCatalogo, pintaEditor, fechaPerto, setPins,
      closePoiSheet, hsheet, usheet, ipanel, houseBeacon, housesBox,
      poeTipoNulo:()=>{ poeTipo=null; },
      // A escada de etapas, a ficha e a maquete são posteriores ao monólito; neutras: planta
      // fechada, nenhum voo nem transição em curso, nenhuma ficha aberta.
      getPlanta:()=>({on:false,corta:false}), getEtapa:(e=>()=>e)({atual:'mapa'}), saiPlanta:()=>{},
      paraVoo:()=>{}, pintaEtapas:()=>{}, getFicha:()=>null, setFicha:()=>{}, indoPara:()=>null,
      escondeMaquete:()=>{}});`,ctx);
  } else vm.runInContext(source+'\nglobalThis.api={baseDaCasa,enterInterior,descarta,exitInterior,saiSeco,alturaDoCorte,aplicaFuro,vista};',ctx);
  const snapshot=()=>vm.runInContext(`JSON.stringify({
    cam:[camera.position.toArray(),camera.quaternion.toArray(),camera.near,camera.far,camera.fov,
         camera.projectionMatrix.elements],
    target:target.toArray(), sph:[sph.radius,sph.phi,sph.theta], corte:CORTE.constant,
    furo:uFuro.value.toArray(), fila:BAKE.fila, sel:[INT.sel,selBox.visible], tipo:poeTipo,
    int:{on:INT.on,fp:INT.fp,orbita:INT.orbita,teto:INT.teto,baseY:INT.baseY,pl:INT.pl&&INT.pl.id,
      raiz:INT.raiz&&[INT.raiz.position.y,INT.raiz.children.length],casa:!!INT.casa,
      moveis:INT.moveis.length,rotulos:INT.rotulos.length,salvo:INT.salvo,
      voo:INT.voo&&[INT.voo.dur,INT.voo.p1.toArray(),INT.voo.q1.toArray()]},
    fp:[FP.pos.toArray(),FP.yaw,FP.pitch], grupo:gInteriores.children.length})`,ctx);
  return {ctx,log,snapshot,el,
    dom:()=>JSON.stringify([...el].map(([k,e])=>[k,e.textContent,e.hidden,e.attrs,[...e.classList.list],e.style.display]))};
}

const passos=[
  // entra numa unidade cadastrada, olha a planta, volta pra primeira pessoa e sai com voo
  `api.enterInterior({unidade:{id:'a'},r:[[10,-40],[30,-40],[30,-20],[10,-20]],name:'Bloco A'})`,
  `api.alturaDoCorte()`, `INT.voo.fim(); api.vista(true)`, `api.alturaDoCorte()`,
  `FP.pos.set(-4,0,-4); api.vista(false)`,   // fora do livre: volta ao ponto de entrada
  `api.exitInterior(); INT.voo.fim()`,
  // reentra e sai seco, o caminho do botão Centro e da busca
  `api.enterInterior({unidade:{id:'b'},r:[[10,-40],[30,-40],[30,-20],[10,-20]]})`,
  `api.saiSeco(); api.saiSeco()`,
  // prédio sem cadastro e prédio sem planta não abrem porta nenhuma
  `api.enterInterior({r:[]}); api.enterInterior({unidade:{id:'c'},semPlanta:true,r:[]})`,
  // entrar duas vezes sem sair: a segunda descarta a primeira
  `api.enterInterior({unidade:{id:'d'},r:[[10,-40],[30,-40],[30,-20],[10,-20]]})`,
  `api.enterInterior({unidade:{id:'e'},r:[[10,-40],[30,-40],[30,-20],[10,-20]]})`,
  `api.vista(true); api.exitInterior(); INT.voo.fim()`,
  // fora da casa o corte sai de cena, o furo zera e vista/saída não fazem nada
  `api.vista(true); api.exitInterior(); api.saiSeco(); api.aplicaFuro(); api.alturaDoCorte()`,
  `api.baseDaCasa({mx:20,mz:-30,andar:3,rec:{r:[[10,-40],[30,-40],[30,-20],[10,-20]]}})`,
  `reliefAmount=0; api.baseDaCasa({mx:20,mz:-30,andar:0,rec:{r:[[10,-40]]}})`,
];

test('interior entry, exit and views match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  for(const passo of passos) {
    const va=vm.runInContext(passo,a.ctx),vb=vm.runInContext(passo,b.ctx);
    assert.deepEqual(vb,va,passo);
    assert.equal(b.snapshot(),a.snapshot(),passo);
    assert.deepEqual(b.log,a.log,passo);
    assert.equal(b.dom(),a.dom(),passo);
  }
  assert.ok(a.log.length>40,'the oracle must have exercised the whole composition');
});

test('a unit on the ground floor without relief sits on the terrain, and the flight lands at eye height',()=>{
  const b=fixture(true);
  vm.runInContext(`api.enterInterior({unidade:{id:'f'},r:[[10,-40],[30,-40],[30,-20],[10,-20]]})`,b.ctx);
  const [, y]=JSON.parse(b.snapshot()).int.voo[1];
  assert.equal(y,JSON.parse(b.snapshot()).int.baseY+1.62);
  // o piso nasce na MAIOR cota das esquinas do lote, não na do centro: 0,1 m × relevo
  assert.equal(JSON.parse(b.snapshot()).int.baseY,0.8*0.1+3*3.15);
});
