# Tarefa 7 da frente Motor: auditoria 4 (curta)
Leia só a seção 4 de `viabilidade/auditoria/AUDITORIA-4.md`. 42/42 casos já passam; faltam:
1. ALTA 1: área sem arredondar × `base_utm` arredondado muda as unidades no limiar (36 × 18 no lote 20×40, TO 0,35). Use a MESMA área (a arredondada) na métrica e no `confere`.
2. MÉDIA 4: rótulo `parede_cega`/`recuo 0,0` em volume que não toca a divisa.
3. BAIXA 5: `parede_cega_ate_m` 12 com caixa de altura 0.
4. BAIXA 6: subsolo ocupa 100% da projeção mesmo quando as vagas pedem bem menos (lote enorme: 17.000 m² pra 180 vagas). Subsolo do tamanho das vagas (mais circulação), sem sair da caixa.
MÉDIA 2 e 3: não mexa; registre como limitação conhecida (incerteza no estudo quando acontecer, se for simples detectar).
Cada um com teste. Regenere exemplo e pilotos se os números mudarem.
Relatório em `motor/RELATORIO.md`; uma linha: `maestri ask "Claude Code" "Motor tarefa 7 concluída. Testes ok/falhou."`
