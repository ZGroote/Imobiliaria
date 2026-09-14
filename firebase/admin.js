// Inicializacao unica do Firebase Admin SDK.
// Todo script server-side (upload, pipeline, seed) importa daqui.
//
// Credencial, em ordem de preferencia:
//   1. env GOOGLE_APPLICATION_CREDENTIALS  (caminho pro json)
//   2. firebase/service-account.json       (padrao do projeto, gitignored)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PADRAO = path.join(DIR, 'service-account.json');

function localizarChave() {
    const env = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (env && fs.existsSync(env)) return env;
    if (fs.existsSync(PADRAO)) return PADRAO;
    return null;
}

/** Le a chave e devolve {caminho, conta}. Lanca com instrucao se faltar. */
export function lerCredencial() {
    const caminho = localizarChave();
    if (!caminho) {
        throw new Error(
            'Credencial do Firebase nao encontrada.\n' +
            `Esperado em: ${PADRAO}\n` +
            'Baixe em: Console do Firebase -> engrenagem -> Configuracoes do projeto\n' +
            '          -> Contas de servico -> Gerar nova chave privada'
        );
    }
    const conta = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    if (!conta.project_id || !conta.private_key) {
        throw new Error(`${caminho} nao parece uma chave de conta de servico (falta project_id/private_key).`);
    }
    return { caminho, conta };
}

/**
 * Nome do bucket do Storage.
 * Projetos criados ate ~out/2024 usam <id>.appspot.com;
 * criados depois usam <id>.firebasestorage.app. Nao da pra adivinhar pelo id,
 * entao o valor real (que aparece na aba Storage do Console) manda via env.
 */
export function nomeDoBucket(projectId) {
    return process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
}

let app = null;

/** Devolve o app admin inicializado (uma vez por processo). */
export function conectar() {
    if (app) return app;
    const { conta } = lerCredencial();
    app = admin.initializeApp({
        credential: admin.credential.cert(conta),
        storageBucket: nomeDoBucket(conta.project_id),
    });
    return app;
}

export const db = () => { conectar(); return admin.firestore(); };
export const bucket = () => { conectar(); return admin.storage().bucket(); };
export { admin };
