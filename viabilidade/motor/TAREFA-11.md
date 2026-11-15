# Tarefa 11 do Motor — domínio de validade declarado (PRD 1.0 §6, VF-004)

**Quem:** Codex (Astra, alto). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/motor/` (+ contrato no `README.md`). Não commite (a central commita).
Base: 0.8.1 (`947e2ec8`). O **Revisor** (outra IA) está revisando a 0.8.1 agora, só leitura: se ele achar defeito, a central te passa depois. Esta tarefa é aditiva e não deve mudar nenhum número dos estudos.

## Por quê

PRD 1.0 §6: "Não inferir que suportar um lote triangular em teste implica suportar qualquer lote irregular. Casos fora do domínio devem retornar **não validado/encaminhar ao profissional**." PRD 0.2 §7.2 sugere os estados `APTO_PARA_PROCESSAMENTO`, `DADOS_INSUFICIENTES`, `FORA_DO_ESCOPO`. Hoje o motor gera estudo para qualquer polígono e não diz se aquilo está dentro do que foi testado.

## O que fazer

1. **Domínio medido, não inventado:** um script `motor/dominio.py` que percorre os 8 estudos e todos os casos de `auditoria/casos/` (os que têm `lote`) e grava `motor/dominio-0.8.json` com as faixas **efetivamente testadas**: área do lote, nº de vértices, convexidade (área/área do fecho convexo), razão frente/profundidade, menor ângulo interno, zonas (ids), presença de área especial, garagem computável sim/não, faixas de CA/TO/permeabilidade das zonas.
2. **No estudo (contrato v5, campo novo opcional):**
   ```json
   "dominio": {"status": "dentro" | "fora" | "dados_insuficientes",
               "motivos": ["área 12.400 m² acima da maior testada (9.870 m²)", "..."],
               "versao": "dominio-0.8"}
   ```
   - `fora` quando qualquer medida sai da faixa testada (com folga pequena, documentada); `dados_insuficientes` quando falta frente, zona conferida, etc.; senão `dentro`.
   - `zona_conferida: false` **não** torna `fora` (todos os pilotos são assim); vira motivo em `dados_insuficientes` só se faltar a zona.
   - `fora` não apaga as opções: o estudo sai, mas com aviso em `incertezas`: "Lote fora do domínio testado do motor: resultado não validado; encaminhar a profissional."
3. **Testes:** os 8 estudos e os casos testados ficam `dentro` (ou `dados_insuficientes` com motivo correto); um lote sintético muito maior, outro muito côncavo e outro com ângulo agudo extremo saem `fora` com o motivo certo. Os números das opções **não mudam** (compare com os JSONs atuais: só os campos `dominio` e a frase nova podem diferir).
4. README: contrato v5 com `dominio`. Versão **0.8.2**. Regenere exemplo e pilotos.

## Relatório

`viabilidade/motor/RELATORIO-11.md`, até 12 linhas: as faixas do domínio, status dos 8 estudos, os 3 casos `fora`. Depois: `maestri ask "Claude Code" "Motor tarefa 11 pronta"`.
