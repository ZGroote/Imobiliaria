// Testes das Security Rules (firebase/firestore.rules e firebase/storage.rules), no emulator.
//
//   npm run test:regras
//
// O emulator precisa do JDK 21 no PATH. Nesta máquina ele é portátil, fora do PATH:
//   JAVA_HOME="$HOME/.jdks/jdk-21.0.12.1+1" PATH="$HOME/.jdks/jdk-21.0.12.1+1/bin:$PATH" npm run test:regras
//
// `demo-` no projeto: o emulator nunca fala com o Firebase de verdade.
// As agências A e B são fictícias (D6): nenhum nome de imobiliária real aqui.
import { test, before, beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, writeBatch,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

const aqui = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const T = Timestamp.fromMillis(1_790_000_000_000);
const BUILD = 'a1b2c3d4e5f6';
const PREVIEW = {
  build: BUILD,
  tourUrl: `https://imoveis.example/b/monte-dos-cedros-37/${BUILD}/tour.html`,
  maqueteUrl: `https://imoveis.example/b/monte-dos-cedros-37/${BUILD}/maquete.html`,
};
const pessoa = (role, agencyId, extra = {}) => ({
  name: role, email: '', role, ...(agencyId ? { agencyId } : {}), active: true,
  createdAt: T, updatedAt: T, ...extra,
});
const pedido = (agencyId, requestedBy, status, extra = {}) => ({
  agencyId, requestedBy, title: 'Pedido', status, createdAt: T, updatedAt: T, ...extra,
});

const SEED = {
  'agencies/agA': { name: 'Imobiliária Fictícia A (dev)', active: true, createdAt: T, updatedAt: T },
  'agencies/agB': { name: 'Imobiliária Fictícia B (dev)', active: true, createdAt: T, updatedAt: T },
  'users/admin': pessoa('platform_admin'),
  'users/op': pessoa('operator'),
  'users/gerA': pessoa('agency_manager', 'agA'),
  'users/corA': pessoa('agent', 'agA'),
  'users/corA2': pessoa('agent', 'agA'),
  'users/gerB': pessoa('agency_manager', 'agB'),
  'users/corB': pessoa('agent', 'agB'),
  'users/inativo': pessoa('agent', 'agA', { active: false }),
  'invites/novo@a.test': { email: 'novo@a.test', name: 'Novo', role: 'agent', agencyId: 'agA', createdBy: 'admin', createdAt: T },
  'properties/propA': { agencyId: 'agA', title: 'Cedros', pipelineUnitId: 'monte-dos-cedros-37', status: 'active', createdAt: T, updatedAt: T },
  'properties/propB': { agencyId: 'agB', title: 'Outro', status: 'active', createdAt: T, updatedAt: T },
  'requests/reqA': pedido('agA', 'corA2', 'submitted', { propertyId: 'propA' }),
  'requests/reqB': pedido('agB', 'corB', 'submitted', { propertyId: 'propB' }),
  'requests/revA': pedido('agA', 'corA', 'agency_review', { propertyId: 'propA', preview: PREVIEW }),
  'requests/revB': pedido('agB', 'corB', 'agency_review', { propertyId: 'propB', preview: PREVIEW }),
  'requests/aprA': pedido('agA', 'corA', 'approved', {
    propertyId: 'propA', preview: PREVIEW, approvedBuild: BUILD, approvedBy: 'gerA', approvedAt: T }),
  'requests/reqA/internal/notes': { text: 'nota interna', updatedBy: 'op', updatedAt: T },
  'requestAssets/assetA': { requestId: 'reqA', agencyId: 'agA', type: 'photo', filename: 'a.jpg', storagePath: 'request-assets/agA/reqA/a.jpg', uploadedBy: 'corA', createdAt: T },
  'requestAssets/assetB': { requestId: 'reqB', agencyId: 'agB', type: 'photo', filename: 'b.jpg', storagePath: 'request-assets/agB/reqB/b.jpg', uploadedBy: 'corB', createdAt: T },
  'auditLogs/logA': { agencyId: 'agA', userId: 'op', entityType: 'request', entityId: 'reqA', action: 'status:accepted', visibility: 'agency', timestamp: T },
  'auditLogs/logAint': { agencyId: 'agA', userId: 'op', entityType: 'request', entityId: 'reqA', action: 'build_failed', visibility: 'internal', timestamp: T },
  'auditLogs/logB': { agencyId: 'agB', userId: 'op', entityType: 'request', entityId: 'reqB', action: 'status:accepted', visibility: 'agency', timestamp: T },
  'publications/pubA': { propertyId: 'propA', agencyId: 'agA', action: 'publish', build: '000000000000', publishedBy: 'admin', publishedAt: T },
  'publications/pubB': { propertyId: 'propB', agencyId: 'agB', action: 'publish', build: '000000000000', publishedBy: 'admin', publishedAt: T },
  'buildJobs/jobA': { requestId: 'reqA', propertyId: 'propA', agencyId: 'agA', status: 'failed', errorMessage: 'x', createdBy: 'op', createdAt: T, updatedAt: T },
};

let env;
const as = (uid, token = {}) =>
  env.authenticatedContext(uid, { email: `${uid}@teste.dev`, email_verified: true, ...token });
const db = (uid, token) => as(uid, token).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const now = serverTimestamp;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-painel',
    firestore: { rules: aqui('../firestore.rules') },
    storage: { rules: aqui('../storage.rules') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await Promise.all(Object.entries(SEED).map(([p, v]) => setDoc(doc(f, p), v)));
  });
});
after(() => env.cleanup());

