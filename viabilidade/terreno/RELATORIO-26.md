# T26: por que 118 lotes saem "sem frente" (16/11)

Só medição. Não mexi em código, `motor/`, `relatorio/` nem `lotes-piloto.json`, e não commitei. Os scripts de medição ficaram na pasta de rascunho, fora do repositório.

1. **Como medi:**
   - Usei o mesmo sorteio de 500 (semente 20261120, depois da T25) e os mesmos 118 recusados por "sem frente".
   - Para cada lote, refiz as regras da T21 fora do código e anotei o que falhou e por quanto: asfalto a 6 m e a 12 m, borda e OSM (classe, distância ao eixo, ângulo, via ligada, encostar em outro lote, caminho cruzando lote).
   - Rodei as mesmas regras **sem o mínimo de 8 m**, para achar os pedaços de frente que existem mas são curtos.
   - Baixei todas as vias do OSM, de todas as classes, para dar nome à via mais perto quando ela não é das 5 classes aceitas.
   - Li a zona de cada lote pelo Anexo 02, com o mesmo `sugerir` do `--zona auto`.
   - **Abri os 118 na foto de satélite** (Esri, zoom 18, 100×100 m ao redor do lote). Os 43 do grupo campus abri também no Anexo 02.
2. **Contagem por motivo:**

| motivo | lotes | zona aceita pelo Anexo 02 |
|---|---:|---:|
| Campus da universidade ou fora do perímetro (gleba) | 43 | 0 |
| Lote estreito: frente real de 3,7 a 7,5 m | 29 | 25 |
| Frente quebrada: pedaços somam ≥8 m, mas nenhum chega a 8 m | 14 | 10 |
| Condomínio, via particular ou estacionamento | 10 | 10 |
| Regra barrou: distância ao eixo | 8 | 5 |
| Lote de fundo ou interno (recusa certa) | 7 | 7 |
| Regra barrou: encosta em outro lote | 4 | 3 |
| Geometria ruim | 3 | 2 |
| Rua na foto que falta no cadastro e no OSM | **0** | — |
| **total** | **118** | 62 |

   - "Zona aceita" diz quantos passariam pela zona se a frente fosse resolvida. Os outros 56 ainda seriam recusados pela zona.
   - **Não achei nenhuma rua na foto que falte no cadastro e no OSM.** Em todos os 118, a rua que se vê na foto também está no OSM. O que muda é a classe da via, a distância ou o tamanho da frente.
3. **Campus e fora do perímetro (43):**
   - **39 ficam no cinza de Campus Universitário** do Anexo 02. Na foto são eucaliptal, pasto ou um loteamento interno, com estrada de terra (`track`), via sem classe (`unclassified`), trilha (`footway`) ou acesso de serviço.
   - Os outros 4: o 39765 cai no verde de parque; o 3095 e o 3331 caem no branco, fora do perímetro; o 96754 cai fora do quadro do Anexo.
   - **A zona recusa os 43 de qualquer jeito.** Resolver a frente deles não ganha nenhum lote.
4. **Lote estreito (29):**
   - São lotes reais, de 3,7 a 7,5 m de largura e de 88 a 290 m², em fila de casas iguais. Na foto, a frente dá na rua asfaltada.
   - A frente é **uma só e passa em todas as regras, menos no mínimo de 8 m**.
   - Larguras:
     - 9 lotes com 7,5 m;
     - 11 lotes com 5,5 a 6,0 m;
     - 1 lote com 5,0 m;
     - 7 lotes com 4,0 a 4,9 m;
     - o 35691 tem 3,7 m e mais um pedaço de 3,7 m, que somam 7,4 m.
   - O 22356 é um lote passante de 7,5 m que dá para duas ruas. Por isso a soma dá 15 m, mas cada frente tem 7,5 m.
5. **Frente quebrada (14):**
   - A frente de verdade tem 8 a 18 m, mas o contorno do cadastro a corta em 2 a 4 pedaços. Isso acontece por quebra de ângulo acima de 10°, recorte ou curva de balão.
   - **Cada pedaço passa nas regras, mas nenhum chega a 8 m.**
   - O 4851 tem cerca de 12 m de frente na foto, mas a parte que passa nas regras soma só 5,3 m por causa de um recorte. É o único da lista em que a soma não chega a 8 m.
6. **Regra barrou: distância (8). Só a distância falhou; classe, ângulo e encostar passaram:**
   - Avenida (`primary`) a 10,1–10,5 m do eixo: 71700, 86651, 86694 e 76658. São avenidas largas, então o eixo fica longe da calçada.
   - Via `secondary` a 8,7 e 8,8 m: 33895 e 77883.
   - Rua `residential` a 11,3 m (17144, frente em arco num balão) e a 12,6 m (36684).
   - **Com 10 m de distância, passam 2 (33895 e 77883), e só 1 tem zona aceita (33895).** Com 11 m, passam 6, e 3 têm zona aceita.
