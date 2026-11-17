# T31: o texto ignorado pode esconder uma divisa de zona? (16/11)

Galho `viabilidade/cor-quadro`. Esse é o alerta do usuário sobre a T30: ignorar texto e córrego não pode fazer aceitar um lote que está, na verdade, em cima de um limite real entre zonas.

## O risco

Um nome de rua tem mais de 10 m de altura no mapa. Se a linha entre duas zonas passa por baixo do texto e o lote está no meio dele, a zona do outro lado só aparece na borda do texto. Essa borda pode ficar a mais de 10 m do lote, e aí a divisa de 10 m não pega.

## O que fazer

1. **Caso sintético adversário:** Z2 de um lado e Z1 do outro. O limite entre as duas fica inteiro coberto por uma faixa preta de 12 a 16 px, e o lote fica no meio da faixa. Hoje isso aceita ou recusa? Diga o resultado.
2. **Medição nos lotes resgatados pela P1:** para cada lote que só passa por causa da P1, junte ao lote a mancha de pixels ignorados (sem cor ou parque solto) que encosta nele. Meça a distância desse conjunto, lote mais mancha, até a mancha 3×3 mais próxima de outra zona ou cor que não é zona.
   - Faça isso nos 13 do sorteio de 500.
   - Faça também num sorteio maior, de 3.000 lotes (semente 20261121), ou no cadastro inteiro se couber em ~30 min.
   - Diga quantos ficam a menos de 10 m e abra **todos** esses no Anexo 02.
3. **Se o caso 1 aceitar, ou se algum lote do item 2 estiver de fato numa divisa:** mude a divisa de 10 m para medir a partir do lote mais a mancha ignorada, em vez de só o lote. Rode de novo o sorteio de 500 e diga quantos dos 319 caem.
   - Se nada cair, não mude nada e diga que o risco está coberto, com os números.
   - Os pilotos e os aceitos que não usam a P1 não podem mudar.

## Teste

- O caso adversário do item 1 entra no `test_sugerir_zona.py` e tem que recusar.
- Rode `novo_lote --testar`, `gerar_lotes --testar`, `test_ponto.py` e `conferir.py` (8/8).

Não toque em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`. Não commite. Relato em `terreno/RELATORIO-31.md`, curto e numerado, com prints pequenos em `terreno/evidencias/t31/`. Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 31 pronta"`.
