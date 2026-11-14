import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('./maquete-liv-ipanema.html',import.meta.url),'utf8');
const route='/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html';
function open(address){
  const current=new URL(address),destinations=[];
  const location={protocol:current.protocol,pathname:current.pathname,search:current.search,hash:current.hash,
    replace:destination=>destinations.push(destination)};
  // Classic scripts run for file:// pages even when ES modules are blocked.
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!/\b(?:src|type)\s*=/.test(match[1]))vm.runInNewContext(match[2],{location,URL});
  }
  return destinations;
}

test('abrir o HTML do projeto pelo arquivo encaminha para a prévia HTTP',()=>{
  assert.deepEqual(open(`file:///C:/Users/respawn/Desktop/imobiliaria${route}`),[
    `http://127.0.0.1:8790${route}`]);
});

test('abertura pelo arquivo conserva opções e âncora do visualizador',()=>{
  const options='?geometria=entrada&unidades=edificio&backend=webgl#stage';
  assert.deepEqual(open(`file:///C:/Users/Nome%20com%20espa%C3%A7o/projeto${route}${options}`),[
    `http://127.0.0.1:8790${route}${options}`]);
});

test('HTTP e cópias de entrega conservam seu endereço',()=>{
  assert.deepEqual(open(`http://127.0.0.1:8790${route}`),[]);
  assert.deepEqual(open(`https://exemplo.test${route}`),[]);
  assert.deepEqual(open('file:///C:/pacote/site/maquete-liv-ipanema.html'),[]);
});
