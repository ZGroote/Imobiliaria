# Tarefa 5 da frente Motor: auditoria 3

Leia a seção 3 de `viabilidade/auditoria/AUDITORIA-3.md` (casos em `auditoria/casos/`).

Ordem:
1. **Crash `AttributeError` no triângulo escaleno** (3.5.1). Confirme rodando o caso; se não reproduzir, diga como rodou.
2. Recuo de fundos ignorado no trapézio de fundo inclinado e no triângulo raso / pentágono (3.5.2–3).
3. `pavimentos_sem_ca` ignorado quando há `altura_max_m` (3.4.1) e alerta falso "Parou no teto de projeto" (3.4.2).
4. `@lru_cache` (3.6): se houver risco de resultado mudar entre chamadas ou de objeto mutável no cache, conserte.
5. `garagem_computavel=True` (3.2): **prioridade baixa**, em São Carlos a garagem não conta no CA. Se o conserto não for curto, só registre como limitação conhecida (incerteza no estudo quando `garagem_computavel=True`).

Cada conserto com teste que falhava antes. Regenere exemplo e pilotos (`gerar_pilotos.py`).
Relatório em `motor/RELATORIO.md`; uma linha pra central: `maestri ask "Claude Code" "Motor tarefa 5 concluída. Testes ok/falhou."`
