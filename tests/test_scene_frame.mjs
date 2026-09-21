import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','37eefae:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
// As mesmas trocas da extração: o que o laço NÃO possui vira leitor ou escritor.
const source=app.slice(app.indexOf('function frame(now) {'),app.indexOf('window.__qa = MapDiagnostics'))
  // 27b: o laço passou a enquadrar o mapa de sombra por quadro (no-op com a chave de
  // aparência desligada). O oráculo recebe a MESMA linha, pra provar que o resto não mudou.
  .replace('  governa(now);', '  governa(now);\n  sombraDoQuadro();')
  .replaceAll('reliefAmount','getRelevo()')
  // a chamada dos rótulos usava forma abreviada: nomear os dois campos depois da troca
  .replace('streetLabels.update({camera, W, H, getRelevo(), interior: INT.on, showLab});',
           'streetLabels.update({camera, W, H, reliefAmount: getRelevo(), interior: INT.on, showLab: mostraRotulos()});')
  .replace('if (vegetation.trackTarget()) somSujo = true;','if (vegetation.trackTarget()) sujaContato();')
  .replace('if (somSujo) { refazSombras(); sujaSombra(); }','if (contatoSujo()) { refazSombras(); sujaSombra(); }')
  .replace('renderer.shadowMap.needsUpdate = sombraSuja && (SOMBRA_CIDADE || INT.on);',
           'renderer.shadowMap.needsUpdate = sombraPendente() && (SOMBRA_CIDADE || INT.on);')
  .replace('  sombraSuja = false;','  limpaSombra();')
  .replace('if (urban) urban.flush();','if (getUrban()) getUrban().flush();')
  .replace('if(exteriors)exteriors.update(','if(getExteriors())getExteriors().update(')
  .replace('_cpuMs = performance.now() - t0;','poeCpuMs(performance.now() - t0);')
  .replace('if (!_semRaf) requestAnimationFrame(frame);','if (!semRaf()) requestAnimationFrame(frame);')
  .replace('const W = innerWidth, H = innerHeight;','const W = getWidth(), H = getHeight();');

