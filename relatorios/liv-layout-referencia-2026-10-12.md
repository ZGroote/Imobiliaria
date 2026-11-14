# LIV: retorno ao padrão visual solicitado — 12/10/2026

Complemento solicitado pelo usuário: removidos os botões de vistas, seletor de pavimento, captura PNG e “Mais opções”. O filtro de apartamentos passou para o topo, ao lado de “LIV Ipanema”, e “17 pavimentos” saiu do selo. Os 19 testes de fluxo passaram; a maquete e o filtro de disponibilidade foram conferidos no navegador, incluindo 320 px sem rolagem horizontal. A captura atual está em `liv-filtro-topo-desktop.jpg`, na pasta de capturas indicada abaixo.

Atualização do painel: as informações gerais do empreendimento aparecem somente na maquete. Nas plantas 2D/3D e no Tour, permanece o contexto do apartamento. O botão `−` minimiza as informações e os textos auxiliares; `+` restaura o painel. Os modos de visualização e seus controles continuam acessíveis. A altura efetivamente liberada é adicionada à cena, inclusive após trocar de modo ou redimensionar a tela. A preferência é preservada na sessão, e o botão funciona com Enter e Espaço. Os 24 testes de fluxo e abertura local passaram; os quatro modos foram conferidos no navegador, sem erros de console, e as larguras de 320, 768, 1024 e 1440 px não apresentaram rolagem horizontal. Na planta 2D, o painel liberou 193,984375 px e a cena aumentou de 521,5 para 715,484375 px. Captura: `liv-planta3d-painel-minimizado.jpg`.

O usuário pediu para seguir aproximadamente a captura enviada: maquete central sobre fundo escuro, identificação discreta e um painel compacto abaixo com informações e controles. Essa direção substitui a composição anterior com cabeçalho grande, fundo claro na cena e painel lateral.

## Resultado

- Maquete centralizada, sem moldura clara, com o selo “LIV Ipanema” e o filtro de apartamentos ao lado.
- Um único painel abaixo da cena, com minimizador próprio e nome, endereço e dados gerais do empreendimento somente na maquete.
- Botões principais em linha e destaque verde, conforme a referência. O painel minimizado conserva a navegação; a experiência visual recebe a altura liberada.
- A seleção continua abrindo as informações da unidade dentro do mesmo painel. Planta 2D, Planta 3D e Tour 3D só aparecem após a associação válida do apartamento.
- A ficha mantém seu botão próprio, e retornar à maquete conserva a unidade selecionada. No celular, abrir uma visualização leva à cena no topo.
- O tema escuro do exterior é solicitado somente pelo visualizador do produto (`embed=1&tema=escuro`). A iluminação de entardecer mantém esse fundo; a prova isolada conserva sua apresentação anterior.

Arquivos alterados nesta etapa, em `experimentos/liv-ipanema-webgpu-2026-10-09/`: `maquete-liv-ipanema.html`, `viewer-ui.css`, `viewer.js`, `prova-rgbm.html`, `renderer.js` e `ambiencia.js`. Modelos, materiais importados, bakes e dados comerciais não foram alterados nesta etapa.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte Node completa do LIV | 82 testes passaram, zero falhas. |
| Sintaxe JavaScript | `viewer.js`, `renderer.js` e `ambiencia.js` passaram. |
| Responsividade | 320, 768, 1024 e 1440 px, sem rolagem horizontal; painel abaixo da cena; botões de plantas e Tour com 44 px. |
| Navegador real | Maquete em perspectiva, iluminação Dia/Entardecer, Planta 3D Meio, Tour com rotas, ficha da unidade 206, Planta 2D a partir da ficha e retorno à maquete conferidos. |
| Celular | Fluxo conferido em 390 × 844 px, mantendo o apartamento 206 e a tipologia Meio. |
| Console | Nenhum erro registrado durante a conferência. |
| Whitespace | `git diff --check` sem erros. |

Prévia local: `http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio&backend=webgl`.

Capturas em `C:/Users/respawn/.codex/visualizations/2026/10/12/01a1311e-28a6-7871-82c2-c70259fc03b9/`: `liv-layout-referencia-desktop.jpg` e `liv-layout-referencia-mobile.jpg`.

O fluxo por apartamento e sua associação Canto/Meio continuam descritos em [LIV: fluxo por apartamento](liv-fluxo-por-apartamento-2026-10-12.md). As alterações estão locais.
