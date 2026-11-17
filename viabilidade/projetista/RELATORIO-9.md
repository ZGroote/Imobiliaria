# Relato da tarefa 9: núcleo do editor manual (PA-G1)

**Entregue:** `editor.py` e `test_editor.py` (10 testes, todos passam). Não commitado. Não toquei em `sondagem.py`, `sintese.py`, `esquema.py`, `validador.py`, `gerador.py` nem fora desta pasta.

## O que faz

Cada operação recebe uma revisão selada e devolve `(revisao_nova, achados)`. A entrada nunca muda.

| Operação | Efeito |
|---|---|
| `mover_divisa(rev, a, b, delta_m)` | desloca a parede comum: `delta > 0` faz A crescer e B encolher; soma das áreas conservada |
| `juntar_unidades(rev, a, b)` | duas vizinhas viram uma, de id `a+b` (cobre o vãozinho de 0,3 mm entre elas) |
| `dividir_unidade(rev, u, frac)` | corta perpendicular ao corredor; cria `u.1` e `u.2` |
| `renomear(rev, elemento, nome)` | só o campo `name`; geometria idêntica |
| `cadeia(revisoes)` | `True` ou `ValueError` dizendo em qual revisão quebrou |

- **Id da revisão:** `rev_` + 12 primeiros hex de `sha256({selo do pai, operação, parâmetros})`. Sem relógio nem `random`. Mover +0,5 e −0,5 dá geometria igual à do pai, com id diferente.
- **Histórico:** cada filha grava `metrics_summary.edicao` (operação, parâmetros). Por isso `cadeia` confere selo, `parent_revision_id` **e** que o id deriva do pai. Adulterar e re-selar a do meio quebra a seguinte.
- **Invalidação:** só com `sintese.avaliar` / `avaliacao_valida`. A avaliação do pai dá `False` contra a filha, motivo "outra revisão".

## Decisões

- **Vizinhas:** duas unidades com arestas paralelas, frente a frente, folga ≤ 2 mm e pelo menos 0,1 m de parede comum. No 22421, `apto_02`…`apto_06` formam a fila; **`apto_01` não é vizinha de ninguém** (o núcleo de 2,5 m fica no meio). Isso é geometria do gerador, não bug.
- **Tipos:** cada unidade editada ganha tipo próprio (`tipo_NN`), reaproveitando um idêntico se existir. Tipos que ficam sem uso saem. O resíduo da laje (`residuals_m2`) e as métricas são recalculados.
- **Recusa** (`EdicaoRecusada`, com `.motivos` e `.achados`): `violacao`, `erro_tecnico`, as premissas do gerador (`acesso`, `fachada`, `dimensao`, mesma regra do `gerador._recusas`) e **área privativa mínima**. Essa mínima não está nas regras do estudo, só na premissa de geração (45 m², lida de `metrics_summary.geracao.programa`). Ela aparece como achado `arquitetura.area_minima_unidade`. Se a revisão não tem essa premissa, a regra não vale.
- **Entrada inválida recusada:** unidade inexistente, não vizinhas, delta zero/não finito/que zera ou inverte, fração fora de (0, 1) (inclui NaN), nome vazio, revisão sem selo válido, unidade que não é o retângulo do gerador.
- **`forcar=True`: implementado.** O esquema não tem campo de violação, mas aceita `metrics_summary` livre. A revisão sai com `status: RASCUNHO` e `metrics_summary.edicao = {forcada: true, violacoes: [...]}`. O `status` do esquema só aceita RASCUNHO e REQUER_REVALIDACAO, e não pus REQUER_REVALIDACAO porque seria significado diferente. Se a central preferir outro campo, é trocar uma linha em `_fechar`.
- **`renomear`:** muda `name` de tipo, pavimento, unidade (colocação), espaço comum ou núcleo. Mudar o `id` quebraria referências. Colocação não tinha `name`; o esquema aceita o campo extra e o validador ignora.
- **Limite:** só unidades retangulares no formato do gerador (as dele são todas assim). `juntar` exige mesma orientação e mesma profundidade/largura alinhada.
- No 22421, dividir uma unidade de 5,45 m ao meio é **recusado** (dá duas de 2,5 m: viola lado mínimo e área). Dividir uma junta de duas (≈10,9 m) funciona.

## Mexi também no `test_para_vista.py` (da tarefa 8, minha, não commitado)

O piloto 22421 está em LF no disco; o teste dourado esperava CRLF e falhava (`test_sem_terreo_igual_a_tarefa_6`). Não foi o editor. Agora o teste compara o hash do piloto normalizado em LF e roda o dourado sobre uma cópia temporária em CRLF. O hash dourado (`f90003d1…`) não mudou.

## Como rodar

```
python -I -X utf8 viabilidade/projetista/test_editor.py
```

O último teste roda `test_projetista` (18), `test_gerador` (8) e `test_para_vista`; todos passam.

## O que ficou sem commit

Toda a pasta `viabilidade/projetista/` (não rastreada), incluindo `editor.py`, `test_editor.py`, `RELATORIO-9.md` e o `test_para_vista.py` ajustado. Os ` M` em `motor/exemplos/pilotos` e `visual/evidencias` não são meus.
