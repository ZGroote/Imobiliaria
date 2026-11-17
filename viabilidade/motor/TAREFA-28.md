# Tarefa 28 do Motor: aviso próprio para frente pela rua do OSM + BAIXA da REVISAO-9

**Galho:** `viabilidade/pos-124`. **Onde mexer:** só `viabilidade/motor/`. **Não fazer:** não commitar; não tocar em `terreno/`.

1. **Frente `rua_osm` (T21 do Terreno).** Hoje cai na mensagem genérica de frente presumida (`motor.py:~784`). Dê um alerta próprio em cada opção, com o nome da via quando houver (`via_osm.nome`):
   "Frente presumida pela rua do OpenStreetMap (<nome ou 'via sem nome'>, <classe>): indica frente provável, não prova testada legal nem acesso público; pode ser estrada de terra. Conferir na matrícula e no local."
   Se o lote tiver mais de uma frente `rua_osm`, o alerta já sai do Terreno; não duplique.
2. **BAIXA da `revisao/REVISAO-9.md`.** `acrescimo_topo_m` inválido (negativo, texto) passa calado em lote sem gabarito. Valide sempre (mesmo `ValueError`), mesmo quando não entra na conta.
3. **Testes:** caso sintético com frente `rua_osm` com nome e sem nome; `acrescimo_topo_m=-5` e `"abc"` sem gabarito dão erro. Pilotos e linha de base não devem mudar (nenhum piloto usa `rua_osm`); se mudarem, diga por quê.
4. `test_motor.py`, `test_estudar.py`, `test_varrer.py` ok.

Relatório: `viabilidade/motor/RELATORIO-28.md`, até 6 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 28 pronta"`.