7. **Ângulo de 25° no lugar de 20°: passa 0 lote.**
   - **Em nenhum dos 118 o ângulo é a única falha.**
   - O único lote com ângulo entre 20° e 25° é o 44661 (campus), que também falha em outras regras.
8. **Regra barrou: encosta em outro lote (4):**
   - O 10249 (7,5 m do eixo) e o 100608 (5,7 m) falham **só** por encostar.
   - O 21769 (8,6 m) e o 33508 (8,8 m) falham por encostar e por distância.
   - Nos 4, o vizinho cobre de 8 a 16 m² do lado que dá para a rua. Na foto, o lote é de esquina ou fica ao lado da rua, e o desenho do vizinho está deslocado por cima dele.
   - **É cadastro sobreposto, não falta de frente.** Afrouxar a regra aqui deixaria passar lote de fundo de verdade.
9. **Fundo ou interno (7):** 453, 5343, 5774, 8063, 35749, 37067 e 75422.
   - A rua mais perto fica a 15–34 m, atrás de outro lote. O 5343 só tem um pedaço de 1,5 m na rua.
   - **A recusa está certa.**
10. **Condomínio, via particular ou estacionamento (10):**
    - Corredor de estacionamento de mercado ou shopping, com lotes de 71 a 95 m² que são vagas ou faixas: 2344, 16549 e 74635.
    - Acesso particular (`private`/`driveway`): 48791, 56462 e 80821. Clube com quadras de saibro: 54079 e 54081. Galpão: 87634.
    - Condomínio de sobrados com rua interna: 86596.
    - **Não é frente para a rua pública.**
11. **Geometria ruim (3):**
    - O 7014 e o 17518 são lotes em bandeira cujo corredor de acesso é uma linha sem largura no cadastro.
    - O 42134 é uma lasca curva numa rotatória, dentro do campus.
12. **Propostas:**
    - **A. Frente mínima de 5 m no lugar de 8 m, com as mesmas regras:**
      - **Ganho: +22 lotes sem frente, 18 deles com zona aceita.**
      - Com 4 m, o ganho sobe para +28 (24 com zona). Não recomendo descer de 5 m: um corredor de lote em bandeira tem 3 a 4 m. Abaixo disso, um lote de fundo com corredor passaria como se tivesse frente.
      - **Risco:** um lote de fundo com corredor de 5 m ou mais passaria. Para segurar isso, dá para exigir que o lado do lote na rua tenha pelo menos metade da largura média do lote.
    - **B. Juntar os pedaços da frente na mesma via quando somam ≥8 m:**
      - **Ganho: +13 lotes, 9 com zona aceita.**
      - **Risco:** juntar pedaços de ruas diferentes num lote de esquina ou passante (o 22356 dá 15 m somando duas ruas). Por isso, só deve juntar pedaços **da mesma via**.
    - **C. Distância ao eixo de 11 m para `primary` e `secondary` (as outras classes ficam em 8 m):**
      - **Ganho: +6 lotes, 3 com zona aceita.** Um limite único de 10 m dá só +2 (1 com zona).
      - **Risco:** baixo. Avenida larga tem o eixo longe da calçada. Uma rua estreita a 11 m indicaria lote de fundo; por isso a mudança fica só nas classes de avenida.
    - **A, B e C juntas: +30 dos 500 com zona aceita** (de 278 para cerca de 308). Cada proposta foi contada separada, sem rodar as três juntas.
13. **O que não resolver:**
    - **Campus e gleba (43):** a zona recusa todos.
    - **Fundo (7):** a recusa está certa.
    - **Condomínio, estacionamento e acesso particular (10):** não têm frente para rua pública. O estudo de viabilidade precisa de testada real.
    - **Encosta (4):** o problema é o cadastro sobreposto. Afrouxar a regra de encostar abre a porta para lote de fundo.
    - **Geometria ruim (3):** lasca e bandeira sem corredor.
    - **Ângulo de 25°:** não ganha nenhum lote.
14. **Prints em `evidencias/t26/sem-frente-36.jpg`:**
    - 36 lotes de todas as categorias, em 4 folhas de 3×3 (1ª no alto à esquerda, 2ª no alto à direita, 3ª embaixo à esquerda, 4ª embaixo à direita). Cada quadro traz o número e a categoria do lote.
    - Cores: magenta é o lote; amarelo, os lotes vizinhos; ciano, o asfalto do cadastro; vermelho, a via do OSM das 5 classes aceitas; laranja, a via do OSM das outras classes.
    - A foto é a imagem do Esri, sem data. Só serve para ver se a rua existe e onde fica a frente; não serve para medir.

## Lista dos 118

**Lote estreito (29):**