// Mudança de status: request + AuditLog no mesmo batch, como o painel fará.
function mudaStatus(f, uid, rid, status, extra = {}, { agencyId = 'agA', visibility = 'agency' } = {}) {
  const b = writeBatch(f);
  const log = doc(collection(f, 'auditLogs'));
  b.set(log, { agencyId, userId: uid, entityType: 'request', entityId: rid,
               action: 'status:' + status, visibility, timestamp: now() });
  b.update(doc(f, 'requests', rid), { status, lastAuditId: log.id, updatedAt: now(), ...extra });
  return b.commit();
}
// Publicação: pedido -> published (AuditLog) E ponteiro do imóvel (Publication), num batch.
function publica(f, uid, rid, pid, build, pubExtra = {}) {
  const b = writeBatch(f);
  const log = doc(collection(f, 'auditLogs'));
  const pub = doc(collection(f, 'publications'));
  b.set(log, { agencyId: 'agA', userId: uid, entityType: 'request', entityId: rid, action: 'status:published', visibility: 'agency', timestamp: now() });
  b.set(pub, { propertyId: pid, agencyId: 'agA', requestId: rid, action: 'publish', build, publishedBy: uid, publishedAt: now(), ...pubExtra });
  b.update(doc(f, 'requests', rid), { status: 'published', lastAuditId: log.id, updatedAt: now() });
  b.update(doc(f, 'properties', pid), {
    publishedBuild: build, publishedRequestId: rid, publishedAt: now(),
    tourUrl: 'https://imoveis.example/imovel/monte-dos-cedros-37',
    maqueteUrl: 'https://imoveis.example/maquete/monte-dos-cedros-37',
    publicUrl: 'https://imoveis.example/imovel/monte-dos-cedros-37',
    lastPublicationId: pub.id, updatedAt: now(),
  });
  return b.commit();
}

// ── §9: isolamento entre imobiliárias ──

test('1. corretor A não lê nada da imobiliária B', async () => {
  const f = db('corA');
  for (const p of ['requests/reqB', 'properties/propB', 'requestAssets/assetB', 'auditLogs/logB', 'agencies/agB', 'users/corB', 'publications/pubB'])
    await assertFails(getDoc(doc(f, p)));
  await assertFails(getDocs(query(collection(f, 'requests'), where('agencyId', '==', 'agB'))));
  await assertFails(getDocs(collection(f, 'requests')));   // sem filtro de agência: negado inteiro
});

