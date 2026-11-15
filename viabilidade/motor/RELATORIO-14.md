# Relatório do Motor, tarefa 14: `test_motor.py` mais rápido

1. **Tempo:** antes 430 s (7 min 10 s); depois **78–88 s** (3 rodadas, uma com a máquina disputada). Meta de 120 s batida. Piso estimado ~55–60 s (430 s de cálculo ÷ 8 núcleos físicos); a maior geração sozinha leva uns 10 s.
2. **Os 10 mais lentos (antes, s):** monotonia 147 (inclui a do D1) · `_regera_caso` 128 (dentro de test_42 e tarefa10) · D1 107 · test_42_casos 84 · tarefa10 44 · revisao1 30 · tarefa6 17 · defeitos_da_auditoria 16 · auditoria3 9 · D2 8,5. Quase tudo é `gerar_estudo` (429 s dos 430); as conferências somam ~1,4 s.
3. **O que mudou (só `test_motor.py`):** `_ge()` roda cada `gerar_estudo` num conjunto de processos e calcula o mesmo (lote, zona, premissas) uma vez só (23 chamadas repetidas); os grupos independentes rodam juntos em threads; monotonia, test_42, tarefa10 e revisao1 disparam suas gerações de uma vez. Nenhuma conferência foi mexida.
4. **Ficou direto, sem cache:** a conferência de determinismo (gera de novo e compara o JSON) e os dois casos com `patch("motor._maior_lamina")` (test_d6, rodado sozinho no fim, porque o patch vale pro processo todo).
5. **Prova (contador no código, o mesmo no arquivo velho e no novo):** 7.437 conferências nos dois, **iguais texto a texto** (127 conferências distintas, nenhuma diferença); `confere` 135× nos dois; 32 pares na varredura de monotonia nos dois (+ as 128 comparações de `_par_monotono`). O "94" do enunciado não bate com nenhuma contagem minha; o que garanto é igual antes e depois.
6. **Linha de base:** `test_8b_linha_de_base` intacto (32 conferências nos dois); `linha-de-base-0.7.1.json` e `0.8.1.json` sem alteração no git (sha256 825f78d8… e 50d3d370…).
7. **Mutação:** numa cópia do `motor.py` tirei 0,5 m do recuo (`recuo_divisa`). O teste antigo falhou ("estudo-exemplo.json desatualizado") e o novo também ("…desatualizado: rode gerar_pilotos.py"). Sem mutação os dois passam.
8. **Efeito colateral:** se um grupo falha, os outros terminam antes do erro aparecer. Sem commit.

## 14b. `test_estudar.py` com as áreas especiais automáticas (terreno tarefa 6)

- Caso (a) 30516 não compara mais `alertas` item a item: **todo alerta do piloto tem que estar no estudo novo** (o de ÁREA ESPECIAL compara o tipo; o piloto escreve "AIA da bacia do Córrego da Água Quente", o lote novo só "AIA") e os extras só podem ser ÁREA ESPECIAL "nao_verificada" ou "possível incidência". O resto (opções, ausentes, domínio, caixa, premissas, zona) continua igual, campo a campo.
- Extras de hoje: 4, um por opção (A, B, C, D): "ÁREA ESPECIAL sem altura numérica, NÃO aplicada: nao_verificada (Áreas especiais do Anexo 05: não verificada)…". O AIA é o mesmo do piloto, só muda o nome. O teste imprime a contagem. `test_estudar.py` passa ("ok").

Sem commit: `test_motor.py`, `test_estudar.py`, este relatório (e os arquivos já soltos de outras frentes).
