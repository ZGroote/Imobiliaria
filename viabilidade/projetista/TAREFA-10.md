# PA-G3: a torre dentro da revisão (Motor, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Terreno está mexendo na mesma pasta, em `cargas.py`, `test_cargas.py` e, se precisar, `sintese.py`: **não toque neles.** Você cria `torre.py` e `test_torre.py` e mexe em `para_vista.py`, `test_para_vista.py` e, se precisar, `gerador.py` e `test_gerador.py`. `esquema.py` e `validador.py` só se for indispensável; nesse caso, explique no relato.

## Problema

Hoje a revisão guarda **um** pavimento tipo. A pilha de andares e o térreo só existem na prévia (`para_vista.py`, tarefas 6 e 8). Por isso, o validador e a síntese nunca enxergam o prédio inteiro: altura, CA total, unidades totais e o andar que sai do envelope.

`PRD-PROJETISTA-0.1.md`, linha 147, define o PA-G3 assim: "repetir pavimentos, implantar torres, medir e validar limites conhecidos, maquete esquemática". Esta tarefa cobre **uma torre só**.

## O que fazer

1. **`torre.compor(revisao, terreo=False, pavimentos=None)`:** recebe a revisão de um pavimento (a do gerador ou a do editor) e devolve uma **revisão filha** com todos os pavimentos em `floor_plates`.
   - Use o mesmo `parent_revision_id` e o mesmo jeito de derivar o id do `editor.py`. Reaproveite a função dele em vez de copiar.
   - Cada pavimento tem `id`, `z0_m` e `height_m` próprios.
   - O térreo vem das premissas `PADROES_TERREO` da tarefa 8: núcleo, hall e garagem. Mova essa lógica de `para_vista.py` para cá; não a duplique.
   - **Escalonamento:** em cada andar, use a faixa do `envelope_by_height` daquela altura. A unidade que sai da faixa é **retirada daquele andar**, e não do prédio inteiro.
     - Se o andar ficar sem nenhuma unidade, a torre para ali.
     - O andar que perdeu unidades vira um **pavimento próprio** (outro `FloorPlate` com outro id). Não pode ser cópia marcada como igual.
   - A contagem de andares é a mesma da tarefa 8, agora gravada na revisão.
2. **Métricas da torre** em `metrics_summary.torre`, cada uma com unidade:
   - altura total;
   - número de pavimentos;
   - unidades totais;
   - área privativa total;
   - área computável total, se o validador já souber calcular; se não, diga que falta;
   - vagas.
3. **O validador roda na torre inteira.** Diga no relato quais regras ele já confere com vários pavimentos (altura, CA, TO, envelope) e quais ainda olham só o primeiro.
   - **Não invente regra nova.** Se faltar, liste.
   - Se o validador quebrar com mais de um pavimento, conserte o mínimo, explique e teste.
4. **`para_vista.py`:** quando a revisão já tem a torre, desenhe o que está em `floor_plates`, sem recalcular nada.
   - Sem torre, ele continua fazendo o que faz hoje.
   - O dourado da tarefa 6 continua batendo, e a saída com `--terreo` da tarefa 8 também, em bytes. Se a ordem dos volumes mudar, justifique e atualize o dourado num commit separado no relato.

## Testes (só `assert`)

1. 22421:
   - `compor` sem térreo dá 2 andares e 12 unidades;
   - com térreo, dá térreo + 1 andar tipo, 6 unidades e 12 vagas (os mesmos números das tarefas 6 e 8).
2. Envelope sintético que encolhe a 6 m: o 3º andar perde unidades em vez de sumir, e o 4º some.
3. A torre é filha da revisão de um pavimento, e a `editor.cadeia([pai, torre])` vale.
4. Editar o pai depois (`mover_divisa`) e compor de novo dá outra torre. A avaliação da torre antiga não vale para a nova.
5. Mesmos bytes em duas rodadas.
6. A prévia desenhada a partir da torre e a prévia de hoje dão o mesmo resultado no 22421.
7. Continuam passando: `test_projetista` (18), `test_gerador` (8), `test_para_vista`, `test_editor` (10) e `test_sintese` (13).

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Print da torre do 22421 com térreo em `previa-22421-torre.png`, num servidor local, como nas tarefas 6 e 8.
- Relato curto em `RELATORIO-10.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Motor tarefa 10 do projetista pronta"`.
