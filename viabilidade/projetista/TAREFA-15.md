# Laje no lugar com mais folga + até 10 unidades por andar (Motor, 17/11)

**Onde:** na cópia `viabilidade/projetista/` desta worktree (`imobiliaria-viabilidade`). Não commite: a central leva para `projetista-g0`.

A central aprovou as alavancas **A e B** do seu `RELATORIO-14.md`. A C (mais de um núcleo) fica para depois.

## O que fazer

1. **(A) No `gerador.py`**, entre as posições válidas da grade, escolha a de **maior folga até a borda do envelope** (desempate fixo, para os bytes não mudarem entre rodadas), em vez da primeira que cabe. Pode mexer no `gerador.py`: a central autoriza.
2. **(B) Na `vitrine.py`**, `PROGRAMAS = (10, 8, 6, 5, 4, 3, 2)`. Fique com o programa que dá **mais unidades no prédio inteiro** (andares × unidades), e não com o primeiro que gera.
3. Rode a vitrine de novo em `viabilidade/projetista/vitrine/` e atualize o `limitante` de acordo.
4. **Torre além do CA máximo** (terreno 6: CA 4,97 com máximo de 4): confira se o `torre.ca` do validador acusa. Se acusar, a vitrine mostra isso no `limitante`. Se não acusar, a torre para no `ca_maximo`, ou você diz no relato por que não para. Não deixe a vitrine mostrar um prédio acima do CA máximo calado.

## Testes

- `test_gerador`: um lote folgado sai com a laje longe da borda (folga > 0), e duas rodadas dão os mesmos bytes.
- `test_vitrine`: o terreno 5 sai com mais de 2 andares; nenhum terreno passa do `ca_maximo` sem aviso.
- Os dourados que mudarem (`SHA_TAREFA_6`, números de 22421...) você **atualiza e explica no relato**, um por um, com antes e depois. Não troque dourado sem dizer o porquê.
- Continuam passando: `test_projetista`, `test_editor`, `test_torre`, `test_para_vista`, `test_fluxo`, `test_limites`, `test_sintese`, `test_cargas`, `test_pacote` e `test_sondagem`.

## Regras

- Mexa em `gerador.py`, `vitrine.py`, nos testes deles e na pasta `vitrine/`; em `torre.py`, só se for indispensável (explique).
- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- O Terreno está procurando lotes vazios (tarefa 32) em `viabilidade/terreno/`; quando ele terminar, a vitrine vai rodar com `--pilotos viabilidade/terreno/pilotos-vagos`. Deixe a `vitrine.py` funcionando com essa pasta.
- Relato curto em `RELATORIO-15.md`, com a tabela dos 5 terrenos antes e depois (andares, unidades, CA).
- Ao terminar: `maestri ask "Claude Code" "Motor tarefa 15 do projetista pronta"`.
