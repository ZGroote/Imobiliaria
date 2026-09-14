#!/usr/bin/env node
/**
 * Diagnostico da conexao com o Firebase.
 *   node tools/firebase_check.js
 *
 * Testa credencial, Firestore e Storage — nessa ordem — e diz exatamente
 * o que fazer quando algum passo falha. Nao apaga nada seu: o unico dado
 * que escreve e um doc em _diagnostico/, removido no fim.
 */
import fs from 'fs';
import path from 'path';
import { lerCredencial, nomeDoBucket, admin, conectar } from '../firebase/admin.js';

const ok = (m) => console.log(`  [ok]    ${m}`);
const fail = (m) => console.log(`  [FALHA] ${m}`);
const info = (m) => console.log(`          ${m}`);

let projectId = null;

// ── 1. CREDENCIAL ──────────────────────────────────────────────
console.log('\n1. Credencial');
let conta;
try {
    ({ conta } = lerCredencial());
    projectId = conta.project_id;
    ok(`chave lida — projeto "${projectId}"`);
    info(`conta de servico: ${conta.client_email}`);
} catch (e) {
    fail(e.message.split('\n')[0]);
    e.message.split('\n').slice(1).forEach(info);
    process.exit(1);
}

// .firebaserc para o Firebase CLI saber o projeto sem --project
const rcPath = path.resolve('.firebaserc');
const rc = JSON.stringify({ projects: { default: projectId } }, null, 2) + '\n';
if (!fs.existsSync(rcPath) || fs.readFileSync(rcPath, 'utf8') !== rc) {
    fs.writeFileSync(rcPath, rc);
    ok('.firebaserc gravado (o CLI ja sabe o projeto)');
}

conectar();

// ── 2. FIRESTORE ───────────────────────────────────────────────
console.log('\n2. Firestore');
try {
    const ref = admin.firestore().doc('_diagnostico/conexao');
    await ref.set({ quando: new Date().toISOString(), origem: 'firebase_check' });
    const snap = await ref.get();
    if (!snap.exists) throw new Error('escreveu mas nao leu de volta');
    ok('escrita e leitura funcionando');
    await ref.delete();
    ok('doc de teste removido');
} catch (e) {
    fail(e.message);
    if (e.code === 5 || /NOT_FOUND/i.test(e.message)) {
        info('O banco ainda nao existe. Console -> Firestore Database -> Criar banco de dados');
        info('(modo producao, regiao southamerica-east1 se o publico for Brasil)');
    }
}

// ── 3. STORAGE ─────────────────────────────────────────────────
console.log('\n3. Storage');
const nome = nomeDoBucket(projectId);
try {
    const [existe] = await admin.storage().bucket(nome).exists();
    if (existe) {
        ok(`bucket "${nome}" acessivel`);
    } else {
        fail(`bucket "${nome}" nao existe`);
        info('Se o Storage ja esta ativo, o nome real esta na aba Storage do Console.');
        info('Rode com o nome certo:  FIREBASE_STORAGE_BUCKET=<nome> node tools/firebase_check.js');
        info('Se nao esta ativo: Console -> Storage -> Comecar');
    }
} catch (e) {
    fail(e.message);
}

console.log('\nProximo passo: publicar as regras de seguranca com');
console.log('  npx firebase-tools deploy --only firestore:rules,storage\n');
process.exit(0);
