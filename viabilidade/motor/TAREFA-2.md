# Tarefa 2 da frente Motor

Leia antes `viabilidade/README.md` (contrato v4) e `viabilidade/motor/TAREFA.md` (regras: escreva só em `viabilidade/motor/`, não commite).

## 1. Defeito de monotonia na opção D (prioridade)

No exemplo (SC-Z2, lote de 1.519 m²), quando o recuo lateral dos 2 primeiros pavimentos AFROUXOU de 2,00 para 1,50 m, a opção D (Embasamento + torre) PIOROU: 38 → 37 unidades (2.304 → 2.242 m² privativos). Afrouxar regra não pode piorar a opção.

- Ache a causa raiz (não o sintoma). Diga em 2–3 linhas por que aconteceu.
- Corrija na função certa, para todas as opções, não só na D.
- Teste de monotonia em `test_motor.py`: o mesmo lote com recuo menor, CA maior, TO maior ou altura maior **não pode** dar área privativa menor em nenhuma opção. Rode em pelo menos 3 lotes (o exemplo e 2 dos pilotos).
- Se a correção certa for "a heurística escolhe a melhor de várias tentativas", diga o custo de tempo.

## 2. Os 7 lotes-piloto

O Terreno entregou `viabilidade/terreno/lotes-piloto.json` com 7 lotes (5 antigos + 1 no Eixo + 1 na Z2). Gere um estudo por lote, com a zona indicada em cada um (`lei/zonas.json`), em `viabilidade/motor/exemplos/pilotos/<id>.json`, mais um script que refaz todos de uma vez. Tabela curta no relatório: lote | zona | melhor opção | unidades | CA usado | alertas.

Lote em área especial (gabarito, aeronáutica sem altura) tem que gerar alerta, não número inventado.

## Relatório

Até ~20 linhas: causa da D, o que mudou, testes, tabela dos 7. Mande com `maestri ask "Claude Code" "<relatório>"`.
