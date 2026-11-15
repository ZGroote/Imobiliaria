# Tarefa 10 — Three local
Bundle ESM minificado: 592.249 bytes, abaixo de 1 MiB; SHA-256 registrado em `vendor/three-viabilidade.json`.
Versões usadas: Three.js 0.186.1 e esbuild 0.25.10.
`vendor/entrada.js` exporta apenas as classes Three usadas e `OrbitControls`; importmap agora aponta localmente.
`testar.cjs` falha ao observar qualquer requisição HTTP(S) fora da origem da página.
Refazer: `node viabilidade/visual/vendor/gerar.mjs`.
Arquivos: `index.html`, `testar.cjs`, `vendor/entrada.js`, `vendor/gerar.mjs`, bundle, manifesto e este relatório.
`node --check` passou nos quatro arquivos JavaScript; Chrome e remedição ficam para a central. Sem commit.
