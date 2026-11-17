# Terrenos VAZIOS para a vitrine (Terreno, 17/11)

**Onde:** nesta worktree (`imobiliaria-viabilidade`), em `viabilidade/terreno/`. Não commite: a central commita.

## Problema

O usuário abriu a vitrine com satélite e viu: **os 7 terrenos já têm casa em cima.** Conferido pela central: os 7 pilotos (`motor/exemplos/pilotos/SC-completo-*`) estão em `sao-carlos/dados/lotes_ocupados.json` (só o 75354, metade do remembramento, não está). Estudo de viabilidade para mostrar a uma arquiteta precisa de **terreno vazio**.

## O que fazer

1. **Achar lotes vazios** no cadastro `completo`, cruzando o que já existe, sem rede:
   - fora de `C:/Users/respawn/Desktop/imobiliaria/sao-carlos/dados/lotes_ocupados.json` (lista de ÍNDICES de `lotes_saocarlos_completo.geojson`, não de id; confira que o índice bate com o `--indices` do `novo_lote.py` antes de usar);
   - sem endereço do CNEFE dentro do lote (`sao-carlos/dados/address_points_cnefe.json`);
   - zona conhecida (sem divisa de zona, fora de área especial que impeça) e com frente para rua (as regras da varredura t24–t31).
2. **Conferir no satélite** cada candidato, num recorte com o contorno (como os da t26/t27). Os dados são de 2022–2025 e o lote pode ter sido construído depois. Descarte o que tiver construção, piscina ou obra. Pode baixar só os ladrilhos dos recortes (Esri World Imagery, z18, uso interno, poucos).
3. **Escolher 6 lotes vazios** com tamanhos variados: 2 pequenos (400–700 m²), 2 médios (1.000–2.000 m²) e 2 grandes (2.500 m² ou mais), em bairros diferentes. Gere cada um com `novo_lote.py` (zona e relevo como no `LOTES.md`) numa pasta NOVA `viabilidade/terreno/pilotos-vagos/`. **Não mexa** em `motor/exemplos/pilotos/` (os testes dependem dela).
4. Folha de prova `viabilidade/terreno/evidencias/t32/vagos-32.jpg`, com os 6 recortes e os rejeitados com o motivo.

## Prova

- `RELATORIO-32.md`, curto: quantos candidatos, quantos rejeitados no satélite e por quê, e a tabela dos 6 (índice, área, zona, bairro, frente).
- O `novo_lote.py --testar` e os testes do terreno continuam passando.

## Regras

- Não toque em `motor/`, `visual/`, `projetista/`, `relatorio/`, painel, `.github/`, config nem hook.
- Rede: só os ladrilhos de satélite dos recortes (z18, poucos). Nada mais.
- Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 32 pronta"`.
