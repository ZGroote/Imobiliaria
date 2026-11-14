# Etapa 1 — medida dos quarteirões e escolha dos três trechos (09/09/2026)

Nada foi alterado no mapa nesta etapa. Só medida.

Ferramentas novas, ambas reexecutáveis:

```powershell
python modelos_urbanos/v1/integracao/auditar_quarteiroes.py          # geometria
$env:MAPA_V='v16-moveis'
python modelos_urbanos/v1/integracao/medir_trecho.py                 # câmera fixa
```

Saídas: `auditoria-quarteiroes-sao-carlos.json` (427 quarteirões medidos num recorte de
1.200 m em torno de −525,−1598), `trechos-sao-carlos.json` (as três câmeras),
`medicao-trechos-sao-carlos-antes.json` e `trecho-{A,B,C}-antes.png`.

## O que a medida diz, e onde ela contraria o diagnóstico do plano

**A fonte de lotes em uso não tem lote profundo.** `lotes_saocarlos.geojson` (a
alternativa que o encaixe usa porque `v7/dados/lotes_saocarlos_completo.geojson` não
existe no disco) tem **frente mediana 11,9 m e fundo mediano 25,1 m**, com p90 em
25,1 m — a grade está travada no `DEPTH` de 25 m. **Zero** dos 427 quarteirões tem
fundo mediano acima de 35 m. A faixa profunda que se vê na tela não vem do polígono
de lote: vem do MURO, que foi gerado de outra camada.

**Toda a procedência é sintética.** 427 de 427 quarteirões têm lote com as
propriedades `lid/quadra/nx/ny` da grade — nenhum traz `fonte`, `planta` ou
`loteamento`. Não há, nesta camada, um único lote de planta oficial a preservar.
Isso não autoriza subdividir nada: autoriza dizer que, **nesta fonte**, não há
cadastro a proteger.

**Muro e lote vêm de camadas diferentes, e isso é o defeito de raiz.**

| medida | valor no recorte |
|---|---|
| muro a mais de 1 m de qualquer divisa da fonte em uso | mediana **26,6%** do quarteirão |
| muro desenhado ÷ divisa que a fonte em uso pediria | mediana **1,17**, p90 1,68 (A: 2,26) |
| área de "lote" caindo fora do miolo (rua/vizinho) | mediana **1.728 m²**, em **427 de 427** quarteirões |
| cobertura da quadra por lote | mediana **57%** (a meta registrada em PIPELINE.md §21 era 93,8%) |
| núcleo de quadra sem lote nenhum | mediana **3.191 m²** |
| ocupação mediana do lote pelo telhado | **18,1%** |
| terreno FECHADO pelos muros na tela | frente mediana **62 m**, fundo mediana **65,6 m** |
| ponta de muro que morre no vazio (nem rua, nem outra divisa) | mediana **7,8%** das pontas |
| encaixes 1:1 da biblioteca no recorte | **781** (3 a 4 por quarteirão) |

A linha do "terreno fechado pelos muros" é a que corresponde ao print: o muro
desenhado **não fecha lote**. Ele fecha regiões de 62 × 66 m (p90 127 × 138 m), porque
fileiras inteiras não têm muro e 8% das divisas terminam no meio do quintal. É isso
que o olho lê como "faixa profunda".

## A causa, identificada

`v7/pipeline/` foi restaurado de `backups/2026-09-04-0131-codigo.zip` — **um backup
anterior aos consertos §21 e §22 do PIPELINE.md**, que são de 04/09 mais tarde. O
código no disco hoje não tem:

| o que falta | onde deveria estar | efeito medido |
|---|---|---|
| `fundo_ate_o_meio`, teto pela largura menor, testada mín. 5 m | `lotes_sinteticos.py` | fileira para em 25 m; núcleo vazio |
| `sem_sobra`, `funde_inuteis` | `lotes_sinteticos.py` | cunha e caco viram lote murado sem casa |
| `planta_complemento` | `juntar_lotes.py` | quadra de planta oficial fica 48% coberta |
| `PROF_REF` | `build_v7_city.py` | casa de 19 m de profundidade em lote fundo |
| `enderecos_extra` (CNEFE) | `ocupacao.py` | menos lote com prova → menos muro e menos casa |

