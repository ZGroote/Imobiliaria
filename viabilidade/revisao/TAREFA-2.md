# Tarefa 2 do Revisor — revisão da tela e do relatório do 1B

**Quem:** Revisor (Codex Astra alto, conta Padrão). **Galho:** `fix/viabilidade-1b`. Escreva **só** em `viabilidade/revisao/`. Não commite (a central commita).
O Visual está mexendo no `viabilidade/visual/index.html` agora (tarefa 12, selo do domínio), e o Motor no `viabilidade/motor/`. **Revise a versão commitada** (`git show 83c107f0:<arquivo>` ou `git diff 06ba272a..83c107f0 -- viabilidade/visual viabilidade/relatorio`), não os arquivos em edição.

## O que revisar

1. **Segurança:** todo texto vindo do JSON do estudo (nomes, `detalhe`, `motivos`, `incertezas`, `criterio_escolha.texto`, fontes, observações) chega ao HTML/DOM **escapado**? Procure `innerHTML`, template strings em HTML e f-strings sem `esc()` no `relatorio.py`. Monte um estudo com `<img src=x onerror=alert(1)>` nesses campos e prove (Playwright + Chrome, como o `testar.cjs`) se executa ou não. A tela aceita arquivo do usuário (upload), então isso importa.
2. **Revisão do estudo:** o identificador `rev <sha256[:12]>` da tela e o `<meta name="estudo-sha256">` do relatório batem para os 8 estudos? O aviso "relatório desatualizado" dispara quando deve, e só então?
3. **Pacote do three** (`visual/vendor/`): `gerar.mjs` reproduz o mesmo SHA; a página não pede nada de fora (confira com o navegador); a licença do three (MIT) está preservada no pacote ou ao lado dele.
4. **Tela × relatório:** os números (unidades, privativa, CA, TO, vagas) dos 8 estudos são idênticos nos dois e iguais ao JSON.
5. **Contrato v5/v4:** arquivos v4 (sem os campos novos) continuam abrindo nos dois.

Para o navegador: `python -I -m http.server <porta> --bind 127.0.0.1` na raiz e `VISUAL_URL=http://127.0.0.1:<porta>/viabilidade/visual/`. Se o seu sandbox não deixar abrir porta, escreva o script e a central roda.

## Entrega

`viabilidade/revisao/REVISAO-2.md`: achados (gravidade, comando reproduzível, esperado × obtido) + o que passou. Depois: `maestri ask "Claude Code" "Revisor tarefa 2 pronta"`.
