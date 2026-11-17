# Relatório da tarefa 14 do Projetista: por que o prédio parou + o lote grande que sobra

Data: 17/11. Nada foi commitado. Mexi só em `vitrine.py`, `test_vitrine.py` e na pasta `vitrine/` (refeita). `torre.py` e `gerador.py` **não foram tocados**. Os diagnósticos abaixo foram feitos em scripts avulsos, sem mudar nenhum arquivo do módulo.

## O que mudou no `resumo.json` (nas duas versões)

- **`limitante`**, dentro de `numeros` e de `numeros_terreo`: `{"andares": "...", "unidades": "..."}`, em português simples.
  - `andares` vem do `parou` da torre, traduzido. Exemplos reais:
    - terreno 1: "O recuo cresce com a altura: o andar entre 6 e 9 m não cabe (15,55 m² ficariam fora da área em que se pode construir)."
    - terreno 6: "Chegou na altura máxima do terreno (64,5 m): o próximo andar passaria dela."
    - se a torre não registrar `parou`: "A torre não registrou motivo para parar." (não acontece hoje nos 5 terrenos)
    - texto de `parou` que eu não conheço passa como está (não invento).
  - `unidades` vem do que o gerador fez: "O gerador desenha um núcleo só (escada, elevador e shaft), com até N unidades por andar." N é o programa que de fato coube (6 em quase todos; **3 no terreno 4**, com a frase "com 6 unidades por andar não coube neste terreno"). Quando os andares de cima perdem unidades por causa do recuo, a frase diz de quanto para quanto (ex.: terreno 6: "de 6 caem para 2").
- **Vagas sem térreo:** `vagas = {"valor": null, "unidade": "vagas", "nota": "estudo sem térreo: sem garagem"}`. Com térreo, igual a antes.

## O resto não mudou (conferido campo a campo)

Comparei a vitrine de antes com a nova, arquivo por arquivo:
- `resumo.json`: só entram `limitante` e a `vagas` sem térreo (0 vira `null` + nota). Todo o resto é igual.
- `estudo-previa*.json` e `indice.json`: mesmo conteúdo. Só mudam o `revision_id` e o `content_sha256` da prévia (e a frase do alerta que cita o id). Causa: os módulos `validador/sintese/torre/gerador` foram remontados hoje às 17:06 na cópia de trabalho; geometria e números são os mesmos. Não é efeito da minha mudança (não mexi em nenhum deles).
- O teste novo trava os números de hoje (andares, unidades e vagas dos 5 terrenos `ok`).

## Diagnóstico do lote grande (não implementado)

Medido nos 5 terrenos `ok` (sem térreo = só andares tipo). "Envelope" = onde se pode construir no 1º andar. "CA" = área computável ÷ área do lote (conta minha; o validador pode medir de outro jeito).

| Terreno | Lote m² | Envelope 1º andar m² | Laje m² | Laje ÷ envelope | Un/andar | CA sem térreo | CA com térreo | `ca_basico` | `ca_maximo` |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 652 | 455 | 412 | **91%** | 6 | 1,19 | 0,71 | 2 | 3 |
| 4 | 1.605 | 1.271 | 371 | 29% | 3 | 0,80 | 0,65 | 1,4 | 1,4 |
| 5 | 2.685 | 2.267 | 533 | **24%** | 6 | **0,38** | 0,23 | 1,4 | 1,4 |
| 6 | 1.599 | 1.263 | 531 | 42% | 6 | 4,97 | 4,70 | 2 | 4 |
| 7 | 1.608 | 1.292 | 533 | 41% | 6 | 1,63 | 1,37 | 2 | 3,5 |

Leitura:
- **Terreno 1** é pequeno de verdade: a laje já ocupa 91% do envelope. Não sobra lote.
- **Terrenos 4 e 5** ficam muito abaixo do CA permitido (0,80 e 0,38 contra 1,4).
- **Terreno 6** passa do `ca_maximo` (4,97 contra 4). A torre não limita por CA. Vale a Central olhar (não sei se o validador mede igual).
- A laje nunca passa de ~533 m²: é o teto de **uma** laje com um núcleo e 6 unidades de até 75 m².

### Achado mais importante: a laje fica encostada na borda do envelope

Nos terrenos 5, 6 e 7 a distância da laje até a borda do envelope do 1º andar é **0,00 m**. O gerador acha a primeira posição que cabe, no canto. Como o recuo cresce com a altura, o 3º andar do terreno 5 sai "15 m² para fora" **num lote de 2.685 m²**. Teste: mesma laje, só deslocada para o centro do envelope do 1º andar, e conto quantos andares cabem sem escalonar:

