import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {getApps as clientApps} from 'firebase/app';
import {getAuth as clientAuth} from 'firebase/auth';
import {getAuth} from 'firebase-admin/auth';
import {doc,getDoc,setDoc,updateDoc,deleteDoc} from 'firebase/firestore';
import {adminDb,semear} from '../scripts/seed.mjs';
import {entrar,sairDeTodos} from './apoio.ts';
import {criarServidorLeituras} from '../../tools/leitura-api.mjs';
import {salvarVersao,listarVersoes} from '../src/lib/leituras.ts';
const leituraJson=readFileSync(new URL('../../tests/fixtures/leitura/v1/capturador-aberturas-mobile.json',import.meta.url),'utf8');
let server,url,db;
before(async()=>{
  await semear();db=adminDb();server=criarServidorLeituras({db,auth:getAuth(),origin:'http://painel.test'});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/property-readings`;
});
after(async()=>{await sairDeTodos();await new Promise(r=>server.close(r));});
async function cliente(uid){const c=await entrar(uid);return {...c,token:await clientAuth(clientApps().at(-1)).currentUser.getIdToken()};}
const payload=(extra={})=>({saveId:randomUUID(),propertyId:'cedros',agencyId:'agA',leituraJson,...extra});
const post=(token,data,method='POST')=>fetch(url,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',origin:'http://painel.test'},body:method==='POST'?JSON.stringify(data):undefined});
test('usuário autenticado salva v1, recarrega via lista e salva v2 mantendo v1 intacta',async()=>{
  const c=await cliente('corA'),p=payload();
  const v1=await salvarVersao(url,c.token,p);const original=(await db.doc('propertyReadings/'+v1.id).get()).data();
  const listado=await listarVersoes(c.db,'cedros','agA');assert.equal(listado[0].version,1);
  const next=JSON.parse(leituraJson);next.revision++;next.rooms[0].name='Sala revisada';
  const v2=await salvarVersao(url,c.token,payload({leituraJson:JSON.stringify(next),basedOnVersionId:v1.id}));
  assert.equal(v2.version,2);assert.deepEqual((await db.doc('propertyReadings/'+v1.id).get()).data(),original);
  assert.equal((await listarVersoes(c.db,'cedros','agA')).length,2);
  assert.equal((await post(c.token,p)).status,200);assert.equal((await listarVersoes(c.db,'cedros','agA')).length,2);
  assert.equal((await post(c.token,{...p,leituraJson:JSON.stringify(next)})).status,409);
});
test('outra agência, inativo, sem token, imóvel ausente e agência incompatível não gravam',async()=>{
  const b=await cliente('gerB'),a=await cliente('gerA');
  for(const [token,p] of [[b.token,payload()],[a.token,payload({agencyId:'agB'})],[a.token,payload({propertyId:'ausente'})],['invalido',payload()]])
    assert.ok([401,403].includes((await post(token,p)).status));
  await assert.rejects(listarVersoes(b.db,'cedros','agA'),/permission/i);
  const first=(await db.collection('propertyReadings').limit(1).get()).docs[0];
  await assert.rejects(getDoc(doc(b.db,'propertyReadings',first.id)),/permission/i);
  await db.doc('users/gerA').update({active:false});assert.equal((await post(a.token,payload())).status,403);
  await db.doc('users/gerA').update({active:'true'});assert.equal((await post(a.token,payload())).status,403);
  await db.doc('users/gerA').update({active:true});
});
test('Admin e operador usam a mesma autorização, updates/deletes e writes diretas sempre negados',async()=>{
  for(const uid of ['admin','op','gerA','corA']){
    const c=await cliente(uid),saved=await salvarVersao(url,c.token,payload());
    const ref=doc(c.db,'propertyReadings',saved.id);
    await assert.rejects(updateDoc(ref,{revision:999}),/permission/i);
    await assert.rejects(deleteDoc(ref),/permission/i);
    await assert.rejects(setDoc(doc(c.db,'propertyReadings',randomUUID()),{propertyId:'cedros',agencyId:'agA',leitura:JSON.parse(leituraJson)}),/permission/i);
    await assert.rejects(setDoc(doc(c.db,'propertyReadingCounters','cedros'),{version:0}),/permission/i);
  }
});
test('documento inválido não chega ao Firestore; campos de autoridade não vêm do cliente',async()=>{
  const c=await cliente('corA'),before=(await db.collection('propertyReadings').get()).size;
  const bad=JSON.parse(leituraJson);bad.rooms[0].widthMm=-1;
  const r=await post(c.token,payload({leituraJson:JSON.stringify(bad)}));assert.equal(r.status,422);
  assert.equal((await db.collection('propertyReadings').get()).size,before);
  assert.equal((await post(c.token,payload({createdBy:'admin',version:999}))).status,400);
  assert.equal((await post(c.token,payload(),'DELETE')).status,405);
});
test('concorrência gera números únicos e predecessor de outro imóvel é recusado',async()=>{
  const c=await cliente('op');
  const results=await Promise.all([1,2,3].map(()=>salvarVersao(url,c.token,payload())));
  assert.equal(new Set(results.map(v=>v.version)).size,3);
  const other=await salvarVersao(url,c.token,payload({propertyId:'colinas'}));
  assert.equal((await post(c.token,payload({basedOnVersionId:other.id}))).status,403);
});
test('histórico paginado recupera versões antigas sem repetir a fronteira',async()=>{
  const c=await cliente('corA');
  const original=(await db.collection('propertyReadings').where('propertyId','==','colinas').get()).docs[0].data();
  const batch=db.batch();for(let version=2;version<=52;version++) batch.create(db.doc('propertyReadings/page-'+version),{...original,version});
  await batch.commit();
  const first=await listarVersoes(c.db,'colinas','agA'),second=await listarVersoes(c.db,'colinas','agA',first.at(-1).version);
  assert.equal(first.length,50);assert.equal(first[0].version,52);
  assert.deepEqual(second.map(v=>v.version),[2,1]);
});
