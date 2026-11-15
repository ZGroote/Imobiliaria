# Relatório 5 — Portão 1A (matriz do PRD + proposta de CI)

- HEAD verificado: `490c0c7` (motor v0.7.1); `conferir.py` com 6/6 aprovado (~174 s) em `.conferir/`.
- Entregas em `viabilidade/auditoria/`: `MATRIZ-PRD-1.0.md`, `CI-PROPOSTA.md` e este relatório. Nada fora dessa pasta foi alterado e nada foi commitado.
- Matriz: 12 VF + 7 testes mínimos + 6 pendências + regras 5.1 e 5.2. Atendido: VF-001, 003, 004, 005, 006, 008, 010, 011. Parcial: VF-002, 007, 009, 5.1, 5.2. Pendente: VF-012 e T9.1-6.
- A palavra "melhor" não aparece na UI nem no relatório. Quanto à regra 5.2, o critério de ordenação não está exposto no JSON.
- Regra 5.1: opção sem unidades é registrada, mas com motivo genérico fixo. A Opção C diz sempre "sem área".
- VF-009: o relatório mostra relevo com fonte e resolução. A tela (`index.html`) não mostra `lote.relevo`.
- Bloqueiam o Portão 1B: arredondamento antes da métrica (VF-002), monotonicidade com recuo assimétrico (VF-007), relevo na tela e motivo exato de descarte, e `testar.cjs` com caminhos de Windows.
- Bloqueiam o Portão 1C: revisão por profissional habilitado (VF-012, T9.1-6) e zona oficial por lote (P2-2).
- CI: Ubuntu, Python 3.14, Node 24, `fetch-depth: 0`, Playwright instalado fora da árvore git (`/tmp`, com `NODE_PATH`), upload de `.conferir/` com `if: always()` e `include-hidden-files: true`. Estimativa: ~4–5 min por execução.
- Correção mínima de `testar.cjs`: linhas 7–8 (Playwright) e 46 (`executablePath`) passam a usar fallback com `fs.existsSync` e `CHROME_PATH`. Não aplicada.
- Ficam sem commit: `AUDITORIA-3.md`, `AUDITORIA-4.md`, `casos/`, `MATRIZ-PRD-1.0.md`, `CI-PROPOSTA.md` e `RELATORIO-5.md`.
