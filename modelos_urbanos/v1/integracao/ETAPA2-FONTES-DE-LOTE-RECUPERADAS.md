# Etapa 2 — as fontes de lote, recuperadas e reconciliadas (10/09/2026)

A etapa 1 mediu e apontou a causa: `v7/pipeline/` tinha voltado de um backup anterior
aos consertos §21 e §22 do PIPELINE.md, enquanto a configuração da cidade era a de
depois. Esta etapa **não inventou parcelamento novo**: repôs o que já estava
documentado e rodou a cadeia inteira, para que casa, muro e portão saiam da mesma
fonte de lote.

## O que foi recuperado (dado)

| fonte | como | resultado |
|---|---|---|
| plantas oficiais | `rodar_tudo.py` revetorizou 171 plantas | 158 ok, **53.260** lotes georreferenciados |
| lote oficial | `consolidar` + `auditoria_tamanhos` + `filtrar_confiaveis` | 36.112 extraídos → **21.227 confiáveis** em 1.287 quadras |
| endereço SigaSC | `pipeline/fontes/sigasc_quadras.py --sonda` + `sigasc_enderecos.py` | **54.111** pontos |
| endereço CNEFE | zip do IBGE + `pipeline/fontes/cnefe.py` | **143.160** pontos (nível 1–3) |

Somados e deduplicados na grade de 1 m dão **166.445** pontos — exatamente o número
registrado em PIPELINE.md §22.1. É a primeira evidência de que a reposição bate com o
que existia.

**Um defeito silencioso encontrado no caminho:** `filtrar_confiaveis.py` lê
`padrao_lote`, que só `auditoria_tamanhos.py` escreve — e a etapa 0e do `rodar.py` não
chamava a auditoria. O filtro devolvia **zero** lote confiável sem erro nenhum. Além
disso `auditoria_tamanhos` lia e escrevia na RAIZ enquanto o pipeline usa `v7/dados/`,
e `relatorio.py` gravava o CSV em `plantas_pipeline/` enquanto a etapa 0d esperava
`v7/relatorios/` — o que fazia a etapa nunca ficar fresca. Os três estão corrigidos, e
a etapa 0e agora declara a auditoria na sua lista de scripts.

## O que foi reposto (código)

Tudo a partir de PIPELINE.md §21 e §22, com o motivo de cada regra no comentário:

| arquivo | o que voltou |
|---|---|
| `lotes_sinteticos.py` | `fundo_ate_o_meio` (raio da testada, metade da travessia), teto por `largura_menor/2`, teto **condicional** de `lote.fundo_max_m`, testada mínima de 5 m, `sem_sobra` (núcleo vira fileira de fundo, até `NIVEIS=3`, resto entra no vizinho de maior divisa), `funde_inuteis` (lote com menos de 11 m de fundo não é lote) |
| `juntar_lotes.py` | `planta_complemento`: a quadra de planta APROVADA é completada a partir de `miolo − união(lotes oficiais)`, com a frente × fundo daquela planta. Por construção não toca o desenho registrado |
| `build_v7_city.py` | `PROF_REF`: a fração `prof` da tabela `CLASSES` passa a medir sobre o lote de referência (25 m) e não sobre o lote inteiro — o fundo do lote não é o fundo da casa |
| `ocupacao.py` | soma `fontes.enderecos` + `fontes.enderecos_extra` e deduplica na grade de 1 m |

`lotes_sinteticos.py --demo` é o autoteste: em quadra de laboratório de 86 m exige
cobertura ≥ 90%, nenhum lote abaixo de 11 m de fundo, nenhuma sobreposição, e **exige
que o teto de 35 m NÃO corte** (cortar ali deixaria um núcleo de 16 m e reabriria o
defeito da §21); na gleba de 190 m exige que corte.

Reposição a partir de prosa não é recuperação do original. A evidência de que ficou
fiel é numérica: 166.445 pontos de endereço (documentado: 166.445), 1.026 quadras
completadas (documentado: 1.018 de 1.026), **95.628 prédios** contra os **96.168** do
`city.json` que veio do HTML e foi gerado pelo código original — 0,56% de diferença.

## A cadeia, rodada inteira

```powershell
python v7/pipeline/quadras_miolo.py      # 2   4.798 quadras
python v7/pipeline/lotes_sinteticos.py   # 3   143.201 lotes            (43 min)
python v7/pipeline/juntar_lotes.py       # 4   152.704 lotes            (16 min)
python v7/pipeline/ocupacao.py           # 5   81.448 ocupados          (7 min)
python v7/pipeline/gen_muros.py          # 6   317.454 seg / 5.778 km
python v7/pipeline/build_v7_city.py      # 7   95.628 predios
python v7/pipeline/gen_portoes.py        # 6b  79.430 portoes
python v7/pipeline/gen_chao.py; python v7/pipeline/gen_ruas.py   # 7b
$env:MAPA_V='v16-moveis'; python pipeline/montar.py sao-carlos   # 8
```

Composição da fonte dos 152.704 lotes: **planta 18.265** (desenho oficial, intocado),
planta_complemento 15.812, planta_refeita 15.325, sintético 103.302.

## Antes e depois, nos três trechos

