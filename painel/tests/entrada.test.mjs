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
import {salvarVersao,listarVersoes,fixarEntrada,bloqueioDaProducao} from '../src/lib/leituras.ts';
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
const imovel=async(id)=>(await db.doc('properties/'+id).get()).data();
const FORA='O imóvel não pertence mais à imobiliária deste pedido.';
// Transfere o imóvel para agB só durante `fn`, e devolve mesmo se `fn` falhar (o seed é do arquivo todo).
async function transferido(id,fn){await db.doc('properties/'+id).update({agencyId:'agB'});try{await fn();}finally{await db.doc('properties/'+id).update({agencyId:'agA'});}}

test('fluxo completo: v1/v2 → fixa v1 → inicia produção → v3 salva não muda o pedido → troca para v3 auditada',async()=>{
  const cor=await token('corA'),op=await entrar('op'),ger=await entrar('gerA');
  await db.doc('requests/entradaColinas').set({agencyId:'agA',requestedBy:'gerA',propertyId:'colinas',title:'Colinas M1-E',
    productionMode:'leve',status:'accepted',createdAt:new Date(),updatedAt:new Date()});
  const v1=await salvar(cor,1,'Sala v1'),v2=await salvar(cor,2,'Sala v2');
  assert.deepEqual([v1.version,v2.version].map(n=>n-v1.version),[0,1]);
  const jobsAntes=(await db.collection('buildJobs').get()).size;

  let r=await pedido(op.db,'entradaColinas');
  assert.match(bloqueioDaProducao(r,await imovel('colinas')),/Fixe a entrada/);  // colinas: fluxo novo
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
  assert.equal(bloqueioDaProducao(r,await imovel('colinas')),undefined);
  // imóvel transferido depois de fixar: tela e regras bloqueiam juntas
  await transferido('colinas',async()=>{
    assert.equal(bloqueioDaProducao(r,await imovel('colinas')),FORA);
    await assert.rejects(mudarStatus(op.db,'op',r,'production'),/permission/i);
  });
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
  const s3=await snapshot(v3.id);
  assert.deepEqual(logs.map(l=>[l.visibility,l.before.readingId,l.before.readingVersion,l.after.readingId,l.after.readingRevision,l.after.contentSha256]),
    [['internal',null,null,v1.id,s1.revision,s1.contentSha256],['internal',v1.id,s1.version,v3.id,s3.revision,s3.contentSha256]]);
  assert.deepEqual(await snapshot(v1.id),s1);                                   // snapshot intacto

  // 14. nada disso cria BuildJob
  assert.equal((await db.collection('buildJobs').get()).size,jobsAntes);
});

test('imóvel legado (pipelineUnitId) inicia sem entrada fixada, mas só na agência do pedido',async()=>{
  const op=await entrar('op');
  await db.doc('requests/entradaCedros').set({agencyId:'agA',requestedBy:'corA',propertyId:'cedros',title:'Cedros legado',
    productionMode:'leve',status:'accepted',createdAt:new Date(),updatedAt:new Date()});
  const r=await pedido(op.db,'entradaCedros');
  await transferido('cedros',async()=>{
    assert.equal(bloqueioDaProducao(r,await imovel('cedros')),FORA);
    await assert.rejects(mudarStatus(op.db,'op',r,'production'),/permission/i);
  });
  assert.equal(bloqueioDaProducao(r,await imovel('cedros')),undefined);
  await mudarStatus(op.db,'op',r,'production');
});

test('bloqueio visual de "Iniciar produção" tem um motivo para cada negação das regras',()=>{
  const r={status:'accepted',agencyId:'agA',propertyId:'p'},novo={agencyId:'agA'},legado={agencyId:'agA',pipelineUnitId:'u'};
  const fixada={...r,productionInput:{readingId:'x'}};
  assert.equal(bloqueioDaProducao({...r,status:'production'},{agencyId:'agB'}),undefined);   // só o início é conferido
  assert.match(bloqueioDaProducao({...r,propertyId:undefined}),/Vincule um imóvel/);
  assert.match(bloqueioDaProducao(r),/Conferindo o imóvel/);
  assert.match(bloqueioDaProducao(r,novo),/Fixe a entrada/);
  assert.equal(bloqueioDaProducao(fixada,novo),undefined);
  assert.equal(bloqueioDaProducao(r,legado),undefined);
  assert.equal(bloqueioDaProducao(fixada,{agencyId:'agB'}),FORA);
  assert.equal(bloqueioDaProducao(r,{...legado,agencyId:'agB'}),FORA);
});
