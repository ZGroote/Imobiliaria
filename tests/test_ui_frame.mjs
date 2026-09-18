import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','f4260af:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('let _v12Int = false'),app.indexOf('function frame(now)'));

function fixture(modular) {
  const log=[];
  const el=new Map();
  const node=id=>{
    if(el.has(id)) return el.get(id);
    el.set(id,{id,hidden:undefined,title:''}); return el.get(id);
  };
  const ctx=vm.createContext({console,$:node,
    aplicaNoite:()=>log.push(['noite']), frameLoop:()=>log.push(['laco']),
    escreveLink:()=>log.push(['link']), desenhaMinimapa:()=>log.push(['mapa']),
    desenhaPlantaMini:()=>log.push(['planta'])});
  vm.runInContext(`var INT={on:false}, FP={pos:{x:0,z:0},yaw:0};
    var NOITE={on:false,t:0}, MM={on:true,pronto:true,ax:1e9,az:0,ath:0,ar:0,px:1e9,pz:0,pyaw:0};
    var target={x:0,z:0}, sph={theta:0,radius:900};
    var _linkT=0;`,ctx);
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/ui/frame.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.passo=UiFrame.create({$, INT, FP, NOITE, MM, target, sph,
      aplicaNoite, frameLoop, escreveLink, desenhaMinimapa, desenhaPlantaMini});`,ctx);
  } else vm.runInContext(source+'\nglobalThis.passo=v12Frame;',ctx);
  return {ctx,log,node,
    estado:()=>JSON.stringify([...el].map(([k,e])=>[k,e.hidden,e.title]))
      +vm.runInContext('JSON.stringify([NOITE.t,MM.ax,MM.px,MM.ath,MM.ar,MM.pyaw])',ctx)};
}

const passos=[
  `passo(1000)`,                                    // primeiro quadro: dt=0
  `passo(1100)`,                                    // minimapa já desenhado, nada muda
  `target.x=40; passo(1200)`,                       // a órbita andou: redesenha
  `sph.radius=500; passo(1300)`,
  `passo(2400)`,                                    // passou 1 s do último link
  `NOITE.on=true; passo(2500)`,                     // transição pelo relógio
  `passo(2600)`, `passo(3000)`, `passo(9000)`,       // o teto de 400 ms segura o salto
  `passo(9400)`, `passo(9800)`, `passo(10200)`,
  `NOITE.on=false; passo(10600)`,                   // volta ao dia pelo mesmo caminho
  `passo(11000)`, `passo(11400)`, `passo(11800)`, `passo(12200)`,
  `INT.on=true; passo(12600)`,                      // entrou: minimapa vira planta
  `FP.pos.x=2; passo(12700)`,                       // andou: redesenha a planta
  `FP.yaw=0.5; passo(12800)`,
  `passo(12900)`,                                   // parado: não redesenha
  `INT.on=false; passo(13000)`,                     // saiu: a noite volta e o mapa também
  `MM.on=false; target.x=90; passo(14100)`,         // minimapa desligado: nada a desenhar
];

test('the per-frame UI step (night, URL link, minimap) matches the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  for(const passo of passos) {
    vm.runInContext(passo,a.ctx); vm.runInContext(passo,b.ctx);
    assert.equal(b.estado(),a.estado(),passo);
    assert.equal(JSON.stringify(b.log),JSON.stringify(a.log),passo);
  }
  assert.ok(a.log.filter(l=>l[0]==='link').length>=2,'o link é reescrito uma vez por segundo');
  assert.ok(a.log.some(l=>l[0]==='planta'),'dentro da casa o minimapa desenha a planta');
  assert.equal(JSON.parse(b.estado().slice(b.estado().indexOf('][')+1))[0],0,'a noite voltou a zero');
});

test('the night transition walks by the clock, capped at 400 ms per frame',()=>{
  const f=fixture(true);
  vm.runInContext('NOITE.on=true; passo(1000)',f.ctx);
  // 400 ms de teto sobre 700 ms de transição: 0,571 por quadro, nunca mais que isso
  vm.runInContext('passo(60000)',f.ctx);
  assert.equal(Number(vm.runInContext('NOITE.t',f.ctx).toFixed(3)),0.571);
  vm.runInContext('passo(60350)',f.ctx);
  assert.equal(Number(vm.runInContext('NOITE.t',f.ctx).toFixed(3)),1);
});
