# Revisão de complexidade — 15/09/2026

Escopo: módulos criados em `pipeline/build`, `core`, `world`, `scene`, `materials`, seus consumidores e testes desta modularização. Revisão com a skill ponytail-review. Os dois achados abaixo foram corrigidos após autorização do usuário, no commit `35fcefb`.

- Corrigido — `tests/browser_snapshot.py` (antigo L1): delete: segundo capturador de câmera fixa, 99 linhas, sem consumidor ativo encontrado. Usar `tests/browser_realtime.mjs`, que já captura a mesma cena, registra métricas e verifica a API; seus tempos usam relógio real.
- Corrigido — `renderizador-v16-moveis/materials/roads.js:L92`: delete: parâmetro `mul` herdado do monólito, sem leitura na função. Trocar `matVia(cor, mul, calcada)` por `matVia(cor, calcada)` e remover o argumento nas duas chamadas e no teste. Economia de argumentos, não de linhas.

net: -99 lines applied.

## Estrutura mantida

Não encontrei necessidade de um framework de módulos, contêiner de injeção, barramento de eventos ou classes base. Nenhum deles foi introduzido. As fábricas existentes recebem dados já usados: configuração/quantização, uniformes de cena, acesso a storage e texturas. O terreno possui estado mutável próprio; geometria e classificação são funções compartilhadas pelas auditorias. O manifesto atende ao HTML offline já distribuído e preserva a ordem de inicialização.

Atualização `19b0155`: o GLSL compartilhado passou para `materials/resources.js`, carregado antes dos materiais. `getNoise` foi removido de fachadas e superfícies; os consumidores recebem a string pronta. A flag `TEX_ON`, sem consumidor, também foi removida. Não foi criado um sistema de resolução de dependências.

Os testes de shader usam o código de um commit fixo como oráculo da migração. Essa comparação tem propósito durante a extração e exige histórico Git local. Não substitui os testes funcionais nem demonstra, sozinha, que todo o monólito está correto.

Esta revisão cobre os arquivos gerados nesta migração; não é uma auditoria de complexidade dos 10 mil arquivos de dados, históricos e demais fontes do acervo. O capturador duplicado foi excluído, e a API de `matVia` e seus consumidores foram ajustados. Os quatro testes de shader de via passaram após a simplificação.


Revisão dos lotes de vegetação/divisas com `ponytail-review`: o estado de instâncias e do índice espacial tem consumidores reais, e as APIs de criação, atualização e invalidação acompanham os fluxos existentes. Não foram adicionados barramento, gerenciador genérico de entidades ou novas dependências. A revisão de complexidade não encontrou corte de linhas necessário nesses lotes; os testes de equivalência permanecem justificáveis durante a migração.

Revisão de 16/09 após integrar os 26 commits paralelos: removidos oito nomes sem leitura no consumidor `app.js` (`insetRing`, `convexHull`, `ST`, `ST_NOME`, `predioMaisPerto`, `loteDaUnidade`, `semAcento`, `MM_CEL`). Suas implementações e APIs de módulo permanecem: têm uso interno, em testes ou auditorias. Nenhuma camada nova foi necessária. Economia de oito bindings locais, sem redução relevante de linhas.

Revisão dos lotes 21g/20e: `InteriorFrame` devolve uma função chamada pelo laço existente; `InteriorEnvironmentProbe` expõe somente capturar e liberar e mantém a textura ativa privada. Não adicionam scheduler, hierarquia de classes, contêiner ou dependências. Não foi identificado código removível nesses dois módulos sem retirar comportamento existente. Os testes de equivalência e descarte servem à migração; os mocks não entram no build. net: -0 lines possible.

Revisão do lote 21h: `InteriorEntry` é a composição que já existia, com as mesmas oito funções e nenhuma camada nova — sem máquina de estados, sem eventos, sem classe. As duas únicas adições são os dois acessores que atravessam a fronteira do módulo (`getRelevo` e `poeTipoNulo`), e cada um existe porque o valor muda no `app.js`. Não foi identificado código removível sem retirar comportamento. net: -0 lines possible.

Revisão do lote 21i: `EditorPanel` devolve as dez funções que já existiam, sem estado próprio além do que o `MOB` e o `INT` já guardavam — nenhuma classe, nenhum barramento, nenhum registrador de comandos. Os dois acessores de `poeTipo` existem porque o dono da variável é o clique dentro da casa, que ficou no `app.js`. Não foi identificado código removível sem retirar comportamento. net: -0 lines possible.

Revisão do lote 21j: `Picking` devolve as quatro funções que já existiam e mantém o raycaster e o vetor de tela como estado interno, que é onde eles já viviam. Nenhum despachante de eventos, nenhuma cadeia de manipuladores, nenhuma dependência nova. Os três acessores existem porque o dono das variáveis continua no `app.js`; inventar um objeto de estado compartilhado só pra evitá-los seria trocar três funções de uma linha por uma camada. net: -0 lines possible.

Revisão do lote 11a (resto): `Elevation` devolve quatro funções e uma chave; não guarda a grade (quem guarda é o `terrain`, como antes), não embrulha o `fetch` numa camada de cliente HTTP e não inventa política de repetição além da que já existia (uma). A ligação com a cena ficou de fora de propósito: movê-la junto exigiria injetar terreno, urbanos, rótulos, POIs e vegetação num módulo que só sabe baixar números. net: -0 lines possible.

Revisão do lote 17 (resto): `SearchBox` guarda as duas variáveis que a lista sempre teve (índice e resultados) e assina os ouvintes que já existiam, um a um, sem despachante nem abstração de "componente". A busca em si continua no `CitySearch`, que já era módulo; este lote é só a caixa. net: -0 lines possible.

Revisão do lote 16 (resto): `ListingFlow` tem as mesmas cinco funções e os mesmos dois estados (`escolhendo` e `FICHA`) de antes; `abreFichaDoImovel` e `reabreFicha` nem são exportados, porque quem os chama está dentro. A `listingSheet` deliberadamente NÃO foi para dentro: ela serve aos dois fluxos, e duplicá-la ou reexportá-la seria inventar dono para uma peça que já tem um. Uma remoção real: `UNID_ATUAL`. net: -3 lines.

Revisão do lote 17 (POIs): `PoiPanel` mantém o mesmo punhado de variáveis de estado que o trecho já tinha (`catOn`, `poiSel`, `poiHidden`, `PERTO` e os quatro campos da guarda de quadro parado) e as mesmas funções; a camada 3D continua no `PoiLayer`, que já era módulo. Duas exportações a mais (`catOn` e `pinoOculto`) existem porque o minimapa e o diagnóstico leem esse estado -- o alternativo seria duplicar a informação. Não foi identificado código removível sem perder comportamento. net: -0 lines possible.

Revisão do lote 16 (anúncio público): `HouseSheet` não devolve nada -- a vitrine e a ficha dela só se falam ali dentro --, e mantém o único estado que já existia (`HOUSE_ATUAL`). Nenhum registro de fichas, nenhuma classe base compartilhada com a ficha do imóvel cadastrado: as duas usam a MESMA `listingSheet`, que continua sendo criada uma vez no `app.js`. net: -0 lines possible.

Revisão do lote 22 (medidor e teclado): os dois módulos devolvem exatamente o que os consumidores usam -- o medidor três funções, o teclado nenhuma (ele só assina ouvintes). Nenhum mapa de atalhos configurável, nenhum sistema de comandos, nenhuma camada de "HUD": o medidor continua escrevendo nos mesmos ids. O `ligado()` do medidor existe porque o atalho P precisa saber o estado que o próprio medidor guarda. net: -0 lines possible.
