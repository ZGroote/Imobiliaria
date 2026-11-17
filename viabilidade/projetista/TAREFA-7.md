# Avaliação mais leve: fonte uma vez só (Terreno, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Motor está mexendo na mesma pasta, em `para_vista.py` e `test_para_vista.py`: **não toque neles.** Você mexe em `sintese.py` e `test_sintese.py`. A linha de comando do `gerador.py` só se for preciso.

## Problema

A `avaliacao-01.json` do 22421 pesa ~101 KB, dez vezes a revisão. A causa: cada um dos 154 achados guarda a fonte inteira, com a lista de leis.

## O que fazer

1. A avaliação ganha uma tabela única de fontes, `fontes: {chave: fonte}`. A chave é estável: use o SHA-256 curto do JSON canônico da fonte, ou o `rule_id` se for único e suficiente. Cada achado passa a guardar só a citação (`source_ref`) no lugar da fonte inteira.
2. Os campos de grandeza da tarefa 5 (`confidence`, `source_version` e `assumptions`) continuam saindo iguais. Eles são calculados da fonte antes de virar citação.
3. Suba `method_version` para `sintese/0.2.0`. Assim, as avaliações antigas caem em "versão do método mudou", como manda a tarefa 5.
4. Meça o tamanho antes e depois no 22421 e escreva os dois no relato. A meta é ficar abaixo de 30 KB. Se não chegar, diga o que ainda pesa.
5. **Não mude** as chaves que o visualizador vai ler: `sintese.sintese`, `regra_da_precedencia`, `dominios`, `motivos_trava`, `fora_do_escopo` e `aviso`. O Visual está montando um painel com elas agora.

## Testes (só `assert`)

1. Cada `source_ref` existe em `fontes`. Não sobra fonte que nenhum achado cita.
2. Reconstruir a fonte de cada achado pela citação dá o mesmo resultado da versão 0.1.0. Compare dentro do teste com uma reconstrução.
3. Os testes da tarefa 5 continuam passando: selo, geometria mudou, outra revisão, versão velha e mesmos bytes.
4. Também continuam passando: `test_projetista` (18), `test_gerador` (8) e `test_para_vista`.

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-7.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 7 do projetista pronta"`.
