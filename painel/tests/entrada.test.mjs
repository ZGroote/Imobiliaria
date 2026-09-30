// M1-E: fixar a leitura de entrada da produção, pela API M1-D real (snapshots) e pelas regras
// publicadas (ponteiro + AuditLog). Nenhuma chamada aqui cria BuildJob.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {getApps as clientApps} from 'firebase/app';
import {getAuth as clientAuth} from 'firebase/auth';
import {getAuth} from 'firebase-admin/auth';
import {doc,getDoc} from 'firebase/firestore';
import {adminDb,semear} from '../scripts/seed.mjs';
import {entrar,sairDeTodos} from './apoio.ts';
import {criarServidorLeituras} from '../../tools/leitura-api.mjs';
import {salvarVersao,listarVersoes,fixarEntrada,exigeEntrada} from '../src/lib/leituras.ts';
import {mudarStatus} from '../src/lib/status.ts';

const base=JSON.parse(readFileSync(new URL('../../tests/fixtures/leitura/v1/capturador-aberturas-mobile.json',import.meta.url),'utf8'));
let server,url,db;
before(async()=>{
  await semear();db=adminDb();server=criarServidorLeituras({db,auth:getAuth(),origin:'http://painel.test'});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/property-readings`;
});
after(async()=>{await sairDeTodos();await new Promise(r=>server.close(r));});
async function token(uid){const c=await entrar(uid);return {...c,token:await clientAuth(clientApps().at(-1)).currentUser.getIdToken()};}
const leitura=(revision,nome)=>JSON.stringify({...base,revision,rooms:base.rooms.map((r,i)=>i?r:{...r,name:nome})});
const salvar=(c,revision,nome)=>salvarVersao(url,c.token,{saveId:randomUUID(),propertyId:'colinas',agencyId:'agA',leituraJson:leitura(revision,nome)});
const pedido=async(f,id)=>({id,...(await getDoc(doc(f,'requests',id))).data()});
const snapshot=async(id)=>{const s=(await db.doc('propertyReadings/'+id).get()).data();return {id,...s};};

test('fluxo completo: v1/v2 → fixa v1 → inicia produção → v3 salva não muda o pedido → troca para v3 auditada',async()=>{
  const cor=await token('corA'),op=await entrar('op'),ger=await entrar('gerA');
  await db.doc('requests/entradaColinas').set({agencyId:'agA',requestedBy:'gerA',propertyId:'colinas',title:'Colinas M1-E',
    productionMode:'leve',status:'accepted',createdAt:new Date(),updatedAt:new Date()});
  const v1=await salvar(cor,1,'Sala v1'),v2=await salvar(cor,2,'Sala v2');
  assert.deepEqual([v1.version,v2.version].map(n=>n-v1.version),[0,1]);
  const jobsAntes=(await db.collection('buildJobs').get()).size;

  let r=await pedido(op.db,'entradaColinas');
  assert.equal(exigeEntrada(r,{}),true);                                        // colinas: fluxo novo
  await assert.rejects(mudarStatus(op.db,'op',r,'production'),/permission/i);   // sem entrada não inicia

  // quem lista e escolhe é a equipe, a partir do documento salvo: nada recalculado no navegador
  const lista=await listarVersoes(op.db,'colinas','agA');
  const escolhida=lista.find(x=>x.id===v1.id);
  await assert.rejects(fixarEntrada(ger.db,'gerA',r,escolhida),/permission/i);  // gerente não fixa
  await fixarEntrada(op.db,'op',r,escolhida);
  r=await pedido(op.db,'entradaColinas');
  const s1=await snapshot(v1.id);
  assert.deepEqual(
    [r.productionInput.readingId,r.productionInput.readingVersion,r.productionInput.readingRevision,r.productionInput.schemaVersion,r.productionInput.contentSha256],
    [s1.id,s1.version,s1.revision,s1.schemaVersion,s1.contentSha256]);
  assert.match(s1.contentSha256,/^[0-9a-f]{64}$/);
  assert.equal(exigeEntrada(r,{}),false);
  await mudarStatus(op.db,'op',r,'production');

  // 11. salvar nova versão não mexe no pedido
  const v3=await salvar(cor,3,'Sala v3');
  r=await pedido(op.db,'entradaColinas');
  assert.equal(r.productionInput.readingId,v1.id);

  // 12. trocar em produção: explícito, auditado, histórico preservado
  await fixarEntrada(op.db,'op',r,await snapshot(v3.id));
  r=await pedido(op.db,'entradaColinas');
  assert.deepEqual([r.status,r.productionInput.readingId,r.productionInput.readingVersion],['production',v3.id,v3.version]);
  const logs=(await db.collection('auditLogs').where('entityId','==','entradaColinas').where('action','==','production_input:set').get())
    .docs.map(d=>d.data()).sort((a,b)=>a.after.readingVersion-b.after.readingVersion);
  assert.deepEqual(logs.map(l=>[l.before.readingId,l.after.readingId,l.after.contentSha256]),
    [[null,v1.id,s1.contentSha256],[v1.id,v3.id,(await snapshot(v3.id)).contentSha256]]);
  assert.deepEqual(await snapshot(v1.id),s1);                                   // snapshot intacto

  // 14. nada disso cria BuildJob
  assert.equal((await db.collection('buildJobs').get()).size,jobsAntes);
});

test('imóvel legado (pipelineUnitId) segue iniciando produção sem entrada fixada',async()=>{
  const op=await entrar('op');
  await db.doc('requests/entradaCedros').set({agencyId:'agA',requestedBy:'corA',propertyId:'cedros',title:'Cedros legado',
    productionMode:'leve',status:'accepted',createdAt:new Date(),updatedAt:new Date()});
  const r=await pedido(op.db,'entradaCedros');
  assert.equal(exigeEntrada(r,{pipelineUnitId:'monte-dos-cedros-37'}),false);
  await mudarStatus(op.db,'op',r,'production');
});
