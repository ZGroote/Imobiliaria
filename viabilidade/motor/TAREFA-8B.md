# Tarefa 8B do Motor — a correção D1 perdeu uma solução boa

**Quem:** Codex (Astra, alto). **Galho:** `fix/viabilidade-1b`. Mesmas regras da TAREFA-8 (só `viabilidade/motor/` + contrato do README; não commite).

## O problema (medido pela central)

No pilot `SC-completo-remembramento-75352-75354` (SC-Z2, 1.607,8 m²), a **opção B** piorou da v0.7.1 (HEAD `06ba272a`) para a 0.8.0:

| | v0.7.1 | 0.8.0 |
|---|---|---|
| Volumes | 2 torres × **11** pav, recuo 4,31 m | 2 torres × **28** pav, recuo 10,69 m |
| TO usada | 0,263 | 0,100 |
| Unidades / privativa | **66** / 4.077,70 m² | **56** / 3.393,59 m² |
| Permeável | 615,32 m² | 795,64 m² |

Pela `_chave` (unidades desc → privativa desc), a solução de 11 pavimentos venceria se ainda fosse gerada. A 0.8.0 **deixou de encontrá-la**. É o risco "heurística perde opção viável" do PRD 1.0 (§12). O exemplo e os outros 6 pilotos não mudaram.

## O que fazer

1. **Causa raiz** (2–3 linhas): por que a solução de 11 pav sumiu? Provavelmente o envelope fixo do D1 ("conservador") ou o novo cálculo das métricas do subsolo (D2). Confirme se a solução da v0.7.1 **ainda cumpre todas as regras** na 0.8.0 (CA, TO, permeabilidade, recuos por altura, vagas). Se não cumpre por causa de uma regra corrigida, diga qual e prove com números: aí a queda é correção, não regressão.
2. **Se é regressão:** recupere a solução **sem quebrar** D1 (os 2 casos de monotonia têm de continuar passando). Caminho sugerido pelo seu próprio relatório: os candidatos do método antigo concorrem com os do envelope fixo, e a `_chave` escolhe; nada é descartado.
3. **Teste de não regressão novo** em `test_motor.py`: para o exemplo e os 7 pilotos, nenhuma opção pode ter menos unidades que uma **linha de base gravada** (a da v0.7.1, em `motor/exemplos/linha-de-base-0.7.1.json`, só `{arquivo: {opcao: unidades}}`), a não ser que a opção esteja numa lista `quedas_justificadas` com o motivo (regra corrigida). Hoje ela estaria vazia.
4. **Tempo:** a suíte foi de 113 s para 356 s. Se der para baixar sem tirar casos (por exemplo, cache de leitura dos pilotos ou um caso pesado duplicado), faça; senão, só registre.
5. Regenere o exemplo e os pilotos; rode `python -I -X utf8 viabilidade/motor/test_motor.py`.

## Relatório

Acrescente uma seção "8B" ao `viabilidade/motor/RELATORIO-8.md` (até 10 linhas): causa, correção ou justificativa, B do remembramento antes/depois, tempo da suíte. Depois: `maestri ask "Claude Code" "Motor tarefa 8B pronta"`.
