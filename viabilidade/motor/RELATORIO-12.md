# Motor 0.8.3 — tarefa 12 — 15/11/2026
R1: o excesso de CA era a única porta para ajustar dimensões; agora CA, TO e permeabilidade acionam a busca (inclusive na checagem do teto de projeto). Os dois pares CA 2,8→12 passam: B permanece com 28 unidades no L e no trapézio.
R2: subsolo/vagas maiores consumiam CA e a secante confundia garagem cheia com máximo de privativa. Agora concorrem patamares positivos menores e subsolos na caixa legal, envoltória e projeções individuais; poda pelo saldo de CA e ajuste considerando uma vaga. Os dez pares GC passam; pode vencer apenas uma vaga, com déficit explícito.
12/12 pares da REVISAO-1 passam, sem exceções; resultados em `validacao-12.json`. Aviso explícito de NÃO monotonia restaurado em todo estudo GC com meta > 0: a busca não exaure posições nem prova preservação universal de implantações anteriores.
Validação: suíte completa passou em 368,92 s (12 pares, AUDITORIA-5, 42 casos, domínio, bases 0.7.1/0.8.1); oito JSONs regenerados, conteúdo anterior preservado. `medir_tempo.py`: mediana de 3, caches limpos, base fixa 0.8.0 de `TEMPOS.md`; 8/8 abaixo de 2×, sem premissa extra; sem commit.
| Estudo | 0.8.0 | 0.8.3 | Razão / teto 2× |
|---|---:|---:|---:|
| estudo-exemplo | 3,17 s | 1,28 s | 0,40× — passa |
| SC-completo-30516 | 6,61 s | 7,76 s | 1,17× — passa |
| SC-completo-37607 | 6,73 s | 2,24 s | 0,33× — passa |
| SC-completo-22426 | 1,29 s | 1,33 s | 1,03× — passa |
| SC-completo-22421 | 0,76 s | 0,77 s | 1,01× — passa |
| SC-completo-25297 | 0,23 s | 0,22 s | 0,96× — passa |
| SC-completo-q1382-11984-11988 | 7,83 s | 7,51 s | 0,96× — passa |
| SC-completo-remembramento-75352-75354 | 9,57 s | 7,36 s | 0,77× — passa |