test('1b. D4: corretor A vê pedidos e imóveis de toda a imobiliária A', async () => {
  const f = db('corA');
  await assertSucceeds(getDoc(doc(f, 'requests/reqA')));   // pedido de corA2
  await assertSucceeds(getDocs(query(collection(f, 'requests'), where('agencyId', '==', 'agA'))));
  await assertSucceeds(getDocs(query(collection(f, 'properties'), where('agencyId', '==', 'agA'))));
  await assertSucceeds(getDocs(query(collection(f, 'publications'), where('agencyId', '==', 'agA'))));
});

test('2. gerente A não altera dados de B nem cria em nome de B', async () => {
  const f = db('gerA');
  await assertFails(updateDoc(doc(f, 'requests/reqB'), { title: 'x', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'properties/propB'), { assignedAgentId: 'corA', updatedAt: now() }));
  await assertFails(setDoc(doc(f, 'requests/novo'), pedido('agB', 'gerA', 'submitted', { createdAt: now(), updatedAt: now() })));
  // pedido de A apontando para imóvel de B
  await assertFails(setDoc(doc(f, 'requests/novo'), pedido('agA', 'gerA', 'submitted', { propertyId: 'propB', createdAt: now(), updatedAt: now() })));
  // material em pedido de B, declarado como de A ou como de B
  for (const agencyId of ['agA', 'agB'])
    await assertFails(setDoc(doc(f, 'requestAssets/x'), { requestId: 'reqB', agencyId, type: 'photo', filename: 'x.jpg',
      storagePath: `request-assets/${agencyId}/reqB/x.jpg`, uploadedBy: 'gerA', createdAt: now() }));
});

test('3. comentário/nota interna e log interno invisíveis à imobiliária', async () => {
  for (const uid of ['gerA', 'corA']) {
    const f = db(uid);
    await assertFails(getDoc(doc(f, 'requests/reqA/internal/notes')));
    await assertFails(getDoc(doc(f, 'auditLogs/logAint')));
    await assertFails(getDoc(doc(f, 'invites/novo@a.test')));
    await assertSucceeds(getDoc(doc(f, 'auditLogs/logA')));
    await assertFails(getDocs(query(collection(f, 'auditLogs'), where('agencyId', '==', 'agA'))));  // sem filtro de visibilidade
    await assertSucceeds(getDocs(query(collection(f, 'auditLogs'), where('agencyId', '==', 'agA'), where('visibility', '==', 'agency'))));
  }
  await assertSucceeds(getDoc(doc(db('op'), 'requests/reqA/internal/notes')));
});

test('4. papel de imobiliária não faz nada de área admin', async () => {
  for (const uid of ['gerA', 'corA']) {
    const f = db(uid);
    await assertFails(updateDoc(doc(f, 'agencies/agA'), { name: 'x', updatedAt: now() }));
    await assertFails(setDoc(doc(f, 'invites/x@a.test'), { email: 'x@a.test', name: 'x', role: 'operator', createdBy: uid, createdAt: now() }));
    await assertFails(updateDoc(doc(f, 'users/corA2'), { role: 'platform_admin', updatedAt: now() }));
    await assertFails(updateDoc(doc(f, 'users/corA2'), { role: 'agency_manager', updatedAt: now() }));
    await assertFails(setDoc(doc(f, 'requests/reqA/internal/notes'), { text: 'x', updatedBy: uid, updatedAt: now() }));
  }
});

test('5. operador: produz, mas não aprova, não publica e não administra', async () => {
  const f = db('op');
  await assertSucceeds(getDoc(doc(f, 'requests/reqB')));
  await assertSucceeds(getDoc(doc(f, 'properties/propB')));
  await assertSucceeds(mudaStatus(f, 'op', 'reqA', 'accepted'));
  await assertSucceeds(mudaStatus(f, 'op', 'reqB', 'waiting_materials', {}, { agencyId: 'agB' }));
  await assertFails(mudaStatus(f, 'op', 'revA', 'approved', { approvedBuild: BUILD, approvedBy: 'op', approvedAt: now() }));
  await assertFails(mudaStatus(f, 'op', 'aprA', 'published'));
  await assertFails(publica(f, 'op', 'aprA', 'propA', BUILD));
  await assertFails(updateDoc(doc(f, 'properties/propA'), { tourUrl: 'https://x', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'properties/propA'), { agencyId: 'agB', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'users/corA'), { role: 'operator', updatedAt: now() }));
  await assertFails(setDoc(doc(f, 'invites/x@a.test'), { email: 'x@a.test', name: 'x', role: 'agent', agencyId: 'agA', createdBy: 'op', createdAt: now() }));
  await assertFails(setDoc(doc(f, 'agencies/agC'), { name: 'C', active: true, createdAt: now(), updatedAt: now() }));
  await assertSucceeds(updateDoc(doc(f, 'properties/propA'), { title: 'Cedros 37', updatedAt: now() }));
});

