# Tarefa 7 do Revisor: as correções da AUDITORIA-6 funcionam mesmo?

**Quem:** Revisor.
**Galho:** `viabilidade/lote-livre` (não troque de galho).
**Onde escrever:** só `viabilidade/revisao/REVISAO-7.md`.
**Não fazer:**
- não commitar;
- não alterar código.

## Contexto

O Auditor achou 4 problemas ALTA na leitura automática dos mapas (`auditoria/AUDITORIA-6.md`). O Terreno diz que corrigiu tudo (`terreno/RELATORIO-11.md`). Confira de forma independente, **sem confiar no relatório do Terreno**.

## O que fazer

1. **Os 4 ALTA:** para cada um, um caso que falhava antes e passa agora.
   - Use os exemplos da auditoria: índice 25369 no Eixo, os pontos do vão do aeroporto e o lote 74451 no histórico.
   - **Ache também um caso novo seu,** que não esteja em nenhum dos dois relatórios.
2. **Regressão.** Rode a amostra da REVISAO-6 (semente 20261115, 20 lotes) com `--zona auto`. Algum lote passou a ser **aceito** com zona que você, olhando o recorte do Anexo 02, julga errada? Algum alerta de área especial sumiu?
3. **Lotes perto do aeroporto e do centro histórico:** 5 de cada, escolhidos por você. O estudo traz o alerta certo?
4. **Regra de evidência:** comando exato e saída copiada em todo achado.

## Entrega

`REVISAO-7.md`:
- veredito no topo (os ALTA estão fechados ou não);
- novos achados com gravidade.

Depois: `maestri ask "Claude Code" "Revisor tarefa 7 pronta"`.
