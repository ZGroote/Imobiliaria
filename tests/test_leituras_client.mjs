import test from 'node:test';
import assert from 'node:assert/strict';
import {requisitarMaquete3D,salvarVersao} from '../painel/src/lib/leituras.ts';

test('prévia envia móveis, contexto e identidade; bearer fica apenas no cabeçalho',async t=>{
  let request;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    request={url,...options,body:JSON.parse(options.body)};
    return {ok:true,json:async()=>({ok:true,html:'<!doctype html><title>Prévia</title>',bytes:42})};
  });
  const response=await requisitarMaquete3D('http://127.0.0.1:5056/property-readings','{"rooms":[]}','{"lote":{}}',
    {moveisJson:'{"moveis":[]}',demo:true,propertyId:'p1',agencyId:'a1',token:'token-local'});
  assert.match(response.html,/Prévia/);
  assert.equal(request.url,'http://127.0.0.1:5056/gerar-maquete');
  assert.equal(request.headers.authorization,'Bearer token-local');
  assert.deepEqual(request.body,{leituraJson:'{"rooms":[]}',contextoJson:'{"lote":{}}',
    moveisJson:'{"moveis":[]}',demo:true,propertyId:'p1',agencyId:'a1'});
});

test('serviço recusado ou HTML vazio não é anunciado como prévia criada',async t=>{
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({ok:true,html:'  '})}));
  await assert.rejects(()=>requisitarMaquete3D('http://127.0.0.1:5056/gerar-maquete','{}'),/prévia vazia/);
  globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Contexto obrigatório.'})});
  await assert.rejects(()=>requisitarMaquete3D('http://127.0.0.1:5056/gerar-maquete','{}'),/Contexto obrigatório/);
});

test('salvar mantém companion completo e o hash confirmado pelo servidor',async t=>{
  let request;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    request=JSON.parse(options.body);
    return {ok:true,json:async()=>({id:'save1',version:2,editorStateSha256:'c'.repeat(64)})};
  });
  const input={saveId:'save1',propertyId:'p1',agencyId:'a1',leituraJson:'{}',editorStateJson:'{"floors":[]}',basedOnVersionId:'save0'};
  assert.deepEqual(await salvarVersao('http://127.0.0.1:5056/property-readings','token',input),
    {id:'save1',version:2,editorStateSha256:'c'.repeat(64)});
  assert.deepEqual(request,input);
});
