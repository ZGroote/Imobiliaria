# Relatório da tarefa 15 do Projetista: laje com folga + até 10 unidades por andar

Data: 17/11. Nada foi commitado. Mexi em `gerador.py`, `vitrine.py`, `test_gerador.py`, `test_vitrine.py` e na pasta `vitrine/` (refeita). `torre.py` **não foi tocado**.

## O que mudou

- **(A) `gerador.py`:** a laje não vai mais para a primeira posição da grade que cabe (o canto). Entre as posições válidas fica a de **maior distância até a borda do envelope**; empate: menor `v`, depois menor `u` (fixo, então os bytes não mudam). Para não varrer a grade inteira (97 s no terreno 5), a busca é grossa (a cada 8 passos de 0,5 m) e depois refina em volta da melhor; o resultado por tamanho de laje é guardado. Tempo: terreno 5 de 12 a 27 s por programa; terreno 1, 0,7 s. Teto conhecido: máximo local, não global (comentário `ponytail:` no código).
- **(B) `vitrine.py`:** `PROGRAMAS = (10, 8, 6, 5, 4, 3, 2)`. Todos os programas são gerados e compostos; vale o que dá **mais unidades no prédio inteiro** (sem térreo). Empate: o de mais unidades por andar. O programa tem que compor nas duas versões (sem e com térreo). A vitrine inteira leva ~5 min.
- **Torre e CA máximo:** o `torre.ca` do validador **acusa mas não recusa**: com a fonte da zona não verificada (sempre, no terreno 6) ele sai como `nao_verificado`, e a `compor` segue. A vitrine por isso **para a torre no `ca_maximo`** (soma o computável andar por andar, vindo das conferências `areas.computavel` do validador; mantém o maior número de andares tipo com CA ≤ máximo; `compor(..., pavimentos=k)`). O `limitante.andares` diz "Parou no CA máximo do terreno (X): com mais um andar o CA iria de A para B." Quando o CA fica entre o básico e o máximo, acrescenta "acima do básico (Y): depende de outorga onerosa" (mesma leitura do validador). Nenhum prédio sai acima do máximo, nem calado.
- `limitante.unidades` agora diz que o programa foi o que deu mais unidades no prédio inteiro e quais programas maiores não ganharam.

## Antes e depois (sem térreo | com térreo)

| Terreno | ca_básico / máx | Antes: andares, un, CA | Depois: andares, un, CA | Antes com térreo | Depois com térreo |
|---|---|---|---|---|---|
| 1 (22421) | 2 / 3 | 2 · 12 · 1,19 | **4 · 16 · 2,15** | 2 · 6 · 0,71 | **4 · 12 · 1,72** |
| 4 (30516) | 1,4 / 1,4 | 5 · 12 · 0,80 | **4 · 24 · 1,29** | 5 · 9 · 0,65 | **5 · 24 · 1,34** |
| 5 (37607) | 1,4 / 1,4 | 2 · 12 · 0,38 | **7 · 42 · 1,33** | 2 · 6 · 0,23 | **8 · 42 · 1,37** |
| 6 (q1382) | 2 / 4 | 21 · 93 · **4,97** | **9 · 72 · 3,78** | 21 · 87 · **4,70** | **10 · 72 · 3,85** |
| 7 (75352-54) | 2 / 3,5 | 6 · 30 · 1,63 | **11 · 66 · 3,49** | 6 · 24 · 1,37 | **11 · 60 · 3,24** |

O terreno 1 sem térreo (CA 2,15) fica acima do básico (2) e abaixo do máximo (3): o `limitante` diz "outorga onerosa".

Leitura:
- **Terreno 5:** de 2 para 7–8 andares, de 12 para 42 unidades. A laje saiu do canto. Para no CA máximo (1,4).
- **Terreno 6:** caía de 21 andares para 9 porque **antes passava do CA máximo** (4,97 contra 4). Agora para em 3,78. É redução, não perda: o prédio de antes era irregular.
- **Terreno 4:** 6 un/andar passa a caber (antes caía para 3). 24 unidades, para no CA máximo.
- **Terreno 1:** 4 andares × 4 un; para na altura máxima (13,5 m).
- Terreno 7: 11 andares, para no CA máximo (3,5).

## Dourados: o que mudou e por quê

- `SHA_TAREFA_6` (22421, prévia): **não mudou**. O 22421 tem a laje em 91% do envelope, não há folga para dar; o gerador escolhe o mesmo lugar. `test_para_vista`, `test_torre` (números do 22421), `test_editor` e `test_gerador` passam sem tocar em dourado nenhum.
- `HOJE` do `test_vitrine` (andares, unidades, vagas dos 5 terrenos): atualizado para a tabela de cima. Causa: (A) tirou a laje do canto e (B) abriu os programas até 10; o corte no CA máximo derruba o terreno 6.
- `test_indice_e_pastas`, `test_resumo_com_unidade_e_igual_a_torre`: unidades e computável do terreno 1 (12→16 un; 772,29→1399,42 m²; 461,23→1118,27 m² com térreo). Causa: terreno 1 deixou de ser 2 andares × 6 e passou a 4 andares × 4.
- `test_limitante_vagas_e_numeros_de_hoje`: o texto de unidades do terreno 4 ("até 3 unidades") virou "até 8" no terreno 6; o terreno 6 deixou de parar na altura máxima (agora para no CA); o teste passou a conferir "altura máxima" no terreno 1.

## Testes novos

- `test_gerador.test_laje_longe_da_borda_em_lote_folgado`: lote 60×40 sai com a laje a 11,1 m da borda do envelope (antes: 0,00 m) e duas rodadas dão os mesmos `content_sha256` e a mesma `busca`; o 22421 continua `gerado`.
- `test_vitrine.test_terreno_5_usa_o_lote_e_ninguem_passa_do_ca_maximo`: terreno 5 com mais de 2 andares; nenhum terreno, em nenhuma versão, passa do `ca_maximo`; acima do básico o `limitante` cita outorga onerosa; "CA máximo" aparece onde foi ele que parou o prédio.

Rodei e **passam**: `test_projetista`, `test_gerador`, `test_editor`, `test_torre`, `test_para_vista`, `test_fluxo`, `test_limites`, `test_sintese`, `test_cargas`, `test_pacote`, `test_sondagem`, `test_vitrine`.

## `--pilotos`

Continua funcionando (o `test_piloto_quebrado_nao_derruba_os_outros` roda com uma pasta própria). Pastas novas, como `viabilidade/terreno/pilotos-vagos`, entram igual.

## Como rodar

```
python -I -X utf8 viabilidade/projetista/vitrine.py viabilidade/projetista/vitrine
python -I -X utf8 viabilidade/projetista/test_vitrine.py
```

## Sobra no git

`viabilidade/projetista/` continua inteira não rastreada. Mexidos nesta tarefa: `gerador.py`, `vitrine.py`, `test_gerador.py`, `test_vitrine.py`, a pasta `vitrine/` e este `RELATORIO-15.md`. Nada commitado.
