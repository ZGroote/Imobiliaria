# Tempo de geração por estudo (não é o tempo da suíte de testes)

Medido pela central em 15/11/2026, Windows 11, Python 3.14.4: `gerar_estudo` de cada estudo, **3 rodadas, mediana**, caches `lru_cache` limpos antes de cada rodada. Script: `medir_tempo.py`.

| Estudo | 0.7.1 (`51a72280`) | 0.8.0 (`b5e14eba`) | Razão |
|---|---|---|---|
| estudo-exemplo | 1,79 s | 3,17 s | 1,77× |
| SC-completo-30516 | 4,18 s | 6,61 s | 1,58× |
| SC-completo-37607 | 3,78 s | 6,73 s | 1,78× |
| SC-completo-22426 | 1,28 s | 1,29 s | 1,01× |
| SC-completo-22421 | 1,09 s | 0,76 s | 0,70× |
| SC-completo-25297 | 0,43 s | 0,23 s | 0,54× |
| SC-completo-q1382-11984-11988 | 8,53 s | 7,83 s | 0,92× |
| SC-completo-remembramento-75352-75354 | 7,05 s | 9,57 s | 1,36× |
| **Total** | **28,1 s** | **36,2 s** | **1,29×** |

- A suíte `test_motor.py` foi de ~113 s para ~396 s (3,5×): a maior parte é **teste novo** (matriz de monotonia D1, linha de base, D1–D8). A geração por estudo subiu 1,29× no total e no máximo 1,78× (dentro do teto de 2×).
- **Orçamento da TAREFA-9:** cada estudo ≤ 2× o valor da coluna 0.7.1.
