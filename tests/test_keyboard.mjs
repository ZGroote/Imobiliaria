import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','f1f6c9f:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('addEventListener("keydown"'),
  app.indexOf('\n',app.indexOf('addEventListener("blur"')))
  .replace('mostraPerf(!perfOn)','mostraPerf(!perfLigado())');

function fixture(modular) {
  const log=[];
  const ouvintes={};
  const ctx=vm.createContext({console,
    addEventListener:(t,fn)=>{(ouvintes[t]=ouvintes[t]||[]).push(fn);},
    mostraPerf:v=>log.push(['medidor',v]), perfLigado:()=>false,
    cancelaGesto:()=>log.push(['cancela']), modoMoveis:v=>log.push(['modo',v]),
    exitInterior:()=>log.push(['sai']), excluiSel:()=>log.push(['exclui']),
    giraSel:()=>log.push(['gira'])});
  vm.runInContext(`var teclas=Object.create(null);
    var INT={on:false}, MOB={on:false,modo:null}, FP={mov:{x:1,z:1}};`,ctx);
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/ui/keyboard.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`Keyboard.create({addEventListener, teclas, INT, MOB, FP, mostraPerf,
      perfLigado, cancelaGesto, modoMoveis, exitInterior, excluiSel, giraSel});`,ctx);
  } else vm.runInContext(source,ctx);
  const dispara=(tipo,ev={})=>{
    const e={preventDefault(){log.push(['default']);},...ev};
    for(const fn of ouvintes[tipo]||[]) fn(e);
  };
  return {ctx,log,dispara,
    estado:()=>vm.runInContext('JSON.stringify([teclas,FP.mov,INT.on,MOB.on,MOB.modo])',ctx)};
}

const passos=[
  // fora da casa: só o medidor responde, e digitar num campo não é atalho
  f=>f.dispara('keydown',{key:'P'}),
  f=>f.dispara('keydown',{key:'p',target:{tagName:'INPUT'}}),
  f=>f.dispara('keydown',{key:'w'}),
  f=>f.dispara('keydown',{key:'Escape'}),
  // dentro da casa: andar, correr, girar a vista, apagar e girar o móvel
  f=>{vm.runInContext('INT.on=true',f.ctx);f.dispara('keydown',{key:'w'});},
  f=>f.dispara('keydown',{key:'ArrowUp',shiftKey:true}),
  f=>f.dispara('keydown',{key:'a'}),f=>f.dispara('keydown',{key:'d'}),
  f=>f.dispara('keydown',{key:'q'}),f=>f.dispara('keydown',{key:'e'}),
  f=>f.dispara('keydown',{key:'s'}),
  f=>f.dispara('keyup',{key:'w'}),f=>f.dispara('keyup',{key:'ArrowLeft'}),
  f=>f.dispara('keyup',{key:'q',shiftKey:true}),
  f=>f.dispara('keydown',{key:'Delete'}),
  f=>f.dispara('keydown',{key:'r'}),
  f=>f.dispara('keydown',{key:'z'}),                    // tecla sem uso: nada
  // Esc em três degraus: gesto, modo, casa
  f=>{vm.runInContext('MOB.on=true;MOB.modo="mover"',f.ctx);f.dispara('keydown',{key:'Escape'});},
  f=>{vm.runInContext('MOB.modo=null',f.ctx);f.dispara('keydown',{key:'Escape'});},
  f=>{vm.runInContext('MOB.on=false',f.ctx);f.dispara('keydown',{key:'Escape'});},
  // perder o foco solta tudo
  f=>{f.dispara('keydown',{key:'w'});f.dispara('keydown',{key:'d'});f.dispara('blur');},
];

test('keyboard shortcuts, walking keys and the blur reset match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  for(const passo of passos) {
    passo(a); passo(b);
    assert.equal(b.estado(),a.estado());
    assert.equal(JSON.stringify(b.log),JSON.stringify(a.log));
  }
  assert.deepEqual(JSON.parse(b.estado())[0],{w:0,s:0,a:0,d:0,q:0,e:0,shift:0},'o blur zera tudo');
  assert.equal(JSON.parse(b.estado())[1].x,0,'e para o manche também');
  assert.equal(a.log.filter(l=>l[0]==='medidor').length,1,'só o P fora de campo alterna o medidor');
});

test('Escape outside the house does nothing, and inside it walks the three steps down',()=>{
  const f=fixture(true);
  f.dispara('keydown',{key:'Escape'});
  assert.equal(f.log.length,0);
  vm.runInContext('INT.on=true;MOB.on=true;MOB.modo="medir"',f.ctx);
  f.dispara('keydown',{key:'Escape'});                 // 1: desfaz o gesto
  vm.runInContext('MOB.modo=null',f.ctx);              // (o cancelaGesto de verdade faz isso)
  f.dispara('keydown',{key:'Escape'});                 // 2: desliga o modo
  vm.runInContext('MOB.on=false',f.ctx);
  f.dispara('keydown',{key:'Escape'});                 // 3: sai da casa
  assert.deepEqual(f.log.map(l=>l[0]),['cancela','modo','sai']);
});