| | A antes | A depois | B antes | B depois | C antes | C depois |
|---|---|---|---|---|---|---|
| lotes no quarteirão | 36 | **59** | 43 | 43 | 37 | 30 |
| cobertura da quadra | 27% | **95,6%** | 45,4% | **99,2%** | 74,3% | **94,0%** |
| núcleo vazio (m²) | 16.416 | **612** | 8.695 | **2** | 0 | 0 |
| lote fora do miolo (m²) | 2.858 | **8** | 2.203 | **5** | 3.125 | **6** |
| muro solto (>1 m da divisa) | 57,2% | **0,0%** | 36,8% | **0,0%** | 24,5% | **0,0%** |
| fundo mediano do lote | 25,1 m | 35,0 m | 25,0 m | 35,1 m | 25,1 m | 17,1 m |
| encaixes 1:1 no quarteirão | 3 | **10** | 4 | **20** | 3 | **7** |

Na cidade: encaixes em escala 1:1 de **6.771 → 50.260**, envelope médio 84,86 → 104,95 m².
`auditar_encaixes.py` confere os 50.260 e dá **zero** invasão de lote, muro, edificação
existente ou de outro encaixe. No recorte de 1.200 m os encaixes vão de 781 a 4.371.

Cobertura de quadra no recorte de 700 m do centro: **85,3%**, com o buraco restante
38,2% na borda, 32,7% no meio e **29,2% no núcleo** — contra 95,2% no núcleo antes do
conserto da §21. O miolo vazio deixou de ser a forma dominante da falta. Ainda está
abaixo dos 93,8% registrados em §21; ver "aberto", abaixo.

## Portões de aceite

`padrao/rodar_qa.py sao-carlos`, família de geometria — todos passam, e são exatamente
os critérios de aceite que o plano pede para esta etapa:

| portão | medido | limite |
|---|---|---|
| lote sobre a rua | **0,01%** | 1,00 |
| frente do lote encostada na rua (mediana) | **0,00 m** | 0,25 |
| quadra com lote fora do eixo da rua | **0** de 955 quadras de planta | 0 |
| muro sobre a rua | 0,22% (13,0 de 5.778 km) | 1,00 |
| casa sobre a rua | 0,53% | 1,00 |
| muro fora do chão | 0,00% | 1,00 |
| árvore fora da calçada | 0,00% | 0,00 |

Família de comportamento: 8 de 9 passam. `testar.mjs`, `testar_ruas.mjs`,
`testar_colisao_ruas.mjs` passam.

**O portão "custo do minimapa" reprovou por carga da máquina, não por regressão.**
Ele acusou `planta 1,02 ms > 0,30` enquanto três trabalhos pesados rodavam em paralelo;
repetido com a máquina ociosa deu **0,05 ms**, e nada nesta etapa toca o desenho da
planta do interior. Fica registrado como propriedade da sonda: ela cronometra com
relógio de parede, então concorrência por CPU vira reprova.

## Custo, contra o orçamento proposto na etapa 6 do plano

| | antes | depois | orçamento proposto |
|---|---|---|---|
| página comprimida | 11.198.085 B | 11.990.645 B (**+7,1%**) | +5% |
| triângulos, trecho A | 3.052.758 | 6.194.259 (**+103%**) | — |
| chamadas de desenho, trecho A | 180 | 186 (+3,3%) | — |
| ms/quadro, trecho A / B / C | 9,97 / 4,34 / 7,26 | 14,65 / 2,89 / 16,57 | +10% |
| heap, trecho A | 468,3 MB | 414,8 MB | — |

**Estoura o orçamento de arquivo e, no cronômetro, o de quadro.** É preciso ler com
honestidade: o dobro de triângulo é o preço de **3,5× mais modelo detalhado na cena**
(2.665 → 9.353 no trecho A), que é justamente o que as etapas 3 a 5 querem aumentar.
A chamada de desenho, que é o gargalo medido deste renderizador
([[mapa-3d-orcamento-render]]), praticamente não mexeu: +3,3%.

O ms/quadro desta sonda **não é comparável entre trechos nem confiável em diferença
pequena** — B melhorou e C piorou com contagem de triângulo quase igual. A decisão de
orçamento da etapa 6 tem que sair de medida em GPU real, não deste número.

## O que fica aberto

1. **Cobertura em 85,3%, não 93,8%.** O que falta agora é 38% na borda da quadra e
   33% no meio — cunha de esquina recusada pelo filtro de retângulo (`área/MRR < 0,62`)
   e pela testada mínima de 5 m. Não é mais miolo vazio.
2. **8.361 lotes ocupados sem casa** (10,3% dos 81.448). Só 95 deles falham por
   `frente < 3,6 m` ou `fundo < 8 m`; o resto não fecha nenhum partido da tabela. O
   rótulo do contador em `build_v7_city` diz "não comporta casa" para todos os casos e
   por isso engana. §21 registrou 7.471 nessa mesma situação — é resíduo conhecido,
   não regressão desta rodada.
3. **Ocupação do lote em 7,5% a 19,3%**, contra a faixa de composição de 35–55% que o
   plano propõe para a etapa 3. O lote cresceu (298 → 384 m² no trecho A) e a casa não.
   É exatamente o que a etapa 3 tem que atacar, e agora tem um terreno coerente embaixo.
4. **Nada foi publicado.** `v16-moveis/publicado` não foi tocado.
