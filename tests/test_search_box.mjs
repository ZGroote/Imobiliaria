import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','d277e52:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('bq.addEventListener("focus", () => document.body'),
  app.indexOf('// Link de posicao na URL'));

const ACHADOS={
  rua:[{k:'rua',n:'Rua B',s:'via',x:10,z:20},{k:'rua',n:'Rua C',s:'via',x:30,z:40,cor:'#123456'}],
  poi:[{k:'poi',n:'Padaria',s:'padaria',x:5,z:6,poi:{id:'p1'}}],
  nada:[]};

function fixture(modular) {
  const log=[];
  const campo=(id)=>({id,value:'',hidden:true,innerHTML:'',ouvintes:{},
    addEventListener(t,fn){(this.ouvintes[t]=this.ouvintes[t]||[]).push(fn);},
    blur(){log.push(['blur',this.id]);}});
  const bq=campo('bq'), bres=campo('bres');
  const janela=[];
  const ctx=vm.createContext({console,bq,bres,
    document:{body:{classList:{add:c=>log.push(['classe+',c]),remove:c=>log.push(['classe-',c])}}},
    addEventListener:(t,fn,cap)=>janela.push([t,fn,cap]),
    esc:t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
    buscaAgora:q=>{log.push(['busca',q]);return ACHADOS[q.trim()]||[];},
    INT:{on:false}, saiSeco:()=>log.push(['saiSeco']),
    openPoiSheet:p=>log.push(['poi',p.id]), aim:a=>log.push(['aim',a.x,a.z]),
    flyTo:(x,z,r)=>log.push(['voo',x,z,r]), sph:{radius:900}, frameLoop:()=>log.push(['laco'])});
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/ui/search-box.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.api=SearchBox.create({document, addEventListener, bq, bres, esc,
      buscaAgora, INT, saiSeco, openPoiSheet, aim, flyTo, sph, frameLoop});`,ctx);
  } else vm.runInContext(source+'\nglobalThis.api={pintaBusca,vaiPara};',ctx);
  const dispara=(el,tipo,ev={})=>{const e={type:tipo,preventDefault(){log.push(['default']);},
    stopPropagation(){log.push(['parou',tipo]);},target:el,...ev};
    for(const fn of el.ouvintes[tipo]||[]) fn(e);};
  return {ctx,log,bq,bres,janela,dispara,
    estado:()=>JSON.stringify([bq.value,bres.hidden,bres.innerHTML])};
}

function roda(f) {
  const {bq,bres,dispara}=f;
  bq.value='rua'; dispara(bq,'input');
  dispara(bq,'keydown',{key:'ArrowDown'});
  dispara(bq,'keydown',{key:'ArrowDown'});
  dispara(bq,'keydown',{key:'ArrowUp'});
  dispara(bq,'keydown',{key:'Enter'});           // vai pro selecionado
  bq.value='poi'; dispara(bq,'input');
  dispara(bq,'keydown',{key:'Enter'});           // POI abre a ficha, não voa
  bq.value='nada'; dispara(bq,'input');          // 4 letras, nada achado
  dispara(bq,'keydown',{key:'Enter'});           // Enter com lista vazia
  bq.value='n'; dispara(bq,'input');             // 1 letra: nem a frase de vazio
  dispara(bq,'keydown',{key:'Escape'});
  dispara(bq,'focus'); dispara(bq,'blur');
  bq.value='rua'; dispara(bq,'input'); dispara(bq,'focus');
  dispara(bres,'click',{target:{closest:sel=>sel==='.bi'?{dataset:{i:'1'}}:null}});
  dispara(bres,'click',{target:{closest:()=>null}});
  dispara(bq,'keyup',{key:'a'});
  // de dentro da casa, a busca sai antes de voar
  vm.runInContext('INT.on=true',f.ctx);
  bq.value='rua'; dispara(bq,'input'); dispara(bq,'keydown',{key:'Enter'});
  // o clique fora fecha a lista; dentro da busca, não
  for(const [t,fn] of f.janela) if(t==='pointerdown') {
    bres.hidden=false; fn({target:{closest:()=>null}});
    f.log.push(['fora',bres.hidden]);
    bres.hidden=false; fn({target:{closest:()=>({})}});
    f.log.push(['dentro',bres.hidden]);
  }
}

test('search box listing, keyboard, click and flight match the pre-extraction application',()=>{
  const a=fixture(false),b=fixture(true);
  roda(a); roda(b);
  assert.equal(b.estado(),a.estado());
  assert.deepEqual(b.log,a.log);
  assert.equal(b.janela.length,a.janela.length);
  assert.ok(a.log.some(l=>l[0]==='saiSeco'),'searching from inside must leave the house');
  assert.ok(a.log.some(l=>l[0]==='poi'),'a POI result opens the sheet instead of flying');
  assert.ok(a.log.filter(l=>l[0]==='voo').length>=2,'a place result flies');
});

test('the flight radius is clamped between 180 and 420 metres',()=>{
  for(const [raio,esperado] of [[50,180],[300,300],[9000,420]]) {
    const f=fixture(true);
    vm.runInContext('sph.radius='+raio,f.ctx);
    f.bq.value='rua'; f.dispara(f.bq,'input'); f.dispara(f.bq,'keydown',{key:'Enter'});
    assert.deepEqual(f.log.find(l=>l[0]==='voo'),['voo',10,20,esperado]);
  }
});
