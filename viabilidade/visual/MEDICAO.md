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
