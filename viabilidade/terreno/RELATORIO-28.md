# T28: frente juntada não infla a testada (16/11)

Mexi só em `terreno/gerar_lotes.py` e `terreno/test_novo_lote.py`. Não toquei em `motor/` e não commitei.

1. **O que mudou:**
   - Na junção da B (`frentes_curtas`), um pedaço só entra no grupo se a reta do começo do primeiro pedaço ao fim do último passar a soma dos pedaços em até **1 m** (`JUNTAR_FOLGA_M`).
   - Vale também para a junção que cruza a quina do começo do contorno.
   - Se não couber, os pedaços seguem sozinhos e ainda podem passar pela A, se algum tiver 5 m ou mais.
2. **Sorteio de 500 (semente 20261120): 306 aceitos** (eram 307). Mudam três lotes, não só o 4851:

| lote | soma dos pedaços | reta | T27 | T28 |
|---|---:|---:|---|---|
| 4851 | 2,97 + 2,28 = 5,24 m | 9,81 m (+4,57) | aceito, estreita | **sem frente** (nenhum pedaço chega a 5 m) |
| 51814 | 5,82 + 3,15 = 8,97 m | 11,53 m (+2,56) | aceito, juntada | **continua aceito**, como estreita de 5,82 m (só o pedaço maior) |
| 23339 | 4,28 + 4,41 = 8,70 m | 9,87 m (+1,17) | barrado pela zona | **sem frente** |

   - O 23339 passa do limite por só 17 cm. Fiz como a tarefa pede (1 m), e de qualquer jeito ele já era recusado pela zona.
   - O 51814 mudou porque, na T27, eu tinha olhado só a diferença do `lote.frente` e não a deste lote. Ele tem um vão de cerca de 2,5 m entre os pedaços.
   - Os outros 305 aceitos ficaram iguais.
3. **Teste novo** (`test_novo_lote.py`):
   - Um lote de 3,5 + 3,5 m com recorte de 4,5 m no meio é recusado.
   - Sem a trava, o mesmo lote juntaria numa estreita de 7 m com reta de 11,5 m. Isso mostra que é a trava que recusa.
   - O 2986 continua juntado.
4. **Rodadas:**
   - `novo_lote --testar`: OK. Pilotos, remembramento e zona auto saíram byte a byte iguais.
   - `gerar_lotes --testar`: OK.
   - `conferir.py`: **8/8 aprovados**.
