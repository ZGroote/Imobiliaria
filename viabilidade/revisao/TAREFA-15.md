# Revisão 15: divisa escondida debaixo do texto (T31) (16/11)

Revise o commit da T31 no galho `viabilidade/cor-quadro` (`terreno/sugerir_zona.py`, `terreno/test_sugerir_zona.py`, `terreno/ZONA-AUTO.md`). Leia `terreno/RELATORIO-31.md`.

Procure principalmente:
1. **O furo fechou?** Monte você mesmo uma variação do caso adversário que o teste não cobre: texto inclinado, limite em diagonal, córrego em vez de texto, ou lote cruzando a ponta da faixa. Alguma variação ainda aceita um lote que passa do limite escondido?
2. **Lote sem pixel da P1 não muda:** confira em 5 aceitos do sorteio de 500 que `distancia_divisa_m` e as `alternativas` são as mesmas do commit anterior.
3. **A mancha cresce só por pixel sem cor ou parque solto?** Pode atravessar branco, campus ou outra zona?
4. **Candidatas:** a outra zona achada pela mancha entra nas candidatas sem trazer cor que não é zona (branco, campus) como "zona".
5. Rode `conferir.py` (8/8).

Achados em `revisao/REVISAO-15.md`, como ALTA/MÉDIA/BAIXA, com arquivo:linha e como reproduzir. Se não houver nenhum, escreva "sem achados". Não conserte nada e não commite. Ao terminar: `maestri ask "Claude Code" "Revisor tarefa 15 pronta"`.
