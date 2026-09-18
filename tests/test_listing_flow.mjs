import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','13aeb8c:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
// No app.js a ficha nascia no meio deste trecho; no módulo ela entra injetada.
const source=app.slice(app.indexOf('const iaviso = $("iaviso");'),app.indexOf('/* ---- geometria fixa da casa'))
  .replace('const usheet = $("usheet");\n','')
  .replace(/const listingSheet = ListingSheet[^;]+;\n/,'')
  .replace('  UNID_ATUAL = u;\n','').replace('let UNID_ATUAL = null;\n','')
  .replace('if (!gGroups.length) {','if (!getGroups().length) {');

const planta={comodos:[{nome:'Sala'}]};
const UNIDADES=[
  {id:'com-predio',planta,ficha:{empreendimento:'Monte',bairro:'Centro',preco:450000,tipo:'venda'},
   andar:3,ancora:{confirmado:true}},
  {id:'em-lote',planta,ficha:{titulo:'Casa',bairro:'Jardim',preco:2500,tipo:'aluguel'},
   lote:{lat:-22,lon:-47,confirmado:false}},
  {id:'sem-ancora',planta,ficha:{empreendimento:'Sem'}},
  {id:'_exemplo',planta,ficha:{}},               // gabarito: não entra na vitrine
  {id:'sem-planta',ficha:{}}];

function fixture(modular,{grupos=3}={}) {
  const log=[];
  const el=new Map();
  const node=id=>{
    if(el.has(id)) return el.get(id);
    const e={id,textContent:'',innerHTML:'',type:'',className:'',dataset:{},children:[],ouvintes:{},
      classList:{list:new Set(),add(c){this.list.add(c);},remove(c){this.list.delete(c);},
        contains(c){return this.list.has(c);}},
      addEventListener(t,fn){(this.ouvintes[t]=this.ouvintes[t]||[]).push(fn);},
      appendChild(f){this.children.push(f);}};
    el.set(id,e); return e;
  };
  let criados=0;
  const ctx=vm.createContext({console,UNIDADES,
    document:{createElement:()=>node('novo-'+(++criados))}, $:node,
    esc:t=>String(t), brl:v=>'R$ '+v,
    listingSheet:{preenche:(u,c)=>log.push(['preenche',u.id,c])},
    predioDaUnidade:u=>u.id==='com-predio'?{rec:{r:[[0,0],[10,0],[10,10],[0,10]]},confirmado:true}
      :u.id==='em-lote'?{lote:{x:70,z:80},confirmado:false}:null,
    closePoiSheet:()=>log.push(['poi']), abrePerto:c=>log.push(['perto',c.x,c.z,c.nome]),
    enterInterior:(rec,u)=>log.push(['entra',u&&u.id]),
    streamUpdate:f=>log.push(['stream',f]), flyTo:(x,z,r)=>log.push(['voo',x,z,r]),
    setTimeout:(fn,ms)=>{log.push(['espera',ms]);return 1;},
    getGroups:()=>({length:grupos})});
  vm.runInContext(`var target={set:(x,y,z)=>__log(['alvo',x,y,z])};
    var houseBeacon={visible:false,position:{set:(x,y,z)=>__log(['farol',x,y,z])}};
    var usheet=$('usheet'), hsheet=$('hsheet'), housesBox=$('houses');
    var gGroups={length:${grupos}};`,ctx);
  ctx.__log=a=>log.push(a);
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/listings/flow.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.api=ListingFlow.create({document, $, esc, brl, UNIDADES, listingSheet,
      usheet, hsheet, housesBox, houseBeacon, target, streamUpdate, flyTo, getGroups,
      predioDaUnidade, closePoiSheet, abrePerto, enterInterior, setTimeout});`,ctx);
  } else vm.runInContext(source+'\nglobalThis.api={pedePredio,cancelaEscolha,abreUnidade,getEscolhendo:()=>escolhendo};',ctx);
  const clica=(id,tipo='click')=>{for(const fn of node(id).ouvintes[tipo]||[]) fn({});};
  return {ctx,log,node,clica,
    estado:()=>JSON.stringify([...el].map(([k,e])=>[k,e.textContent,[...e.classList.list],
      e.dataset.unidade,e.innerHTML.length,e.children.map(f=>[f.dataset.unidade,f.innerHTML])]))
      +vm.runInContext('JSON.stringify([houseBeacon.visible,api.getEscolhendo()&&api.getEscolhendo().id])',ctx)};
}

test('showcase, unit opening, sheet and “choose the building” match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  const passos=[
    // a vitrine nasce na criação: 3 itens (gabarito e unidade sem planta ficam de fora)
    f=>f.log.push(['vitrine',f.node('houses').children.length]),
    f=>f.clica('novo-1'),                       // unidade com prédio: voa e abre a ficha
    f=>f.clica('ux'),                           // fecha a ficha e apaga o farol
    f=>f.clica('novo-2'),                       // unidade em lote: o alvo é o terreno
    f=>f.clica('uEnter'),                       // botão da visita 3D
    f=>f.clica('uPerto'),                       // "o que tem por perto" guarda a volta
    f=>f.clica('novo-3'),                       // sem âncora: pede pra apontar o prédio
    f=>f.clica('iavisoX'),                      // desistir da escolha
    f=>vm.runInContext(`api.pedePredio({id:'x',ficha:{empreendimento:'Y'}},'Texto proprio')`,f.ctx),
    f=>vm.runInContext('api.cancelaEscolha()',f.ctx),
    f=>f.clica('uEnter'),                       // depois de fechar, ainda entra na última ficha
  ];
  for(const passo of passos) {
    passo(a); passo(b);
    assert.equal(b.estado(),a.estado());
    assert.equal(JSON.stringify(b.log),JSON.stringify(a.log));
  }
  assert.ok(a.log.some(l=>l[0]==='voo'&&l[3]===190),'the sheet flight is the 190 m one');
  assert.ok(a.log.some(l=>l[0]==='farol'&&l[1]===70),'a unit on a plot targets the plot itself');
});

test('clicking a listing before the city arrives waits instead of asking for the building',()=>{
  const a=fixture(false,{grupos:0}),b=fixture(true,{grupos:0});
  for(const f of [a,b]) vm.runInContext(`api.abreUnidade({id:'com-predio'})`,f.ctx);
  assert.equal(JSON.stringify(b.log),JSON.stringify(a.log));
  assert.equal(JSON.stringify(b.log.at(-1)),JSON.stringify(['espera',400]));
  // na quadragésima tentativa desiste e pede o prédio
  for(const f of [a,b]) vm.runInContext(`api.abreUnidade({id:'com-predio'},40)`,f.ctx);
  assert.equal(JSON.stringify(b.log),JSON.stringify(a.log));
  assert.equal(b.node('iavisoT').textContent,a.node('iavisoT').textContent);
  assert.match(b.node('iavisoT').textContent,/cidade ainda nao carregou/);
});
