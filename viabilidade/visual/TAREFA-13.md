# Tarefa 13 do Visual — achados da REVISAO-2 (injeção no relatório, CA na tela, licença)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/visual/` e `viabilidade/relatorio/`. Não commite (só você não commita; a central commita).
Leia `viabilidade/revisao/REVISAO-2.md`. A central **reproduziu o achado 1** no código atual: 100 `<img onerror>` ativos no relatório.

1. **ALTA — injeção no relatório** (`relatorio.py` ~75–108 e ~915): num estudo **sem opções**, `zona.parametros.taxa_ocupacao` ou `taxa_permeabilidade` como texto (`<img src=x onerror=alert(1)>`) entra no HTML sem escape.
   - Na entrada do gerador: parâmetros numéricos da zona e das métricas têm de ser número (ou `null`); outro tipo = erro claro, o relatório não sai.
   - Em toda função de formatação que pode devolver texto (`formatar_numero_ptbr` e afins): `esc()` no retorno. Defesa em profundidade, mesmo com a validação.
   - Procure o mesmo padrão em **todo** o `relatorio.py` (qualquer interpolação de valor do JSON sem `esc`) e na tela (`innerHTML` com dado do estudo).
   - Testes: os dois casos `viabilidade/revisao/tarefa2/casos/xss-numerico-*.json` → o gerador recusa; e um teste genérico que injeta o payload em **todos** os campos de texto e números do estudo e exige zero tag ativa no HTML.
2. **MÉDIA — CA arredondado na tela** (`index.html` ~43/48/156, `maximumFractionDigits: 2`): a tela tem de mostrar o CA com a mesma precisão do relatório (`2,081`, não `2,08`; `0,998`, não `1`). Confira as 5 métricas dos 8 estudos: tela = relatório = JSON.
3. **MÉDIA — licença do three:** copie o `LICENSE` do three 0.186.1 (do mesmo `node_modules/three` usado no `gerar.mjs`) para `visual/vendor/LICENSE-three.txt`, e faça o `gerar.mjs` copiar e registrar o SHA dele no manifesto.
4. `python -I -X utf8 viabilidade/relatorio/test_relatorio.py`, `node --check`. O Chrome a central roda (inclusive o `viabilidade/revisao/tarefa2/browser.cjs` do Revisor).

Relatório: `viabilidade/visual/RELATORIO-13.md`, até 8 linhas, com a lista de arquivos alterados. Depois: `maestri ask "Claude Code" "Visual tarefa 13 pronta"`.
