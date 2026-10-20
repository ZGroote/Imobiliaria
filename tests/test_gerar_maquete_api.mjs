import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gerarMaquete,criarServidorLeituras} from '../tools/leitura-api.mjs';

const leituraJson=readFileSync(new URL('./fixtures/leitura/v1/exemplo-geometrico.json',import.meta.url),'utf8');
const contexto=JSON.parse(readFileSync(new URL('./fixtures/m1f/contexto-sintetico.json',import.meta.url),'utf8'));
const contextoJson=JSON.stringify(contexto);
const moveisJson=JSON.stringify({_gerado_por:'capturador-2d',moveis:[{tipo:'sofa',p:[2,2],rot:0,w:1.9,h:0.8,d:0.9}]});
const propertyId=contexto.propertyId,agencyId=contexto.agencyId;
const body={leituraJson,contextoJson,moveisJson,propertyId,agencyId};
const origin='http://painel.test';
const db={doc:path=>({get:async()=>({data:()=>path==='users/op'?{active:true,role:'operator'}:
  path==='users/other'?{active:true,role:'agent',agencyId:'outra'}:
  path==='users/gerente'?{active:true,role:'agency_manager',agencyId}:
  path===`properties/${propertyId}`?{agencyId}:undefined})})};
const auth={verifyIdToken:async token=>{if(['op','other','gerente'].includes(token))return{uid:token};throw Error('invalid');}};

async function servidor(t,allowDemo=false){
  const server=criarServidorLeituras({db,auth,origin,allowDemo});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const post=(url,payload,token)=>fetch(url+'/gerar-maquete',{method:'POST',headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(payload)});

test('API transporta contexto e móveis para consumidor real, preservando propriedade',async t=>{
  const url=await servidor(t);
  const r=await post(url,body,'op');
  assert.equal(r.status,200);
  const res=await r.json();
  assert.equal(res.ok,true);
  assert.equal(res.relatorio.entrada.propertyId,propertyId);
  assert.equal(res.relatorio.entrada.agencyId,agencyId);
  assert.equal(res.relatorio.geometria.comodos,8);
  const dados=JSON.parse(res.html.match(/<script id="__imovel" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(dados.empreendimento,contexto.ficha.empreendimento);
  assert.equal(dados.cadastro.planta.moveis.length,1);
  assert.deepEqual(dados.cadastro.planta.moveis[0].p,[2,2]);
});

test('geração exige autenticação, agência autorizada e contexto no modo cadastral',async t=>{
  const url=await servidor(t);
  assert.equal((await post(url,body)).status,401);
  assert.equal((await post(url,body,'other')).status,403);
  assert.equal((await post(url,body,'gerente')).status,403,'a imobiliária só pede: nem o gerente do imóvel gera');
  assert.equal((await post(url,{...body,contextoJson:undefined},'op')).status,422);
  const r=await post(url,{...body,contextoJson:JSON.stringify({...contexto,propertyId:'outro'})},'op');
  assert.equal(r.status,422);
  assert.match((await r.json()).error,/CONTEXTO_DE_OUTRO_IMOVEL/);
  assert.equal((await post(url,{...body,demo:true},'op')).status,403);
});

test('CORS recusa hosts com sufixo falso e outras origens locais',async t=>{
  const url=await servidor(t);
  for(const attacker of ['https://site.web.app.atacante.example','http://localhost:9876','http://192.168.atacante.example']){
    const r=await fetch(url+'/property-readings',{method:'OPTIONS',headers:{origin:attacker}});
    assert.equal(r.status,403);
    assert.equal(r.headers.get('access-control-allow-origin'),null);
  }
  assert.equal((await fetch(url+'/gerar-maquete',{method:'OPTIONS',headers:{origin}})).status,204);
});

test('demo exige opt-in servidor e payload explícito; imóvel demo ainda exige autorização',async t=>{
  const url=await servidor(t,true);
  assert.equal((await post(url,{leituraJson})).status,401);
  assert.equal((await post(url,{leituraJson,demo:true,propertyId,agencyId})).status,401);
  assert.equal((await post(url,{leituraJson,demo:true,propertyId,agencyId},'other')).status,403);
  const ambiguous=await post(url,{leituraJson,demo:true,contextoJson});
  assert.equal(ambiguous.status,422);
  assert.match((await ambiguous.json()).error,/CONTEXTO_INVALIDO/);
  const r=await post(url,{leituraJson,demo:true});
  assert.equal(r.status,200);
  const res=await r.json();
  assert.match(res.html,/Prévia demonstrativa/);
  const dados=JSON.parse(res.html.match(/<script id="__imovel" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(dados.ficha.some(([label])=>['Dormitórios','Vagas','Banheiros'].includes(label)),false);
});

test('gate real recusa JSON ambíguo, móveis desconhecidos e não finitos',async()=>{
  await assert.rejects(gerarMaquete(leituraJson,contextoJson,{demo:true}),/CONTEXTO_INVALIDO/);
  await assert.rejects(gerarMaquete(leituraJson.replace('"revision":','"revision":999,"revision":'),undefined,{demo:true}),/INVALID_JSON/);
  await assert.rejects(gerarMaquete(leituraJson,undefined,{demo:true,moveisJson:JSON.stringify([{tipo:'inexistente',p:[0,0],rot:0,w:1,h:1,d:1}])}),/EDITOR_STATE_INVALIDO/);
  await assert.rejects(gerarMaquete(leituraJson,undefined,{demo:true,moveisJson:'[{"tipo":"sofa","p":[0,0],"rot":0,"w":NaN,"h":1,"d":1}]'}),/INVALID_JSON/);
});
