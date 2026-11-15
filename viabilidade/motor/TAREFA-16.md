# Tarefa 16 do Motor: por que lote pequeno dá poucas opções?

**Quem:** Motor.
**Galho:** `viabilidade/lote-livre` (já em checkout; não troque de galho).
**Onde mexer:** só em `viabilidade/motor/`.
**Não fazer:**
- não commitar;
- não tocar no terreno (o Terreno está na tarefa 8);
- não mudar o motor nesta tarefa sem a prova do item 3.

## Fato

`estudar.py --ponto "-22.0175, -47.8908" --zona auto` deu o lote SC-completo-75902 (518 m², Z1, CA disponível 1.554 m²). Saiu **só 1 opção (C)**. A, B e D ficaram `busca_inconclusiva`, com "Melhor pavimento tentado: 1 pavimento(s), 0 unidade(s)". A maioria dos lotes de São Carlos tem entre 250 e 700 m².

## O que fazer

1. **Amostra.** Sorteie 40 lotes de 250 a 800 m² na base `completo` (semente anotada), com `--zona auto` ou, na recusa, a zona da sugestão. Para cada opção ausente, classifique o motivo: lei (recuo, TO, permeabilidade, laje mínima pela geometria) ou busca (a heurística parou cedo, passo grosso, ponto de partida ruim).
2. **Prova num caso.** Para o 75902 e mais 2 casos "busca": existe solução válida que a busca não achou? Mostre com uma busca exaustiva fina, como teste e não no motor: pavimentos × recuos × posição, conferindo todas as regras com as mesmas funções de verificação do motor. Se existir, traga os números.
3. **Só se o item 2 provar falha de busca:**
   - corrija a busca com a mudança mínima;
   - os pilotos não mudam: linha de base 0.8.1 pelo sha e monotonia igual;
   - o caso provado passa a sair;
   - acrescente o caso ao `test_motor.py`.

   Se a ausência for da lei, não mude nada. Explique e proponha um texto mais claro para o motivo, por exemplo "a laje que sobra depois dos recuos tem X m², abaixo da mínima de 80 m²".

## Relatório

`viabilidade/motor/RELATORIO-16.md`, até 12 linhas:
- a tabela de motivos (lei × busca);
- o resultado da prova;
- o que mudou.

Depois: `maestri ask "Claude Code" "Motor tarefa 16 pronta"`.