| Terreno | Andares hoje | Andares com a laje no centro |
|---|---|---|
| 1 | 2 | 2 |
| 4 | 2 | 0 (envelope irregular; o centro não serve, precisa de busca) |
| 5 | 2 | **16** |
| 6 | 7 | 15 |
| 7 | 4 | 15 |

(Contagem "sem escalonar", só do envelope; não passou pelo validador nem pelo limite de altura.)

### Segunda alavanca: o gerador já aceita mais de 6 unidades por andar

Teste direto no `gerar_pavimento` (só diagnóstico):

| Terreno | Resultado por `unidades` |
|---|---|
| 5 | 6, 8, 10, 12, 14 todos `gerado` (CA 0,38 → 0,50 → 0,62 → 0,74 → 0,86, ainda 2 andares) |
| 4 | **6 falha** (núcleo não cabe na profundidade), **8 e 10 geram**, 12 e 14 não cabem no envelope |
| 1 | só 6 gera; 8 não cabe; 10+ inviável |

Ou seja, `PROGRAMAS = (6, 5, 4, 3, 2)` na vitrine corta a subida cedo: o terreno 4 cai para 3 por andar quando 8 funciona.

### Proposta, da menor para a maior

1. **(A) Escolher a posição da laje pelo que sobra de folga, não pela primeira que cabe.** No `gerador.py`, onde ele varre a grade `passo_posicao_m`: entre as posições válidas, preferir a de maior folga até a borda do envelope (ou a que deixa mais andares caberem). Custo: **~15 linhas** em `gerador.py` + **2 testes** (laje não encostada na borda num lote folgado; terreno 5 com mais de 2 andares). Efeito esperado: o maior (terreno 5: 2 → vários andares). **Risco:** muda a posição em lotes que hoje encostam, então o dourado `SHA_TAREFA_6` e os números dos terrenos 5, 6 e 7 vão mudar; precisa de decisão da Central. `gerador.py` é do Terreno/Central, por isso não mexi.
2. **(B) Tentar mais unidades por andar na vitrine.** `PROGRAMAS = (14, 12, 10, 8, 6, 5, 4, 3, 2)` (ou parar em 10). Custo: **1 linha** em `vitrine.py` + ajuste do teste dos números. Efeito: o terreno 5 passa de 12 para ~24–28 unidades (com 2 andares) e o terreno 4 deixa de cair para 3 por andar. Laje maior significa menos andares nos lotes apertados (terreno 4 com 8: 2 andares), então o ganho de CA é menor que o de unidades; B sozinho não resolve o "porquê só 2 andares".
3. **(C) Mais de um núcleo ou duas lâminas.** Só se A + B não bastarem. Custo: **~100+ linhas** no gerador (um núcleo por 6 a 8 unidades, ligação das duas alas, validador de rota de fuga) e uma suíte nova. Não recomendo agora.

Minha sugestão: **A primeiro** (é a causa do "2 andares" num lote de 2.685 m²), depois B (1 linha).

## Testes

- `test_vitrine` (8 testes, passam): novo `test_limitante_vagas_e_numeros_de_hoje` (todo terreno `ok` tem `limitante` com texto não vazio nas duas versões; sem térreo `vagas.valor` é `null` com a nota; com térreo continua número; andares, unidades e vagas dos 5 terrenos iguais aos de hoje; o terreno 4 mostra "até 3 unidades"; o 6 cita altura máxima). O teste de unidade ajustado para aceitar `limitante` e `vagas` nula sem térreo.
- Rodei e **passam**: `test_projetista`, `test_gerador`, `test_editor`, `test_torre`, `test_para_vista`, `test_fluxo`, `test_limites`, `test_sintese`. O `SHA_TAREFA_6` que falhava no relato 12 agora passa (a cópia remontada às 17:06 trouxe os módulos alinhados).

## Como rodar

```
python -I -X utf8 viabilidade/projetista/vitrine.py viabilidade/projetista/vitrine
python -I -X utf8 viabilidade/projetista/test_vitrine.py
```

## Sobra no git

`viabilidade/projetista/` continua inteira não rastreada. Mexidos nesta tarefa: `vitrine.py`, `test_vitrine.py`, a pasta `vitrine/` e este `RELATORIO-14.md`. Nada commitado.
