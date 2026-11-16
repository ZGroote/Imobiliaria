# Revisão 14: texto e córrego não recusam (T30) (16/11)

Revise o commit da T30 no galho `viabilidade/cor-quadro` (`terreno/sugerir_zona.py`, `terreno/test_sugerir_zona.py`, `terreno/ZONA-AUTO.md`). Leia `terreno/RELATORIO-29.md` e `terreno/RELATORIO-30.md`.

Procure principalmente:
1. **Zona errada aceita.** O pixel sem cor que agora é ignorado pode esconder uma faixa estreita de outra zona, de Eixo ou de área especial (ZEIS, APP etc.) que estava por baixo do texto? A divisa de 10 m ainda pega esse caso?
2. **Branco, campus e Represa** continuam recusando sempre, pela cor crua? Algum caminho deixa de recusar?
3. **Mensagens:** o "Ibaté" só aparece quando o lote está todo a oeste da borda? Alguma mensagem afirma algo que o mapa não mostra (por exemplo, "campus" por 1 pixel)?
4. **Aceitos antigos não mudam.** Confira em 5 lotes aceitos do sorteio.
5. Rode `conferir.py` (8/8).

Achados em `revisao/REVISAO-14.md`, como ALTA/MÉDIA/BAIXA, com arquivo:linha e como reproduzir. Se não houver nenhum, escreva "sem achados". Não conserte nada e não commite. Ao terminar: `maestri ask "Claude Code" "Revisor tarefa 14 pronta"`.
