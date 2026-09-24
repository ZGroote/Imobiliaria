#!/usr/bin/env node
// LEGADO, ISOLADO. A implementacao antiga esta em upload_modelo.js.legacy, uma extensao que o
// Node se recusa a executar. Ela gravava modelos/<imobiliaria>/<imovel>.glb pelo Admin SDK,
// que ignora as Security Rules: e o Storage do modelo antigo, que o projeto novo nao tem (D2).
// Nenhum fluxo a chama; veja tasks/painel/proposta.md, N6. Este arquivo nao importa nada, entao
// nenhum modulo legado e avaliado. Reativar exige decisao explicita: renomear o .legacy.
console.error('upload_modelo.js esta isolado: gravaria modelos/ no formato antigo, '
    + 'ignorando as regras. Veja tasks/painel/proposta.md, N6.');
process.exit(1);
