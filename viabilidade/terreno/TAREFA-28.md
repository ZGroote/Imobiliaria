# T28: frente juntada não pode inflar a testada (16/11)

Galho `viabilidade/sem-frente`. Leia o achado BAIXA de `revisao/REVISAO-13.md`. O problema: na frente juntada, `lote["frente"]` vai do começo do primeiro pedaço ao fim do último, e o motor lê esse comprimento como testada. No 4851, a soma dá 5,24 m e a reta dá 9,81 m. Num lote de 3,5 + 3,5 m com vão de 4,5 m, a reta daria 11,5 m e o motor deixaria de avisar "testada abaixo do mínimo da zona".

## O que fazer

1. Na junção da B, **só junte quando a reta do primeiro ao último pedaço passar a soma dos pedaços em até 1 m**. Se passar mais que isso, não junte: os pedaços seguem sozinhos e podem passar pela A, se algum tiver 5 m ou mais. Não mexa em `motor/`.
2. Sorteio de 500: diga quantos aceitos ficam (era 307) e quais lotes mudam. Pelo seu relato, só o 4851 deve mudar.
3. Teste: o caso sintético de 3,5 + 3,5 m com vão de 4,5 m não junta, e o 2986 continua juntado.
4. Rode `novo_lote --testar`, `gerar_lotes --testar` e `conferir.py` (8/8).

Não commite. Relato curto em `terreno/RELATORIO-28.md`. Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 28 pronta"`.
