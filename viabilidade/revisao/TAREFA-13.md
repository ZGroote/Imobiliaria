# Revisão 13: frente estreita, juntada e avenida (T27) (16/11)

Revise o commit da T27 no galho `viabilidade/sem-frente` (`terreno/gerar_lotes.py`, `terreno/novo_lote.py`, `terreno/test_novo_lote.py`). Leia `terreno/RELATORIO-26.md` e `terreno/RELATORIO-27.md`.

Procure principalmente:
1. **Lote sem frente de verdade aceito.** Pense em lote de fundo com corredor, bandeira, condomínio e estacionamento. A trava de "metade da largura média" (área ÷ fundura) pode falhar em lote irregular, em L ou muito raso? O relato admite que um corredor de 7 m passa: existe caso mais comum que esse?
2. **Juntada (B):** pedaços de vias diferentes nunca somam? O "mesmo nome" do OSM pode juntar duas ruas distintas que têm o mesmo nome? O vão de até 5 m pode atravessar a frente do vizinho?
3. **Testada exagerada:** no 4851, a soma dá 5,24 m, mas o `lote.frente` (a reta) dá 9,81 m, e o motor lê a reta como testada. Isso pode fazer o motor passar um lote pelo mínimo de testada da zona quando ele não passaria? Diga se é ALTA, MÉDIA ou BAIXA, com um exemplo.
4. **Lotes já aceitos não mudam:** a A e a B só rodam como último recurso? Confira em 5 lotes aceitos do sorteio.
5. **Avenida (C):** a classe vem do OSM. Uma via `primary` estreita a 11 m pode pegar um lote de fundo?
6. Rode `conferir.py` (8/8).

Achados em `revisao/REVISAO-13.md`, como ALTA/MÉDIA/BAIXA, com arquivo:linha e como reproduzir. Se não houver nenhum, escreva "sem achados". Não conserte nada e não commite. Ao terminar: `maestri ask "Claude Code" "Revisor tarefa 13 pronta"`.
