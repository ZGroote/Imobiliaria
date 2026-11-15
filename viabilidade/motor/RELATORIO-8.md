# Motor — tarefa 8 / Portão 1B

15/11/2026 · galho `fix/viabilidade-1b` · motor 0.8.0 · contrato v5 aditivo.

| Defeito | Reproduzido no HEAD anterior? Causa / correção | Teste em `test_motor.py` |
|---|---|---|
| D1 | Sim: A 39→38 (22×35), 48→46 (24×40). Limite de permeabilidade independente dos recuos laterais/fundos; preservadas as buscas com margem e CA exato e corrigida a tolerância antes do piso de unidades. | `test_d1_recuo_assimetrico_permeabilidade`, dois casos também em `monotonia` |
| D2 | Parcial: `_sub_final` já não existe; queda A 42→39 reproduzida. Garagem dizia 918,00 m² contra 918,37 m² exportados; garagem, CA e permeabilidade agora usam a geometria final. | `test_d2_metricas_subsolo_final` (dois casos da auditoria e três recuos do exemplo) |
| D3 | Não: recuo medido e isenção de parede cega já corrigidos. Preservados; texto deixa de afirmar contato com a divisa. | `test_d3_rotulo_parede_cega` |
| D4 | Não: caixa sem altura já tinha limite de parede cega zero. Preservado. | `test_d4_caixa_sem_altura` |
| D5 | Não: subsolo do lote enorme já dimensionado pelas vagas. Preservado, com métrica da geometria arredondada. | `test_d5_subsolo_dimensionado_pelas_vagas` |
| D6 | Sim: motivo fixo por opção. Geradores informam tentativas/limites; impossibilidade tem prova numérica; demais estados distinguem busca, parâmetro ausente e exceção. Frase v4 mantida. | `test_d6_opcoes_ausentes_classificadas` (quatro motivos e altura insuficiente) |
| D7 | Sim: critério ausente no JSON. Expostas as duas entradas reais de `_chave`, sem inventar pavimentos no critério. | `test_d7_criterio_reflete_chave` |
| D8 | Parcial: garagem computável já avisava; aviso agora descreve a busca por degraus e só aparece com vagas > 0. D1 corrigido nos dois casos e na matriz ampliada. | `test_d8_aviso_apenas_garagem_computavel_com_vagas` |

Causa D1: `max(e, recuo)` na bisseção fazia afrouxar fundos estreitar laterais. O envelope agora é fixo e os recuos entram só na interseção.
No limiar de laje, a margem artificial do ajuste ao CA e a tolerância aplicada depois do piso também perdiam unidades; a tentativa exata concorre com a original, sem descartá-la.
Limitação: garagem computável permanece não monotônica (A 42→40 e D 38→36 no par CA 5,0), declarada no estudo; os casos antigos desse regime mantêm verificação de invariantes e aviso, sem alegar monotonia.
Custo da correção completa: enumerar patamares de unidades/vagas por pavimento e preservar candidatos de implantação/subsolo; até P×U candidatos por proporção, em vez de uma laje ajustada por pavimento. Exige ampliar busca e regressões; tempo adicional ainda não medido.
O envelope fixo é conservador: pode aproveitar menos área que a v0.7.1 sob recuos assimétricos; o motor continua heurístico, sem prova de ótimo global.
Validação: `python -I -X utf8 viabilidade/motor/test_motor.py` → `ok`, código 0; 42/42 casos passam no `confere`. Tempo antes: 112,7 s; depois: 355,9 s (suíte ampliada com D1–D8 e os 42 casos). `git diff --check` aprovado.
Exemplo e sete pilotos regenerados por `gerar_pilotos.py`; README atualizado apenas no contrato. ALTA 1 anterior preservada.
Sem commit: a central commita. `conferir.py` completo não executado, conforme a divisão da tarefa; visual e relatório pertencem à frente paralela.

## 8B — regressão do remembramento
Causa: D1 passou a ativar o envelope pela caixa sem recuos laterais/fundos (1.464,07 m²), embora a caixa legal já coubesse: 1.292,42 m² ≤ 1.366,61 m². Esse recorte desnecessário retirava a implantação de 11 pavimentos.
Correção: ativar o envelope somente quando a caixa legal excede o limite; quando necessário, sua bisseção continua independente dos recuos, como na correção D1.
B recuperada: 56 → 66 unidades, 28 → 11 pavimentos, 3.393,59 → 4.077,70 m² privativos; recuos 4,31 m e 66 vagas em dois subsolos.
A solução continua válida: computável 4.657,12 ≤ 5.627,22 m²; TO 0,263 ≤ 0,7; permeável final 615,25 ≥ 241,17 m². A queda era regressão, não correção de regra.
Linha de base extraída dos oito JSONs de `06ba272a`: `exemplos/linha-de-base-0.7.1.json`; teste compara cada opção com gerações atuais e `quedas_justificadas` está vazia.
Exemplo e sete pilotos regenerados. O teste novo reutiliza as oito gerações da suíte, sem duplicar buscas nem retirar casos.
Validação: `python -I -X utf8 viabilidade/motor/test_motor.py` → `ok`, código 0; D1, linha de base e 42/42 casos aprovados. Tempo: 373,3 s contra 355,9 s na tarefa 8; sem redução do tempo total. `git diff --check` aprovado; sem commit.
