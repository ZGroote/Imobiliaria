# Medição de desempenho da maquete volumétrica

Data: 2026-11-15. Medianas de 3 execuções independentes por estudo e perfil.
Primeira maquete: `performance.now()` no primeiro `renderer.render()` com volumes; tempo relativo à navegação.
Bytes: `Network.loadingFinished.encodedDataLength` acumulado até o primeiro desenho (inclui HTML, estudo e dependências).
Órbita: rotação automática por 5 s, um giro completo; FPS = chamadas de renderização / duração observada.
Celular: viewport 390×844, escala 3, CPU 4× mais lenta e perfil Fast 3G (150 ms, 1,6 Mbps/750 Kbps). Desktop: 1366×768.
Memória: fotografia de `performance.memory` após a órbita e a troca de opção; `n/d` quando indisponível.

| Estudo | Perfil | Primeira maquete (ms) | Transferidos (bytes) | Órbita (FPS) | Troca A→B (ms) | Heap usado (MB) |
|---|---|---:|---:|---:|---:|---:|
| Exemplo | desktop | 1299 | 467279 | 60.2 | 77 | 11.9 |
| Exemplo | celular | 4896 | 467304 | 60.1 | 248 | 11.5 |
| 22421 | desktop | 1359 | 471431 | 60.0 | 102 | 10.3 |
| 22421 | celular | 4901 | 471442 | 60.2 | 311 | 8.7 |
| 22426 | desktop | 1333 | 382571 | 60.0 | n/d (sem B) | 9.0 |
| 22426 | celular | 4786 | 382585 | 60.2 | n/d (sem B) | 8.7 |
| 25297 | desktop | 1309 | 377939 | 60.1 | n/d (sem B) | 8.6 |
| 25297 | celular | 4386 | 377967 | 60.2 | n/d (sem B) | 8.7 |
| 30516 | desktop | 296 | 394870 | 60.2 | 82 | 11.2 |
| 30516 | celular | 4617 | 394896 | 60.2 | 278 | 11.0 |
| 37607 | desktop | 1286 | 385695 | 60.3 | 93 | 10.8 |
| 37607 | celular | 4488 | 385721 | 60.2 | 243 | 10.9 |
| q1382-11984-11988 | desktop | 1289 | 414115 | 60.1 | 114 | 10.2 |
| q1382-11984-11988 | celular | 5563 | 502340 | 60.2 | 391 | 11.4 |
| remembramento-75352-75354 | desktop | 9515 | 405242 | 60.3 | 105 | 10.7 |
| remembramento-75352-75354 | celular | 13364 | 405220 | 60.2 | 402 | 12.0 |

Observações: valores são medições deste ambiente, sem metas de aprovação e sem otimizações nesta tarefa.

## Depois da tarefa 9

Nova medição pendente: este ambiente bloqueia o bind do servidor HTTP local, então não consegui reexecutar o `medir.cjs` para Exemplo e remembramento. Os números acima seguem sendo a linha de base da tarefa 8. A instrumentação atual mede o tempo total até o primeiro render, não os tempos separados de cada etapa; não há valores pós-tarefa para comparar.

Diagnóstico por código: a primeira maquete espera os imports do Three.js/OrbitControls e depois busca, valida, faz hash e desenha o estudo. A conferência do relatório só busca o HTML após clique, portanto fica fora desse caminho. O HTML do remembramento não tem `estudo-sha256` e é da revisão 0.8.0; o JSON atual é 0.8.1, então o relatório está desatualizado, mas isso só afeta o clique. O arquivo do remembramento tem 47.644 bytes e 448 vértices; parse e SHA-256 em Node local levaram 0,53 ms e 0,69 ms (não são tempos do Chrome). A variação de 346 ms para 9.515/9.520 ms veio com diferença de 88.194 bytes; a saída agregada não separa espera dos imports CDN, fetch do estudo ou criação WebGL.

## Diagnóstico da central (15/11, depois da tarefa 9)

Tempos por requisição (Playwright `request.timing()`), contexto novo a cada rodada, desktop:
- Numa primeira sessão, `three.module.js` do **jsdelivr** levou **~1,1 s** em todas as aberturas; minutos depois, as 4 rodadas do remembramento e do exemplo deram **0,29–0,63 s** até a primeira maquete, sem nenhuma requisição acima de 0,7 s.
- Conclusão: o patamar de ~1,3 s e os 9,5 s do remembramento vêm da **latência variável do CDN** (`cdn.jsdelivr.net/npm/three@0.186.1`), não do estudo (47 KB, parse/hash < 1 ms). A medição de cima mede o CDN daquele momento.
- Correção proposta: servir o three 0.186.1 junto da página (a mesma versão existe em `experimentos/liv-experimental-2026-10-14/node_modules/three` da `main`), eliminando a dependência de rede externa.

## Depois da tarefa 10 (three local, 15/11)

Bundle `vendor/three-viabilidade.min.js` (592.249 bytes, three 0.186.1 + OrbitControls, esbuild 0.25.10; `gerar.mjs` refaz o mesmo SHA-256). Nenhum pedido fora da origem (o `testar.cjs` falha se houver). Primeira maquete, desktop, contexto novo a cada rodada: remembramento **210–527 ms**, exemplo **196–217 ms** (antes 1,3–9,5 s com o CDN). A tabela de cima é a linha de base com CDN; refazer o `medir.cjs` completo para o celular.
