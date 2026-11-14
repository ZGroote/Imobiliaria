# Relatório — Visual tarefa 2

- `index.html`: seletor para os sete estudos piloto; área computável máxima nula aparece como “Sem limite na lei”; incertezas sobre área especial sem altura numérica ficam destacadas.
- `testar.cjs`: valida os sete pilotos e o exemplo em desktop/celular, checa o caso sintético sem CA e salva capturas.
- `README.md`: documenta os estudos piloto e os novos avisos.
- Evidências em `evidencias/`: capturas desktop e celular para o exemplo e cada piloto, além de `teste-browser.json`.
- Resultado: `node viabilidade/visual/testar.cjs` — PASS; oito estudos por perfil, sem erros de console. Caso CA nulo e destaque de área especial aprovados.
- Escopo respeitado: apenas `viabilidade/visual/`; sem commit e sem publicação.
- Limites: teste em Chrome headless; não validado em aparelho físico nem revisada a legislação.
- Para a central: `maestri ask "Claude Code" "Visual tarefa 2 concluída. Testes ok. Relatório: visual/RELATORIO.md"`
