// M1-F de ponta a ponta sobre as peças reais: a API M1-D grava o snapshot, as regras do M1-E
// aceitam a fixação, e `python -m pipeline.e2e_leitura` consome o par exportado do emulador
// até a maquete local. Sem Firestore de produção, BuildJob ou Hosting.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {getApps as clientApps} from 'firebase/app';
import {getAuth as clientAuth} from 'firebase/auth';
import {getAuth} from 'firebase-admin/auth';
import {doc, getDoc} from 'firebase/firestore';
import {adminDb, semear} from '../scripts/seed.mjs';
import {entrar, sairDeTodos} from './apoio.ts';
import {criarServidorLeituras} from '../../tools/leitura-api.mjs';
import {salvarVersao, listarVersoes, fixarEntrada} from '../src/lib/leituras.ts';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const CONTEXTO = path.join(RAIZ, 'tests/fixtures/m1f/contexto-sintetico.json');
const leituraJson = fs.readFileSync(path.join(RAIZ, 'tests/fixtures/leitura/v1/exemplo-geometrico.json'), 'utf8');
let server, url, db, tmp;
before(async () => {
  await semear(); db = adminDb();
  server = criarServidorLeituras({db, auth: getAuth(), origin: 'http://painel.test'});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}/property-readings`;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm1f-'));
});
after(async () => {
  await sairDeTodos(); await new Promise(r => server.close(r));
  fs.rmSync(tmp, {recursive: true, force: true});
});

// O par que o M2 vai ler do Firestore: o pedido, com o productionInput, e o snapshot apontado.
async function exporta(rid) {
  const r = (await db.doc('requests/' + rid).get()).data();
  const s = await db.doc('propertyReadings/' + r.productionInput.readingId).get();
  const {createdAt, ...snap} = s.data();
  const {fixedAt, ...pi} = r.productionInput;
  return {schema: 1,
    pedido: {id: rid, agencyId: r.agencyId, propertyId: r.propertyId,
      productionInput: {...pi, fixedAt: fixedAt.toDate().toISOString()}},
    snapshot: {id: s.id, ...snap, createdAt: createdAt.toDate().toISOString()}};
}
function e2e(entrada, destino) {
  const arq = path.join(tmp, randomUUID() + '.json');
  fs.writeFileSync(arq, JSON.stringify(entrada));
  const r = spawnSync(process.env.PYTHON ?? 'python', ['-m', 'pipeline.e2e_leitura', arq, CONTEXTO, '--destino', destino],
    {cwd: RAIZ, encoding: 'utf8'});
  return {code: r.status, out: r.stdout ? JSON.parse(r.stdout) : null, err: r.stderr};
}

test('snapshot gravado pela API e fixado pelas regras chega à maquete local, amarrado ao hash', async () => {
  await db.doc('properties/m1f-sintetico').set({agencyId: 'agA', title: 'Sintético M1-F', status: 'active',
    createdAt: new Date(), updatedAt: new Date()});
  await db.doc('requests/pedidoM1f').set({agencyId: 'agA', requestedBy: 'gerA', propertyId: 'm1f-sintetico',
    title: 'M1-F', productionMode: 'leve', status: 'accepted', createdAt: new Date(), updatedAt: new Date()});
  await entrar('corA');
  const token = await clientAuth(clientApps().at(-1)).currentUser.getIdToken();
  const v1 = await salvarVersao(url, token, {saveId: randomUUID(), propertyId: 'm1f-sintetico', agencyId: 'agA', leituraJson});
  const op = await entrar('op');
  const [snap] = await listarVersoes(op.db, 'm1f-sintetico', 'agA');
  assert.equal(snap.id, v1.id);
  await fixarEntrada(op.db, 'op', {id: 'pedidoM1f', ...(await getDoc(doc(op.db, 'requests', 'pedidoM1f'))).data()}, snap);

  const entrada = await exporta('pedidoM1f');
  const ok = e2e(entrada, path.join(tmp, 'ok'));
  assert.equal(ok.code, 0, ok.err);
  assert.deepEqual([ok.out.entrada.readingId, ok.out.entrada.readingVersion, ok.out.entrada.contentSha256],
    [v1.id, v1.version, snap.contentSha256]);
  assert.equal(ok.out.geometria.conferida, true);
  assert.deepEqual([ok.out.geometria.comodos, ok.out.geometria.portas, ok.out.geometria.janelas], [8, 7, 4]);
  assert.ok(fs.statSync(path.join(tmp, 'ok', 'maquete.html')).size > 0);

  // o mesmo par com a leitura mexida depois de gravada: bloqueia antes da página
  const mexida = structuredClone(entrada);
  mexida.snapshot.leitura.rooms[0].widthMm += 50;
  const recusa = e2e(mexida, path.join(tmp, 'mexida'));
  assert.equal(recusa.code, 2);
  assert.deepEqual(recusa.out.errors.map(e => e.code), ['CONTEUDO_ADULTERADO']);
  assert.equal(fs.existsSync(path.join(tmp, 'mexida')), false);
  assert.equal((await db.collection('buildJobs').where('requestId', '==', 'pedidoM1f').get()).size, 0);
});
