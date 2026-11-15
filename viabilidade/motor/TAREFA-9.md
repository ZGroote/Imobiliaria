# Tarefa 9 do Motor — garagem computável monotônica (fecha o Portão 1B)

**Quem:** Codex (Astra, alto). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/motor/` (+ contrato do README, se mudar). Não commite.
Base: motor 0.8.0 commitado em `b5e14eba`. O Visual mexe em `visual/` e `relatorio/`; o Auditor escreve em `auditoria/`: não toque.

## Problema

Com `garagem_computavel = True`, afrouxar uma regra ainda pode reduzir unidades. Exemplos do seu relatório 8: A 42→40 e D 38→36 no par CA 5,0; caso `saida-gc-ca50-recuo-3m0 → 1m5` em `auditoria/casos/`. Hoje só há aviso em `incertezas` (D8). O PRD (VF-007) aceita aviso, mas o Gate 1B pede tratar.
Seu relatório estimou a correção completa: "enumerar patamares de unidades/vagas por pavimento e preservar candidatos de implantação/subsolo; até P×U candidatos por proporção".

## O que fazer

1. Causa raiz em 2–3 linhas, com o caso concreto: por que afrouxar o recuo derruba unidades quando a garagem conta no CA?
2. Correção pela via que você mesmo propôs, ou uma mais barata, se existir: **preservar os candidatos** que eram viáveis com a regra mais apertada (eles continuam viáveis com a afrouxada) e deixar a `_chave` escolher.
3. **Orçamento de tempo:** o maior estudo hoje leva ~10 s (remembramento) e o exemplo ~1 s. A correção não pode passar de **2×** em nenhum dos 8 estudos. Meça antes e depois. Se não couber, implemente atrás de uma premissa `busca_garagem_completa` (padrão `False`), mantenha o aviso quando ela estiver desligada e diga o custo.
4. Testes: os pares de garagem computável da auditoria e do seu relatório entram no teste de monotonia (sem exceção para esse regime, se a correção fechar); a não regressão contra `linha-de-base-0.7.1.json` continua passando; os 42 casos passam.
5. Se fechar, retire o aviso D8 (ou deixe só quando a premissa estiver desligada) e suba o motor para **0.8.1**. Regenere exemplo e pilotos.

## Relatório

`viabilidade/motor/RELATORIO-9.md`, até 15 linhas: causa, correção, monotonia (passa ou não, em quais pares), tempo por estudo antes/depois (tabela com os 8), tempo da suíte. Depois: `maestri ask "Claude Code" "Motor tarefa 9 pronta"`.
