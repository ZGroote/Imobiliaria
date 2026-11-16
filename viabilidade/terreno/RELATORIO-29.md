# T29: cor insegura e fora do quadro (16/11)

Só medição. Não mexi em código, `motor/`, `relatorio/` nem `lotes-piloto.json`, e não commitei. Os scripts ficaram no rascunho, fora do repositório. A folha de prints e a lista ficaram em `terreno/evidencias/t29/` (`folha-29.jpg` e `lotes-29.json`).

1. **Números de hoje** (sorteio de 500, semente 20261120, depois da T28):
   - 306 aceitos;
   - **25 "cor insegura"** (eram 24: a T27 tirou um lote de "sem frente" que caiu aqui);
   - **22 "fora do quadro"**. Todos com o motivo "Fora do quadro georreferenciado", nenhum por "lote grande".
2. **Cor insegura: por que recusa.** Basta **um** pixel sem cor da legenda (ou de cor que não é zona) dentro do lote para a regra recusar.
   - Texto preto, linha azul de córrego e a sombra atrás dos nomes de loteamento ficam assim quando estão a mais de 3 px de uma cor boa.
   - A borda das letras às vezes cai no verde do Pq. Ecológico, e isso também recusa.
   - Abri os 25 no Anexo 02 (recorte de ~140 m e de ~420 m) e no satélite os que caem no branco ou no campus.

| categoria | lotes | zona a olho inequívoca |
|---|---:|---:|
| texto/nome de rua impresso por cima | 10 | 10 (8 Z2, 2 Z1) |
| linha azul de córrego por cima (categoria nova) | 3 | 3 (2 Z2, 1 Z3) |
| cor desbotada: sombra atrás do nome do loteamento | 2 | 2 (Z3, Z4) |
| borda: em cima da linha vermelha do perímetro | 1 | 0 |
| cor da legenda que não é zona: campus (nova) | 3 | 0 (é campus, não Z1–Z5) |
| branco: fora do perímetro urbano de 2016 (nova) | 6 | 0 |
| hachura / cor fora da legenda | 0 | — |
| **total** | **25** | **15** |

   - **Branco:** o satélite mostra que os 6 estão ocupados ou em loteamento novo. Os 97953, 107324, 102806 e 105161 têm casas, e os 1782 e 2369 têm rua aberta e lote vazio. Mesmo assim, o Anexo 02 os deixa fora da linha vermelha.
     - Na pasta não achei lei que amplie o perímetro.
     - O KML de 2014/15 é proposta, e o `FONTES.md` manda não usar.
     - Então a recusa está certa.
   - **2032:** fica metade de cada lado do traço vermelho do perímetro. No satélite é loteamento novo do lado de fora.
3. **Fora do quadro: os 22 ficam em Ibaté**, a cidade vizinha a oeste.
   - Estão entre -48,005 e -47,987 de longitude e -21,957 de latitude, que é o centro de Ibaté.
   - A afim os coloca de 2.104 a 4.242 px à esquerda da borda da imagem, ou seja, **3 a 6 km** além do quadro.
   - O próprio Anexo 02 escreve "IBATÉ" e desenha o limite do município perto da borda esquerda (canto na folha).
   - No satélite é bairro de casas. São **recusa certa** (fora do município).
   - Não há erro de georreferência: a afim fecha com erro médio de 2,9 m nos 21 cruzamentos, e esses lotes estão a quilômetros.
   - Nenhum caiu na margem, na legenda, no carimbo ou no encarte dos distritos.
   - No cadastro inteiro, **pelo menos 6.914 de 110.089 lotes (6,3%)** ficam a oeste da borda do mapa. Há mais 101 a leste da borda (perto de -47,83; -22,00), mas nenhum caiu no sorteio e não os abri.
4. **Proposta P1, que vale a pena:** pixel sem cor e Pq. Ecológico solto (sem mancha de 3×3 px) deixam de recusar.
   - Branco, campus e represa continuam recusando sempre.
   - A zona tem que cobrir pelo menos metade dos pixels do lote.
   - A divisa de 10 m e a regra de "mais de uma zona" ficam como estão.
   - Simulei com uma cópia do `sugerir_zona.py` no rascunho, nos 388 lotes do sorteio que chegam à zona.
   - **Ganha 13 lotes (306 → 319):** os 10 de texto e os 3 de córrego. Os 13 saem com a mesma zona que vi a olho.
   - **Nenhum dos 306 aceitos muda**, e pela regra nem poderia, porque ela só afrouxa.
   - Quatro "vários motivos" trocam o texto do motivo e continuam recusados.
   - **Risco de zona errada:** baixo. Texto em cima de uma faixa estreita de outra zona poderia esconder essa faixa, mas a divisa de 10 m continua contando as manchas de outras zonas num raio de 250 m.
5. **Mensagens mais claras (P2 e P3), sem ganhar lote:**
   - fora do quadro a oeste: "fora do município de São Carlos (Ibaté)";
   - branco: "fora do perímetro urbano do Anexo 02";
   - campus: "campus universitário, não é zona do art. 25".
   - Se Ibaté sair do sorteio, a taxa de hoje vai de 306/500 (61,2%) para 306/478 (64,0%). Com a P1, vai para 319/478 (66,7%).
6. **O que não resolver:**
   - **Ibaté (22):** a lei de São Carlos não vale lá.
   - **Branco (6) e borda do perímetro (1):** não dá para inventar zona onde o mapa diz que é fora do perímetro.
   - **Campus (3):** campus não é zona.
   - **Sombra de rótulo (2):** tirar o piso de metade ganharia o 63932 (Z3) e o 90722 (Z4), ambos certos. Mas aí aceitaria lote em que de 62% a 94% dos pixels não têm cor de zona. São 2 lotes em 500, e não compensa.
7. **Lista dos lotes.** Os mesmos dados estão em `evidencias/t29/lotes-29.json`.
   - **Cor insegura (25):**
     - texto por cima:
       - Z2: 12545, 21498, 22356, 23086, 51670, 55625, 62964, 75478;
       - Z1: 68151, 72288;
     - córrego por cima: 57190 (Z2), 60197 (Z2), 81626 (Z3);
     - sombra do rótulo: 63932 (Z3), 90722 (Z4);
     - borda do perímetro: 2032;
     - campus: 39961, 64640, 64897;
     - branco, fora do perímetro: 1782, 2369, 97953, 102806, 105161, 107324.
   - **Fora do quadro, Ibaté (22):** 96352, 96707, 97072, 97088, 97912, 98029, 98537, 98779, 99123, 99627, 99865, 101835, 102506, 104037, 105611, 105740, 106790, 106930, 107862, 108170, 108515, 109782.
