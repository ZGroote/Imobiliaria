import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','1899f9d:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
// A ficha entra por leitor no módulo, porque ela nasce depois dele no app.js.
const fim=app.lastIndexOf('/*',app.indexOf('Navegação: botão esquerdo'));
const source=(app.slice(app.indexOf('const HOUSES = (function ()'),app.indexOf('const brl = v =>'))
  +app.slice(app.indexOf('let HOUSE_ATUAL = null;'),fim))
  .replace('const housesBox = $("houses");\n','')
  .replace('  listingSheet.preencheAnuncio(house);','  getSheet().preencheAnuncio(house);');

const ANUNCIOS=[{id:'a1',titulo:'Casa no Centro',bairro:'Centro',preco:450000,tipo:'venda',
    lat:-22.01,lon:-47.89},
  {id:'a2',titulo:'Kitnet',bairro:'Vila',preco:1200,tipo:'aluguel',lat:-22.02,lon:-47.88}];

function fixture(modular,anuncios=ANUNCIOS) {
  const log=[],maquete=[];   // a miniatura (v17) nao existia no original: fica fora do oraculo
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
  const ctx=vm.createContext({console,
    document:{createElement:()=>node('novo-'+(++criados)),
      getElementById:id=>id==='__imoveis'?{textContent:JSON.stringify(anuncios)}:null},
    $:node, px:lon=>Math.round((lon+47.89)*1000), pz:lat=>Math.round(-(lat+22.01)*1000),
    brl:v=>'R$ '+v, ListingModels:{open:id=>log.push(['modelo',id])},
    esc:t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
    getSheet:()=>({preencheAnuncio:h=>log.push(['anuncio',h.id])}),
    closePoiSheet:()=>log.push(['poi']), abrePerto:c=>{log.push(['perto',c.x,c.z,c.nome]);ctx.__volta=c.volta;},
    flyTo:(x,z,r)=>log.push(['voo',x,z,r]),
    // so o endereco do primeiro anuncio tem predio por perto
    predioMaisPerto:(x,z,r)=>(maquete.push(['predio',x,z,r]),x===0&&z===0?{id:'p1'}:null),
    mostraMaquete:(rec,u,dono)=>maquete.push(['mostra',rec.id,u,dono]),
    escondeMaquete:()=>maquete.push(['esconde'])});
  vm.runInContext(`var hsheet=$('hsheet'), usheet=$('usheet'), housesBox=$('houses');
    var houseBeacon={visible:false,position:{set:(x,y,z)=>__log(['farol',x,y,z])}};`,ctx);
  ctx.__log=a=>log.push(a);
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/listings/house-sheet.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`HouseSheet.create({document, $, esc, px, pz, brl, getSheet, ListingModels,
      hsheet, usheet, housesBox, houseBeacon, flyTo, closePoiSheet, abrePerto,
      predioMaisPerto, mostraMaquete, escondeMaquete});`,ctx);
  } else vm.runInContext(source,ctx);
  const clica=id=>{for(const fn of node(id).ouvintes.click||[]) fn({});};
  return {ctx,log,maquete,node,clica,
    estado:()=>JSON.stringify([...el].map(([k,e])=>[k,e.textContent,e.innerHTML,[...e.classList.list],
      e.children.map(f=>f.innerHTML)]))
      +vm.runInContext('JSON.stringify([houseBeacon.visible])',ctx)};
}

test('the public showcase, its sheet, the 3D model and “nearby” match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  assert.equal(b.estado(),a.estado(),'vitrine montada na criação');
  assert.equal(JSON.stringify(b.log),JSON.stringify(a.log),'criação');
  const passos=[
    f=>f.clica('novo-1'),                 // abre o primeiro anúncio: farol, voo e ficha
    f=>f.clica('hModel'),                 // o modelo 3D do anúncio
    f=>f.clica('hPerto'),                 // "o que tem por perto" com a volta guardada
    f=>vm.runInContext('__volta()',f.ctx), // a volta reabre a ficha e refaz o voo
    f=>f.clica('hx'),                     // fecha e apaga o farol
    f=>f.clica('hModel'),                 // o modelo continua sendo o do último aberto
    f=>f.clica('novo-2'),
    f=>f.clica('hModel'),
  ];
  for(const passo of passos) {
    passo(a); passo(b);
    assert.equal(b.estado(),a.estado());
    assert.equal(JSON.stringify(b.log),JSON.stringify(a.log));
  }
  assert.equal(a.node('houses').children.length,2,'um item por anúncio público');
  assert.ok(a.log.filter(l=>l[0]==='voo').length>=3,'abrir, voltar do perto e o segundo anúncio voam');
  assert.deepEqual(JSON.parse(JSON.stringify(a.log.find(l=>l[0]==='voo'))),['voo',0,0,190]);
  // a miniatura sai do predio mais perto do endereco; sem predio, e ao fechar, ela some
  assert.deepEqual(JSON.parse(JSON.stringify(b.maquete)),[['predio',0,0,90],['mostra','p1',null,'hsheet'],
    ['esconde'],['predio',10,10,90],['esconde']]);
});

// O cadastro vem de fora e ninguem revisa titulo por titulo. O item da vitrine e o
// unico ponto do anuncio publico montado por innerHTML -- o resto e textContent.
test('ad text with markup is written as text, not as markup',()=>{
  const f=fixture(true,[{id:'x',titulo:'<img src=x onerror="alert(1)">',
    bairro:'</div><script>alert(2)<\/script>',preco:1,tipo:'venda',lat:-22.01,lon:-47.89}]);
  const item=f.node('houses').children[0].innerHTML;
  assert.ok(!/<img|<script/i.test(item),'nada de tag vinda do cadastro: '+item);
  assert.ok(item.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'),item);
  assert.ok(item.includes('&lt;/div&gt;&lt;script&gt;'),item);
});

test('a city without a public showcase gets an empty one instead of an error',()=>{
  for(const modular of [false,true]) {
    const log=[];
    const ctx=vm.createContext({console,document:{getElementById:()=>({textContent:'nao e json'}),
      createElement:()=>({classList:{add(){},remove(){}},addEventListener(){},style:{}})},
      $:()=>({classList:{add(){},remove(){}},addEventListener(){},children:[],appendChild(){},
        style:{}}),
      px:()=>0,pz:()=>0,brl:v=>''+v,ListingModels:{open(){}},getSheet:()=>({preencheAnuncio(){}}),
      closePoiSheet(){},abrePerto(){},flyTo(){}});
    vm.runInContext(`var hsheet=$(), usheet=$(), housesBox=$();
      var houseBeacon={visible:false,position:{set(){}}};`,ctx);
    if(modular) {
      vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/listings/house-sheet.js',import.meta.url),'utf8'),ctx);
      vm.runInContext(`globalThis.n=HouseSheet.create({document, $, px, pz, brl, getSheet,
        ListingModels, hsheet, usheet, housesBox, houseBeacon, flyTo, closePoiSheet, abrePerto});
        globalThis.total=housesBox.children.length;`,ctx);
    } else vm.runInContext(source+'\nglobalThis.total=HOUSES.length;',ctx);
    assert.equal(vm.runInContext('total',ctx),0);
  }
});
