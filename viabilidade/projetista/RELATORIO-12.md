# Relatório da tarefa 12 do Projetista: garagem que se cruza + vitrine de novo

Data: 17/11. Nada foi commitado. Mexi só em `torre.py`, `test_torre.py`, `vitrine.py`, `test_vitrine.py` e na pasta `vitrine/`. Não toquei em `validador.py`, `sintese.py` nem `test_limites.py` (do Terreno).

## O conserto (torre.py, função nova `_sem_cruzar`)

- **Causa:** na garagem do terreno 6, um vértice cai em cima da própria borda do contorno (hall chegando na divisa). O polígono exato é válido, mas o selo arredonda a 4 casas e aí o contorno se cruza, e a torre era recusada.
- **Regra:** depois de cortar cada peça do térreo, olho o contorno **já arredondado**. Se continua válido, a peça passa intacta (os bytes de quem já funcionava não mudam). Se se cruza, refaço o polígono arredondado com `make_valid` e separo nos pontos de encosto. Some só uma lasca de ~0,2 cm² do encosto; a área da garagem muda menos de 0,01 m².
- Os números do 22421 não mudaram (térreo + 1 andar, 6 unidades, 12 vagas), e a prévia sem térreo e com `--terreo` mantém os mesmos bytes: a parte da geometria é idêntica à de antes (conferido por diff, ver o aviso abaixo).

## Os 7 terrenos (vitrine refeita em `vitrine/`)

"Andares" conta o térreo quando ele existe. Tentativa de 6, 5, 4, 3 e 2 unidades por andar mantida.

| Terreno | Piloto | Sem térreo | Com térreo |
|---|---|---|---|
| 1 | 22421 | 2 andares, 12 unidades | 2 andares (térreo + 1), 6 unidades, 12 vagas |
| 2 | 22426 | **falhou** | — |
| 3 | 25297 | **falhou** | — |
| 4 | 30516 | 5 andares, 12 unidades (3 por andar) | 5 andares, 9 unidades, 9 vagas |
| 5 | 37607 | 2 andares, 12 unidades | 2 andares, 6 unidades, 15 vagas |
| 6 | q1382-11984-11988 | **ok**: 21 andares, 93 unidades | 21 andares, 87 unidades, 16 vagas |
| 7 | remembramento-75352-75354 | 6 andares, 30 unidades | 6 andares, 24 unidades, 15 vagas |

Motivos dos que falham (agora com a área do terreno, em português simples):
- Terreno 2: "Neste terreno (602 m²) o pavimento mínimo do gerador não cabe dentro da área em que se pode construir."
- Terreno 3: "Neste terreno (327 m²) o pavimento mínimo do gerador não cabe dentro da área em que se pode construir."

Usei essa frase nos dois porque é o que o gerador diz com 2 unidades (a última tentativa). Só trocaria por "pequeno demais" se o gerador devolvesse "inviável" na última tentativa (a frase para esse caso também existe no código). Não forcei prédio nenhum.

## Testes

- `test_torre`: caso novo `test_contorno_que_encosta_na_propria_borda` (a garagem do q1382 de verdade: válida no exato, cruzada arredondada; depois do conserto, todas as peças válidas e área quase igual; peça válida passa intacta; e de ponta a ponta no piloto q1382 o térreo sai e nenhum contorno do térreo é inválido).
- `test_vitrine`: o terreno 6 sai `ok`; 2 e 3 saem `falhou` com a área e sem jargão. Os 6 testes de vitrine passam.
- Passam: `test_projetista` (18), `test_gerador`, `test_fluxo` (5), `test_sintese` (13) e os 8 de `test_torre` fora a suíte encadeada.

## ⚠ O que NÃO passa, e não é meu

`test_para_vista` (a prova do dourado `SHA_TAREFA_6`) **está falhando**, e com isso falham também `test_editor`, `test_torre` e `test_vitrine` na parte que roda as suítes antigas. Isso começou às 09:44, quando `validador.py` e `sintese.py` foram mexidos (tarefa 13 do Terreno). Provei que não é o meu conserto: com o meu `_sem_cruzar` desligado, falha igual. A diferença na prévia do 22421 são só 2 linhas: o alerta "Regras com fonte não verificada" agora lista também `torre.altura, torre.ca, torre.continuidade, torre.permeabilidade, torre.to` (regras novas do validador), e por isso muda o `content_sha256`. A geometria e os números não mudaram.
Decisão da Central/Terreno: ou atualizar o dourado (`SHA_TAREFA_6`) com essa frase nova, ou tirar as regras novas do texto do alerta. Não atualizei o dourado.

As amostras da `vitrine/` já saíram com o alerta novo (as prévias dos 5 terrenos `ok` trazem essa frase).

## Como rodar

```
python -I -X utf8 viabilidade/projetista/vitrine.py viabilidade/projetista/vitrine
python -I -X utf8 viabilidade/projetista/test_torre.py
python -I -X utf8 viabilidade/projetista/test_vitrine.py
```

## Sobra no git

`viabilidade/projetista/` continua inteira não rastreada. Mexidos nesta tarefa: `torre.py`, `test_torre.py`, `vitrine.py`, `test_vitrine.py`, a pasta `vitrine/` (refeita) e este `RELATORIO-12.md`. Nada commitado.