- 5421: frente 5,5 m (soma 7,6 m em 2 pedaços); 253 m²; zona Z2
- 6073: frente 5,9 m; 110 m²; zona Z2
- 6959: frente 5,9 m; 130 m²; zona Z5A
- 7165: frente 6,0 m; 138 m²; zona Z5A
- 7352: frente 5,9 m; 138 m²; zona Z5A
- 8230: frente 5,8 m; 88 m²; zona Z2
- 10984: frente 5,9 m; 100 m²; zona Z5A
- 17975: frente 6,0 m; 270 m²; zona recusa
- 18795: frente 6,0 m; 269 m²; zona Z5A
- 20224: frente 6,0 m; 273 m²; zona recusa
- 20808: frente 6,0 m; 91 m²; zona Z2
- 22356: frente 7,5 m (soma 15,0 m em 2 pedaços); 204 m²; zona recusa(cor)
- 30708: frente 7,5 m; 232 m²; zona Z4
- 31157: frente 7,5 m; 233 m²; zona Z4
- 31176: frente 7,5 m; 233 m²; zona recusa
- 31434: frente 7,5 m; 233 m²; zona Z4
- 31677: frente 7,5 m; 150 m²; zona Z4
- 31811: frente 7,5 m; 157 m²; zona Z4
- 32097: frente 5,0 m; 107 m²; zona Z4
- 32156: frente 7,5 m; 232 m²; zona Z4
- 32382: frente 4,7 m; 97 m²; zona Z4
- 32708: frente 5,7 m; 134 m²; zona Z4
- 34598: frente 4,5 m; 115 m²; zona Z4
- 35156: frente 4,9 m; 112 m²; zona Z4
- 35691: frente 3,7 m (soma 7,4 m em 2 pedaços); 182 m²; zona Z4
- 36038: frente 4,0 m; 120 m²; zona Z4
- 36463: frente 4,7 m; 112 m²; zona Z4
- 36757: frente 4,5 m; 115 m²; zona Z4
- 75654: frente 7,5 m; 290 m²; zona Z2

**Frente quebrada (14):**

- 2986: frente 6,8 m (soma 9,8 m em 2 pedaços); 279 m²; zona Z2
- 4771: frente 3,9 m (soma 9,8 m em 4 pedaços); 237 m²; zona Z2
- 4851: frente 3,0 m (soma 5,3 m em 2 pedaços); 221 m²; zona Z2
- 12890: frente 4,5 m (soma 9,0 m em 3 pedaços); 212 m²; zona recusa(parque)
- 22608: frente 5,8 m (soma 18,6 m em 4 pedaços); 152 m²; zona Z5A
- 23339: frente 4,4 m (soma 8,7 m em 2 pedaços); 246 m²; zona recusa
- 31827: frente 4,7 m (soma 8,1 m em 2 pedaços); 115 m²; zona Z4
- 50188: frente 6,3 m (soma 12,0 m em 3 pedaços); 149 m²; zona recusa(cor)
- 51814: frente 5,8 m (soma 10,5 m em 3 pedaços); 402 m²; zona Z2
- 55251: frente 6,4 m (soma 11,2 m em 2 pedaços); 374 m²; zona recusa(cor)
- 81108: frente 7,7 m (soma 12,0 m em 3 pedaços); 254 m²; zona Z2
- 83647: frente 6,7 m (soma 10,6 m em 2 pedaços); 235 m²; zona Z2
- 83777: frente 4,9 m (soma 11,0 m em 3 pedaços); 276 m²; zona Z3
- 91958: frente 4,0 m (soma 11,8 m em 4 pedaços); 263 m²; zona Z3

**Regra barrou: distância (8):**

- 17144: residential a 11,3 m do eixo; 277 m²; zona Z2
- 33895: secondary a 8,7 m do eixo; 191 m²; zona Z4
- 36684: residential a 12,6 m do eixo; 237 m²; zona Z4
- 71700: primary a 10,1 m do eixo; 219 m²; zona Z2
- 76658: primary a 10,5 m do eixo; 394 m²; zona recusa
- 77883: secondary a 8,8 m do eixo; 230 m²; zona recusa
- 86651: primary a 10,1 m do eixo; 419 m²; zona Z2
- 86694: primary a 10,1 m do eixo; 190 m²; zona recusa(cor)

**Regra barrou: encosta em outro lote (4):**

- 10249: residential a 7,5 m; 263 m²; zona recusa(cor)
- 21769: residential a 8,6 m; 391 m²; zona Z2
- 33508: residential a 8,8 m; 243 m²; zona Z4
- 100608: residential a 5,7 m; 240 m²; zona Z2

**Lote de fundo/interno (7):**

