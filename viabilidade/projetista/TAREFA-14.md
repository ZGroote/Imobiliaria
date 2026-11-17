# Vitrine: dizer por que o prédio parou, e o lote grande que sobra (Motor, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

## Problema

A vitrine está no ar (link de prévia) e quem olha vai perguntar duas coisas que a tela não responde:

1. **"Por que só 2 andares?"** O `metrics_summary.torre.parou` já guarda o motivo, mas ele não chega ao `resumo.json`.
2. **"Por que um lote de 2.684 m² dá só 12 apartamentos?"** O terreno 5 sai com CA de ~0,38. O gerador monta **um** pavimento-tipo com um núcleo e no máximo 6 unidades, então o lote grande fica quase vazio. O terreno 1 (651 m²) dá os mesmos 12 apartamentos.
3. **"0 vagas"** aparece na ficha sem térreo, como se fosse um resultado. Na verdade, o estudo sem térreo não tem garagem.

## O que fazer

1. **`limitante` no `resumo.json`**, nas duas versões (`numeros` e `numeros_terreo`): em português simples para quem olha a tela, o que segurou:
   - os **andares**: o `parou` da torre traduzido, por exemplo "o recuo cresce com a altura e o 3º andar não cabe" ou "altura máxima de X m". Sem `parou`, diga isso;
   - as **unidades por andar**: por exemplo "o gerador usa um núcleo só, com até 6 unidades por andar".
   Não invente motivo: copie do que a torre e o gerador já sabem.
2. **Vagas sem térreo:** `vagas.valor` vira `null`, com `nota`: "estudo sem térreo: sem garagem". Com térreo, fica como está.
3. **Lote grande (só diagnóstico, sem mudar o gerador):** no `RELATORIO-14.md`, meça para os 5 terrenos `ok`:
   - a área da laje ocupada ÷ a área onde se pode construir no 1º andar (envelope);
   - o CA atingido contra o `ca_basico` e o `ca_maximo` de `rules_ref.params.motor`.
   Proponha a menor mudança que usaria o lote grande (mais de um núcleo? mais unidades por núcleo? duas lâminas?), com o custo estimado em linhas e testes. **Não implemente:** a central decide depois.
4. Rode a vitrine de novo em `viabilidade/projetista/vitrine/`.

## Testes (só `assert`)

- `test_vitrine`: todo terreno `ok` tem `limitante` com texto não vazio nas duas versões; sem térreo, `vagas.valor` é `null` com nota.
- O resto dos números da vitrine não muda (compare com a vitrine de hoje, campo a campo).
- Continuam passando: `test_projetista` (18), `test_gerador` (8), `test_editor` (10), `test_torre`, `test_para_vista`, `test_fluxo` (5), `test_limites` (7) e `test_sintese` (13).

## Regras

- Mexa em `vitrine.py`, `test_vitrine.py` e na pasta `vitrine/`. Em `torre.py`, só se for indispensável; nesse caso, explique no relato.
- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-14.md`.
- Ao terminar: `maestri ask "Claude Code" "Motor tarefa 14 do projetista pronta"`.
