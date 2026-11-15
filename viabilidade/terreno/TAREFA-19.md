# Tarefa 19 do Terreno: o `metodo` dos pilotos ainda descreve o ajuste antigo (BAIXA, pós-merge do #124)

**Quem:** Terreno.
**Galho:** `viabilidade/pos-124` (saiu da main depois do merge do PR #124), worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** `viabilidade/terreno/testar_pilotos.py`, `viabilidade/terreno/dados/zonas-anotar.py` e o `lotes-piloto.json` que o `--reproduzir` gera. Liberado mexer em `dados/` só nesse script.
**Não fazer:** não commitar; não tocar em motor, tela, relatório, `conferir.py`, imagens nem nos dois JSON de posicionamento.

## Por quê

Na T18 você conferiu os 7 pilotos no lugar novo (afim por 21 cruzamentos) e nenhuma zona mudou. Mas o `metodo` de cada piloto em `lotes-piloto.json` ainda diz "ajuste afim ... usando cinco vértices do perímetro do Anexo 02.A" (`dados/zonas-anotar.py:~85`). Quem lê o piloto não fica sabendo que o ajuste antigo errava 40–100 m nem que houve reconferência.

O `testar_pilotos.py` guarda o SHA256 dos 5 pilotos originais (`ORIGINAIS`, linha ~30) sobre o registro inteiro, menos `zona_origem` e `zona_conferida`. Isso protege a anotação original, e queremos manter essa proteção.

## O que fazer

1. Não reescreva o `metodo` original: ele é o registro do que foi feito em 14/11. Acrescente um campo novo, `reconferencia`, gerado pelo `zonas-anotar.py`, com:
   - data `2026-11-15`;
   - método novo: afim direta EPSG:31983 → pixel por 21 cruzamentos, RMSE e máximo do anexo 02 lidos de `zonas-posicionamento.json`, sem número escrito à mão;
   - resultado: zona confirmada e a distância à divisa que você mediu na T18;
   - fonte: `terreno/RELATORIO-18.md`.
2. Tire `reconferencia` do hash em `testar_pilotos.py` (mesma tupla de `zona_origem` e `zona_conferida`). Os valores de `ORIGINAIS` **não mudam**. Se não der para fazer sem mudar o hash, pare e explique no relatório por quê.
3. Os 2 pilotos que não são originais (Eixo e Z2) também ganham `reconferencia`.
4. Teste: o `--reproduzir` gera o arquivo igual ao versionado, e os 7 pilotos têm `reconferencia` com a zona igual a `zona_id`.

## Testes

- `python -I viabilidade/terreno/testar_pilotos.py --reproduzir` e sem o argumento
- `python -I -X utf8 viabilidade/motor/test_estudar.py` (se algum estudo comparado byte a byte mudar, diga qual e por quê)
- `python -I -X utf8 viabilidade/conferir.py`: 8/8

## Relatório

`viabilidade/terreno/RELATORIO-19.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 19 pronta"`.

## Decisão da central (15/11, depois do RELATORIO-19)

**Opção 2.** Está liberado mexer em `terreno/preparar_zonas.py`, mas só para ele **não** copiar `reconferencia` para o lote.
- O campo fica só em `dados/anotacoes-zonas.json`, junto da anotação original.
- O lote, o motor e a linha de base do `test_8b` ficam iguais.
- Aplique o seu patch e ajuste:
  - o hash do `testar_pilotos.py` volta ao que era, porque o campo não chega ao lote;
  - o teste da zona confirmada lê `anotacoes-zonas.json`.
- Aceite: `testar_pilotos.py`, com e sem `--reproduzir`; `conferir.py` 8/8 contando só o que é seu (o Motor está mexendo em `motor/` na T24, então se der falha lá, diga qual é).
- Atualize o `RELATORIO-19.md` (até 8 linhas) e avise como antes. Depois, siga para a `TAREFA-20.md`.
