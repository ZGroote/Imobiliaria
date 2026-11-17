# Tarefa 27 do Motor: aviso de relevo no estudo (caminho 1 do RELATORIO-26)

**Quem:** Motor.
**Galho:** `viabilidade/pos-124`, worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** só `viabilidade/motor/` (código, testes, exemplos e linha de base, se mudarem).
**Não fazer:** não commitar; não tocar em `terreno/` (o Terreno está na T21), tela, relatório nem `conferir.py`.

## Decisão da central

Caminho 1: **só um aviso, a conta não muda.** O caminho 2 (somar lote − rua ao gabarito) fica de fora. O MDE-SP não entra: não declara licença.

## O que fazer

1. O lote já traz `relevo` (o `novo_lote.py` calcula; os pilotos vêm de `dados/relevo-pilotos.json`), com `declividade_pct`, `cota_min_m` e `cota_max_m`. Hoje o motor não lê nada disso e só escreve "Relevo ignorado".
2. Quando `declividade_pct ≥ 10`, cada opção ganha um alerta com o número:
   "Terreno com ~X% de declive (Copernicus GLO-30, 30 m, mede topo de prédio e árvore): o térreo, o subsolo e a altura medida a partir da via podem mudar; conferir com levantamento planialtimétrico."
   - Use "pode", nunca "é".
   - Sem `relevo` no lote, fica como hoje.
3. Deixe o motor já pronto para um campo opcional `relevo.desnivel_lote_rua_m`: se `|valor| ≥ 2`, o mesmo alerta, com "lote ~X m acima/abaixo da rua". O Terreno vai gravar esse campo numa tarefa futura. Por enquanto, teste com um lote sintético.
4. No lote com gabarito do art. 80, o alerta de folga da T24 deve citar o desnível quando ele existir, porque a lei mede "acima do nível da via".
5. O piloto 37607 tem 14,2% de declive, então o estudo dele muda. Atualize os exemplos e a linha de base do `test_8b` só pelo alerta novo, e diga no relatório o que mudou, byte a byte, em cada arquivo.

## Testes

- `test_motor.py`, `test_estudar.py`, `test_varrer.py`
- `conferir.py` 8/8. Se o terreno estiver solto por causa da T21 e falhar por isso, diga.

Casos novos: 37607 (com aviso), um piloto plano (sem aviso), lote sintético com `desnivel_lote_rua_m` de +3 e de −1.

## Relatório

`viabilidade/motor/RELATORIO-27.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 27 pronta"`.
