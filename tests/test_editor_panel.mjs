import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','3e39a13:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const trecho=(de,ate)=>app.slice(app.indexOf(de),app.indexOf(ate));
// As três partes que o módulo reúne, na ordem em que estavam no app.js.
const source=[trecho('function seleciona(i) {','/* ---- entrar e sair'),
  trecho('function pintaCatalogo() {','$("isw").addEventListener'),
  trecho('/* ---- ligar e desligar o modo','\nconst editorPointer =')].join('\n');

const MOVEIS={cama:{nome:'Cama',b:[1.4,0.5,1.9],cor:0x8899AA},sofa:{nome:'Sofá',b:[1.8,0.8,0.9],cor:0x445566}};

function fixture(modular) {
  const log=[];
  const el=new Map();
  const node=id=>{
    if(el.has(id)) return el.get(id);
    const e={id,textContent:'',value:'',hidden:undefined,dataset:{},attrs:{},children:[],
      classList:{list:new Set(),add(c){this.list.add(c);},remove(c){this.list.delete(c);},
        toggle(c,on){const v=on===undefined?!this.list.has(c):!!on;v?this.list.add(c):this.list.delete(c);return v;}},
      setAttribute(k,v){this.attrs[k]=v;},appendChild(f){this.children.push(f);},
      addEventListener(t,fn){this.ouvintes=this.ouvintes||[];this.ouvintes.push([t,fn]);}};
    el.set(id,e); return e;
  };
  let criados=0;
  const ctx=vm.createContext({console,MOVEIS,MOVEL_KEYS:Object.keys(MOVEIS),TOQUE:false,
    document:{createElement:()=>node('btn-'+(++criados))}, $:node,
    atualizaMovel:m=>log.push(['atualiza',m.tipo,m.u,m.v,m.w,m.rot]), salvaMoveis:()=>log.push(['salva']),
    fazGrade:null,   // trocado por uma malha real depois do three, abaixo
    poeSetas:()=>log.push(['setas']), poeFantasma:m=>log.push(['fantasma',m.tipo]),
    tiraFantasma:()=>log.push(['tira-fantasma']), pintaMedidas:()=>log.push(['medidas']),
    registra:(...a)=>log.push(a)});
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(`fazGrade=()=>{registra('grade');const g=new THREE.Mesh(new THREE.BufferGeometry());
      g.geometry.dispose=()=>registra('grade-dispose');return g;};
    var MOB_VERDE=0x5FC777;
    var MOB={on:false,modo:null,grade:null,fantasma:null,arrasto:null,cabe:true,passo:0.10};
    var selBox=new THREE.Mesh(undefined,new THREE.LineBasicMaterial({color:MOB_VERDE}));
    var ipanel=$('ipanel');
    var poeTipo=null;
    var INT={on:true,sel:-1,baseY:9.45,raiz:new THREE.Group(),moveis:[],
      pl:{W:(u,v)=>[u*2,v*2]}};
    function movel(tipo,u,v){return {tipo,u,v,rot:0,w:MOVEIS[tipo].b[0],d:MOVEIS[tipo].b[2],
      h:MOVEIS[tipo].b[1],cor:MOVEIS[tipo].cor,obj:new THREE.Group()};}
    INT.moveis.push(movel('cama',1,2),movel('sofa',3,4));`,ctx);
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/interior/editor-panel.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.api=EditorPanel.create({document, $, INT, MOB, MOB_VERDE, MOVEIS,
      MOVEL_KEYS, TOQUE, selBox, ipanel, atualizaMovel, salvaMoveis, fazGrade, poeSetas,
      poeFantasma, tiraFantasma, pintaMedidas,
      getPoeTipo:()=>poeTipo, setPoeTipo:v=>{ poeTipo=v; }});`,ctx);
  } else vm.runInContext(source+`
    globalThis.api={seleciona,pintaCatalogo,pintaEditor,mexeSel,giraSel,excluiSel,modoMoveis,modo,cancelaGesto,confirmaMover};`,ctx);
  return {ctx,log,
    estado:()=>vm.runInContext(`JSON.stringify({sel:INT.sel,tipo:poeTipo,
      mob:{on:MOB.on,modo:MOB.modo,origem:MOB.origem,arrasto:MOB.arrasto,grade:!!MOB.grade},
      box:[selBox.visible,selBox.position.toArray(),selBox.scale.toArray(),selBox.rotation.y,
           selBox.material.color.getHex()],
      moveis:INT.moveis.map(m=>[m.tipo,m.u,m.v,m.w,m.d,m.h,m.rot,m.cor]),
      filhos:INT.raiz.children.length})`,ctx),
    dom:()=>JSON.stringify([...el].map(([k,e])=>[k,e.textContent,e.value,e.hidden,e.attrs,
      [...e.classList.list],e.children.map(f=>[f.textContent,f.dataset.k,f.attrs])]))};
}

const passos=[
  // catálogo desenhado uma vez, tipo escolhido e desfeito pelo mesmo botão
  `api.pintaCatalogo(); api.pintaCatalogo()`,
  `$('iCat').children[0].ouvintes[0][1](); api.pintaCatalogo()`,
  `$('iCat').children[0].ouvintes[0][1]()`,
  `$('iCat').children[1].ouvintes[0][1]()`,
  // seleção, medidas, giro e exclusão
  `api.seleciona(0)`, `api.pintaEditor()`, `api.mexeSel('w',1.75)`, `api.giraSel()`,
  `api.seleciona(1); api.mexeSel('h',0.95); api.giraSel(); api.giraSel()`,
  `api.excluiSel()`, `api.excluiSel()`,
  // o modo liga a grade e o painel; desligar solta tipo, gesto e seleção
  `INT.moveis.push(movel('cama',5,6)); api.seleciona(0); api.modoMoveis(true)`,
  `api.modo('mover')`, `api.modo('mover')`, `api.modo('medir')`,
  `api.modo('mover'); INT.moveis[0].u=9; api.cancelaGesto()`,
  `api.modo('mover'); INT.moveis[0].u=9; api.confirmaMover()`,
  `api.modo('medir'); api.modo('mover')`,            // trocar de modo cancela o mover
  `api.seleciona(-1); api.modo('mover')`,            // sem móvel não há modo
  `api.modoMoveis(false)`, `api.modoMoveis(true)`,
  `INT.on=false; api.modoMoveis(true)`,              // fora da casa o modo não liga
  `INT.on=true; api.modoMoveis(true); api.seleciona(0); api.modo('mover'); api.modoMoveis(false)`,
];

test('editor panel selection, catalog, measurements and modes match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  for(const passo of passos) {
    vm.runInContext(passo,a.ctx); vm.runInContext(passo,b.ctx);
    assert.equal(b.estado(),a.estado(),passo);
    assert.deepEqual(b.log,a.log,passo);
    assert.equal(b.dom(),a.dom(),passo);
  }
  assert.ok(a.log.length>30,'the oracle must have exercised the whole panel');
});

test('cancelling a move puts the furniture back where the ghost marks',()=>{
  const b=fixture(true);
  vm.runInContext(`api.modoMoveis(true); api.seleciona(0); api.modo('mover');
    INT.moveis[0].u=77; INT.moveis[0].v=88; api.cancelaGesto();`,b.ctx);
  const [[,u,v]]=JSON.parse(b.estado()).moveis;
  assert.deepEqual([u,v],[1,2]);
});
