import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','aa9269d:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('async function fetchElevation'),app.indexOf('function recomputeAllDy'))
  +app.slice(app.indexOf('// Guarda a grade de elevação'),app.indexOf('let elevLoading'));

const N=5, HALF=2000;
// Uma ladeira com um ponto isolado ruim, que é exatamente o que a mediana existe pra tirar.
const bruto=[...Array(N*N)].map((_,k)=>Math.floor(k/N)*3+(k%N));
bruto[12]=900;

function fixture(modular,{store=new Map(),embutida=null,falhas=0}={}) {
  const log=[];
  let chamada=0;
  const ctx=vm.createContext({console:{error:(...a)=>log.push(['console',a[0]])},
    CENTER:{lat:-22.0175,lon:-47.8908}, MLAT:111132.92, MLON:103200.5, ELEV_N:N, ELEV_HALF:HALF,
    sleep:ms=>{log.push(['sleep',ms]);return Promise.resolve();},
    timed:async(url,ms)=>{
      log.push(['busca',url.length,ms]);
      if(chamada++ < falhas) throw Error('timeout');
      const locs=url.split('locations=')[1].split('|');
      const base=(chamada-1-falhas)*0;   // as amostras vêm da lista global, por índice
      return {ok:true,status:200,json:async()=>({results:locs.map((_,k)=>({elevation:bruto[base+k+log.filter(l=>l[0]==='amostra').length]}))})};
    },
    guarda:{le:k=>{log.push(['le',k]);return store.has(k)?store.get(k):null;},
            grava:(k,v)=>{log.push(['grava',k,v.length]);store.set(k,v);}},
    document:{getElementById:id=>{log.push(['dom',id]);return embutida===null?null:{textContent:embutida};}}});
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/world/elevation.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.api=Elevation.create({document, console, CENTER, MLAT, MLON,
      ELEV_N, ELEV_HALF, timed, sleep, guarda});`,ctx);
  } else vm.runInContext(source+'\nglobalThis.api={fetchElevation,medianGrid,loadElevCache,saveElevCache,ELEV_CACHE_KEY};',ctx);
  return {ctx,log,store};
}

test('median grid, cache key and cache reading match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  const chave=f=>vm.runInContext('api.ELEV_CACHE_KEY',f.ctx);
  assert.equal(chave(b),chave(a));
  assert.equal(chave(b),'elevGrid_v3_-22.0175_-47.8908_5_2000');
  // mediana: tira o ponto isolado sem achatar a ladeira
  const mediana=f=>vm.runInContext(`JSON.stringify(Array.from(api.medianGrid(Float32Array.from(${JSON.stringify(bruto)}),${N},1)))`,f.ctx);
  assert.equal(mediana(b),mediana(a));
  assert.ok(!JSON.parse(mediana(b)).includes(900),'the isolated spike is gone');
  // canto: a janela 2x2 vale [0,1,3,4] e a mediana pega o índice 2 -> 3 (valor = linha*3 + coluna)
  assert.deepEqual(JSON.parse(mediana(b)).slice(0,5),[3,3,4,5,6]);
});

test('cache accepts the embedded grid, the stored grid, and refuses the wrong size',async()=>{
  const certa=JSON.stringify([...Array(N*N)].map((_,k)=>k));
  const casos=[{nome:'embutida',op:{embutida:certa}},
    {nome:'embutida quebrada',op:{embutida:'{'}},
    {nome:'embutida com tamanho errado',op:{embutida:'[1,2,3]'}},
    {nome:'gravada',op:{store:new Map([['elevGrid_v3_-22.0175_-47.8908_5_2000',certa]])}},
    {nome:'gravada com tamanho errado',op:{store:new Map([['elevGrid_v3_-22.0175_-47.8908_5_2000','[1,2]']])}},
    {nome:'vazia',op:{}}];
  for(const c of casos) {
    const a=fixture(false,c.op),b=fixture(true,{...c.op,store:new Map(c.op.store||[])});
    const lido=f=>vm.runInContext('JSON.stringify(api.loadElevCache()&&Array.from(api.loadElevCache()))',f.ctx);
    assert.equal(lido(b),lido(a),c.nome);
    assert.deepEqual(b.log,a.log,c.nome);
  }
  // gravar tolera storage indisponível
  const b=fixture(true,{store:{set(){throw Error('cheio');},has:()=>false,get:()=>null}});
  vm.runInContext(`api.saveElevCache(Float32Array.from([1,2,3]))`,b.ctx);
});

test('the elevation fetch batches, retries once and recentres on the middle sample',async()=>{
  // A malha tem 25 pontos e o lote é de 100: uma requisição só, com uma falha antes.
  for(const falhas of [0,1]) {
    const a=fixture(false,{falhas}),b=fixture(true,{falhas});
    const roda=f=>vm.runInContext(`api.fetchElevation((feito,total)=>globalThis.__p=[feito,total])
      .then(g=>JSON.stringify([Array.from(g),globalThis.__p]))`,f.ctx);
    const [ra,rb]=[await roda(a),await roda(b)];
    assert.equal(rb,ra,'falhas='+falhas);
    const [grade,progresso]=JSON.parse(rb);
    assert.deepEqual(progresso,[0,1]);
    assert.equal(grade[Math.round((N-1)/2)*N+Math.round((N-1)/2)],0,'the centre sample becomes zero');
    assert.deepEqual(b.log.filter(l=>l[0]==='busca').length,1+falhas);
    assert.deepEqual(b.log,a.log);
  }
});
