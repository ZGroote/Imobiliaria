import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function page(compact){
  const el=()=>{const c=new Set(),h={};return {inert:false,attrs:{},h,
    classList:{contains:k=>c.has(k),add:k=>c.add(k),remove:k=>c.delete(k)},
    setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){h[k]=f;}};};
  const els={};const $=id=>els[id]||(els[id]=el());
  const media={matches:compact,addEventListener(k,f){media.change=f;}};
  const observed=[];
  const document={body:el()};document.body.dataset={};
  const ctx=vm.createContext({document,matchMedia:q=>{assert.equal(q,'(max-width:820px)');return media;},
    MutationObserver:class{constructor(f){this.f=f;}observe(e,o){observed.push([e,o]);}}});
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/ui/mobile-tabs.js',import.meta.url),'utf8'),ctx);
  const perto={on:false};let fechou=0;
  const tabs=ctx.MobileTabs.create({$,perto,fechaTudo:()=>fechou++});
  return {$,document,media,observed,perto,tabs,fechados:()=>fechou};
}

test('tabs toggle, close sheets first and mark only the active area interactive on compact screens',()=>{
  const {$,document,observed,tabs,fechados}=page(true);
  assert.equal(document.body.dataset.mobile,'mapa');assert.equal(observed.length,6);
  assert.equal($('houses').inert,true);assert.equal($('panel').inert,true);assert.equal($('usheet').inert,true);
  $('mImoveis').h.click();
  assert.equal(fechados(),1);assert.equal(document.body.dataset.mobile,'imoveis');
  assert.equal($('mImoveis').attrs['aria-expanded'],'true');assert.equal($('mMapa').attrs['aria-pressed'],'false');
  assert.equal($('houses').inert,false);assert.equal($('panel').inert,true);
  $('mImoveis').h.click();assert.equal(document.body.dataset.mobile,'mapa');
  $('mOpcoes').h.click();assert.equal($('panel').inert,false);
  $('usheet').classList.add('on');tabs.atualizaMobile();
  assert.equal(document.body.dataset.mobile,'mapa');assert.equal($('usheet').inert,false);
});

test('wide screens keep lists interactive; inside a home or nearby mode the map tab wins',()=>{
  const {$,document,media,perto,tabs}=page(false);
  assert.equal($('houses').inert,false);assert.equal($('panel').inert,false);
  $('mOpcoes').h.click();assert.equal(document.body.dataset.mobile,'opcoes');
  perto.on=true;tabs.atualizaMobile();assert.equal(document.body.dataset.mobile,'mapa');
  perto.on=false;$('mOpcoes').h.click();document.body.classList.add('dentro');media.matches=true;media.change();
  assert.equal(document.body.dataset.mobile,'mapa');assert.equal($('panel').inert,true);
});
