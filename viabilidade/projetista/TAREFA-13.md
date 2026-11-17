# PA-G3: os limites da torre no validador (Terreno, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Motor está mexendo na mesma pasta, em `torre.py`, `vitrine.py`, nos testes deles e na pasta `vitrine/`: **não toque neles.** Você mexe em `validador.py` e cria `test_limites.py`. Em `sintese.py`, mexa só se for indispensável; nesse caso, explique no relato.

## Problema

O `RELATORIO-10.md` mostrou que o validador já percorre todos os andares, mas **não confere os limites do prédio inteiro**: altura, CA, taxa de ocupação, permeabilidade, vagas e continuidade vertical. Os valores já estão na revisão, em `rules_ref.params.motor` (`ca_basico`, `ca_maximo`, `altura_max_m`...), e nenhuma regra lê esses valores.

## O que fazer

1. **Regras novas no `validador.py`.** Cada uma lê o limite de `rules_ref.params.motor` e a fonte de `rules_ref.sources`, com o mesmo `verified` que veio de lá. Não invente valor nem fonte.
   - `torre.altura`: a altura total contra `altura_max_m`.
   - `torre.ca`: computável total ÷ área do lote, contra `ca_basico` e `ca_maximo`. Acima do básico e até o máximo é **condicionado** (outorga onerosa), não conforme. Use o status mais próximo que o validador já tenha.
   - `torre.to`: a projeção da maior laje sobre o lote ÷ área do lote. Respeite `garagem_conta_na_taxa_ocupacao`.
   - `torre.permeabilidade`: se a revisão não tiver o que medir, a regra sai `nao_verificado`, com o motivo "a revisão não modela área permeável". **Não** chute a área permeável.
   - `torre.continuidade`: o `z0_m` de cada andar é o topo do andar de baixo (com a tolerância da revisão), e o núcleo fica na mesma projeção em todos os andares. Isso vale também para uma revisão feita à mão.
   - **Vagas:** se `params.motor` tiver mínimo de vagas, confira; se não tiver, não crie a regra e diga isso no relato.
2. **Limite `null` ou ausente** (como o `altura_max_m` do 22421): a regra sai `nao_verificado`, com "limite não informado". Nunca `conforme`.
3. **Uma revisão de um pavimento só** (sem `metrics_summary.torre`): as regras de torre saem `nao_verificado`, com "pilha de pavimentos ausente". Não quebram nem viram conforme.
4. **Nenhuma regra órfã:** cada `rule_id` novo tem que cair num domínio da `sintese.py`. Se não cair, faça o mapeamento mínimo na síntese, suba `method_version` e teste.
5. **Os números de hoje não mudam:** unidades e andares de `test_projetista`, gerador, editor, torre, fluxo e vitrine continuam os mesmos. Se uma regra nova recusar uma torre que antes passava, mostre o caso no relato antes de mudar qualquer número.

## Testes (`test_limites.py`, só `assert`)

1. 22421 com térreo e sem térreo:
   - o CA medido é igual à conta à mão: computável total ÷ área do lote;
   - a TO é igual à conta à mão;
   - a altura sai `nao_verificado`.
2. Lote sintético com CA máximo baixo: `torre.ca` dá violação; entre o básico e o máximo, dá o status condicionado.
3. Revisão feita à mão:
   - com um andar flutuando, `torre.continuidade` dá violação;
   - com o núcleo deslocado, também dá violação.
4. Uma revisão de um pavimento: todas as regras de torre saem `nao_verificado`.
5. Toda regra nova tem fonte, e o `verified` dela é igual ao de `rules_ref.sources`.
6. Mesmos bytes em duas rodadas.
7. Continuam passando: `test_projetista` (18), `test_gerador` (8), `test_editor` (10), `test_torre`, `test_para_vista`, `test_sintese` (13), `test_pacote` (6), `test_fluxo` (5) e `test_cargas` (6).

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-13.md`, com o CA e a TO do 22421, com e sem térreo.
- Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 13 do projetista pronta"`.
