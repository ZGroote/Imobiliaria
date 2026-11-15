# Revisão 2 — tela e relatório do 1B

Revisor: Codex. Concluída em 15/11/2026, com execução de Chrome pendente para a central, conforme instrução do usuário. **Não liberar sem tratar o achado 1.** Há também divergência de precisão e ausência do texto completo da licença no pacote. O problema dos hashes existe em `83c107f0` e já está corrigido em `cad94ecd`.

Escopo principal: arquivos commitados em **83c107f0**, preservados em `tarefa2/referencia/`. Os **87 arquivos** da cópia foram comparados byte a byte, por SHA-256, com o Git. Conferência complementar de `cad94ecd`: hashes e métricas dos oito relatórios, os dois casos de injeção, formatação da tela e escape dos textos do selo de domínio. Não é uma homologação integral desse segundo commit. Uso considerado: abertura local de estudos e relatórios estáticos, incluindo JSON fornecido pelo usuário.

O material anterior foi aproveitado. `auditar.py`, os casos e os HTMLs já gerados não foram refeitos. `evidencias/browser.json` preserva a tentativa anterior: **`bloqueado_por_permissao`, `spawn EPERM`, nenhum caso executado**. Listas vazias nesse arquivo não significam aprovação.

## Achados

### 1. Alta — texto em parâmetros numéricos vira HTML ativo no relatório

**Local em 83c107f0:** `viabilidade/relatorio/relatorio.py:75–108`, `:915–916`; entrada por `gerar_relatorio()` em `:1841`. Em `cad94ecd`, o mesmo caminho continua vulnerável.

**Caso concreto:** estudo sem opções (`opcoes: []`), com `zona.parametros.taxa_ocupacao` ou `taxa_permeabilidade` igual a `<img src=x onerror=alert(1)>`. Esse caso também passa pelo validador real da tela. O relatório multiplica a string por 100 e a insere sem `esc()` na apresentação percentual. `formatar_numero_ptbr()` devolve strings desconhecidas sem escape.

**Esperado:** rejeitar o tipo inválido antes de gerar o documento, ou exibir texto escapado; nenhuma tag com manipulador de evento. **Obtido:** cada caso gera **100 tags `img` com `onerror="alert(1)"`**, nos dois commits. A presença do HTML ativo foi confirmada com parser; o disparo de `alert` em Chrome ainda depende da execução pela central. Não houve prova de execução pela tela: seus caminhos de texto usam `textContent`.

**Reproduzir, sem Chrome:**

```powershell
python -I -B -X utf8 viabilidade/revisao/tarefa2/consolidar.py
node viabilidade/revisao/tarefa2/metricas.cjs
```

Entradas e saídas prontas: `tarefa2/casos/xss-numerico-taxa_ocupacao.{json,html}` e `xss-numerico-taxa_permeabilidade.{json,html}`. Resultado: `evidencias/consolidacao.json`, `xss-casos.json` e `validacao.json`. `browser.cjs` testa esses arquivos e exige alerta no relatório como prova do defeito.

**Correção mínima:** validar esses parâmetros como números na entrada do gerador e aplicar `esc()` nas interpolações de formatação que aceitam texto. Manter um teste com estudo sem opções e payload nos dois campos. Isso evita que a ausência de opções pule as conversões numéricas feitas nas fichas. Sem correção, um relatório gerado a partir de JSON adulterado contém JavaScript executável ao ser aberto.

### 2. Média — os oito relatórios de 83c107f0 apontam para outra revisão

**Local:** `viabilidade/relatorio/saida/*.html`, meta `estudo-sha256`; comparação na tela em `viabilidade/visual/index.html:229–245`.

**Esperado:** hash do JSON commitado igual ao meta do respectivo HTML. **Obtido em 83c107f0:** **0/8 conferem**. Exemplo: JSON `184217bede7d…`, relatório `435c5c4ee3b2…`. As cinco métricas conferem, mas isso não substitui a identidade integral do arquivo. A divergência também não é explicada apenas por converter LF para CRLF.

**Reproduzir:** `python -I -B -X utf8 viabilidade/revisao/tarefa2/consolidar.py`. A lista completa está em `evidencias/estudos.json` e `consolidacao.json`.

O código da tela calcula SHA-256 dos bytes recebidos e compara o meta: portanto esses relatórios seguem o ramo “Relatório desatualizado”. A observação desse aviso no DOM ainda está pendente. **Em cad94ecd, 8/8 hashes conferem.** Publicar sempre o par JSON/HTML gerado dos mesmos bytes; não há correção adicional deste achado a pedir para cad94ecd. Se for usado o pacote antigo, o botão de relatório impede a abertura pelo fluxo normal.

### 3. Média — CA perde casas decimais na tela

**Local em 83c107f0:** `viabilidade/visual/index.html:43,48,156`; `relatorio.py:75–108` preserva as casas significativas. A configuração `maximumFractionDigits: 2` permanece em `cad94ecd`.

**Esperado pela tarefa:** unidades, privativa, CA, TO e vagas iguais entre JSON, tela e relatório. **Obtido:** nas **130 métricas** das **26 opções** dos oito estudos, **17 valores de CA** são arredondados na tela. Exemplo: estudo-exemplo/A, JSON e relatório `2,081`, tela `2,08`; piloto 22421/B, `0,998` vira `1`. As outras **113** métricas preservam o valor, normalizando a TO percentual da tela para fração.

