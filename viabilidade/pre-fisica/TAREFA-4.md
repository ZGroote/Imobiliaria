# PVF-G2: estimativa preliminar de cargas por pavimento (Terreno, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. O módulo fica no pacote do projetista: um contrato só. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Motor está mexendo na mesma pasta, em `torre.py`, `para_vista.py`, `gerador.py` e nos testes deles: **não toque neles.** Você cria `cargas.py` e `test_cargas.py` e, se precisar, mexe em `sintese.py` e `test_sintese.py`.

**Leia:**
- `PVF-G0.md`, seções 2, 3, 6 e 7;
- `DECISOES-PVF-G0.md`, itens 3, 4 e 7. O item 3 diz: concreto armado convencional, em faixas, com parâmetros que nascem `verified: false`, porque ainda não temos calculista.

## O que fazer

1. **`cargas.estimar(revisao, premissas=PREMISSAS_PADRAO)`** devolve uma estimativa **por pavimento** e **por elemento**, sempre em **faixa** (mínimo, central e máximo):
   - **permanente (g):** peso próprio de laje, vigas, pilares e paredes, por m² de laje, como premissa de concreto armado convencional;
   - **variável (q):** sobrecarga de uso por tipo de ambiente (unidade, circulação, garagem, hall), como na NBR 6120:2019, mas **como premissa** `verified: false`. Escreva o valor e a referência; não afirme que o valor confere com a norma;
   - **totais:**
     - kN/m² de cada pavimento;
     - kN de cada pavimento;
     - kN acumulado do topo até a base, por pavimento;
     - total da torre.

   Unidade em todo número: `kN`, `kN/m²` e `m²`.
2. **Proibido:** carga em pilar, dimensionamento, combinação de ações (NBR 8681), capacidade de fundação e qualquer comparação com sondagem. **O total da torre não é carga na fundação.** Ponha isso num aviso fixo no resultado.
3. **Premissas** em `PREMISSAS_PADRAO`, cada uma com:
   - valor (mínimo, central e máximo);
   - unidade;
   - referência (texto);
   - `verified: false`;
   - `revisado_por: null`.

   Uma premissa que alguém marcar `verified: true` sem `revisado_por` com nome, conselho e registro é **erro**.
4. **Vínculo (item 4 da decisão):** o resultado guarda `revision_id`, o `content_sha256` da revisão e os `element_ids` de cada parcela.
   - Sele o resultado com o `gravar(..., selador=)` do `esquema.py`, como na avaliação e na sondagem.
   - `cargas_validas(resultado, revisao)` dá `False` quando a geometria muda, com motivo, como `avaliacao_valida`.
5. **Funciona com um pavimento ou com vários:** hoje a revisão tem um pavimento só; a torre com vários pavimentos está chegando (Motor, tarefa 10). Use só o que estiver em `floor_plates`. Se houver 1 pavimento, a estimativa é só desse pavimento, e um aviso diz "pilha de pavimentos ausente".
6. **Síntese, só se for preciso:** o domínio estrutural continua `nao_verificado` mesmo com a estimativa pronta. A estimativa nunca tira trava. Se você mexer na síntese, suba `method_version` e teste.

## Testes (só `assert`)

1. 22421 (revisão do gerador):
   - todo número tem unidade;
   - mínimo ≤ central ≤ máximo;
   - g e q são positivos.
2. Uma revisão sintética com 3 pavimentos:
   - o acumulado cresce de cima para baixo;
   - o total é a soma dos pavimentos (até 0,01 kN).
3. Mover uma divisa (`editor.mover_divisa`) deixa as cargas antigas inválidas, com motivo.
4. `verified: true` sem `revisado_por` dá erro.
5. O resultado tem o aviso "não é carga na fundação" e não tem nenhuma chave de capacidade, pilar ou fundação. Teste isso com uma lista de palavras proibidas nas chaves.
6. Mesmos bytes em duas rodadas.
7. Continuam passando: `test_sintese` (13), `test_sondagem` (3), `test_projetista` (18), `test_gerador` (8) e `test_editor` (10).

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Os valores da norma você escreve a partir do que já está no repositório ou do que você sabe, e marca `verified: false`. Não baixe a norma.
- Relato curto em `RELATORIO-PVF-G2.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Terreno PVF-G2 pronto"`.
