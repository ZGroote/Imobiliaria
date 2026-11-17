# T27: frente de lote estreito, frente quebrada e avenida larga (16/11)

Galho `viabilidade/sem-frente`. Leia antes o seu `RELATORIO-26.md`. Implemente as propostas A, B e C, cada uma com sua conta separada:

1. **A. Frente mínima de 5 m no lugar de 8 m.** 5 m é a testada mínima da Lei 6.766/79 (art. 4º, II). Para não aceitar lote de fundo com corredor, use a trava que você propôs: o lado na rua precisa ter pelo menos metade da largura média do lote. Diga como mediu a largura média. Não desça de 5 m.
2. **B. Juntar os pedaços da frente** quando estão **na mesma via** e somam 8 m ou mais. Pedaços de vias diferentes (esquina, lote passante) não se somam. Hoje o 22356 dá 15 m somando duas ruas; ele deve continuar com 7,5 m por rua (e passar pela A, se a trava deixar).
3. **C. Distância ao eixo de 11 m só para `primary` e `secondary`.** As outras classes continuam em 8 m.
4. Classe, ângulo de 20°, "encostar em outro lote" e "via ligada à rede" **não mudam**.

## Prova

- **Sorteio de 500 (semente 20261120):** aceitos antes e depois, e a conta de cada proposta sozinha e das três juntas.
- **Lista dos que passam a aceitos**, com a proposta que os liberou, a frente nova e a zona.
- Abra **todos os lotes que passam a aceitos** na foto (e no Anexo 02, se a zona for a dúvida). Se **um** deles não tiver frente para rua pública de verdade, por exemplo fundo com corredor, condomínio ou estacionamento, conte no relato e ajuste a regra antes de entregar. Folha de prints pequena em `terreno/evidencias/t27/`.
- **Lotes já aceitos:** a frente só pode subir ou continuar igual. Diga quantos mudam e em quê. Zona, geometria e o resto do `lote.json` não mudam. Pilotos: `novo_lote --testar` igual.
- **Motor com lote estreito, só rodando:** `estudar.py --zona auto` em 3 lotes novos de 4,5 a 6 m (ex.: 34598, 32097, 6073). Diga o que sai: quantas opções, alertas, e se algum quebra. Não mexa no `motor/`.

## Teste

- Um caso sintético de lote de 5,5 m que passa.
- Um de fundo com corredor de 5 m que continua recusado pela trava.
- Um de esquina com 2 pedaços de 5 m em ruas diferentes que não soma.
- Uma avenida a 10,5 m que passa e uma rua `residential` a 10,5 m que não passa.
- Rode `novo_lote --testar`, `gerar_lotes --testar`, `test_sugerir_zona.py` e `conferir.py` (8/8).

Não toque em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`. Não commite. Relato em `terreno/RELATORIO-27.md`, curto e numerado. Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 27 pronta"`.