Enquanto isso, `padrao/cidades/sao-carlos.json` (que vive fora de `v7/` e sobreviveu)
já declara `lote.fundo_max_m` e `fontes.enderecos_extra` — **a configuração é a de
depois, o código é o de antes**. Regenerar hoje, sem repor o código, reproduz o defeito
reportado ponto a ponto.

**Procedência incerta, registrada:** os arquivos `v7/dados/muros_segs.json`,
`portoes.json` e `v7/sao-carlos-v7.city.json` que estão no disco são saídas do pipeline
**pós-conserto** (voltaram byte a byte do HTML montado, ver [[mapa-3d-v7-e-dado-nao-build]]).
O `lotes_saocarlos_completo.geojson` que os gerou **não** volta do HTML. Ou seja: hoje
o mapa desenha muro e casa de uma camada de lote que ninguém consegue mais abrir. Toda
comparação lote×muro feita contra a fonte alternativa herda essa divergência — não é
erro de medida, é o estado real do disco.

## Os três trechos escolhidos

Escolhidos pela geometria do QUARTEIRÃO (que é estável), não pela do lote (que vai
mudar na etapa 2). Câmeras congeladas em `trechos-sao-carlos.json`.

| | A — quadra grande, miolo vazio | B — terrenos estreitos | C — esquina irregular |
|---|---|---|---|
| centro (x, z) | −862,4 / −1767,6 | −1127,8 / −1687,0 | −459,8 / −1444,8 |
| câmera (dist, phi, theta) | 210 / 0,78 / 0,6 | 185 / 0,78 / 0,6 | 150 / 0,80 / 0,6 |
| área do miolo | 22.542 m² | 16.777 m² | 7.366 m² |
| lotes / frente / fundo | 36 / 11,9 / 25,1 m | 43 / **9,6** / 25,0 m | 37 / 11,9 / 25,1 m |
| cobertura da quadra | **27%** | 45% | 74% |
| núcleo vazio | **16.416 m²** | 8.695 m² | 0 |
| lote fora do miolo | 2.858 m² | 2.203 m² | **3.125 m²** |
| ocupação do lote | 12,8% | 20,8% | 17,1% |
| muro solto (>1 m da divisa) | **57,2%** | 36,8% | 24,5% |
| muro ÷ divisa esperada | **2,26** | 1,86 | 1,06 |
| células fechadas pelo muro | 3 (fundo p90 **161,7 m**) | 2 (fundo p90 **276,9 m**) | 1 (200,1 m) |
| área/retângulo mínimo | 0,755 | 0,654 | **0,494** |
| encaixes da biblioteca | 3 | 4 | 3 |

## Linha de base de desempenho (mesma máquina, Chrome headless, SwiftShader)

Página `v16-moveis/sao-carlos-v16-moveis.html`, **11.198.085 bytes**.

| trecho | chamadas | triângulos | modelos da biblioteca na cena | volumes antigos | ms/quadro | heap |
|---|---|---|---|---|---|---|
| A | 180 | 3.052.758 | 2.665 | 15.226 | 9,97 | 468,3 MB |
| B | 164 | 2.908.115 | 2.649 | 15.431 | 4,34 | 468,3 MB |
| C | 167 | 3.270.626 | 2.982 | 16.339 | 7,26 | 496,9 MB |

O ms/quadro sai do rasterizador de software com relógio de parede de um HTTP local
(o da página está virtualizado pelo `--virtual-time-budget`). Ele **não é comparável
entre trechos** — A tem menos triângulo que C e mede mais tempo. Serve só para o mesmo
trecho antes e depois, e mesmo assim com folga: o orçamento de 10% da etapa 6 está
dentro do ruído desta sonda para diferenças pequenas.

## O que a etapa 2 tem que fazer, à luz disto

Não "revisar a geração de profundidade": **repor o código que já existia e está
documentado**, rodar a cadeia 3→9 inteira e medir de novo nos mesmos três trechos.
Inventar subdivisão nova antes disso seria consertar um sintoma cuja causa está escrita
no PIPELINE.md.
