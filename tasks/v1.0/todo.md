# Execução da versão 1.0

Escopo e decisões: [plan.md](plan.md). Ordem: T01 → T02/T03 → T04 → T05 → T06 →
T07 → T08 → T09 → T10 → T11 → T12 → T13 → T14 → T15. Cada incremento deve ser
verificável; tarefas grandes abaixo têm entregas separadas. Sem prazo prometido
antes de validar um tour completo e medir no celular.

## T01 — Registrar o piloto e sua apresentação

- [x] Selecionar Castanheiras, Colinas e Cedros; criar plano separado autorizado.
- [x] Exibir Sob consulta e localização aproximada na vitrine, ficha e metadados.
- [x] Gerar base local `1.0.0-dev.1` com os três imóveis e manifesto.

Aceite: IDs existem, preços continuam nulos, coordenadas continuam não confirmadas.
Arquivos: `tasks/v1.0/piloto.json`, `listings/sheet.js`, `listings/flow.js`,
`pipeline/imovel.py`; testes de ficha e fluxo, build isolado e inspeção de metadados.

Resultado: [verificação da primeira base](verificacao-dev.1.md). T01 concluída;
T02–T15 seguem pendentes. A montagem local não equivale à release estável.

## T02 — Dados de anúncio seguros

- [x] Escapar título/bairro em `listings/house-sheet.js`; aceitar somente URLs de anúncio HTTP(S).
- [x] Proteger a serialização de JSON embutido contra fechamento de tag script.

Aceite: entradas com HTML são texto e não executam código; links inválidos não navegam.
Arquivos: `house-sheet.js`, `sheet.js`, serialização em `pipeline/build/` e testes focados.
Verificar fixtures hostis em navegador, sem usar dados externos ou gravar produção.

Resultado: [verificação do T02](verificacao-t02.md). O escape do `</` ficou no montador,
não em `pipeline/build/`, porque é ali que todo bloco vira tag. A ficha da unidade
cadastrada já escapava; o item da vitrine pública, não.

## T03 — Isolamento dos dados no Firebase

- [ ] Restringir criação, leitura e atualização de usuários e alterações de tenant em imóveis.
- [ ] Testar dois tenants, usuário comum, admin e visitante no emulador.

Aceite: nenhuma leitura ou edição cruzada; o titular não concede privilégios a si mesmo.
Arquivos: `firebase/firestore.rules`, testes de regras e configuração do emulador.
Implantação das regras é uma etapa própria, após revisão do resultado.

## T04 — Preparação de publicação consistente

- [ ] Consolidar nome por hash e conferir tiles/modelos/imagens antes de atualizar índice.
- [ ] Definir cache de rotas estáveis e assets imutáveis; manter rollback.

Aceite: duas montagens diferentes geram URLs diferentes; falha preserva índice anterior.
Arquivos: `pipeline/publicar.py`, `exteriores/v1/preparar.py`, `firebase.json` e testes.
Verificar pacote HTTP e ausência deliberada de um asset, sem executar deploy.

Checkpoint A: build preservado, entradas seguras, isolamento testado, pacote completo.

## T05 — Link e estado de um imóvel

- [ ] Extrair deep links do script injetado para módulo de produção com prontidão explícita.
- [ ] Preservar aliases e resolver erro, timeout, navegação rápida e unidade desconhecida.

Aceite: URL abre exatamente uma unidade e não deixa ação anterior abrir outro imóvel.
Arquivos: novo módulo em `listings/`, `modules.json`, integração em `app.js`, gerador e teste.
Verificar primeira carga sem cache e dois links sucessivos; usar um imóvel antes dos três.

## T06 — Ficha estática compartilhável

- [ ] Gerar página leve por imóvel com área, preço, localização e acesso ao tour/anúncio.
- [ ] Adicionar copiar link/compartilhar, com alternativa quando compartilhamento nativo falhar.

Aceite: ficha funciona sem JS/3D; URL canônica é estável e preserva imóvel/modo.
Arquivos: gerador de página individual, template, CSS e testes de metadados/URLs.
Verificar HTML bruto, navegação por teclado e layout estreito.

## T07 — Preview automático

- [ ] Capturar a unidade real quando renderização e luz estiverem prontas; salvar imagem versionada.
- [ ] Inserir OG absoluto somente com imagem existente; identificar visualização 3D.