test('6. platform_admin acessa e administra todos os tenants', async () => {
  const f = db('admin');
  for (const p of ['requests/reqA', 'requests/reqB', 'properties/propB', 'auditLogs/logAint', 'users/corB', 'invites/novo@a.test'])
    await assertSucceeds(getDoc(doc(f, p)));
  await assertSucceeds(updateDoc(doc(f, 'agencies/agB'), { name: 'B2', updatedAt: now() }));
  await assertSucceeds(updateDoc(doc(f, 'users/corA'), { role: 'agency_manager', updatedAt: now() }));
  await assertSucceeds(setDoc(doc(f, 'invites/op2@x.test'), { email: 'op2@x.test', name: 'Op 2', role: 'operator', createdBy: 'admin', createdAt: now() }));
  await assertSucceeds(publica(f, 'admin', 'aprA', 'propA', BUILD));
});

// ── identidade (T03 / REVISAO-1.5) ──

test('7. users/{uid} só nasce de convite, com o papel do convite', async () => {
  const novo = (token) => db('novo', { email: 'novo@a.test', ...token });
  const base = { name: 'Novo', email: 'novo@a.test', role: 'agent', agencyId: 'agA', active: true, createdAt: now(), updatedAt: now() };
  await assertFails(setDoc(doc(db('semconvite'), 'users/semconvite'), { ...base, email: 'semconvite@teste.dev' }));
  await assertFails(setDoc(doc(novo(), 'users/novo'), { ...base, role: 'platform_admin' }));
  await assertFails(setDoc(doc(novo(), 'users/novo'), { ...base, role: 'agency_manager' }));
  await assertFails(setDoc(doc(novo(), 'users/novo'), { ...base, agencyId: 'agB' }));
  await assertFails(setDoc(doc(novo(), 'users/outro'), base));                                 // uid alheio
  await assertFails(setDoc(doc(novo({ email_verified: false }), 'users/novo'), base));
  await assertFails(setDoc(doc(novo(), 'users/novo'), { ...base, extra: 1 }));
  await assertSucceeds(setDoc(doc(novo(), 'users/novo'), base));
});

test('8. ninguém muda o próprio role, agencyId ou active', async () => {
  for (const uid of ['corA', 'gerA', 'op']) {
    const f = db(uid);
    await assertFails(updateDoc(doc(f, `users/${uid}`), { role: 'platform_admin', updatedAt: now() }));
    await assertFails(updateDoc(doc(f, `users/${uid}`), { agencyId: 'agB', updatedAt: now() }));
    await assertFails(updateDoc(doc(f, `users/${uid}`), { active: false, updatedAt: now() }));
    await assertSucceeds(updateDoc(doc(f, `users/${uid}`), { name: 'Outro nome', updatedAt: now() }));
  }
  // nem o admin cria combinação inválida: operador com agência, corretor sem agência
  const f = db('admin');
  await assertFails(updateDoc(doc(f, 'users/op'), { agencyId: 'agA', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'users/corA'), { agencyId: 'naoexiste', updatedAt: now() }));
});

test('9. inativo e pendente não leem nada (o inativo lê só a si)', async () => {
  const i = db('inativo');
  await assertFails(getDoc(doc(i, 'requests/reqA')));
  await assertFails(getDoc(doc(i, 'properties/propA')));
  await assertSucceeds(getDoc(doc(i, 'users/inativo')));
  await assertFails(mudaStatus(i, 'inativo', 'reqA', 'cancelled'));
  const p = db('pendente');
  await assertFails(getDoc(doc(p, 'requests/reqA')));
  await assertFails(getDoc(doc(p, 'agencies/agA')));
});

