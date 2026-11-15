# Tarefa 16 do Visual: acessibilidade da tela (V1-012)

**Quem:** Codex (Visual).
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/visual/`.
**Não fazer:**
- não commitar;
- não tocar no relatório, no motor nem no terreno.

## O que fazer

1. **Teclado.** Dá para usar a tela inteira sem mouse?
   - Tab passa por todos os controles na ordem visual: abrir estudo, exemplo, lista de pilotos, relatório, botões de opção, lado a lado, vista inicial e vista de cima.
   - O foco aparece com nitidez.
   - Enter e espaço funcionam.
   - A maquete 3D pode girar por teclado (setas) quando tem foco, ou existe uma alternativa por botão.
2. **Leitor de tela.**
   - Os botões de opção dizem qual está ativa (`aria-pressed` ou equivalente).
   - O `<canvas>` tem rótulo que diz o que a figura mostra.
   - Os números da opção ficam numa estrutura legível: tabela ou lista de termos.
   - Os avisos amarelos usam `role` adequado, sem interromper a leitura a cada troca.
3. **Contraste.**
   - Texto: mínimo 4,5:1 (WCAG AA).
   - Componentes: mínimo 3:1.
   - Meça as cores atuais. Corrija só o que estiver abaixo, mudando o mínimo.
4. **Teste em `testar.cjs`.**
   - Percorrer com Tab e conferir a ordem e o foco visível.
   - Trocar de opção pelo teclado.
   - Conferir `aria-pressed` e o rótulo do canvas.
   - Medir o contraste dos pares texto/fundo principais (computado no navegador).

Rode `node --check viabilidade/visual/testar.cjs`. O Chrome a central roda.

## Relatório

`viabilidade/visual/RELATORIO-16.md`, até 10 linhas:
- o que estava fora;
- o que mudou;
- as razões de contraste antes e depois.

Depois: `maestri ask "Claude Code" "Visual tarefa 16 pronta"`.