Aceite: três imagens corretas, sem HUD ou tela vazia; thumbnail no compartilhamento real.
Arquivos: captura em `pipeline/`, gerador OG e testes de integridade.
Verificar HTTP 200, dimensão, enquadramento e cache; não substituir teste real por metatag existente.

Checkpoint B: um tour funciona de ponta a ponta e pode ser compartilhado.

## T08 — Aérea

- [ ] Enquadrar imóvel/entorno e garantir entrada/saída por URL e botão.
- [ ] Executar E01: ortográfica/transparência/rotação opcional.

Aceite: imóvel legível em retrato e paisagem; interação interrompe rotação automática.
Arquivos: câmera, controlador de modos, UI e teste de transições; captura antes/depois.

## T09 — Planta 3D

- [ ] Reaproveitar `vista(true)` e isolar a unidade, restaurando o entorno ao sair.
- [ ] Manter rotação/zoom sem conflito com editor de móveis ou primeira pessoa.

Aceite: unidade inteira enquadrada e mobiliada; repetidas trocas não acumulam recursos.
Arquivos: `interior/entry.js`, controlador de modos, cena/frame e testes.

## T10 — Planta 2D

- [ ] Introduzir projeção ortográfica superior e distribuição de cômodos legível.
- [ ] Executar E02: linhas versus paredes preenchidas, rótulos e medidas.

Aceite: sem distorção de perspectiva, cômodos legíveis e retorno correto à planta 3D.
Arquivos: câmera ativa, controlador de modos, UI e teste focado; revisar picking e resize.

## T11 — Walkthrough

- [ ] Consolidar entrada e saída na altura dos olhos usando navegação existente.
- [ ] Dar controles explícitos para sair/trocar modo no celular e avisos do imóvel na entrada.

Aceite: portas transitáveis, colisão, luz e retorno à ficha em cada um dos três tours.
Arquivos: `entry.js`, `first-person.js`, UI dos modos e testes de fluxo.

Checkpoint C: quatro modos e aliases funcionam; testes de câmera/picking/editor continuam válidos.

## T12 — Carregamento por necessidade

- [ ] Medir custo por bloco e separar primeiro unidade, biblioteca necessária e entorno.
- [ ] Criar carregamento recuperável com cache e cancelamento ao trocar de unidade.
- [ ] Reduzir o pacote do modo planta sem quebrar índices ou mínimos de bibliotecas.

Executar em três incrementos: medição; loader; divisão dos pacotes. Cada um tem teste próprio.
Aceite: planta abre sem baixar/montar cidade inteira; falha de rede não resulta em tela vazia.
Arquivos: build/pacotes, dados de cidade, controlador de modos e teste de rede.
Comparar bytes HTTP, abertura fria/quente, parse e memória; preservar IDs do recorte.

## T13 — Mobile e falha de WebGL

- [ ] Validar um/dois dedos, teclado virtual, orientação e controles sem sobreposição.
- [ ] Reusar nível baixo/governador e experimentar redução do entorno.
- [ ] Mostrar ficha estática quando criar o renderer falhar; não exigir WebGL2 sem necessidade.

Aceite: Android/Chrome e iPhone/Safari, com navegador do WhatsApp, completam o fluxo.
Arquivos: gestos, qualidade, bootstrap/fallback e UI; dividir por gesto, fallback e desempenho.
Emulação desktop é preliminar; registrar separadamente testes em aparelho físico.

## T14 — Cache offline

- [ ] E05: implementar cache com limite e estratégia de atualização após estabilizar URLs/pacotes.
- [ ] Verificar versão anterior, download interrompido, offline e liberação de espaço.

Aceite: não mistura arquivos de versões distintas; consegue atualizar e sair de uma versão defeituosa.
Arquivos: service worker, registro e teste HTTP/HTTPS. Não prometer funcionamento em `file://`.

## T15 — Fechar o piloto

- [ ] Testar os três imóveis em todas as entradas e modos; registrar capturas e métricas.
- [ ] Rodar suites e QA completo sobre hashes dos artefatos corretos; revisar achados da segurança.
- [ ] Gerar `1.0.0-rc.1`, changelog, pacote de links e texto para o corretor.
- [ ] Validar preview real, mobile e rollback antes de marcar `1.0.0` estável.

Dependências: T01–T14. Arquivos: manifesto da release, relatório de aceite e changelog.
Publicação e envio não são consequências automáticas de um teste local aprovado.
