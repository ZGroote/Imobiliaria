# Tarefa 8 do Terreno: deixar o lote novo rápido

**Quem:** Terreno.
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/terreno/`.
**Não fazer:**
- não commitar;
- não gravar imagem no repositório;
- não mudar nenhum resultado.

## Por quê

O `novo_lote.py` leva de 7 a 10 s por lote, e cerca de 6 s disso é só para ler as bases: o GeoJSON de 65 MB, as ruas (`street_tris.json`) e o raster. Veja `RELATORIO-4.md` a `RELATORIO-7.md`.

## O que fazer

1. **Medir** quanto leva cada carga.
2. **Índice em cache, fora do git.**
   - Na primeira execução, gravar um índice compacto (por exemplo `.npz` com os polígonos já em UTM e as ruas) em `viabilidade/terreno/.cache/`. Ponha essa pasta no `.gitignore` do módulo, acrescentando a linha sem apagar as outras.
   - Nas execuções seguintes, ler do cache.
   - O cache carrega o sha256 das fontes. Se uma fonte mudar, o cache é refeito.
   - Use só stdlib, numpy ou shapely, que já estão instalados. Nada de pickle de objeto shapely.
3. **Meta:** lote novo abaixo de 2 s com o cache quente. Mostre o tempo com cache frio e com cache quente.
4. **Prova de que nada mudou.** O `--testar` inteiro passa, e os 5 pilotos e o remembramento saem byte a byte iguais com e sem cache.
5. **Teste de fonte alterada:** uma cópia temporária da fonte, com um byte trocado, faz o cache ser refeito.

## Relatório

`viabilidade/terreno/RELATORIO-8.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 8 pronta"`.
