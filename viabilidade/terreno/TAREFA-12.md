# Tarefa 12 do Terreno: frente pela borda da quadra

**Quem:** Terreno.
**Galho:** `viabilidade/lote-livre` (não troque de galho).
**Onde mexer:** só em `viabilidade/terreno/`.
**Não fazer:**
- não commitar;
- não mexer em `pipeline/ruas.py` nem em nada fora de `viabilidade/`;
- não gravar imagem no repositório.

## Por quê

A varredura de 300 m no centro (`motor/RELATORIO-20.md`) recusou 200 de 369 lotes por "sem frente para rua". Você mostrou na tarefa 10 que a causa é a malha de asfalto (`street_tris.json`) com buracos. A rua existe, mas o asfalto não está no arquivo.

## Ideia

O próprio cadastro desenha as quadras. Um lado do lote que **não encosta em nenhum outro lote** e fica na **borda externa** do conjunto de lotes da quadra (a união dos lotes vizinhos), voltado para um vão de 8 a 30 m até a quadra do outro lado, é quase sempre frente para rua.

## O que fazer

1. **Regra 3: "borda de quadra".** Só roda quando as regras 1 e 2 (tarefa 10) não acham frente, e só no `novo_lote` (`ampliar=True`), para que os pilotos não mudem. Ela aceita uma aresta (ou cadeia colinear de pelo menos 8 m) quando:
   - (a) não é compartilhada com outro lote (distância maior que ~0,5 m de qualquer vizinho);
   - (b) do outro lado, na direção da normal para fora, há um vão livre de lote com largura de 8 a 30 m. Meça esse vão no próprio cadastro: a distância até o próximo lote, que deve ficar entre 8 e 30 m;
   - (c) o vão não é praça nem área verde grande. Se a área vazia em volta for bem maior que um corredor, recuse ou marque "não verificada"; escolha a regra e explique.

   Marque a frente com `regra: "borda_de_quadra"` e o aviso "frente presumida pela borda da quadra (sem asfalto no mapa)". O motor já transforma `regra` em incerteza (tarefa 19); confira se o texto sai certo.
2. **Esquina:** se duas arestas passam pela regra, faça como na regra 1 (ordem e esquina indicada).
3. **Prova.**
   - Os 7 pilotos byte a byte iguais.
   - A amostra da REVISAO-6 e a varredura de 300 m no centro (`motor/varrer.py --ponto "-22.01725, -47.8908" --raio 300`): quantos passam a ter frente, antes e depois.
   - Olhe 10 dos novos aceitos no recorte do mapa ou pela geometria, dentro do `--testar`, sem gravar imagem, e confirme que a aresta dá para a rua.
   - Liste os casos duvidosos.
4. **Falsos positivos:** procure ativamente lote de fundo de quadra ou com viela. A regra não pode aceitar lote sem acesso. Na dúvida, recuse.

## Relatório

`viabilidade/terreno/RELATORIO-12.md`, até 12 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 12 pronta"`.
