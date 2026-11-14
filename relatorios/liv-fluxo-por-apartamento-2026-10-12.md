# LIV: plantas e Tour a partir do apartamento selecionado — 12/10/2026

Atualização visual posterior: o visualizador voltou ao padrão solicitado pelo usuário, com fundo escuro e painel compacto abaixo da maquete. O fluxo descrito aqui foi preservado; a composição atual está registrada em [LIV: layout de referência](liv-layout-referencia-2026-10-12.md).

Direção confirmada: simplificar o LIV e apresentar Planta 2D, Planta 3D e Tour 3D somente depois da seleção de um apartamento. Esta atualização substitui a navegação geral descrita no relatório anterior de correções.

## Comportamento entregue

- A entrada apresenta a maquete e a instrução para selecionar um apartamento na fachada.
- A seleção abre um painel com número, pavimento, tipologia, posição e situação comercial da unidade. A ficha completa abre pelo botão **Informações do apartamento**, sem alterar a câmera ou a seleção.
- O painel oferece **Planta 2D**, **Planta 3D** e **Tour 3D**. A tipologia Canto/Meio vem da associação cadastrada da unidade; o seletor manual de tipologia deixa de fazer parte do fluxo.
- Sem associação válida, as informações continuam acessíveis e os interiores permanecem indisponíveis. A interface também aguarda a validação dos vínculos antes de restaurar uma sessão com interiores.
- Dentro dos interiores, a navegação mantém o apartamento identificado. **Voltar à maquete** conserva a seleção; escolher outro apartamento atualiza seu contexto e sua planta.
- No celular, selecionar a unidade leva ao painel; abrir uma planta ou o Tour leva ao visualizador. A rolagem respeita a preferência de movimento reduzido.

O arquivo atual de vínculos cobre as 170 unidades do catálogo do edifício: 68 Canto e 102 Meio. O fluxo usa esses vínculos explícitos. A cobertura técnica não substitui a conferência arquitetônica da fonte, e a identificação ilustrativa dos interiores continua visível.

## Arquivos

Interface e comportamento em `experimentos/liv-ipanema-webgpu-2026-10-09/`: `maquete-liv-ipanema.html`, `viewer-ui.css`, `viewer.js`, `unit-ui.js` e `test_viewer_flow.mjs`. `CATALOGO.md` e `VINCULOS.md` descrevem o novo fluxo e a cobertura atual. Os arquivos de dados comerciais, vínculos e modelos não foram modificados nesta atualização.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte Node completa do LIV | 82 testes passaram, zero falhas. |
| Regressões de fluxo do viewer | 19 casos passaram, incluindo bloqueio sem unidade, restauração validada, alteração da associação e carregamentos concorrentes. |
| Navegador real, WebGL | Seleção de 102/Canto e 206/Meio; ficha, plantas 2D/3D, Tour e retorno à maquete conferidos. |
| Celular | Seleção pela fachada, rolagem ao painel/visualizador, ficha e troca entre os três modos conferidas em 390 × 844 px. |
| Responsividade | 320, 768, 1024 e 1440 px, sem rolagem horizontal; os três botões do painel mantêm pelo menos 44 px de altura. |
| Inventário da entrega | 238 arquivos; `viewer-ui.css` incluído automaticamente pela referência no HTML. |
| Sintaxe e whitespace | Verificação JavaScript e `git diff --check` passaram. |

Prévia local: `http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio&backend=webgl`.

Capturas em `C:/Users/respawn/.codex/visualizations/2026/10/12/01a1311e-28a6-7871-82c2-c70259fc03b9/`: `liv-apartamento-selecionado-desktop.jpg` e `liv-apartamento-informacoes-mobile.jpg`.

As alterações continuam locais, sem commit ou publicação. Os resultados dos testes gerais e as pendências anteriores permanecem registrados em `correcoes-liv-2026-10-12.md` e `auditoria-alteracoes-locais-2026-10-12.md`.