test('10. anônimo não lê nada do painel', async () => {
  const f = anon();
  for (const p of ['requests/reqA', 'properties/propA', 'agencies/agA', 'users/admin', 'auditLogs/logA', 'invites/novo@a.test'])
    await assertFails(getDoc(doc(f, p)));
});

// ── fluxo: status, aprovação, publicação ──

test('11. status só muda com AuditLog no mesmo batch, do mesmo autor', async () => {
  const f = db('op');
  await assertFails(updateDoc(doc(f, 'requests/reqA'), { status: 'accepted', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'requests/reqA'), { status: 'accepted', lastAuditId: 'logA', updatedAt: now() }));  // log velho
  await assertFails(mudaStatus(db('admin'), 'op', 'reqA', 'accepted'));   // log em nome de outro
  const b = writeBatch(f);                                                 // log de outra ação
  const log = doc(collection(f, 'auditLogs'));
  b.set(log, { agencyId: 'agA', userId: 'op', entityType: 'request', entityId: 'reqA', action: 'status:production', visibility: 'agency', timestamp: now() });
  b.update(doc(f, 'requests/reqA'), { status: 'accepted', lastAuditId: log.id, updatedAt: now() });
  await assertFails(b.commit());
  await assertSucceeds(mudaStatus(f, 'op', 'reqA', 'accepted'));
});

test('12. aprovar: só o gerente da agência, só em agency_review, só o build em revisão', async () => {
  const aprova = (uid, rid, build = BUILD, agencyId = 'agA') =>
    mudaStatus(db(uid), uid, rid, 'approved', { approvedBuild: build, approvedBy: uid, approvedAt: now() }, { agencyId });
  await assertFails(aprova('corA', 'revA'));
  await assertFails(aprova('gerB', 'revA', BUILD, 'agB'));
  await assertFails(aprova('gerA', 'revA', 'outrobuild00'));
  await assertFails(aprova('gerA', 'reqA'));                     // não está em revisão
  await assertFails(aprova('gerA', 'revB'));
  await assertSucceeds(aprova('gerA', 'revA'));
  await assertSucceeds(mudaStatus(db('gerB'), 'gerB', 'revB', 'production', {}, { agencyId: 'agB' }));  // pedir ajuste
});

test('13. publicar só o aprovado; trocar o preview derruba a aprovação', async () => {
  await assertFails(publica(db('admin'), 'admin', 'revA', 'propA', BUILD));        // não aprovado
  await assertFails(publica(db('admin'), 'admin', 'aprA', 'propA', 'outrobuild00')); // imóvel aponta outro build
  const novoPreview = { ...PREVIEW, build: 'ffffffffffff' };
  await assertFails(updateDoc(doc(db('op'), 'requests/aprA'), { preview: novoPreview, updatedAt: now() }));
  await assertSucceeds(mudaStatus(db('op'), 'op', 'aprA', 'production', { preview: novoPreview }));
  await assertFails(publica(db('admin'), 'admin', 'aprA', 'propA', 'ffffffffffff'));  // preview novo não foi aprovado
  await assertFails(mudaStatus(db('op'), 'op', 'reqA', 'agency_review'));             // revisão sem preview
});

test('13b. publicação registrada, depois reverter para o build anterior', async () => {
  await assertSucceeds(publica(db('admin'), 'admin', 'aprA', 'propA', BUILD));
  await env.withSecurityRulesDisabled((ctx) =>
    updateDoc(doc(ctx.firestore(), 'properties/propA'), { previousBuild: '000000000000' }));
  const f = db('admin');
  const b = writeBatch(f);
  const pub = doc(collection(f, 'publications'));
  b.set(pub, { propertyId: 'propA', agencyId: 'agA', action: 'rollback', build: '000000000000', previousBuild: BUILD, publishedBy: 'admin', publishedAt: now() });
  b.update(doc(f, 'properties/propA'), { publishedBuild: '000000000000', previousBuild: BUILD, lastPublicationId: pub.id, updatedAt: now() });
  await assertSucceeds(b.commit());
});