- 453: residential a 15,2 m; 245 m²; zona Z3
- 5343: residential a 30,7 m; 221 m²; zona Z2
- 5774: residential a 31,2 m; 136 m²; zona Z2
- 8063: residential a 33,5 m; 140 m²; zona Z5A
- 35749: residential a 29,4 m; 116 m²; zona Z4
- 37067: residential a 29,7 m; 99 m²; zona Z4
- 75422: residential a 30,3 m; 184 m²; zona Z5A

**Condomínio/via particular/estacionamento (10):**

- 2344: service/customers/parking_aisle a 3,5 m; 92 m²; zona Z2
- 16549: service/parking_aisle a 3,8 m; 95 m²; zona Z2
- 48791: service/private/driveway a 3,6 m; 224 m²; zona Z3
- 54079: service/driveway a 3,5 m; 420 m²; zona Z5A
- 54081: service/driveway a 3,5 m; 420 m²; zona Z5A
- 56462: service/private a 3,6 m; 416 m²; zona Z2
- 74635: service/destination/parking_aisle a 3,6 m; 71 m²; zona Z2
- 80821: service/private/driveway a 3,6 m; 285 m²; zona Z2
- 86596: residential a 8,5 m; 158 m²; zona Z2
- 87634: service a 3,6 m; 420 m²; zona Z3

**Campus/fora do perímetro (43):**

- 3095: service a 3,6 m; 290 m²; zona recusa(branco)
- 3331: service/private/driveway a 3,5 m; 290 m²; zona recusa(branco)
- 38130: track a 3,1 m; 421 m²; zona recusa(campus)
- 38351: track a 3,1 m; 420 m²; zona recusa(campus)
- 38352: track a 3,1 m; 420 m²; zona recusa(campus)
- 38490: track a 3,1 m; 420 m²; zona recusa(campus)
- 39175: track a 3,1 m; 420 m²; zona recusa(campus)
- 39197: track a 3,1 m; 420 m²; zona recusa(campus)
- 39249: track a 3,1 m; 420 m²; zona recusa(campus)
- 39317: track a 3,2 m; 420 m²; zona recusa(campus)
- 39765: track a 3,0 m; 420 m²; zona recusa(parque)
- 39935: track a 3,1 m; 420 m²; zona recusa(campus)
- 40286: track a 3,3 m; 405 m²; zona recusa(campus)
- 40478: track a 3,1 m; 310 m²; zona recusa(campus)
- 40627: track a 3,2 m; 421 m²; zona recusa(campus)
- 40820: track a 3,1 m; 310 m²; zona recusa(campus)
- 40925: track a 3,2 m; 408 m²; zona recusa(campus)
- 40960: track a 3,1 m; 420 m²; zona recusa(campus)
- 41060: unclassified a 5,8 m; 420 m²; zona recusa(campus)
- 41263: track a 3,1 m; 420 m²; zona recusa(campus)
- 41276: track a 3,1 m; 420 m²; zona recusa(campus)
- 41376: track a 3,1 m; 420 m²; zona recusa(campus)
- 41465: track a 3,1 m; 420 m²; zona recusa(campus)
- 41510: track a 3,1 m; 421 m²; zona recusa(campus)
- 41715: track a 3,1 m; 420 m²; zona recusa(campus)
- 41831: unclassified a 5,8 m; 408 m²; zona recusa(campus)
- 41896: footway a 0,6 m; 419 m²; zona recusa(campus)
- 42177: footway a 3,0 m; 245 m²; zona recusa(campus)
- 42692: track a 3,1 m; 421 m²; zona recusa(campus)
- 43065: unclassified a 5,8 m; 513 m²; zona recusa(campus)
- 43127: unclassified a 5,8 m; 444 m²; zona recusa(campus)
- 43338: unclassified a 6,2 m; 402 m²; zona recusa(campus)
- 43345: unclassified a 6,5 m; 381 m²; zona recusa(campus)
- 43468: unclassified a 5,8 m; 121 m²; zona recusa(campus)
- 43615: unclassified a 5,8 m; 383 m²; zona recusa(campus)
- 43860: unclassified a 5,9 m; 420 m²; zona recusa(campus)
- 44083: service/parking_aisle a 3,5 m; 77 m²; zona recusa(campus)
- 44498: track a 3,1 m; 420 m²; zona recusa(campus)
- 44518: track a 3,1 m; 356 m²; zona recusa(campus)
- 44661: track a 3,2 m; 217 m²; zona recusa(campus)
- 64602: service a 3,6 m; 504 m²; zona recusa(campus)
- 64858: unclassified a 5,8 m; 420 m²; zona recusa(campus)
- 96754: unclassified a 5,8 m; 421 m²; zona fora do quadro

**Geometria ruim (3):**

- 7014: residential a 27,7 m; 60 m²; zona Z5A
- 17518: residential a 21,5 m; 43 m²; zona Z3
- 42134: service/parking_aisle a 3,6 m; 65 m²; zona recusa(campus)
