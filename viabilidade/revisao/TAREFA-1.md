# Tarefa 1 do Revisor — revisão independente do motor 0.8.1

**Quem:** Revisor (Codex Astra, alto; conta Padrão). **Galho:** `fix/viabilidade-1b`.
**Escreva só em `viabilidade/revisao/`.** Não altere motor, visual, relatório, auditoria. **Não commite** (quem commita é a central, Claude Code).

## Agora (enquanto o Motor termina)

O Motor (outra IA) está fechando as tarefas 9 e 10 no `viabilidade/motor/motor.py` → versão 0.8.1. **Não mexa nesses arquivos.** Por enquanto, só leia:
- `viabilidade/PRD-VIABILIDADE-1.0.md` (§5, §5.1, §5.2, §9), `viabilidade/README.md` (contrato);
- `viabilidade/motor/TAREFA-8.md`, `TAREFA-8B.md`, `TAREFA-9.md`, `TAREFA-10.md`, `RELATORIO-8.md`;
- `viabilidade/auditoria/AUDITORIA-5.md` (4 ALTA reproduzidos pela central na 0.8.0);
- `viabilidade/motor/TEMPOS.md` e `medir_tempo.py`.

## Quando a central avisar "0.8.1 commitada"

Revise o diff `git diff b5e14eba..HEAD -- viabilidade/motor/` (0.8.0 → 0.8.1) e o comportamento:
1. **Correção:** cada achado da AUDITORIA-5 (A1–A4, M1, M2, B1) e a garagem computável (TAREFA-9) estão resolvidos na causa e não só no sintoma? Rode os comandos da auditoria.
2. **Busca:** procure outros pontos do mesmo tipo dos ALTA, como limiar que liga/desliga caminho, `return` precoce numa busca ou prova de "impossível" que só vale para uma forma. Para cada suspeito, monte um par de casos (regra apertada → afrouxada) e rode.
3. **Monotonia:** varredura própria com pelo menos 30 pares novos (lotes retangulares, estreitos, em L, trapézio, triângulo; recuos simétricos e assimétricos; CA, TO, altura, permeabilidade; com e sem garagem computável). Grave os que quebrarem em `viabilidade/revisao/casos/`.
4. **Tempo:** `medir_tempo.py` 0.8.0 × 0.8.1; teto de 2× por estudo (TAREFA-9).
5. **Não regressão:** `linha-de-base-0.7.1.json` e os casos da auditoria.

## Entrega

`viabilidade/revisao/REVISAO-1.md`: achados com gravidade (ALTA/MÉDIA/BAIXA), comando reproduzível, esperado × obtido; e a lista do que conferiu e passou. Afirmação sem comando reproduzível não entra. Depois: `maestri ask "Claude Code" "Revisor tarefa 1 pronta"`.
