# T30: texto e córrego por cima não recusam; mensagens claras (16/11)

Galho `viabilidade/cor-quadro`. Leia antes o seu `RELATORIO-29.md`. Implemente a P1, a P2 e a P3:

1. **P1:** pixel sem cor e Pq. Ecológico solto (sem mancha de 3×3 px, com a mesma função `mancha` de antes) deixam de recusar o lote.
   - Branco, campus e Represa continuam recusando sempre.
   - A zona precisa cobrir pelo menos metade dos pixels do lote. Isso não muda.
   - A divisa de 10 m e a regra de "mais de uma zona" não mudam.
2. **P2 e P3, mensagens de recusa mais claras** (só o texto; a recusa continua):
   - Fora do quadro: "fora do mapa do Anexo 02". Se o lote fica a oeste da borda, acrescente "(a oeste fica Ibaté: lote provavelmente fora do município de São Carlos)". Não diga "Ibaté" para os que ficam a leste.
   - Branco: "fora do perímetro urbano do Anexo 02".
   - Campus: "campus universitário: não é zona do art. 25".
   - Se `motor/varrer.py` ou algum teste conferir o texto antigo, diga onde e não mexa no `motor/`. Eu passo para o Motor.

## Prova

- **Sorteio de 500:** aceitos antes (306) e depois. Liste os que passam a aceitos, com a zona. A sua simulação deu os 13 de texto e córrego.
- **Abra os novos aceitos no Anexo 02** e confira se a zona é a mesma que você viu a olho. Se algum sair diferente, pare e conte no relato. Folha pequena em `terreno/evidencias/t30/`.
- **Lotes já aceitos:** nada pode mudar. Pilotos: `novo_lote --testar` igual.
- **Recusados que trocam de motivo:** liste-os e diga o motivo antigo e o novo.

## Teste

- Um caso sintético de texto preto de 2 px sobre Z2 que passa.
- Um de branco dentro do lote que continua recusando.
- Um de mancha de 4×4 px de outra cor sem zona que continua recusando.
- O texto da mensagem de Ibaté.
- Rode `novo_lote --testar`, `gerar_lotes --testar`, `test_sugerir_zona.py`, `test_ponto.py` e `conferir.py` (8/8).

Não toque em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`. Não commite. Relato em `terreno/RELATORIO-30.md`, curto e numerado. Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 30 pronta"`.