test('14. imutáveis e atribuição de corretor', async () => {
  const f = db('gerA');
  await assertFails(updateDoc(doc(f, 'requests/reqA'), { agencyId: 'agB', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'requests/reqA'), { requestedBy: 'gerA', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'requests/reqA'), { title: 'x' }));                 // sem updatedAt do servidor
  await assertSucceeds(updateDoc(doc(f, 'requests/reqA'), { title: 'Novo título', updatedAt: now() }));
  await assertSucceeds(updateDoc(doc(f, 'properties/propA'), { assignedAgentId: 'corA', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'properties/propA'), { assignedAgentId: 'corB', updatedAt: now() }));
  await assertFails(updateDoc(doc(f, 'properties/propA'), { title: 'x', updatedAt: now() }));
  // corretor edita o próprio pedido, não o do colega
  await assertFails(updateDoc(doc(db('corA'), 'requests/reqA'), { title: 'x', updatedAt: now() }));
  await assertSucceeds(updateDoc(doc(db('corA2'), 'requests/reqA'), { title: 'x', updatedAt: now() }));
  await assertSucceeds(mudaStatus(db('corA2'), 'corA2', 'reqA', 'cancelled'));
});

test('15. imobiliária cria pedido e material só na própria agência', async () => {
  const f = db('corA');
  await assertSucceeds(setDoc(doc(f, 'requests/novoA'), pedido('agA', 'corA', 'submitted', { propertyId: 'propA', createdAt: now(), updatedAt: now() })));
  await assertFails(setDoc(doc(f, 'requests/novoA2'), pedido('agA', 'corA', 'approved', { createdAt: now(), updatedAt: now() })));
  await assertFails(setDoc(doc(f, 'requests/novoA3'), pedido('agA', 'corA2', 'submitted', { createdAt: now(), updatedAt: now() })));
  await assertSucceeds(setDoc(doc(f, 'requestAssets/a2'), { requestId: 'reqA', agencyId: 'agA', type: 'floorplan', filename: 'planta.pdf',
    storagePath: 'request-assets/agA/reqA/planta.pdf', uploadedBy: 'corA', createdAt: now() }));
  await assertFails(setDoc(doc(f, 'requestAssets/a3'), { requestId: 'reqA', agencyId: 'agA', type: 'floorplan', filename: 'p.pdf',
    storagePath: 'request-assets/agB/reqB/p.pdf', uploadedBy: 'corA', createdAt: now() }));
});

// ── publications: o histórico de publicar/reverter ──

test('16. publications: nasce só com a publicação do imóvel, do mesmo autor e build, e não muda', async () => {
  const f = db('admin');
  // registro solto: o imóvel não aponta para ele
  await assertFails(setDoc(doc(f, 'publications/solta'), { propertyId: 'propA', agencyId: 'agA', action: 'publish',
    build: BUILD, publishedBy: 'admin', publishedAt: now() }));
  // imóvel publicado reaproveitando um registro antigo
  const b = writeBatch(f);
  const log = doc(collection(f, 'auditLogs'));
  b.set(log, { agencyId: 'agA', userId: 'admin', entityType: 'request', entityId: 'aprA', action: 'status:published', visibility: 'agency', timestamp: now() });
  b.update(doc(f, 'requests', 'aprA'), { status: 'published', lastAuditId: log.id, updatedAt: now() });
  b.update(doc(f, 'properties', 'propA'), { publishedBuild: BUILD, publishedRequestId: 'aprA', publishedAt: now(), lastPublicationId: 'pubA', updatedAt: now() });
  await assertFails(b.commit());
  // registro que não descreve a mudança: outra agência, outro build, outro autor, outra ação
  for (const errado of [{ agencyId: 'agB' }, { build: 'outrobuild00' }, { publishedBy: 'op' }, { action: 'rollback' }])
    await assertFails(publica(f, 'admin', 'aprA', 'propA', BUILD, errado));
  await assertSucceeds(publica(f, 'admin', 'aprA', 'propA', BUILD));
  // só cresce; a imobiliária lê o da própria agência
  await assertFails(updateDoc(doc(f, 'publications/pubA'), { build: 'ffffffffffff' }));
  await assertFails(deleteDoc(doc(f, 'publications/pubA')));
  await assertSucceeds(getDoc(doc(db('corA'), 'publications/pubA')));
});

