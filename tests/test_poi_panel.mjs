import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','88bbc83:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
// No app.js estas variáveis eram do módulo inteiro; no arquivo extraído entram por leitor.
const source=app.slice(app.indexOf('function recalcDyPois()'),app.indexOf('/* ======',app.indexOf('function updatePois')))
  .replaceAll('reliefAmount','getRelevo()')
  .replace('const dentro = typeof INT !== "undefined" && INT.on;',
           'const I = getInterior();\n  const dentro = !!(I && I.on);');

const CAT={farmacia:{lbl:'Farmácia',col:'#4AA',ic:'<path/>',curto:'farmácia',pri:2},
  mercado:{lbl:'Mercado',col:'#A84',ic:'<path/>',curto:'mercado',pri:3},
  hospital:{lbl:'Hospital',col:'#C44',ic:'<path/>',curto:'hospital',pri:1}};
const CAT_KEYS=Object.keys(CAT);
const CRUS=[['farmacia',40,-30],['farmacia',900,-30],['mercado',120,60],['hospital',60,-10],
  ['mercado',5000,5000]];

function fixture(modular) {
  const log=[];
  const el=new Map();
  const node=id=>{
    if(el.has(id)) return el.get(id);
    const e={id,textContent:'',innerHTML:'',href:'',title:'',hidden:undefined,className:'',
      dataset:{},children:[],ouvintes:{},scrollTop:9,offsetWidth:64,
      style:{props:{},setProperty(k,v){this.props[k]=v;}},
      classList:{list:new Set(),add(c){this.list.add(c);},remove(c){this.list.delete(c);},
        contains(c){return this.list.has(c);},
        toggle(c,on){const v=on===undefined?!this.list.has(c):!!on;v?this.list.add(c):this.list.delete(c);return v;}},
      setAttribute(k,v){this.dataset['aria_'+k.replace('aria-','')]=v;},
      getAttribute:function(k){return this.dataset['aria_'+k.replace('aria-','')];},
      addEventListener(t,fn){(this.ouvintes[t]=this.ouvintes[t]||[]).push(fn);},
      appendChild(f){const i=this.children.indexOf(f);if(i>=0)this.children.splice(i,1);this.children.push(f);},
      querySelector:function(){return this._b||(this._b=node(this.id+'-b'));}};
    el.set(id,e); return e;
  };
  let criados=0;
  const ctx=vm.createContext({console,CAT,CAT_KEYS,POI_Y:24,POI_MAX:4200,POI_NAME:1400,POI_HALO:30,
    document:{createElement:()=>node('novo-'+(++criados)),
      body:{classList:{add:c=>log.push(['corpo+',c]),remove:c=>log.push(['corpo-',c])}}},
    $:node, esc:t=>String(t), terrainY:(x,z)=>x/1000, registerTerrain:()=>log.push(['terreno']),
    flyTo:(x,z,r)=>log.push(['voo',x,z,Math.round(r)]), streamUpdate:f=>log.push(['stream',f]),
    requestAnimationFrame:fn=>{log.push(['raf']);fn();},
    innerWidth:1200, innerHeight:800,
    PoiLayer:{create:({pois})=>{log.push(['camada',pois.length]);
        const layer={};for(const k of CAT_KEYS) layer[k]=[{visible:true}];
        return {group:{visible:true,tipo:'gPoi'},layer};},
      contaPerto:(pois,x,z,r)=>{log.push(['conta',x,z,r]);
        const n={};for(const p of pois){const d=Math.hypot(p.x-x,p.z-z);if(d<=r)n[p.c]=(n[p.c]||0)+1;}return n;}}});
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(`var camera=new THREE.PerspectiveCamera(55,1.5,1,20000);
    camera.position.set(0,300,600); camera.lookAt(new THREE.Vector3(0,0,0)); camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    var sph=new THREE.Spherical(700,0.9,0.4), target=new THREE.Vector3();
    var scene={add:o=>__log(['cena',o.tipo])};
    var overlay=$('overlay'), usheet=$('usheet'), hsheet=$('hsheet');
    var houseBeacon={visible:false,position:{set:(x,y,z)=>__log(['farol',x,y,z])}};
    var relevo=1, interior={on:false};
    var POIS=${JSON.stringify(CRUS)}.map(([c,x,z],i)=>({c,x,z,n:'Lugar '+i,a:'Rua '+i,
      h:'8h', t:null, w:null, lat:-22-i/1000, lon:-47-i/1000, cfg:CAT[c], dy:0,
      v:new THREE.Vector3()}));`,ctx);
  ctx.__log=a=>log.push(a);
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/ui/poi-panel.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.api=PoiPanel.create({THREE, document, $, esc, overlay, scene, camera,
      sph, target, POIS, CAT, CAT_KEYS, PoiLayer, terrainY, registerTerrain, POI_HALO, POI_Y,
      POI_MAX, POI_NAME, usheet, hsheet, houseBeacon, flyTo, streamUpdate,
      getInterior:()=>interior, getRelevo:()=>relevo});`,ctx);
  } else vm.runInContext(`var getInterior=()=>interior, getRelevo=()=>relevo;\n`+source+`
    globalThis.api={recalcDyPois,sujaPois,closePoiSheet,openPoiSheet,aplicaCat,setPins,abrePerto,
      fechaPerto,minimizaFicha,updatePois,PERTO,catOn,pinoOculto:()=>poiHidden};`,ctx);
  return {ctx,log,node,
    estado:()=>JSON.stringify([...el].map(([k,e])=>[k,e.textContent,e.innerHTML.length,e.href,
      e.hidden,[...e.classList.list],e.dataset,e.style.props,e.children.map(f=>f.id)]))
      +vm.runInContext(`JSON.stringify([api.PERTO.on,!!api.PERTO.volta,api.pinoOculto(),api.catOn,
        POIS.map(p=>[p.el.style.display,p.el.style.transform||null,[...p.el.classList.list]])])`,ctx)};
}

const passos=[
  `api.updatePois()`,                                  // pino apagado: nada na tela
  `api.setPins(true); api.updatePois()`,                // aceso: marcadores colocados
  `relevo=0; api.updatePois()`,                         // relevo mexe na altura do feixe
  `api.openPoiSheet(POIS[0])`,                          // ficha acende pino e categoria
  `api.updatePois()`,
  `$('px').ouvintes.click[0]({})`,                      // fecha a ficha e apaga o pino
  `api.aplicaCat('mercado',false); api.updatePois()`,
  `api.aplicaCat('mercado',true)`,
  `api.abrePerto({x:50,z:-20,nome:'Monte',volta:()=>__log(['volta'])})`,
  `api.updatePois()`,
  `api.aplicaCat('farmacia',true); api.updatePois()`,
  `api.openPoiSheet(POIS[1])`,                          // dentro do perto: ficha encolhe
  `$('nNone').ouvintes.click[0]({})`,
  `$('nAll').ouvintes.click[0]({})`,
  `$('nBack').ouvintes.click[0]({})`,                   // volta pra ficha de onde veio
  `api.abrePerto({x:50,z:-20,nome:'Monte'}); $('nx').ouvintes.click[0]({})`,
  `interior={on:true}; api.setPins(true); api.updatePois()`,   // dentro da casa, nada
  `interior={on:false}; api.updatePois()`,
  `api.minimizaFicha(true)`,
  `$('uDobra').ouvintes.click[0]({stopPropagation(){}})`,
  `$('usheet').ouvintes.click[0]({target:{closest:()=>null}})`,
  `api.recalcDyPois(); api.updatePois()`,
];

test('POI markers, sheet, categories, pins and the nearby column match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  let apareceu=false;
  assert.equal(b.estado(),a.estado(),'criação');
  assert.equal(JSON.stringify(b.log),JSON.stringify(a.log),'criação');
  for(const passo of passos) {
    vm.runInContext(passo,a.ctx); vm.runInContext(passo,b.ctx);
    assert.equal(b.estado(),a.estado(),passo);
    assert.equal(JSON.stringify(b.log),JSON.stringify(a.log),passo);
    // basta um passo com marcador na tela: no fim da sequência as categorias estão apagadas
    if(vm.runInContext(`POIS.some(p=>p.el.style.display==='flex'&&!!p.el.style.transform)`,b.ctx))
      apareceu=true;
  }
  assert.ok(apareceu,'algum marcador foi colocado na tela durante a sequência');
  assert.ok(a.log.some(l=>l[0]==='conta'),'a coluna conta por raio');
  assert.ok(a.log.some(l=>l[0]==='volta'),'nBack chama quem abriu');
});

test('the nearby column counts by radius and starts with every category off',()=>{
  const f=fixture(true);
  vm.runInContext(`api.abrePerto({x:50,z:-20,nome:'Monte'})`,f.ctx);
  const ligadas=vm.runInContext('Object.values(api.catOn).filter(Boolean).length',f.ctx);
  assert.equal(ligadas,0,'todas apagadas ao abrir');
  // 4 dos 5 POIs estão dentro de 1 km de (50,-20) — o de (5000,5000) fica fora
  assert.match(f.node('nSub').textContent,/^4 estabelecimentos a menos de 1 km de Monte\./);
  // os <b> de contagem: um por chip da coluna (farmácia 2, mercado 1, hospital 1)
  const contagens=f.node('nList').children.map(c=>Number(c.querySelector('b').textContent));
  assert.deepEqual(contagens,[2,1,1],'mais perto primeiro');
});
