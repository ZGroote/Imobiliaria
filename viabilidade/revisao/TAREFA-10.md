# Tarefa 10 do Revisor: T21, T22 (Terreno) e T27, T28 (Motor)

**Galho:** `viabilidade/pos-124`. **Diff:** `git diff e9541362..89639ef2 -- '*.py' '*.json' '*.gz'`. Trabalhe numa cópia temporária desse commit, fora da worktree. **Não fazer:** não commitar; não mexer na worktree.

## O que olhar
1. **T21, rua do OSM** (`terreno/gerar_lotes.py`, `osm_vias.py`):
   - as travas (5 classes, ligada à malha, ≤ 8 m do eixo, ≤ 20°, não encostar em outro lote) funcionam?
   - abra 5 lotes `rua_osm` inéditos (fora dos 31 do RELATORIO-21) na foto: a frente está certa?
   - o `.gz` sai igual byte a byte do `osm_vias.py`? Só se o pbf estiver em `Desktop/imobiliaria/fontes_osm/`; senão, diga.
   - o `make_valid` do vizinho recusa mesmo quando a área muda mais de 1%?
2. **T22, desnível** (`terreno/novo_lote.py`): sinal certo (lote acima da rua = positivo)? E o que acontece em lote de esquina, com asfalto de duas ruas?
3. **T27/T28, motor:**
   - o aviso de relevo nunca muda `metricas`?
   - o aviso `rua_osm` aparece só na frente principal?
   - `acrescimo_topo_m` dá erro com e sem gabarito?
   - o `test_estudar` ficou frouxo demais?
4. Rode `conferir.py` na cópia.

## Relatório
`viabilidade/revisao/REVISAO-10.md`, achados por gravidade (ALTA/MÉDIA/BAIXA), cada um com comando e saída. Depois: `maestri ask "Claude Code" "Revisor tarefa 10 pronta"`.
