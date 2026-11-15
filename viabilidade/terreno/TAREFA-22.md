# Tarefa 22 do Terreno: gravar o desnível lote − rua no lote novo (segue a T26/T27 do Motor)

**Galho:** `viabilidade/pos-124`. **Onde mexer:** só `viabilidade/terreno/`. **Não fazer:** não commitar; não tocar no motor nem em `lotes-piloto.json` sem dizer.

## Por quê
A T26 (`motor/RELATORIO-26.md`) mostrou que o Copernicus (DSM 30 m) erra a cota absoluta (+5 m de prédio), mas a diferença **lote − rua** é estável entre fontes (mediana 0,6 m, p90 1,5 m). A T27 já deixou o motor pronto para ler `relevo.desnivel_lote_rua_m` e avisar quando `|valor| ≥ 2` m.

## O que fazer
1. No `novo_lote.py` (que já lê o raster de relevo), grave `relevo.desnivel_lote_rua_m` = cota do lote − cota da rua na frente principal, com o mesmo método da T26 (diga qual: amostra no centro do lote x amostra no eixo da via em frente). Arredonde a 0,1 m. Sem frente ou sem raster: não grave o campo.
2. Grave junto `relevo.metodo_desnivel` com uma linha: fonte, resolução, que é DSM e que serve para triagem.
3. **Pilotos:** NÃO mexa em `lotes-piloto.json` nesta tarefa. Só diga quanto daria o desnível dos 7 pilotos e dos 5 lotes da subárea (74451, 77015, 77022, 77375 e 80172); ele deve bater com a T26 (77015 ≈ −3 a −5, 77022 ≈ +3 a +5).
4. **Amostra T20/T21** (500, semente 20261120): quantos aceitos teriam `|desnível| ≥ 2` m?

## Testes
`novo_lote --testar`, `gerar_lotes --testar`, `test_estudar`, `test_varrer`, `conferir.py` 8/8. Caso novo: um lote com raster sintético e desnível conhecido.

Relatório: `viabilidade/terreno/RELATORIO-22.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 22 pronta"`.
