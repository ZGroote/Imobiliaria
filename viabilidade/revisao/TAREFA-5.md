# Tarefa 5 do Revisor: inspeção independente de privacidade (89 imagens)

**Quem:** Codex (Revisor).
**Onde ler:** `viabilidade/terreno/dados/` e `viabilidade/visual/evidencias/` na worktree atual.
**Onde escrever:** só `viabilidade/revisao/REVISAO-5.md`.
**Não fazer:**
- não commitar;
- não alterar nenhuma imagem;
- não ler `viabilidade/conferencia/INSPECAO-PRIVACIDADE-1E.md` antes de terminar. A inspeção tem que ser sua, sem a conclusão da central na cabeça.

## Pergunta

Algum destes arquivos expõe algo que não deveria ficar público? Exemplos:
- nome de cliente, incorporadora ou pessoa;
- e-mail, telefone ou documento;
- endereço de pessoa;
- caminho da máquina;
- metadado de câmera ou GPS;
- foto de terceiro;
- material sem licença para publicar.

## Como

1. **Lista.** `git ls-files` das duas pastas, só imagens (`.png .jpg .jpeg .tif` e similares). Devem ser 89. Se não forem, registre a diferença.
2. **Metadados.** Leia os metadados de cada uma (Pillow: `info` e EXIF) e registre o que achar.
3. **Olhar.** Abra e olhe **cada imagem**.
   - Nas capturas da tela, leia o texto: elas são grandes, então amplie onde precisar.
   - Para cada arquivo, uma linha: o que é e se tem algo sensível.
4. **Pontos fracos.** Diga o que você não conseguiu verificar.

## Relatório

`viabilidade/revisao/REVISAO-5.md`:
- veredito no topo;
- tabela com os 89 arquivos;
- limites.

Depois: `maestri ask "Claude Code" "Revisor tarefa 5 pronta"`.
