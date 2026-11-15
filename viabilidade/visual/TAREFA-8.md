# Tarefa 8 do Visual — medir o desempenho da maquete volumétrica (PRD V1 §4.2, §9)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/visual/`. Não commite. Não toque em `viabilidade/motor/`.

O PRD V1 pede "desktop e mobile, com critérios mensuráveis de desempenho **após medição**". Ainda não há nenhuma medição. Esta tarefa **mede**, sem fixar metas e sem otimizar nada.

## O que fazer

1. `viabilidade/visual/medir.cjs` (Playwright, o mesmo carregamento portátil do `testar.cjs`; `VISUAL_URL` e `CHROME_PATH` iguais). Para cada estudo (exemplo + 7 pilotos), em **dois perfis**: desktop 1366×768 e celular emulado (viewport 390×844, `deviceScaleFactor` 3, CPU 4× mais lenta via CDP `Emulation.setCPUThrottlingRate`, rede "Fast 3G" via CDP), registrar:
   - tempo até a primeira maquete desenhada (defina e documente o sinal: ex. um `window.__maquetePronta = performance.now()` que o `index.html` grava no primeiro frame com volumes; se precisar, acrescente esse marcador ao `index.html`, sem mudar comportamento);
   - bytes transferidos (página + estudo + bibliotecas);
   - quadros por segundo médios em 5 s de órbita automática (girar a câmera por código);
   - tempo para trocar de opção (A→B) até o novo desenho;
   - memória JS (`performance.memory` quando houver).
2. Rode 3 vezes por estudo/perfil e grave a **mediana** em `viabilidade/visual/medicao/AAAA-MM-DD.json` + um resumo legível em `viabilidade/visual/MEDICAO.md` (tabela). A central roda o Chrome: deixe o script pronto e testado com `node --check`; se conseguir rodar no seu sandbox, ótimo, senão a central roda.
3. Não otimize nada nesta tarefa. Se algo parecer muito lento, anote como "observação" no `MEDICAO.md`.

## Relatório

`viabilidade/visual/RELATORIO-8.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 8 pronta"`.
