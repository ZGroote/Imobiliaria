# Tarefa 21 do Visual: os avisos novos aparecem bem no relatório?

**Galho:** `viabilidade/duas-zonas`.
**Onde mexer:** `viabilidade/relatorio/` e `viabilidade/visual/` (evidências).
**Não fazer:** não commitar; não tocar em `motor/` nem `terreno/`.

## Contexto
Desde o #124 o motor ganhou 3 avisos (`motor/RELATORIO-24.md`, `-27.md` e `-28.md`):
- **Folga dos 9 m do art. 80:** "Altura: sobram X m até os 9 m…", às vezes com "DEPENDE DE CONFIRMAÇÃO NA PREFEITURA" e com o desnível da rua.
- **Relevo:** "Terreno com ~X% de declive…" e "Lote ~X m acima/abaixo da rua…".
- **Frente pela rua do OSM:** "Frente presumida pela rua do OpenStreetMap…".

Esses textos são longos e ninguém olhou como ficam no `relatorio.html`, no computador e no celular.

## O que fazer
1. Gere relatórios com `motor/estudar.py` para:
   - 77015 (art. 80 e desnível de −5 m);
   - o piloto 37607 (declive de 14%);
   - um lote `rua_osm` do RELATORIO-21 (ex.: 12741);
   - um lote sem nenhum desses avisos.

   Use `--pasta` numa pasta temporária fora do repositório.
2. Tire print no computador e no celular (o mesmo jeito das evidências do `conferir.py`). Os avisos têm que ficar legíveis, sem estourar a largura, e o "DEPENDE DE CONFIRMAÇÃO" tem que ficar destacado.
3. Se algo estiver ruim, conserte só no `relatorio/relatorio.py` (CSS ou agrupamento), sem mudar o texto que o motor escreve. Exemplo: quando o mesmo aviso se repete em todas as opções, ele pode aparecer uma vez só, acima da tabela.
4. Se mexer no relatório, rode `relatorio/test_relatorio.py` e `conferir.py` 8/8, e diga se algum hash comparado byte a byte mudou.

Relatório: `viabilidade/visual/RELATORIO-21.md`, até 8 linhas, com o caminho dos prints de antes e depois. Depois: `maestri ask "Claude Code" "Visual tarefa 21 pronta"`.