function fixture(modular) {
  const log=[];
  const el=id=>({id,firstElementChild:{style:{}},style:{}});
  const compass={firstElementChild:{style:{}}};
  const ctx=vm.createContext({console,$:id=>id==='compass'?compass:el(id),
    document:{}, innerWidth:1200, innerHeight:800, getWidth:()=>1200, getHeight:()=>800,
    performance:{now:()=>4242},
    requestAnimationFrame:fn=>{log.push(['agenda']);return 1;},
    SOL_OFF:{x:-520,y:940,z:640}, SOMBRA_CIDADE:true,
    governa:n=>log.push(['governa',n]), ajustaEsferas:()=>log.push(['esferas']),
    resize:()=>log.push(['resize']),
    terrainYCached:(x,z)=>Math.round(x+z), bakePasso:(fila,orc)=>{log.push(['bake',fila.id,orc]);return fila.acaba;},
    interiorFrame:n=>log.push(['interior',n]),
    streetLabels:{update:o=>log.push(['rotulos',o.W,o.H,o.reliefAmount,o.interior,o.showLab])},
    refazPortoes:()=>log.push(['portoes']), refazSombras:()=>log.push(['sombras']),
    updatePois:()=>log.push(['pois']), streamUpdate:f=>log.push(['stream',f]),
    streamPump:()=>log.push(['bomba']), v12Frame:n=>log.push(['ui',n]),
    nevoaDoQuadro:()=>log.push(['nevoa']), pintaPerf:n=>log.push(['medidor',n]),
    sombraDoQuadro:()=>log.push(['enquadra'])});
  vm.runInContext(`var THREE_OK=1;
    var sujaSombra=()=>{ __log(['suja']); sombra=true; };   // como o do app.js
    var camera={position:{setFromSpherical(s){__log(['camPos',s.radius]);return this;},
        add(t){__log(['camSoma',t.x]);return this;},toArray:()=>[1,2,3]},
      lookAt:t=>__log(['olha',t.x]), updateMatrixWorld:()=>__log(['matriz'])};
    var target={x:10,y:0,z:20}, sph={radius:900,theta:0.4,phi:0.9};
    var scene={}, renderer={shadowMap:{needsUpdate:false},render:()=>__log(['render']),
      info:{render:{calls:1}}};
    var sun={position:{set:(x,y,z)=>__log(['sol',x,y,z])},target:{position:{copy:t=>__log(['solAlvo',t.x])}}};
    var CEU={visible:true,position:{copy:p=>__log(['ceu'])}};
    var INT={on:false,voo:null,orbita:false};
    var BAKE={fila:null,orcVoo:9,orcamento:3};
    var risers=[{u:{value:0},t0:0},{u:{value:1},t0:0}];
    var mark={visible:false}, markMat={opacity:0}, fillMat={opacity:0};
    var houseBeacon={visible:false}, houseBeaconMat={opacity:0};
    var alvoSombra={distanceToSquared:t=>__dist,copy:t=>__log(['copiaAlvo',t.x])};
    var vegetation={dirty:false,trackTarget:()=>__track,refresh:()=>__log(['veg'])};
    var urbanMod=null, exteriorMod=null, relevo=0.5, rotulos=true, contato=false, sombra=true,
        cpu=0, travado=false, __dist=0, __track=false;`,ctx);
  ctx.__log=a=>log.push(a);
  const deps=`{THREE:{}, document, $, scene, camera, renderer, target, sph, sun, SOL_OFF,
    SOMBRA_CIDADE, CEU, INT, BAKE, governa, ajustaEsferas, resize, risers, mark, markMat,
    fillMat, houseBeacon, houseBeaconMat, terrainYCached, bakePasso, interiorFrame,
    streetLabels, vegetation, refazPortoes, refazSombras, alvoSombra, updatePois,
    streamUpdate, streamPump, v12Frame, nevoaDoQuadro, pintaPerf, sujaSombra,
    sombraDoQuadro,
    sujaContato:()=>{contato=true;}, contatoSujo:()=>contato,
    sombraPendente:()=>sombra, limpaSombra:()=>{sombra=false;},
    getRelevo:()=>relevo, mostraRotulos:()=>rotulos,
    getUrban:()=>urbanMod, getExteriors:()=>exteriorMod,
    poeCpuMs:v=>{cpu=v;}, semRaf:()=>travado, getWidth, getHeight}`;
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/scene/frame.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.frame=SceneFrame.create(${deps});`,ctx);
  } else {
    vm.runInContext(`var d=${deps};
      var {sujaContato,contatoSujo,sombraPendente,limpaSombra,getRelevo,mostraRotulos,
           getUrban,getExteriors,poeCpuMs,semRaf}=d;`,ctx);
    vm.runInContext(source+'\nglobalThis.frame=frame;',ctx);
  }
  return {ctx,log,
    estado:()=>vm.runInContext(`JSON.stringify([target,sph,markMat.opacity,fillMat.opacity,
      houseBeaconMat.opacity,risers.map(r=>r.u.value),renderer.shadowMap.needsUpdate,
      sombra,contato,cpu,BAKE.fila&&BAKE.fila.id])`,ctx)};
}

const passos=[
  `frame(1000)`,                                        // cidade parada, sem interior
  `mark.visible=true; houseBeacon.visible=true; frame(1500)`,
  `__track=true; frame(2000)`,                          // a vegetação andou: sombra de contato
  `__track=false; vegetation.dirty=true; frame(2500)`,  // malha nova: portões e sombra
  `vegetation.dirty=false; frame(3000)`,
  `__dist=9; frame(3500)`,                              // o alvo andou mais de 1 m
  `relevo=1; frame(4000)`,
  `urbanMod={flush:()=>__log(['flush'])}; exteriorMod={update:(...a)=>__log(['ext',a.length])}; frame(4500)`,
  `BAKE.fila={id:'q1',acaba:false}; frame(5000)`,        // o bake gasta orçamento normal
  `INT.voo={}; frame(5500)`,                             // durante o voo, o triplo
  `INT.voo=null; BAKE.fila={id:'q2',acaba:true}; frame(6000)`,   // terminou: some
  `INT.on=true; frame(6500)`,                            // dentro da casa
  `INT.on=true; INT.orbita=true; frame(7000)`,           // vista de planta: a câmera orbita
  `INT.on=false; INT.orbita=false; rotulos=false; frame(7500)`,
  `travado=true; frame(8000)`,                           // passo manual do QA: não agenda
  `travado=false; CEU.visible=false; frame(8500)`,
];

test('the frame loop order and effects match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  for(const passo of passos) {
    vm.runInContext(passo,a.ctx); vm.runInContext(passo,b.ctx);
    assert.equal(b.estado(),a.estado(),passo);
    assert.equal(JSON.stringify(b.log),JSON.stringify(a.log),passo);
  }
  const ordem=a.log.map(l=>l[0]);
  // governador -> esferas -> tamanho -> prédio subindo suja a sombra -> interior manda na
  // câmera -> fora dele a órbita reposiciona -> sol -> matriz, e só então o que projeta
  assert.deepEqual(ordem.slice(0,10),
    ['governa','enquadra','esferas','resize','suja','interior','camPos','camSoma','olha','sol']);
  assert.ok(ordem.indexOf('matriz')<ordem.indexOf('rotulos'),'a matriz vem antes de projetar rótulo');
  assert.ok(ordem.indexOf('render')>ordem.indexOf('pois'),'desenha depois de decidir o que existe');
  assert.ok(a.log.filter(l=>l[0]==='render').length===passos.length,'um render por quadro');
  assert.equal(a.log.filter(l=>l[0]==='agenda').length,passos.length-1,'o passo travado não agenda');
});

test('the shadow map is only redrawn when something dirtied it',()=>{
  const f=fixture(true);
  // sem prédio subindo: só o que sujar de verdade manda redesenhar
  vm.runInContext('risers.length=0; frame(1000)',f.ctx);
  assert.equal(vm.runInContext('renderer.shadowMap.needsUpdate',f.ctx),true,'a primeira vez está suja');
  vm.runInContext('frame(1500)',f.ctx);
  assert.equal(vm.runInContext('renderer.shadowMap.needsUpdate',f.ctx),false,'parada, não redesenha');
  vm.runInContext('INT.on=true; frame(2000)',f.ctx);
  assert.equal(vm.runInContext('renderer.shadowMap.needsUpdate',f.ctx),true,'dentro da casa, sempre');
});
