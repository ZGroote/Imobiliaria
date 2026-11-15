# Tarefa 20 do Terreno: quantos lotes ainda são recusados, e por quê (medir antes de mexer)

**Quem:** Terreno, depois da T19.
**Galho:** `viabilidade/pos-124`, worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** nada de código nem `dados/`. Script de medida na sua pasta temporária, fora do repositório. Só o relatório entra.
**Não fazer:** não commitar.

## Por quê

A REVISAO-6 (achado 3) sorteou 20 índices e 16 deles (80%) foram recusados com "Lote sem frente para rua". Isso foi antes da T12 (frente pela borda da quadra), da T15 e da T17. A próxima frente de desenvolvimento seria fazer o estudo atender mais lotes. Antes disso, precisamos do número de hoje.

## O que fazer

1. Sorteie 500 índices da base `completo` com semente fixa (diga qual) e rode o mesmo caminho do `novo_lote.py --zona auto`, gravando só em pasta temporária. Rode também os 20 índices da REVISAO-6 (semente 20261115) para comparar com o número de antes.
2. Monte uma tabela por motivo de recusa: frente, buraco, área, zona, área especial, erro etc. Para cada motivo, dê a contagem, a % e 2 índices de exemplo.
3. Para "sem frente", separe:
   - lote de miolo/fundo de verdade: recusar está certo;
   - lote que dá para rua sem asfalto mapeado ou com asfalto a mais de 6 m: recusar está errado;
   - lote em quadra sem vizinho que deixe medir o vão: recusar está errado.

   Abra pelo menos 10 no mapa (Anexo 02 ou a foto aérea pública que o projeto já usa) e diga em qual grupo cada um cai.
4. Separe o raio de 2 km do centro do resto da cidade.
5. Termine com 1 a 3 consertos em ordem de quantos lotes cada um recuperaria, e com o risco de cada um aceitar uma frente errada. **Não aplique.**

## Relatório

`viabilidade/terreno/RELATORIO-20.md`, até 20 linhas, com a tabela. Todo número com o comando que o gerou. Depois: `maestri ask "Claude Code" "Terreno tarefa 20 pronta"`.
