# Tarefa 9 do Visual — por que o remembramento demora 9,5 s (e às vezes 0,35 s)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/visual/`. Não commite. Não toque em `viabilidade/motor/`.

## Fato (medição da central, `viabilidade/visual/MEDICAO.md`)

`SC-completo-remembramento-75352-75354`, primeira maquete: desktop **346 ms, 9.515 ms, 9.520 ms**; celular 13.132 / 13.364 / 13.584 ms. Os outros 7 estudos: ~1,3 s no desktop. Uma variação de 0,35 s para 9,5 s no mesmo arquivo sugere **espera** (timeout, fetch preso, fila), não custo de desenho. Também chama a atenção um patamar de ~1,3 s no desktop em quase todos os estudos, com uma rodada de 296 ms no 30516.

## O que fazer

1. **Diagnóstico com evidência:** instrumente (temporário, só no seu teste) as fases até o primeiro desenho: fetch do estudo, sha256, parse, montagem da cena, fetch/conferência do relatório (`<meta name="estudo-sha256">`), carregamento do three/fontes. Ache onde vão os ~9 s e os ~1 s. Pistas: a conferência do relatório da tarefa 6 (fetch do `relatorio/saida/<id>.html`; o do remembramento está desatualizado para a revisão 0.8.0?), algum `setTimeout`, fila do `http.server`.
2. **Corrigir só se a causa for clara e pequena** (ex.: a conferência do relatório não pode bloquear o primeiro desenho; fazer depois, em paralelo). Nada de otimização geral.
3. Rode o `medir.cjs` de novo **só para o remembramento e o exemplo**, se o seu sandbox deixar; senão a central roda. Atualize o `MEDICAO.md` com uma seção "Depois da tarefa 9".

## Relatório

`viabilidade/visual/RELATORIO-9.md`, até 8 linhas: onde estavam os 9 s e o 1 s, o que mudou. Depois: `maestri ask "Claude Code" "Visual tarefa 9 pronta"`.
