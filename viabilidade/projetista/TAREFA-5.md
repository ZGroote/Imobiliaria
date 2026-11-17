# Síntese ligada à revisão + campos de grandeza (Terreno, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Motor está mexendo na mesma pasta, em `para_vista.py` e `test_para_vista.py`: **não toque neles.** Você pode mexer em `sintese.py`, `test_sintese.py`, `gerador.py` (só na linha de comando) e `test_gerador.py`. `esquema.py` e `validador.py` só se for indispensável; nesse caso, explique no relato.

**Leia:** `PVF-G0.md` (seção 4), `DECISOES-PVF-G0.md` (decisão 4) e `RELATORIO-PVF-G1.md` (limitações). Todos estão nesta pasta.

## O que fazer

1. **A avaliação vira arquivo selado, ligado à revisão.** Crie em `sintese.py` a função `avaliar(revisao, escopo, evidencias) -> avaliacao`. Ela:
   - roda o `validador.validar(revisao, revisao["site"], revisao["rules_ref"])` e o `sintetizar`;
   - grava junto `revision_id` e `revision_sha256` (= `content_sha256` da revisão), `escopo`, `evidencias` e `method_version`;
   - sela a avaliação com SHA-256 próprio.

   Crie também `avaliacao_valida(avaliacao, revisao) -> (bool, motivo)`. Ela dá falso se:
   - o `content_sha256` da revisão não bate (decisão 4: mudou a geometria, a avaliação perde a validade sozinha);
   - o selo da avaliação foi adulterado;
   - a versão do método mudou.

   **Não ponha a avaliação dentro do `DesignRevision`:** isso mudaria o hash da geometria. É um arquivo ao lado.
2. **Campos de grandeza (PRD seção 7).** Acrescente em cada achado classificado:
   - `quantity_kind` (área, comprimento, contagem, razão… pela `unit`);
   - `assumptions` (lista; vem da fonte quando ela é premissa);
   - `source_version`;
   - `confidence` (`fonte_conferida` / `premissa` / `sem_fonte`);
   - `engine_version` (`projetista/0.1.0` + versão da síntese).

   Mantenha `scope`, `reason` e `required_actions`. Os campos que faltarem ficam `null`, com `reason`; nunca são inventados. Não use relógio (`calculated_at` fica fora; o resultado tem que ser reprodutível).
3. **Linha de comando do gerador.** Ao lado de cada `revisao-NN.json`, grave `avaliacao-NN.json` com `gravar` (atômico).
   - O escopo padrão é `geometrico`, `urbanistico` e `arquitetonico`, com `evidencias` vazias.
   - O resumo impresso ganha uma linha: a síntese e a regra da precedência.
   - Opção `--escopo` com a lista separada por vírgula.

## Testes (só `assert`)

1. Revisão gerada do piloto 22421 → avaliação válida. Mudar um vértice de uma unidade e selar de novo → `avaliacao_valida` falso, com o motivo "geometria mudou".
2. Adulterar a `sintese` dentro da avaliação → falso ("selo").
3. Todo achado tem os 5 campos novos. Achado com fonte `verified: false` → `confidence = "premissa"` ou `"sem_fonte"`, nunca `"fonte_conferida"`.
4. Duas execuções dão bytes idênticos.
5. Continuam passando: os 18 do `test_projetista`, os 7 do `test_gerador` e os do `test_sintese`.

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-5.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 5 do projetista pronta"`.
