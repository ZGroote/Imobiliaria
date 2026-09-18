import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','72de68d:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
// O `let poeTipo` sai do trecho: no módulo o slot é o do contexto, escrito pelos acessores.
const source=app.slice(app.indexOf('/* ---- de um clique'),app.indexOf('function paraUV'))
  .replace('let poeTipo = null;\n','');

const MOVEIS={cama:{nome:'Cama',b:[1.4,0.5,1.9],cor:0x8899AA}};
// Duas quadras mescladas: cada vértice carrega o centroide do prédio dele.
function quadra(recs) {
  const pc=[];
  for(const b of recs){let mx=0,mz=0;for(const p of b.r){mx+=p[0];mz+=p[1];}
    pc.push(mx/b.r.length,mz/b.r.length);}
  return {geometry:{userData:{presetCenter:pc}},userData:{recs}};
}
const RECS=[{id:'b1',r:[[0,0],[10,0],[10,10],[0,10]]},{id:'b2',r:[[20,0],[30,0],[30,10],[20,10]]}];

function fixture(modular,hits,dentro=true) {
  const log=[];
  const ctx=vm.createContext({console,MOVEIS,innerWidth:1000,innerHeight:800,
    guarda:{grava:(k,v)=>log.push(['grava',k,v])},
    chaveAncora:id=>'anc:'+id, idDoRegistro:r=>'reg:'+r.id,
    unidadeDoPredio:r=>r.id==='b1'?{id:'u1'}:null,
    abreUnidade:u=>log.push(['abreUnidade',u.id]),
    cancelaEscolha:()=>{log.push(['cancelaEscolha']);vm.runInContext('escolhendo=null',ctx);},
    dentroDaPlanta:()=>dentro, paraUV:(x,z)=>[x/2,z/2],
    alternaLuz:l=>log.push(['luz',l]), luzDoHit:h=>({id:h.object.userData.luz}),
    seleciona:i=>log.push(['seleciona',i]), confirmaMover:()=>log.push(['confirma']),
    pintaCatalogo:()=>log.push(['catalogo']), poeNaCena:m=>log.push(['poe',m.tipo]),
    salvaMoveis:()=>log.push(['salva'])});
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(`var camera=new THREE.PerspectiveCamera(60,1.25,.1,5000);
    camera.position.set(0,40,60); camera.lookAt(new THREE.Vector3(5,0,5)); camera.updateMatrixWorld();
    var gBuild=new THREE.Group(), CORTE={constant:2.5}, urban=null, escolhendo=null;
    var poeTipo=null;
    var MOB={on:true,modo:null,cabe:true};
    var INT={on:true,baseY:0,sel:0,casa:null,plafons:null,chaves:null,moveis:[],
      pl:{ob:{cx:0,cz:0,ux:1,uz:0}}};`,ctx);
  // O raycaster real depende da tela; aqui os alvos vêm de uma lista fixa, igual dos dois lados.
  vm.runInContext(`THREE.Raycaster.prototype.setFromCamera=function(){this.ray.origin.set(4,6,4);
      this.ray.direction.set(0,-1,0).normalize();};
    THREE.Raycaster.prototype.intersectObjects=function(objs){return globalThis.__hits(objs);};`,ctx);
  ctx.__hits=objs=>hits(objs,log);
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/ui/picking.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.api=Picking.create({THREE, camera, gBuild, getUrban:()=>urban,
      guarda, chaveAncora, idDoRegistro, unidadeDoPredio, abreUnidade, cancelaEscolha,
      getEscolhendo:()=>escolhendo, INT, MOB, CORTE, MOVEIS, dentroDaPlanta, paraUV,
      alternaLuz, luzDoHit, seleciona, confirmaMover, pintaCatalogo, poeNaCena, salvaMoveis,
      getPoeTipo:()=>poeTipo, setPoeTipo:v=>{ poeTipo=v; }});`,ctx);
  } else vm.runInContext(source+'\nglobalThis.api={registroDoHit,cliqueNaCidade,abreFicha,cliqueInterior};',ctx);
  return {ctx,log,
    estado:()=>vm.runInContext(`JSON.stringify({tipo:poeTipo,escolhendo,
      moveis:INT.moveis.map(m=>[m.tipo,m.u,m.v,m.rot,m.w,m.d,m.h,m.cor]),
      mob:[MOB.on,MOB.modo]})`,ctx)};
}

const face={a:0}, face2={a:1};
const daCidade=(objs,log)=>{log.push(['intersect',objs.length]);
  return [{object:objs[0],face,point:new THREE.Vector3(4,1,4)}];};
const movelDoObj=(tipo)=>({userData:{movel:{tipo}},geometry:{}});

test('city click, hit-to-record and interior click match the pre-extraction application',()=>{
  const cenarios=[
    // 1. clique no primeiro prédio da quadra: a face 0 devolve b1, que tem cadastro
    {nome:'predio com cadastro',hits:(objs,log)=>{log.push(['inter',objs.length]);
      return [{object:quadra(RECS),face:{a:0},point:{y:1}}];},
     passos:[`api.cliqueNaCidade({clientX:500,clientY:400})`]},
    // 2. face 1 devolve b2, sem cadastro: não abre ficha nenhuma
    {nome:'predio sem cadastro',hits:(objs,log)=>[{object:quadra(RECS),face:{a:1},point:{y:1}}],
     passos:[`api.cliqueNaCidade({clientX:10,clientY:10})`]},
    // 3. escolhendo prédio de uma unidade: grava a âncora em vez de abrir a ficha
    {nome:'trocar predio',hits:(objs,log)=>[{object:quadra(RECS),face:{a:0},point:{y:1}}],
     passos:[`escolhendo={id:'u9'}; api.cliqueNaCidade({clientX:1,clientY:1})`]},
    // 4. nada sob o cursor
    {nome:'vazio',hits:()=>[],passos:[`api.cliqueNaCidade({clientX:1,clientY:1})`]},
    // 5. interruptor: acende e não seleciona
    {nome:'interruptor',hits:()=>[{object:{userData:{luz:'sala'},geometry:{}},point:{y:1.1}}],
     passos:[`api.cliqueInterior({clientX:5,clientY:5})`]},
    // 6. móvel: seleciona; com tipo em espera, põe no chão
    {nome:'movel',hits:()=>[{object:movelDoObj('cama'),point:{y:0.4}}],
     passos:[`api.cliqueInterior({clientX:5,clientY:5})`,
             `poeTipo='cama'; api.cliqueInterior({clientX:5,clientY:5})`,
             `MOB.on=false; api.cliqueInterior({clientX:5,clientY:5})`]},
    // 7. acima do corte o raio não pega nada, e a parede solta a seleção
    {nome:'corte e parede',hits:()=>[{object:movelDoObj('cama'),point:{y:9}},
                                     {object:{userData:{casa:true},geometry:{}},point:{y:1.4}}],
     passos:[`api.cliqueInterior({clientX:5,clientY:5})`]},
    // 8. em "mover", o clique confirma o destino e não seleciona o que está embaixo
    {nome:'mover',hits:()=>[{object:movelDoObj('cama'),point:{y:0.4}}],
     passos:[`MOB.modo='mover'; api.cliqueInterior({clientX:5,clientY:5})`,
             `MOB.cabe=false; api.cliqueInterior({clientX:5,clientY:5})`]},
    // 9. chão vazio: solta a seleção; com tipo em espera, põe o móvel
    {nome:'chao',hits:()=>[],
     passos:[`api.cliqueInterior({clientX:5,clientY:5})`,
             `poeTipo='cama'; api.cliqueInterior({clientX:5,clientY:5})`]},
  ];
  for(const c of cenarios) {
    const a=fixture(false,c.hits),b=fixture(true,c.hits);
    for(const passo of c.passos) {
      vm.runInContext(passo,a.ctx); vm.runInContext(passo,b.ctx);
      assert.equal(b.estado(),a.estado(),c.nome+': '+passo);
      assert.deepEqual(b.log,a.log,c.nome+': '+passo);
    }
  }
  // fora da planta o clique no chão não põe nada
  for(const modular of [false,true]) {
    const f=fixture(modular,()=>[],false);
    vm.runInContext(`poeTipo='cama'; api.cliqueInterior({clientX:5,clientY:5})`,f.ctx);
    assert.equal(JSON.parse(f.estado()).moveis.length,0);
    assert.equal(JSON.parse(f.estado()).tipo,'cama');
  }
});

test('the record index is built once per mesh and keyed by the quantised centroid',()=>{
  const b=fixture(true,()=>[]);
  const r=vm.runInContext(`JSON.stringify((() => {
    const o={geometry:{userData:{presetCenter:[5,5,25,5]}},userData:{recs:${JSON.stringify(RECS)}}};
    const um=api.registroDoHit({object:o,face:{a:0}});
    const dois=api.registroDoHit({object:o,face:{a:1}});
    return [um.id,dois.id,!!o.userData.indice,api.registroDoHit({object:o,face:null})];
  })())`,b.ctx);
  assert.equal(r,JSON.stringify(['b1','b2',true,null]));
});
