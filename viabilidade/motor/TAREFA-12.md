# Tarefa 12 do Motor — achados ALTA da REVISAO-1 (fecha o 1B)

**Quem:** Codex (Astra, alto). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/motor/` (+ contrato no README). Não commite (a central commita).
Base: 0.8.2 (`83c107f0`). Leia `viabilidade/revisao/REVISAO-1.md`. A central **reproduziu R1 e R2** com os scripts do Revisor (`viabilidade/revisao/revisar.py caso <id>`).

## R1 — ALTA: subir o CA desliga a busca que resolvia a permeabilidade

`L-gc0-CA-perm0.65-CAalto` (e o trapézio equivalente): CA 2,8 → 12, sem garagem computável, **B 28 → ausente**. Em `_melhor`, o candidato reprovado pela permeabilidade só entra no `_ajusta_ao_ca` quando `area_computavel_m2 > cap + 0.01`. Com o CA alto, ele não entra e a opção some.

**Esperado:** candidatos reprovados por **qualquer** limite ajustável (permeabilidade, TO, CA) vão para a busca de dimensões viáveis. A condição não pode depender só de exceder o CA. Os dois pares entram na regressão.

## R2 — ALTA: garagem computável ainda não monotônica (10 pares) e o aviso sumiu

`degrau-13x23-gc1` (A 14→13, D 12→11), `L-gc1-frontal-ca3.4` (B 40→36), `L-gc1-frontal`, CA 4,2/4,3 e os demais em `viabilidade/revisao/casos/`. O subsolo/patamar de vagas cresce com a regra afrouxada e consome CA. A **implantação/subsolo anterior continua válida sob a regra nova** (o Revisor conferiu), mas não concorre.

**Esperado:**
1. Fazer concorrer os candidatos de subsolo com **patamares de vagas menores** e as implantações anteriores (sua estimativa P×U da tarefa 8), mantendo o critério unidades → privativa. Se não couber no teto de tempo (2× a coluna 0.8.0 de `TEMPOS.md`), use a premissa `busca_garagem_completa` (padrão `False`).
2. **Enquanto houver um caso não monotônico conhecido** (premissa desligada, ou par que ainda quebre), o estudo com garagem computável e vagas > 0 tem de trazer de volta o aviso explícito, igual ao da 0.8.0: "Garagem conta no CA: nesse regime o resultado NÃO é monotônico; afrouxar uma regra pode reduzir apartamentos." A 0.8.1 o retirou; isso estava errado.
3. Todos os pares da REVISAO-1 entram na regressão: os que passarem, sem exceção; os que ainda quebrarem, listados com o aviso conferido.

## Também

- Os 12 pares da REVISAO-1 + os da AUDITORIA-5 no teste de monotonia.
- Não regressão: `linha-de-base-0.7.1.json`, `linha-de-base-0.8.1.json` (só os campos permitidos mudam), 42 casos, domínio.
- Tempo: `medir_tempo.py` 0.8.0 × 0.8.3, teto 2× por estudo.
- Versão **0.8.3**. Regenere exemplo e pilotos.

## Relatório

`viabilidade/motor/RELATORIO-12.md`, até 15 linhas: R1 e R2 (causa, correção, pares que passam e que ficam com aviso), tempos. Depois: `maestri ask "Claude Code" "Motor tarefa 12 pronta"`.
