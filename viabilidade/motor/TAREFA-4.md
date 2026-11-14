# Tarefa 4 da frente Motor: auditoria 2

O Auditor reconferiu a v0.5.0: `viabilidade/auditoria/AUDITORIA-2.md` (casos novos em `auditoria/casos/`). Leia a tabela da seção 2 e a seção 3.

Prioridade:
1. **Opção com 0 unidades aprovada** (triângulos: B com 856 m² e 0 unidades; A/C/D do escaleno). Opção sem apartamento não é opção: descarte com alerta ou ajuste a laje.
2. **Monotonia em UNIDADES**, não só em área privativa (TO 25→35%: B cai 64→60 un.). O cliente compra apartamento. Decida o critério de "melhor" (sugestão: maior nº de unidades, empate por área privativa) e estenda o teste de monotonia a unidades. Diga no relatório se é possível garantir.
3. Monotonia que ainda quebra: `mono-ca-20-d → 25-d`, sumiço da D (`sumico-d-2m0 → 1m5`), `garagem_computavel=True`.
4. **Teto de altura** (MÉDIA 10, piorou: 103–108 pav. no lote enorme). Premissa `pavimentos_max_projeto` (padrão 30, marcada como padrão) valendo para TODAS as opções, inclusive a torre da D (hoje a D passa de `pavimentos_sem_ca`).
5. `recuo_fundos` ignorado no triângulo; `cap_style="square"` mordendo a lateral interna do L; `confere()` com `ZeroDivisionError` em frente repetida.
6. Lentidão: tente o cache de `_centros` (opção "a" do seu relatório). Meta: exemplo < 1,5 s.

Cada conserto com teste que falhava antes. Regenere exemplo e pilotos.
Relatório completo em `motor/RELATORIO.md`; pra central, uma linha:
`maestri ask "Claude Code" "Motor tarefa 4 concluída. Testes ok/falhou. Relatório: motor/RELATORIO.md"`
