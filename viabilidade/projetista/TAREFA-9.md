# PA-G1, núcleo do editor manual, sem tela (Motor, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Terreno está mexendo na mesma pasta, em `sondagem.py`, `test_sondagem.py`, `sintese.py` e `test_sintese.py`: **não toque neles.** Você cria `editor.py` e `test_editor.py`. `esquema.py` e `validador.py` só se for indispensável; nesse caso, explique no relato.

## Contexto

Pela Ordem B (`PA-G0.md`, seção 8), depois do gerador vem o **editor manual (PA-G1)**. A tela fica com o Visual, mais tarde. Esta tarefa é o **núcleo**: as operações de edição sobre uma `DesignRevision`, para a tela só chamar. Leia `PA-G0.md` (seções 4, 8 e 9), `esquema.py` (`parent_revision_id`, `selar`) e `RELATORIO-4.md`.

## O que fazer

`editor.py`: cada operação recebe uma revisão selada e devolve uma **revisão nova**.
- A revisão nova é selada, com `parent_revision_id` = id da anterior e `revision_id` novo e estável. O id deriva do pai + operação + parâmetros, sem relógio nem `random`.
- A revisão de entrada nunca é alterada.

Operações mínimas:

1. `mover_divisa(rev, unidade_a, unidade_b, delta_m)`: desloca a parede comum entre duas unidades vizinhas. Uma cresce e a outra encolhe, e a soma das áreas se conserva.
2. `juntar_unidades(rev, unidade_a, unidade_b)`: duas unidades vizinhas viram uma.
3. `dividir_unidade(rev, unidade, frac)`: corta perpendicular ao corredor, na fração dada, e cria 2 unidades com ids estáveis.
4. `renomear(rev, elemento, nome)`: só o rótulo; a geometria não muda.

Cada operação:
- **Roda o `validador.validar` na saída** e devolve `(revisao_nova, achados)`.
- Uma operação que gera `violacao` ou `erro_tecnico` **é recusada**: devolve erro claro e nenhuma revisão. A exceção é a flag `forcar=True`. Nesse caso, a revisão sai marcada como rascunho com violação, num campo que o esquema já aceite. Se não houver campo, não implemente o `forcar` e diga isso no relato.
- Recusa entrada inválida: unidade inexistente, unidades que não são vizinhas, delta que zera a unidade, fração fora de (0, 1).

Mais duas peças:
- **Histórico:** `cadeia(revisoes)` confere que cada `parent_revision_id` aponta para a anterior e que todos os selos batem.
- **Invalidação:** a avaliação da revisão-pai (`sintese.avaliar`) tem que dar `avaliacao_valida = False` contra a filha, com o motivo "outra revisão" ou "geometria mudou". Só use o `sintese`, não o altere.

## Testes (`test_editor.py`, só `assert`)

1. Gere o 22421 com o `gerador` e rode `mover_divisa` de +0,50 m entre duas vizinhas. A área total se conserva (até 0,01 m²), o pai fica intacto (mesmos bytes) e o `parent_revision_id` está certo.
2. Mover de volta (−0,50 m) volta à mesma geometria do pai, com `revision_id` diferente: é outra revisão, com o mesmo conteúdo geométrico.
3. `juntar` seguido de `dividir` em 0,5 dá unidades com a soma das áreas igual.
4. Um delta que deixa uma unidade abaixo do lado mínimo ou da área mínima é recusado com motivo.
5. A `cadeia` de 4 edições é válida, e adulterar a do meio dá erro.
6. A avaliação do pai não vale para a filha.
7. A mesma sequência de operações dá os mesmos bytes.
8. Continuam passando: `test_projetista` (18), `test_gerador` (8) e `test_para_vista`.

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-9.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Motor tarefa 9 do projetista pronta"`.
