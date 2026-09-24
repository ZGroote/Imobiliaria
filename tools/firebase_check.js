#!/usr/bin/env node
// LEGADO, ISOLADO. A implementacao antiga esta em firebase_check.js.legacy, uma extensao que o
// Node se recusa a executar. Pelo Admin SDK, que ignora as Security Rules, ela gravava
// _diagnostico/conexao no Firestore e .firebaserc na raiz, e no fim mandava publicar
// firestore:rules e storage juntos, o que nao vale mais (tasks/painel/proposta.md, secao 5).
// Nenhum fluxo a chama; veja N6. Este arquivo nao importa nada, entao nenhum modulo legado e
// avaliado. Reativar exige decisao explicita: renomear o .legacy.
console.error('firebase_check.js esta isolado: gravaria _diagnostico/ e .firebaserc pelo '
    + 'Admin SDK. Veja tasks/painel/proposta.md, N6.');
process.exit(1);
