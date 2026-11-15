# Tarefa 3 da frente Motor: defeitos da auditoria

O Auditor (olhar independente) achou 16 defeitos: `viabilidade/auditoria/AUDITORIA.md` (casos para reproduzir em `auditoria/casos/`). Leia só a lista final e os casos citados.

Corrija, nesta ordem, cada um com um teste em `test_motor.py` que falhava antes:
1. ALTA 1: crash com `ca_maximo` null (zona real SC-Z6E).
2. ALTA 6: `_cabe()` não confere a permeabilidade mínima.
3. ALTA 2 e 5: lote em L (subsolo sai do lote; frente/fundos trocados).
4. ALTA 3 e 4: monotonia em A, B e D (se a Tarefa 2 já resolveu, só confirme com os casos `mono-*`).
5. MÉDIA 8, 9, 12: unidades fatiadas entre andares, vagas que somem sem alerta / divisão por zero, crash com frente degenerada.
6. MÉDIA 7: lentidão (meta: exemplo de volta abaixo de 1 s, ou diga por que não dá).

Os demais (MÉDIA 10, 11, 13 e BAIXA) só se forem de 1–2 linhas; senão liste como pendente.

Escreva só em `viabilidade/motor/`. Relatório completo em `motor/RELATORIO.md`; pra central, uma linha:
`maestri ask "Claude Code" "Motor tarefa 3 concluída. Testes ok/falhou. Relatório: motor/RELATORIO.md"`
