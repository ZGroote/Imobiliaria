# T30: texto e córrego não recusam; motivos mais claros (16/11)

Mexi em `terreno/sugerir_zona.py`, `terreno/test_sugerir_zona.py` e `terreno/ZONA-AUTO.md` (a descrição da regra). Não toquei em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`, e não commitei. A folha e a lista ficaram em `terreno/evidencias/t30/`.

1. **P1 (o que mudou na regra):**
   - Pixel sem cor (texto, linha de córrego) e pixel solto do Pq. Ecológico (sem mancha de 3×3, a mesma `mancha`) não recusam mais.
   - Branco, campus e Represa continuam recusando sempre. Isso vale **pela cor do próprio pixel**.
     - Na primeira rodada usei a cor recuperada, e o 60197 (córrego) recusava como "campus": a linha azul herdava a cor do campus do vizinho.
     - Voltei para a cor crua, como na simulação da T29.
   - A zona tem que cobrir pelo menos metade dos pixels do lote.
   - A divisa de 10 m e a regra de "mais de uma zona" não mudaram.
2. **P2/P3 (texto; a recusa fica igual):**
   - Fora do quadro: "Fora do mapa do Anexo 02 (borda, legenda ou encarte)".
     - Se o lote está **todo** a oeste da borda do mapa, o motivo ganha "(a oeste fica Ibaté: lote provavelmente fora do município de São Carlos)".
     - A leste, no encarte ou cruzando a borda, não fala de Ibaté.
   - Branco: "Fora do perímetro urbano do Anexo 02".
   - Campus: "Campus universitário: não é zona do art. 25".
   - **Decisão minha:** a mensagem clara só sai com mancha de 3×3 px.
     - No 55251 e no 86694, o campus era de 1 a 3 pixels na borda de um traço, e dizer "campus" ali seria falso.
     - Pixel solto de branco ou campus continua recusando, mas com o motivo genérico ("Cor sem correspondência…").
     - Quando branco ou campus já explicam a recusa, o genérico não se repete.
3. **Quem confere o texto antigo:**
   - **No `motor/`, nada confere.** O `motor/varrer.py` só copia o motivo para o `varredura.csv` e agrupa o resumo pelo texto. Os grupos do resumo vão ter nomes novos.
   - O único teste com o texto antigo era o `terreno/test_sugerir_zona.py`, que atualizei.
   - O texto antigo segue citado em `auditoria/AUDITORIA-6b.md`, que é histórico, e não mexi.
4. **Sorteio de 500 (semente 20261120):**
   - **306 → 319 aceitos**, os mesmos 13 da simulação da T29 (lista em `evidencias/t30/novos-30.json`):
     - Z2: 12545, 21498, 22356, 23086, 51670, 55625, 57190, 60197, 62964, 75478;
     - Z1: 68151, 72288;
     - Z3: 81626.
   - **Nenhum dos 306 aceitos mudou:** o `lote.json` saiu igual campo a campo.
   - "Cor insegura" ficou com 2: o 63932 e o 90722, os de sombra de rótulo, em que a zona cobre menos da metade.
5. **Conferência no Anexo 02 (`evidencias/t30/folha-30.jpg`, recorte de ~140 m e de ~420 m):**
   - Os 13 saem com a mesma zona que vi a olho na T29.
   - Cada um fica dentro de uma cor só (Z1 bege, Z2 amarelo, Z3 azul-claro), com texto ou córrego por cima.
   - Nenhum diferente.
6. **Recusados que trocaram de motivo (41; continuam recusados):**
   - 22 de Ibaté. Antes: "Fora do quadro georreferenciado…". Agora: "Fora do mapa do Anexo 02 … (a oeste fica Ibaté…)". São os 22 da T29, todos com o aviso.
   - 7 passaram de "Cor sem correspondência" para "Fora do perímetro urbano do Anexo 02": 1782, 2369, 97953, 102806, 105161, 107324 e 2032 (o da linha do perímetro).
   - 3 passaram de "Cor sem correspondência" para "Campus universitário: não é zona do art. 25": 39961, 64640, 64897.
   - 9 de "vários motivos". Em todos, o motivo antigo era "Cor sem…" mais outro:
     - 65522 e 54539: "Cor sem…; Divisa" → só "Divisa/cor não zonal a menos de 10 m" (agora caem em "só divisa, 2+ candidatas");
     - 60316 e 65447: "Cor sem…; mais de uma zona" → só "Cores de mais de uma zona";
     - 1677: "Cor sem…; Divisa" → "Fora do perímetro urbano; Divisa";
     - 43628 e 54349: "Cor sem…; Divisa" → "Campus universitário; Divisa";
     - 55251 e 86694: "Cor sem…; Divisa" → "Fora do perímetro urbano; Cor sem…; Divisa" (branco de verdade, mais 1 a 3 px de campus solto).
7. **Testes novos (`test_sugerir_zona.py`):**
   - Sobre Z2 dentro do lote:
     - faixa preta de 8 px, que deixa 2 px sem cor: **passa**;
     - 2×2 de parque: **passa**;
     - 4×4 de branco: recusa como "Fora do perímetro";
     - 4×4 de campus: recusa como "Campus";
     - 4×4 de parque: recusa como "Cor sem…";
     - 2×2 de branco ou de campus: recusa com o genérico;
     - lote quase todo preto: recusa (menos da metade).
   - Texto de Ibaté: lote a 3.000 px a oeste da borda leva o texto inteiro. Os lotes cruzando a borda, no encarte e a leste não falam de Ibaté.
8. **Rodadas:**
   - `novo_lote --testar`: OK, pilotos, remembramento e zona auto byte a byte iguais. O `test_sugerir_zona.py` roda dentro dele.
   - `gerar_lotes --testar`: OK.
   - `test_ponto.py`: OK.
9. **`conferir.py`: 8/8 aprovados** (motor, terreno, lote-novo, estudar, relatorio, lei, visual, nada fora de `viabilidade/`). Depois dele, rodei de novo o `gerar_lotes --testar` e o `test_ponto.py` com o código final: OK.
