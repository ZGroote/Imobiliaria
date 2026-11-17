# Garagem do térreo que se cruza (terreno 6) + vitrine de novo (Motor, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Terreno está mexendo na mesma pasta, em `validador.py` e `test_limites.py` (tarefa 13): **não toque neles.** Você mexe em `torre.py`, `test_torre.py`, `vitrine.py`, `test_vitrine.py` e na pasta `vitrine/`.

## O que fazer

1. **Conserte o recorte da garagem do térreo** que você descreveu no `RELATORIO-11.md`. No terreno 6 (q1382-11984-11988), um vértice da garagem encosta na própria borda e, arredondado a 4 casas, o contorno se cruza.
   - Faça o conserto mínimo: limpar o polígono antes de arredondar, ou outra regra de recorte que você julgar melhor.
   - Os números do 22421 não mudam: térreo + 1 andar, 6 unidades e 12 vagas.
   - Os dourados da prévia continuam iguais em bytes.
2. **Rode a vitrine de novo** em `viabilidade/projetista/vitrine/`. O terreno 6 tem que sair `ok`. Se ainda falhar, diga por quê.
3. **Os terrenos 2 e 3 continuam `falhou`.** Não force um prédio que não cabe. Só confira se o motivo está em português simples para quem olha a tela; por exemplo: "o terreno é pequeno demais para o pavimento mínimo do gerador (327 m²)".
4. **Mantenha a tentativa de 6, 5, 4, 3 e 2 unidades por andar** como está.

## Testes

- `test_torre`: um caso novo com um contorno que encosta na própria borda. O térreo sai válido, e o contorno não se cruza depois do arredondamento.
- `test_vitrine`: o terreno 6 sai `ok`.
- Continuam passando: `test_projetista` (18), `test_gerador` (8), `test_editor` (10), `test_para_vista` e `test_fluxo` (5).

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-12.md`, com a tabela dos 7 terrenos atualizada.
- Ao terminar: `maestri ask "Claude Code" "Motor tarefa 12 do projetista pronta"`.
