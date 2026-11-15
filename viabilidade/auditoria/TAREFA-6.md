# Tarefa 6 do Auditor — auditoria independente do motor 0.8.0 (Portão 1B)

**Quem:** Auditor (Antigravity). Escreva **só** em `viabilidade/auditoria/` (casos novos em `casos/`). Não altere motor, visual, relatório. Não commite.
**Galho:** `fix/viabilidade-1b`. **Não confie nos relatórios do autor**: o PRD 1.0 §9.3 manda auditar sem depender da explicação de quem fez. Toda afirmação sua precisa de comando e saída reproduzíveis. Nomes de função, contagens e linhas que você citar serão conferidos pela central; na auditoria anterior apareceram nomes inventados.

Leia: `viabilidade/PRD-VIABILIDADE-1.0.md` (§5, §5.1, §5.2, §9), `viabilidade/README.md` (contrato v5), `viabilidade/motor/TAREFA-8.md` e `TAREFA-8B.md` (o que foi pedido) e `viabilidade/auditoria/AUDITORIA-4.md` (o que estava aberto).

## O que auditar

1. **Monotonia (VF-007):** gere pelo menos 20 pares "regra apertada → regra afrouxada" (recuo lateral, recuo de fundos, assimétricos, CA, TO, altura, permeabilidade) em lotes retangulares, estreitos, em L e trapézio, com e sem garagem computável. Nenhuma opção pode piorar, **exceto** garagem computável, que tem de vir com aviso no `incertezas`. Cada quebra vira caso em `casos/`.
2. **Não regressão:** compare a 0.8.0 com a v0.7.1 (`git show 51a72280:viabilidade/motor/motor.py` num arquivo temporário fora do repo) nos 42 casos antigos + exemplo + 7 pilotos. Liste toda opção que perdeu unidades e diga se há uma regra que justifique.
3. **Opções ausentes (§5.1):** para cada `opcoes_ausentes` dos pilotos e dos seus casos, confira se o `motivo` está certo. `impossivel` precisa de prova numérica verdadeira; ache pelo menos 1 caso em que uma opção marcada `impossivel` na verdade existe (tentando à mão uma geometria que caiba), ou declare que não achou após N tentativas.
4. **Métricas = geometria (VF-002):** `confere()` nos casos novos; subsolo: `niveis` e `area_permeavel_m2` batem com a geometria final.
5. **Contrato v5:** `criterio_escolha.ordem` reflete de fato a ordenação do código; arquivos v4 continuam aceitos pelo visual e pelo relatório (rode `test_relatorio.py`).

## Entrega

- `viabilidade/auditoria/AUDITORIA-5.md`: tabela de achados (gravidade ALTA/MÉDIA/BAIXA, caso, comando, esperado × obtido) + lista do que foi verificado e passou.
- Casos novos em `viabilidade/auditoria/casos/` (entrada e saída).
- Não precisa mandar mensagem: a central confere os arquivos.
