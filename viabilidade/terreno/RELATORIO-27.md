# T27: frente estreita, frente quebrada e avenida (16/11)

Mexi só em `terreno/gerar_lotes.py`, `terreno/novo_lote.py` e `terreno/test_novo_lote.py`. Não toquei em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`, e não commitei. A folha de prints e a lista ficaram em `terreno/evidencias/t27/`.

1. **O que mudou (`gerar_lotes.py`):**
   - **C. Avenida:** a rua do OSM pode estar a até **11 m** do eixo se for `primary` ou `secondary`. As outras classes continuam com 8 m (`OSM_EIXO_LARGA_M`, `OSM_LARGAS`).
   - **A e B entram como último recurso** (`frentes_curtas`). Só rodam quando nenhuma regra antiga achou frente de 8 m, então lote que já era aceito não muda.
     - Elas usam as mesmas regras de antes (asfalto, juntar arestas, asfalto a 12 m, OSM), com o mesmo ângulo de 20°, o mesmo "encostar em outro lote" e a mesma "via ligada". A única diferença é que aceitam pedaços a partir de 2 m.
   - **B. Pedaços juntados:** pedaços seguidos no contorno do lote se juntam quando:
     - são da mesma família;
     - no OSM, são da mesma via (mesmo id ou mesmo nome);
     - estão na mesma direção, com até 30° de diferença;
     - o vão entre eles tem até 5 m.
     - Esquina e lote de duas ruas não somam, porque são vias diferentes.
     - Somou 8 m ou mais: vira frente **juntada**.
   - **A. Frente estreita:** se a frente (inteira ou somada) tem de **5 a 8 m** e tem **pelo menos metade da largura média do lote**, vira frente **estreita**.
   - **Como medi a largura média:** área do lote ÷ fundura. A fundura é a extensão dos vértices do lote na direção perpendicular à frente.
     - Um lote de 6 × 30 m dá 6 m.
     - Um lote de fundo com corredor de 5 m e corpo de 20 × 20 m dá cerca de 13 m. Aí a trava pede 6,5 m e o corredor de 5 m não passa.
     - Abaixo de 5 m nada passa.
   - `novo_lote.py` grava um **AVISO** no `obs`, dizendo o tamanho e mandando conferir a testada na matrícula:
     - "frente quebrada no cadastro, somando N pedaços (a + b m)";
     - "frente estreita de X m (… metade da largura média, Y m)".
   - A regra que fica gravada continua a original (`arestas_colineares`, `tolerancia_asfalto_12m` ou `rua_osm`), e as mensagens do motor continuam valendo.
2. **Sorteio de 500 (semente 20261120):**

| configuração | aceitos | sem frente |
|---|---:|---:|
| antes | 278 | 118 |
| só A (5 m + trava) | 301 (+23) | 89 |
| só B (juntar pedaços de 8 m) | 282 (+4) | 111 |
| só C (avenida a 11 m) | 281 (+3) | 112 |
| **A + B + C** | **307 (+29)** | **79** |

   - Com A+B+C, 39 lotes saem de "sem frente": 29 são aceitos e 10 são barrados depois pela zona (5 "vários motivos", 3 "mais de uma zona", 1 "só divisa", 1 "cor insegura").
   - A conta não fecha somando as propostas: 4 lotes passam por A e também por B, e 3 só passam com A e B juntas (frente estreita feita de pedaços).
3. **Os 29 novos aceitos** (lista completa em `evidencias/t27/novos-29.json`):

| proposta | lotes | frente | zonas |
|---|---|---|---|
| A (estreito) | 8230, 6073, 31677, 6959, 31811, 7352, 7165, 32156, 10984, 22608, 30708, 20808, 31157, 32097, 5421, 32708, 18795, 75654, 31434 | 5,0 a 8,3 m | Z2, Z4, Z5A |
| A+B (juntada ≥8 m; também passa só por A) | 81108, 83647, 51814, 2986 | 9,7 a 11,5 m | Z2 |
| A+B juntas (estreita feita de pedaços) | 35691, 4851, 83777 | 7,4 a 9,8 m | Z2, Z3, Z4 |
| C (avenida) | 71700 (primary, eixo 10,1 m), 33895 (secondary, 8,7 m), 86651 (primary, 10,1 m) | 12 a 22,7 m | Z2, Z4 |

   - Pela turma da T26, os 29 vêm só de "estreito" (19), "quebrada" (7) e "distância" (3).
   - Nenhum veio de "fundo", "condomínio/particular", "campus", "encosta" ou "geometria".
4. **Foto de satélite:** abri **os 29** (Esri, zoom 18, 60 × 60 m; o zoom 19 não tem imagem aqui). Folha em `evidencias/t27/novos-29.jpg`.
   - Todos são casa estreita, terreno vazio, galpão ou mata com o lado verde virado para a rua ou avenida que se vê na foto.
   - **Nenhum falso:** nenhum lote de fundo com corredor, condomínio ou estacionamento. Não precisei ajustar a regra.
   - As zonas saíram pelo caminho normal (nenhum caiu em "dúvida"), então não precisei do Anexo 02.
   - Dois pedem olho na matrícula:
     - **22608:** forma torta, e a frente de 5,85 m é a ponta mais fina do lote.
     - **71700:** terreno dentro de mata, na beira da avenida.
5. **Lotes já aceitos:** nenhum dos 278 mudou, em nenhuma das 4 configurações. Zona, geometria, frente e o resto do `lote.json` ficaram iguais campo a campo.
6. **Pilotos:** `novo_lote --testar` reproduz todos os pilotos igual (ver item 9).
7. **Motor** (`estudar.py --zona auto`, três lotes estreitos):
   - 32097 (Z4, 107 m², frente 5,0 m), 6073 (Z2, 110 m², 5,9 m) e 8230 (Z2, 88 m², 5,8 m) **dão 0 opções**.
     - A, B, C e D são impossíveis: a laje máxima é de 28,6, 37,8 e 27,1 m², abaixo dos 80 m².
     - Os alertas saem certos: "Testada de X m abaixo do mínimo da zona (10 m)", "Lote de N m² abaixo do mínimo da zona (200 m²)", "Frente presumida" e "Lote fora do domínio testado do motor".
     - Nada quebrou.
   - O de 4,5 m que eu queria testar (34598) é recusado no terreno, como deve: menos de 5 m.
8. **Testes novos** (em `test_novo_lote.py`):
   - Lote sintético de 5,5 m passa como estreito; o de 4,5 m não passa.
   - Lote de fundo com corredor de 5 m e de 6 m: **os dois são recusados**.
     - O de 6 m é recusado pela trava. Sem a trava, ele passaria.
     - O de 5 m é recusado antes, pelo "encostar" (ver item 10).
   - Esquina com 5,5 m em cada rua (Rua A e Rua B): sai como duas frentes estreitas de 5,5 m, **sem somar**.
   - Avenida (`primary`/`secondary`) com eixo a 10,5 m passa; rua `residential` a 10,5 m não passa; `primary` a 11,5 m não passa.
   - Lotes reais:
     - 2986 sai como juntada, com 2 pedaços;
     - **22356 continua com 7,5 m por rua**: passa por A como duas frentes estreitas de 7,504 m, sem somar as duas ruas, com o AVISO no `obs`.
9. **Rodadas:**
   - `novo_lote --testar`: OK, com a linha nova da T27. Os 5 pilotos, o remembramento e a zona auto saíram byte a byte iguais (7 arquivos).
   - `gerar_lotes --testar`: OK.
   - `test_sugerir_zona.py`: OK. `test_ponto.py`: OK.
     - Os dois rodam sem `-I`: com `-I`, o Python não acha o PIL, como já acontecia na T25.
   - `conferir.py`: **8/8 aprovados** (motor, terreno, lote-novo, estudar, relatorio, lei, visual, nada fora de `viabilidade/`).
10. **Limites (o que fica de fora ou pede decisão):**
    - **O "encostar em outro lote" come a frente de 5 m no OSM.** A margem é de 0,5 m nas pontas, então com vizinho na divisa um lado de exatamente 5 m é barrado. Na prática, a regra do OSM aceita a partir de pouco mais de 5 m. A regra do asfalto não tem essa margem. Não mexi, porque a tarefa manda manter o "encostar".
    - **A trava não segura corredor largo.** Num lote bandeira com corredor de 7 m e corpo de 20 × 20 m, a largura média é de cerca de 13,5 m, a metade é 6,75 m, e o corredor passa. Corredor de 6 m ou menos é barrado.
    - **Na frente quebrada, o AVISO e o `lote.frente` mostram números diferentes.** O AVISO usa a soma dos pedaços. O `lote.frente` é a reta do primeiro ao último pedaço, contando os vãos (até 5 m) e os dentes menores que 2 m.
      - No 4851 (frente serrilhada no cadastro): soma de 5,24 m e reta de 9,81 m.
      - Nos outros, a diferença é de menos de 0,7 m.
      - A reta é o que o motor lê como testada.
    - **Com um vão de 10 m em vez de 5**, passariam mais 3 da turma "quebrada" da T26, todos como estreitos: 4771 (5,9 m), 91958 (6,5 m) e 12890 (6,8 m). O 12890 só chega aos 9 m inteiros com 60° de ângulo. Mantive 5 m e 30°.
    - Do grupo "estreito" da T26, 6 ficam de fora por terem menos de 5 m (36038, 36757, 34598, 35156, 32382, 36463). Os outros 4 do grupo (20224, 31176, 17975 e o 22356) saem de "sem frente" mas são barrados pela zona.
    - Da turma "quebrada", 55251, 50188 e 23339 ganham frente juntada mas são barrados pela zona ("vários motivos"). Da turma "distância", 76658 e 86694 ("vários motivos") e 77883 ("mais de uma zona") também são barrados pela zona.
    - O 35691 (3,7 + 3,7 = 7,5 m) só passa com A e B juntas.