**Reproduzir:** `node viabilidade/revisao/tarefa2/metricas.cjs`. O script executa a função real de formatação extraída da tela fixada; a lista está em `evidencias/formatacao.json`. Não é captura de DOM.

**Correção mínima:** preservar a precisão do CA recebido do Motor, de modo consistente com o relatório. Sem correção, o usuário lê números diferentes e um CA abaixo de 1 pode aparecer como 1. Não foi encontrada divergência nas métricas armazenadas no HTML, nos dois commits.

### 4. Média — pacote do three não acompanha o texto completo da licença

**Local:** `viabilidade/visual/vendor/gerar.mjs:24`, bundle e arquivos adjacentes, iguais entre os dois commits.

**Esperado pela tarefa:** licença MIT preservada no pacote ou ao lado dele. **Obtido:** bundle com aviso `Copyright 2010-2026 Three.js Authors` e identificador `SPDX-License-Identifier: MIT`, mas sem o texto completo; a pasta tem somente `entrada.js`, `gerar.mjs`, manifesto e bundle.

**Reproduzir:**

```powershell
git ls-tree -r --name-only 83c107f0 -- viabilidade/visual/vendor
Select-String -Path viabilidade/revisao/tarefa2/referencia/viabilidade/visual/vendor/three-viabilidade.min.js -Pattern 'SPDX-License-Identifier|Permission is hereby granted'
```

**Correção mínima:** copiar a licença da versão empacotada para `vendor/` e fazer o gerador preservá-la. Sem isso, a entrega continua sem o texto de licença solicitado. Evidência existente: `evidencias/vendor.json`.

## O que passou e o que está pendente

| Verificação | Resultado e alcance |
|---|---|
| Procedência | 87 arquivos do snapshot conferem com 83c107f0. |
| Textos do estudo | Os 61 casos anteriores de texto/motivo não contêm tags ativas no relatório. `motivo` fora da enumeração é rejeitado pela tela; os demais passam pelo validador e chegam a caminhos com `textContent`. Execução no navegador pendente. |
| Selo de domínio em cad94ecd | `versao` e `motivos` com payload não produzem tags ativas no HTML nos três estados. A tela usa `textContent`/`el()`. |
| Métricas dos relatórios | Cinco métricas de todas as opções conferem com os JSONs nos oito estudos, nos dois commits. A evidência anterior também valida os HTMLs regenerados. |
| Contrato v4 | Oito casos sem os campos opcionais novos foram gerados e validados pelo relatório na etapa anterior. Agora também passaram no `validar()` real da tela, extraído e executado em Node. A abertura e apresentação visual ainda dependem de Chrome. |
| Bundle | 592.249 bytes; SHA-256 `fd1b23dd766dd7bfa86853033f0598d15afed8a9136d28f443b4625a4d106741`, igual ao manifesto. |
| Reprodução do bundle | Registro da central no commit `df37e7b4` diz que reproduziu o SHA. Não houve nova compilação nesta retomada; a tentativa local anterior foi bloqueada. |
| Rede externa | Importmap e bundle locais, sem CDN no caminho normal inspecionado. Observação independente de requisições no navegador pendente; não aprovada com base em lista vazia. |
| Aviso de revisão | Comparação de bytes e ramos de erro inspecionados. Casos de hash correto, errado, ausente e HTTP 404 preparados, mas ainda não executados em Chrome. |

Há ainda um teste preparado para a janela entre conferir e abrir o relatório: a tela faz `fetch(href)` e depois navega novamente para a mesma URL. O script serve respostas diferentes nessas duas etapas e registra o resultado. **Não tratado aqui como defeito reproduzido em navegador.**

## Execução restante para a central

Não é necessário gerar novamente os casos. Na raiz do repositório, abrir um terminal para o servidor da **cópia fixada**:

```powershell
python -I -B -m http.server 8879 --bind 127.0.0.1 --directory viabilidade/revisao/tarefa2/referencia
```

Em outro terminal:

```powershell
node viabilidade/revisao/tarefa2/browser.cjs
```

O script usa Chrome instalado, Playwright do projeto ou do runtime, e salva `tarefa2/evidencias/browser.json`. `REVIEW_URL` serve apenas para mudar a porta/endereço dessa mesma cópia; não apontar para a tela em edição ou para cad94ecd. Resultado esperado da auditoria da versão defeituosa: `status: concluido`, oito estudos, 63 casos XSS, três cenários de aviso, nenhuma requisição externa e alertas nos dois casos numéricos do relatório. O teste documenta vulnerabilidades conhecidas; concluir não significa que a versão está aprovada.

Na retomada, foram corrigidos dois problemas do próprio teste: o seletor contava o `importmap` legítimo como injeção, e o relatório substituído precisava ser interceptado também na navegação da nova aba. O teste agora confere o meta da aba aberta e exige zero alertas na tela. `node --check` passou; execução real continua pendente.

Comandos locais executados nesta retomada: `consolidar.py`, `metricas.cjs` (130 métricas e 71 validações) e checagem de sintaxe de `browser.cjs`. Alterações somente em `viabilidade/revisao/`: este relatório, `tarefa2/consolidar.py`, ajustes de `browser.cjs`/`metricas.cjs` e evidências `consolidacao.json`/`validacao.json`. `formatacao.json` foi reemitido pelo script. Os demais arquivos soltos já existiam. **Nada foi commitado.**

Não executados nesta retomada: Chrome, servidor, recompilação do bundle, suíte completa, publicação ou verificação de impressão. Risco restante: injeção de HTML confirmada no relatório, cuja execução em navegador ainda precisa ser documentada pela central.
