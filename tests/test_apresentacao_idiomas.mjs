import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../experimentos/apresentacao-2026-11-01/site/idiomas.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup({lang='pt-BR',href='https://conectaimoveis3d.com.br/',saved=null,region={country:null,locale:'en'},blocked=false,fail=false}={}){
  class Element {
    constructor(){this.attrs={};this.listeners={};this.dataset={};this.hidden=true;this.textContent='';this.children={};}
    setAttribute(name,value){this.attrs[name]=value;}
    removeAttribute(name){delete this.attrs[name];}
    addEventListener(type,callback){this.listeners[type]=callback;}
    querySelector(name){return this.children[name]??=new Element();}
    click(){this.listeners.click?.();}
  }
  const links=['pt-BR','en'].map(id=>Object.assign(new Element(),{dataset:{idioma:id}}));
  const box=new Element(),writes=[];let requests=0;
  const window={};
  const document={documentElement:{lang},querySelectorAll:()=>links,querySelector:()=>box};
  runInNewContext(source,{window,document,location:{href},URL,AbortController,
    localStorage:{getItem(){if(blocked)throw Error('blocked');return saved;},setItem(key,value){if(blocked)throw Error('blocked');writes.push([key,value]);}},
    fetch(){requests++;return fail?Promise.reject(Error('offline')):Promise.resolve({ok:true,json:async()=>region});},
    setTimeout:()=>1,clearTimeout(){}});
  return {api:window.ConectaIdiomas,links,box,writes,requests:()=>requests};
}

test('links de idioma usam somente os domínios fixos e conservam a seção',()=>{
  const f=setup();
  assert.equal(f.api.languageUrl('en','https://conectaimoveis3d.com.br/?next=https://outro.example/#duvidas'),
    'https://conectaimoveis3d.com/?lang=en#duvidas');
  assert.equal(f.api.languageUrl('pt-BR','https://conectaimoveis3d.com/?lang=en#explorar'),
    'https://conectaimoveis3d.com.br/?lang=pt-BR#explorar');
  assert.throws(()=>f.api.languageUrl('https://outro.example/','https://conectaimoveis3d.com/'));
  assert.equal(f.api.languageUrl('en','http://127.0.0.1:8783/index.html#duvidas'),
    'http://127.0.0.1:8783/index.en.html?lang=en#duvidas');
});

test('a escolha explícita prevalece sobre país e preferência antiga',async()=>{
  const f=setup({lang:'en',href:'https://conectaimoveis3d.com/?lang=en',saved:'pt-BR',region:{country:'BR',locale:'pt-BR'}});
  await flush();
  assert.equal(f.requests(),0);assert.equal(f.box.hidden,true);
  assert.equal(f.links[1].attrs['aria-current'],'page');
  assert.equal(f.links[0].attrs['aria-current'],undefined);
  assert.equal(f.writes.at(-1)[1],'en');
});

test('o país gera sugestão dispensável e a preferência permanece disponível',async()=>{
  const f=setup({lang:'en',href:'https://conectaimoveis3d.com/',region:{country:'BR',locale:'pt-BR'}});
  await flush();assert.equal(f.box.hidden,false);
  assert.equal(f.box.lang,'pt-BR');
  assert.equal(f.box.querySelector('a').href,'https://conectaimoveis3d.com.br/?lang=pt-BR');
  f.box.querySelector('button').click();
  assert.equal(f.box.hidden,true);assert.equal(f.writes.at(-1)[1],'en');
  f.links[0].click();assert.equal(f.writes.at(-1)[1],'pt-BR');
});

test('rede ou armazenamento indisponível não impedem o seletor',async()=>{
  const f=setup({blocked:true,fail:true});await flush();
  assert.equal(f.box.hidden,true);
  assert.doesNotThrow(()=>f.links[1].click());
  assert.equal(f.links[1].href,'https://conectaimoveis3d.com/?lang=en');
});