// ── Storage ──

const bytes = new Uint8Array([1, 2, 3]);
const sobe = (uid, path, contentType = 'image/jpeg') =>
  uploadBytes(ref(as(uid).storage(), path), bytes, { contentType });

test('17. Storage: materiais isolados por agência e por pedido', async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled((ctx) =>
    uploadBytes(ref(ctx.storage(), 'request-assets/agB/reqB/b.jpg'), bytes, { contentType: 'image/jpeg' }));
  await assertSucceeds(sobe('corA', 'request-assets/agA/reqA/foto.jpg'));
  await assertSucceeds(sobe('gerA', 'request-assets/agA/reqA/planta.pdf', 'application/pdf'));
  await assertFails(sobe('corA', 'request-assets/agB/reqB/x.jpg'));
  await assertFails(sobe('corA', 'request-assets/agA/reqB/x.jpg'));     // pedido é de B
  await assertFails(getBytes(ref(as('corA').storage(), 'request-assets/agB/reqB/b.jpg')));
  await assertSucceeds(getBytes(ref(as('op').storage(), 'request-assets/agB/reqB/b.jpg')));
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'request-assets/agB/reqB/b.jpg')));
  await assertFails(sobe('inativo', 'request-assets/agA/reqA/y.jpg'));
});

test('18. Storage: tipo perigoso, sobrescrita e nada fora de request-assets/', async () => {
  await env.clearStorage();
  await assertFails(sobe('corA', 'request-assets/agA/reqA/x.html', 'text/html'));
  await assertFails(sobe('corA', 'request-assets/agA/reqA/x.svg', 'image/svg+xml'));
  await assertSucceeds(sobe('corA', 'request-assets/agA/reqA/dup.jpg'));
  await assertFails(sobe('corA', 'request-assets/agA/reqA/dup.jpg'));   // reenviar = arquivo novo
  // os prefixos do modelo antigo não têm regra: nem leitura pública, nem escrita, nem para o admin
  await env.withSecurityRulesDisabled((ctx) =>
    uploadBytes(ref(ctx.storage(), 'modelos/x/m.glb'), bytes, { contentType: 'model/gltf-binary' }));
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'modelos/x/m.glb')));
  await assertFails(getBytes(ref(as('admin').storage(), 'modelos/x/m.glb')));
  for (const p of ['modelos/agA/m.glb', 'fotos/agA/i/f.jpg', 'plantas/agA/i/p.pdf', 'logos/agA/l.png'])
    await assertFails(sobe('admin', p, 'image/png'));
});

// ── buildJobs e o que não é do modelo ──

test('19. buildJobs: a equipe lê; pelo cliente ninguém escreve', async () => {
  for (const uid of ['admin', 'op']) {
    await assertSucceeds(getDoc(doc(db(uid), 'buildJobs/jobA')));
    await assertFails(setDoc(doc(db(uid), 'buildJobs/novo'), { status: 'queued' }));
    await assertFails(updateDoc(doc(db(uid), 'buildJobs/jobA'), { status: 'ready' }));
  }
  for (const uid of ['gerA', 'corA']) await assertFails(getDoc(doc(db(uid), 'buildJobs/jobA')));
});

test('20. fora do modelo canônico, tudo negado: nem coleção nem claim do modelo antigo', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'cidades/sao-carlos'), { nome: 'São Carlos' }));
  const claimsAntigas = db('qualquer', { imobiliaria_id: 'agA', role: 'admin' });
  for (const f of [anon(), claimsAntigas, db('admin')]) {
    await assertFails(getDoc(doc(f, 'cidades/sao-carlos')));
    for (const c of ['imobiliarias', 'imoveis', 'usuarios', 'cidades', 'analytics'])
      await assertFails(setDoc(doc(f, `${c}/x`), { status: 'publicado', imobiliaria_id: 'agA' }));
  }
  await assertFails(getDoc(doc(claimsAntigas, 'agencies/agA')));   // claim não substitui users/{uid}
});
