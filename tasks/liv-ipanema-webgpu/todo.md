# Execução — LIV Ipanema visual e WebGPU

Referência: [plano](plan.md), [baseline](baseline.json) e [dossiê](../../relatorios/liv-referencias-publicas-2026-10-09/README.md). Data: 09/10/2026.

A execução foi autorizada pelo usuário e começou em 09/10/2026, na branch `codex/liv-ipanema-webgpu`. T00/T01 e a validação técnica de T03/T04 foram concluídas. T02 está parcial: referências, reconciliação e medições desktop/emuladas registradas; ensaio físico e orçamento definitivo continuam pendentes. T05 tem a separação inicial dos recursos e Planta 2D direta. Nenhuma publicação da evolução foi realizada.

Convenção de caminhos abaixo: `EXP` = novo diretório `experimentos/liv-ipanema-webgpu-2026-10-09/`; `LIV` = `v1.5/miniaturas/liv-ipanema/`; `MAPA` = `experimentos/mapa-liv-ipanema-5km-2026-10-08/`. Arquivos novos são propostas de organização, a confirmar na reprodução. Não alterar o experimento histórico para hospedar a evolução.

## LIV-M0 — preservar, reproduzir e medir

- [x] **T00 — Preservar a versão escolhida.**
  - Dependências: nenhuma.
  - Responsabilidade: copiar o pacote completo e conferir sua identidade; registrar o endereço público e a expiração.
  - Artefatos: `backups/liv-webgpu-2026-10-09/site-v3/`, `backups/liv-webgpu-2026-10-09/inventario.json`, `baseline.json`.
  - Verificação realizada: HTML público baixado e comparado; 126 arquivos da cópia comparados por hash com a origem local; 58.313.188 bytes preservados. Teste novo de navegador e medição física ainda não realizados.
  - Continuidade: manter essa cópia preservada; copiar para o armazenamento de artefatos do projeto na execução.

- [x] **T01 — Corrigir e demonstrar a reprodução isolada.**
  - Dependências: T00.
  - Responsabilidade: separar hash de fonte e publicação minificada, fixar entradas/versões e gerar em destino novo, conservando verificações.
  - Escopo provável: `MAPA/preparar_site.py`, teste específico de reprodução em `EXP/`, `EXP/preparar_pacote.py`, `EXP/manifesto.json`, `EXP/README.md`.
  - Aceite: preparação aceita a origem correta, rejeita origem alterada e gera os quatro modos, links e recursos esperados. Registrar diferenças da reprodução sem sobrescrever `site-v3/` ou seus relatórios.
  - Verificar: teste positivo/negativo de identidade; manifesto/hashes; `qa_miniatura.py` e `qa_mapa.py` apontados ao novo destino.
  - Executado: commit `fa4730d`; dez testes passaram, incluindo falha intermediária/recuperação. Montagem e repetição conferem 125 arquivos idênticos; QAs em `EXP/evidencias/reproducao-miniatura/` e `reproducao-mapa/` passaram.

- [ ] **T02 — Capturar baseline, registrar evidências e fechar orçamento.**
  - Dependências: T00; executar em paralelo à T01 quando possível.
  - Responsabilidade: capturas em câmeras fixas, protocolo de rede/cache e desempenho, matriz de referência, reconciliação de pavimentos e finais.
  - Escopo provável: `EXP/medir_baseline.py`, `EXP/evidencias/baseline/`, `EXP/referencias.json`, `EXP/orcamento.json`, `EXP/README.md`.
  - Aceite: três rodadas comparáveis no desktop e ao menos um celular físico; equipamento/backend declarados; relação entre térreo + 16 tipos e a geometria atual documentada; metas fixadas antes dos efeitos.
  - Verificar: transferência real, primeira cena utilizável, quadros p50/p95 e memória disponível; capturas frontal, lateral e aérea/implantação associadas às fontes oficiais.
  - Parcial: `referencias.json`, `reconciliacao-unidades.md`, capturas e três rodadas por viewport/cache em `evidencias/medicao-baseline/`. Medição inicial concorrente com QAs, rede local e toque emulado: diagnóstico preliminar. `orcamento.json` é provisório e foi fixado antes de novos efeitos. Comparação visual oficial e Android/iPhone físicos pendentes.

**Checkpoint C0:** T01 + T02. Baseline recuperável, pipeline reproduzível e métricas registradas. Estimar o calendário após esse checkpoint e a prova T03.

## LIV-M1 — provar e integrar o renderer

- [x] **T03 — Provar RGBM em TSL nos dois backends.**
  - Dependências: T01, T02.
  - Responsabilidade: portar um material representativo com as mesmas geometria/UV/textura e uma versão fixa do Three.js.
  - Escopo provável: `EXP/renderer.js`, `EXP/material-rgbm.js`, `EXP/prova-rgbm.html`, manifesto de runtime/recursos, evidências da prova.
  - Aceite: decodificação, espaço de cor, UV e intensidade preservados; sem dupla iluminação; capturas comparáveis em WebGPU e WebGL2; falha de inicialização recuperável.
  - Verificar: comparação com `LIV/liv-lightmap.js` em vistas idênticas, backend efetivo registrado e erros de recurso/inicialização exercitados.
  - Executado: commit `df128bf`, Three.js 0.186.1 fixado. Exterior efetivo de 56 malhas/41 baked exportado com geometria/UV/atlas verificados. WebGPU NVIDIA/Turing e WebGL2 ANGLE/D3D11 passaram em 1440×900 e 390×844 emulado. Dez capturas comparáveis documentam diferenças de PBR/sombra/AA; continuidade visual, sem identidade de pixels. Nove cenários de recuperação passaram em `evidencias/recuperacao/`.

- [x] **T04 — Migrar o exterior atual e preservar controles/captura.**
  - Dependências: T03.
  - Responsabilidade: integrar materiais necessários, orbit/câmeras, destaque de pavimento, troca de modos e PNG; manter interiores legados sob demanda nesta fase.
  - Escopo provável: `EXP/renderer.js`, `EXP/exterior.js`, `EXP/viewer.js`, `EXP/captura.js`, `EXP/qa_viewer.py`.
  - Aceite: cinco vistas, câmera livre, destaque/reset, PNG e ida/volta dos quatro modos funcionam. Renderer/cena inativos são liberados; implantação permanece completa.
  - Verificar: QA funcional e capturas comparáveis nos dois backends; vinte ciclos de troca de modo para investigar crescimento de memória; PNG efetivamente baixado e decodificado.
  - Executado: `maquete-liv-ipanema.html`, `viewer.js` e adaptador de retorno do mapa. Quatro modos, cinco vistas, destaque/reset, mouse/toque e PNG passaram; interiores legados continuam sob demanda e ilustrativos. Vinte ciclos desktop e vinte com toque emulado mantiveram um iframe ativo e contagens estáveis de documentos/nós; heap via CDP não comprova toda a memória GPU. `qa_navegacao.py` passou em 320/768/1440 px, incluindo ida/volta do mapa, recuperação de câmera/pavimento no voltar e decodificação dos PNGs. Evidências em `integracao-final/`, `integracao-20-ciclos/`, `integracao-20-ciclos-toque/` e `navegacao/`.

**Checkpoint C1 técnico atingido:** T03 + T04 no equipamento declarado e emulação de toque. Diferenças visuais documentadas antes de refinamento artístico. Qualificação física T02/T12 permanece pendente; este resultado não é o piloto de seleção C3.

## LIV-M2 — reduzir carga e refinar a cena

- [ ] **T05 — Separar assets e tornar o carregamento progressivo.**
  - Dependências: T04.
  - Responsabilidade: pacotes por modo/luz, manifesto/hash, cache coerente, instancing/LOD e texturas conforme medição.
  - Escopo provável: `EXP/assets/`, `EXP/loader.js`, `EXP/preparar_pacote.py`, `EXP/manifesto.json`, medição de rede em `EXP/`.
  - Aceite: menos bytes iniciais e abertura melhor que a base nas condições de T02; após a tela inicial utilizável, preparar Tour → mapa → Planta 2D, com preempção pelo modo solicitado, conforme nova diretriz do usuário. Não criar cenas ocultas; erros de download permitem nova tentativa; recursos não se misturam entre versões.
  - Verificar: rede fria/cache, bloqueio de um asset, retorno entre modos e pico de memória. Comparar o GLB existente à cena embutida antes de escolher qual representação otimizar.
  - Parcial: cena/atlas/texturas exteriores separados e verificados; Planta 2D abre da imagem sem renderer. A política anterior por clique foi substituída pela fila automática após a abertura inicial. O GLB regional não foi escolhido porque diverge da cena efetiva da base. Medição comparável e orçamento físico ainda precisam fechar o aceite.
  - Medido: `evidencias/medicao-final/medicao.json` tem três rodadas sequenciais desktop por backend/cache. Conteúdo inicial 23.993.373 bytes, redução de 37,5%. Abertura fria mediana: base 1.508 ms, WebGL2 1.882 ms, WebGPU 2.797 ms. O critério de tempo permanece reprovado; não marcar T05 concluída ou alegar ganho de FPS. Nós RGBM equivalentes compartilhados reduziram a compilação; tentativas de paralelismo/ordem do loop sem ganho foram revertidas e registradas em `PERF.md`.
  - Continuação: materiais não baked padrão reensaiados em `medicao-pbr-antes-upload/`: medianas frias base 1.633 ms, WebGL2 2.190 ms, WebGPU 2.975 ms; 23.993.689 bytes iniciais. Antecipar o upload do atlas não deu ganho consistente e foi revertido, com dados preservados em `medicao-pbr-upload-antecipado/`. Perfil instrumentado localizou espera do primeiro RAF; não mede tempo GPU nem comprova causa no compositor. Critério continua pendente.
  - Rede lenta: leitura de recursos em blocos com progresso e timeout por inatividade; abertura com Slow4G emulado passou em 124,56 s na versão com fila, sem o antigo abort fixo de 90 s. Repetir Maquete ou escolher Tour durante a inicialização aguarda a mesma cena corretamente. Ver `evidencias/carregamento-fila/` e `integracao-fila/`; não é melhoria de velocidade.
  - Fila implementada: `transfer-manifest.json` registra 124 arquivos/57.017.790 bytes de conteúdo secundário; `transfer-worker.js` compartilha prefetch e fetch nativo, verifica tamanho/hash e conserva somente respostas completas. Nove casos de fila e quatro cenários com dados reais (incluindo mapa frio/quota indisponível), quatro modos nos três perfis e navegação em 320/768/1440 px aprovados. O GLB precede os tiles e uma consulta antiga de cache não reprioriza a cena removida. Client e prioridade por modo em `transfers.js`/`viewer.js`; testes e limites em `EXP/FILA.md`. T05 continua parcial: armazenamento/rede físicos e critério de abertura pendentes.

- [ ] **T06 — Corrigir volumes, fachadas e implantação pelas referências.**
  - Dependências: T02, T04.
  - Responsabilidade: silhueta, base/térreo, vãos, varandas, guarda-corpos, portaria e lazer; manter escala/posição do mapa enquanto não houver correção comprovada.
  - Escopo provável: fontes geométricas próprias em `EXP/modelo/`, gerador/exportador do LIV, `EXP/referencias.json`, bake/UV correspondente, capturas de comparação.
  - Aceite: três ângulos comparáveis às fontes, volumes principais conferidos e medidas inferidas identificadas; alterações de geometria usam iluminação da própria versão.
  - Verificar: matriz de evidências; contagem/uso de pavimentos; reimportação do GLB no mapa existente; escala, orientação, contato com terreno e portaria.
  - Inspeção em 10/10/2026: comparação oficial identificou contorno da cobertura simplificado e acabamento localizado da portaria pendente. `EXP/modelo/NOTAS-GEOMETRIA.md` documenta a autoria isolada e UV/bake próprios; nenhuma geometria nova foi aplicada. A evidência de guarda-corpo pintado está em `EXP/refinamento-exterior.json`.
  - Continuação da entrada em 10/10: vista Acesso de perto torna legíveis portal/marquise/placa, mas também expõe posição/forma simplificadas e placa encoberta. `EXP/PORTARIA.md` registra a comparação, sem declarar a reconstrução concluída. Geometria e atlas da base permanecem preservados.

- [ ] **T07 — Refinar materiais, paisagismo, câmeras e dois estados de luz.**
  - Dependências: T05, T06.
  - Responsabilidade: acabamento PBR, vegetação próxima, vidros/varandas, enquadramentos e estados coerentes de dia e entardecer.
  - Diretriz do usuário: priorizar materiais PBR padrão, incluindo MeshStandard/MeshPhysical e GLTF, com conversão automática do renderer. Configurar novos acabamentos/texturas; reservar TSL próprio ao comportamento específico RGBM e outros efeitos que realmente o exijam.
  - Escopo provável: `EXP/materials.js`, `EXP/lighting.js`, `EXP/cameras.js`, assets/bakes por estado, evidências visuais.
  - Aceite: leitura clara do empreendimento, sem cintilação/artefatos relevantes; estados carregados sob demanda; orçamento fechado em T02 respeitado nos dois backends.
  - Verificar: vistas fixas vs. render oficial, órbita com vegetação/vidros e transição de estado; não apresentar mudança artística de luz como simulação solar por data/hora.
  - Base técnica antecipada: `EXP/materials.js`, `asset-loader.js` e bancada `materiais.html` preservam materiais padrão importados e suas propriedades/mapas; exterior não baked usa MeshStandardMaterial convertido pelo renderer. Dez testes Node, quatro perfis desktop/toque WebGPU/WebGL2 e vinte reimportações passaram. GLB Draco próprio existente de 1.158 malhas/44 materiais qualificado nos dois backends desktop. KTX2/Meshopt, acabamentos finais do LIV, vegetação, dia/entardecer e orçamento físico permanecem pendentes. Ver `EXP/MATERIAIS.md`.
  - Primeiro acabamento em 10/10/2026: clone MeshStandardMaterial pintado somente para esquadrias/guarda-corpos da torre, com assinatura/edição verificadas, e vista Varandas responsiva. Parâmetros visuais estimados; fonte e material compartilhado da portaria preservados. Comparação e limites em `EXP/REFINAMENTO.md`; fechamento de T07 ainda depende de T05/T06, paisagismo, luz e ensaio físico. Três perfis do acabamento/Varandas, rejeição de assinatura, recarga de sessão, descarte e recuperação com um clique aprovados em `refinamento-exterior-final/`; nove cenários de recuperação em `recuperacao-refinamento-final/`.
  - Continuação em 10/10: dois clones MeshStandardMaterial acrescentados para vidros da implantação (metalness 0, roughness 0,16) e letreiro (0/0,65), sem transmissão, shader novo ou mudança de cor base. Materiais fonte/carros e bakes preservados. Vista Acesso de perto adapta a caixa local à tela; valores PBR estimados e forma da entrada pendente, conforme `EXP/PORTARIA.md`.
  - Qualificação dessa continuação: sete testes CPU e três perfis em cada relatório `portaria-final/`, `refinamento-acesso-final/` e `unidades-portaria-final/` passaram. Inclui enquadramento em cinco tamanhos, gesto de toque, descarte dos três clones, sessão/seleção, ambas as tipologias em 2D/3D/Tour, rejeição de assinatura e duas recuperações de catálogo. Os 14 recursos dos interiores e 139 da fila foram reconferidos; geometria, atlas e luzes não mudaram. T06/T07 e ensaio físico permanecem pendentes.

**Checkpoint C2:** T05–T07. Exterior refinado, comparação documentada e custo medido; resolver regressões de carregamento/órbita antes de ampliar o catálogo.

## LIV-M3 — um pavimento selecionável

- [ ] **T08 — Cadastrar pavimento/finais e volumes de seleção.**
  - Dependências: T02, T06.
  - Responsabilidade: ID técnico estável, posição, tipologia/vínculo, planta 2D oficial correspondente, confiança e volumes de seleção independentes da malha decorativa.
  - Escopo provável: `EXP/unidades.json`, `EXP/plantas2d/`, `EXP/picking.js`, `EXP/referencias.json`, teste de integridade do cadastro.
  - Aceite: dez finais do pavimento piloto confrontados com a implantação; seleção corresponde à face correta e planta 2D; ambiguidades registradas; nenhuma numeração comercial presumida.
  - Verificar: tabela final → posição → tipologia/planta 2D com fonte; raios de seleção em vistas frontal/lateral e toque; IDs únicos.
  - Incremento de 10/10: dez IDs técnicos do índice 1 e zonas proporcionais à implantação p.15 em `EXP/unidades.json`, com faixas não uniformes e núcleo excluído. `unidades.js` valida IDs/lados/volumes e rejeita dados comerciais ou vínculos de interiores não confirmados. `picking.js` separa a interação da geometria decorativa e bloqueia seleção através da cobertura/outros pavimentos. Ver `EXP/UNIDADES.md`; associação de planta/espelhamento por final continua pendente, mantendo T08 parcial.

- [ ] **T09 — Integrar realce, ficha e planta no piloto.**
  - Incremento de 10/10: lista acessível, toque na fachada, realce azul e ficha consomem o mesmo ID, com vista dedicada de cada lado, legenda, limpeza, sessão e retorno de modos. A ficha distingue o final selecionado da referência geral Canto/Meio; nenhum vínculo ou estoque é presumido. Cinco testes CPU, três perfis de navegador e duas falhas injetadas registrados em `EXP/evidencias/unidades-piloto/runtime.json`; ainda faltam vínculo oficial, refinamento final do exterior e qualificação física. T09 permanece parcial.
  - Dependências: T07, T08.
  - Responsabilidade: seleção pela fachada/lista, destaque, ficha física e acesso à planta 2D; disponibilidade desconhecida explícita; Planta 3D/Tour gerais identificados como interior ilustrativo até T10.
  - Escopo provável: `EXP/unit-ui.js`, `EXP/viewer.js`, `EXP/unit-ui.css`, `EXP/index.html`, QA de seleção.
  - Aceite: mouse/toque/teclado selecionam o mesmo final; ficha/planta 2D conferidas; seleção pode ser limpa e não interfere na órbita; controles cabem no celular. O interior legado de canto não é apresentado como interior conferido de um final de meio.
  - Verificar: selecionar os dez finais, conferir a planta 2D, trocar modo/andar/luz, retornar à maquete e usar teclado; indicação de interior ilustrativo preservada nos modos gerais. Executar T12 no perfil piloto antes de disponibilizar o primeiro preview.

**Checkpoint C3:** T08 + T09. Piloto de seleção funcional. A demonstração qualificada pode seguir por T12 → T13 enquanto a expansão de interiores/catálogo continua.

## LIV-M4 — tipologias e apresentação completa

- [ ] **T10 — Conferir canto/meio e migrar os modos interiores.**
  - Dependências: T03, T09; fonte pública de plantas já disponível.
  - Responsabilidade: duas bases de planta, versões espelhadas demonstradas, interior RGBM/TSL, Planta 2D/3D e Tour com limites de circulação preservados.
  - Escopo implementado dos interiores: `EXP/interiores/`, `EXP/interior-renderer.js`, `EXP/interior-navigation.js`, `EXP/interior-camera.js`, `EXP/interior-cutaway.js`, `EXP/plantas2d/` e QA de tipologias/modos. Espelhamentos/vínculos comerciais permanecem pendentes.
  - Aceite: a seleção abre a tipologia correta; móveis/aberturas/circulação coerentes; dimensões inferidas identificadas; bakes associados à geometria correta nos dois backends.
  - Verificar: plantas comerciais lado a lado com modelo; giro/visita em canto e meio; troca de tipologia; encerramento do renderer legado quando todos os modos estiverem migrados. Mudanças em móveis preservam a regra existente de invalidar/rebaixar bake incompatível.
  - Incremento em 10/10/2026 por diretriz explícita do usuário, antecipando as duas tipologias sem inferir vínculos por final do piloto T09. Base própria de meio exportada pelo construtor, imagem oficial separada e seletor compartilhado de Planta 2D/3D/Tour. Ambos os interiores usam WebGPURenderer e materiais PBR padrão; canto conserva RGBM próprio, meio usa iluminação dinâmica. Três perfis funcionais passaram com o código final, incluindo seis ambientes por planta, toque emulado, móveis, sessão, captura e descarte. Colisão contínua passou em 48 rotas/8.604 verificações independentes; 17 cenários de falha/cancelamento passaram, inclusive snapshot preservado antes da restauração e driver sem resposta. Fila aprovada em 12 fixtures e quatro cenários com 135 arquivos reais; retorno pelo mapa/histórico em três larguras. Fontes, evidências e reprodução em `EXP/INTERIORES.md`.
  - Continuação de 10/10: bake próprio de Meio adotado após exportação da sua cena nativa, correção de faces coplanares do tapete, conferência de geometria/UV1 e 512 amostras em 2048×2048. Canto conserva sua fonte/atlas. Sombras solares passam a atualizar somente quando a cena muda; restaurar o conjunto aplica os móveis antes de recalcular colisões/rotas. Seis ensaios de iluminação/câmera passaram em WebGPU, WebGL2 e toque emulado, incluindo canvas de 780×1688, e a reprodução autoral de Meio foi idêntica em bytes. Cinco testes do pacote rejeitam entradas incompatíveis sem alterar arquivos existentes. Ver `EXP/INTERIORES.md` e `EXP/PERF.md`.
  - Qualificação desse incremento: três perfis funcionais, 19 cenários de recuperação e quatro cenários de fila com os 139 recursos reais passaram. A consulta de rotas ao resetar o conjunto ocorreu uma única vez por tipologia/perfil. Relatórios `interiores-luz-estatica/`, `falhas-luz-estatica/` e `fila-luz-estatica/` em `EXP/evidencias/`.
  - Refinamento das câmeras em 10/10: enquadramento do volume completo e espaço dos controles em ambas as plantas, ação Enquadrar, preservação da órbita manual no resize/restauração e foco do Tour em móveis visíveis do ambiente escolhido. O teste CPU de projeção passou em 80 cantos/dez combinações; três perfis de navegador passaram com as duas tipologias, incluindo 320 px, paisagem e descarte. As malhas/materiais/mapas permaneceram idênticos, e a cena autoral de Meio foi reproduzida byte a byte. Ver `EXP/CAMERAS.md`.
  - Qualificação das câmeras: três perfis funcionais passaram em `interiores-cameras/`; seis casos de luz/sombra passaram em `luz-cameras-visibilidade/`, com o ponto acima da porta confirmado como primeira superfície opaca visível e variação média RGB de no máximo 0,16/255. Hashes de código dos relatórios conferidos após os ensaios.
  - Apresentação das plantas em 10/10: controle Paredes baixas, corte visual a 1,20 m em Canto e Meio, móveis na altura original e recuperação de paredes/esquadrias/forro/luminárias completos no Tour. Tampa de corte reutiliza o PBR original e conserva os vãos. O corte mantém o atlas/sombra da cena completa, com preferência restaurável e snapshots antigos compatíveis. A cena autoral de Meio anterior à apresentação foi reproduzida byte a byte; as 14 entradas do pacote e os 139 recursos da fila permanecem íntegros. Seis ensaios de corte passaram em WebGPU, WebGL2 e toque emulado. Ver `EXP/CORTES.md`.
  - Qualificação do corte: três perfis de câmera, seis casos de luz e três perfis funcionais passaram em `cameras-corte/`, `luz-corte/` e `interiores-corte/`. A caminhada manteve zero novos passes de sombra em 24 quadros por caso, e o ponto visível acima da porta variou no máximo 0,16/255 no RGB médio. Materiais/mapas e recursos congelados preservados, com descarte completo; toque é emulado.
  - T10 permanece parcial: acabamentos finais, espelhamentos/vínculos por final e ensaio físico ainda pendentes. Não associar uma tipologia selecionada a unidade comercial sem T08/T09.

- [ ] **T11 — Expandir catálogo reconciliado e espelho de unidades.**
  - Dependências: T08, T10.
  - Responsabilidade: pisos/finais/tipologias, térreo/gardens e exceções explícitas; espelho com filtros e ficha sincronizados.
  - Escopo provável: `EXP/unidades.json`, `EXP/unit-schema.js`, `EXP/espelho.js`, `EXP/unit-ui.js`, testes de integridade/sincronização.
  - Aceite: reconciliar as 170 unidades declaradas com o modelo e fontes sem inventar numeração/vaga; cada linha do espelho aponta para o mesmo volume/ficha/planta; ausência comercial preservada.
  - Verificar: IDs únicos, finais por pavimento, vínculos pendentes explícitos, seleção fachada ↔ espelho, filtros e acessibilidade.

- [ ] **T12 — Qualificar produto, fallback e desempenho em aparelhos reais.**
  - Dependências: T09 para perfil `piloto`; T10 e T11 adicionais para perfil `completo`.
  - Responsabilidade: matriz desktop/Android/iPhone/navegadores internos, rede/cache, falhas, retorno mapa e quatro modos, orçamento e evidências por backend.
  - Escopo provável: `EXP/qa_viewer.py`, QA de mapa em destino próprio, `EXP/medir_runtime.py`, `EXP/evidencias/`, relatório de qualificação.
  - Aceite: regressões obrigatórias do plano aplicáveis ao perfil aprovadas; no piloto, conferir cadastro/realce/ficha/planta 2D e indicação do interior geral ilustrativo; no completo, acrescentar catálogo expandido, tipologia 3D e espelho sincronizados. Backend efetivo registrado; zero falhas não tratadas; metas T02 atendidas ou limitação/resolução documentada antes da entrega.
  - Verificar: mínimo de três rodadas nas condições registradas, teste físico Android+iPhone, captura PNG e repetição de modos. QA emulado complementa a prova física.
  - Execução: realizar o perfil piloto para a primeira demonstração; repetir no perfil completo após T10/T11. Resultados de outros empreendimentos não contam como homologação do LIV.
  - Relato de 10/10: caminhada com travamentos na publicação r168, em Poco X6 5G/Android 13/Chrome 154.0.8037.127. Diagnóstico desktop sequencial em `EXP/PERF.md`; cálculo síncrono de rotas é candidato a pausas ao pedir destinos, sem causa física confirmada. A parede que muda de claridade com rotação foi reproduzida com bake ativo na base antiga; o interior nativo passou nesse caso em WebGPU/WebGL2. Ver `EXP/LUZ-CAMERA.md`. Qualificar caminhada e giro no aparelho continua pendente.

**Checkpoint C4:** T10–T12 no perfil completo. Apresentação completa qualificada, mesmo com dados comerciais ausentes.

## Pacote de entrega e dados comerciais

- [ ] **T13 — Preparar entrega, comparação e recuperação.**
  - Dependências: T12 aprovado no perfil a entregar.
  - Responsabilidade: pacote com manifesto, relatório, diferenças, métricas, pendências, preview separado e procedimento de retorno.
  - Escopo provável: `EXP/preparar_pacote.py`, `EXP/manifesto.json`, `EXP/ENTREGA.md`, configuração específica do preview, verificação HTTP com destino próprio.
  - Aceite: pacote local revisável completo; URLs relativas corretas; hashes e assets conferidos; identificação de perfil piloto/completo e expiração explícita. Publicar quando a execução/publicação desse preview for solicitada.
  - Verificar: servir o pacote local, QA funcional/HTTP e recuperação da base preservada. Após publicação autorizada, conferir novamente o endereço público e registrar identidade/expiração.

- [ ] **T14 — Integrar tabela comercial oficial/autorizada.**
  - Dependências: T11; fonte comercial e regras de atualização fornecidas para uso no produto.
  - Responsabilidade: importação inicial validada, vínculo por ID/numeração, disponibilidade, preço/condições, origem e data; resolver associações ambíguas antes de ativar.
  - Escopo provável: `EXP/importar_comercial.py`, schema comercial, dados comerciais separados, `EXP/espelho.js`, testes de importação/sincronização.
  - Aceite: duplicatas/IDs inexistentes rejeitados, campos ausentes tratados, estado e preço idênticos na ficha/espelho/fachada; números atualizados somente pela fonte escolhida.
  - Verificar: amostra conferida com tabela, rejeição de arquivo inválido, versão anterior recuperável e teste de atualização. Preços de anúncios avulsos não substituem a tabela.
  - Estado: condicional; não bloqueia o preview visual ou o espelho com disponibilidade não informada.

## Extensões condicionais

- [ ] **T15 — Migrar integralmente o mapa regional para o renderer novo.**
  - Dependências: T12 no perfil completo; decisão de ampliar o escopo.
  - Responsabilidade: shaders de terreno/ruas/fachadas/vegetação/limite circular e integração de maquete preservando dados e recorte.
  - Escopo provável: renderer/materials de mapa em `EXP/`, integração GLB, manifesto regional, QA de mapa, evidências de comparação.
  - Aceite: mesmos 5 km, relevo/posicionamento/busca e carregamento regional; melhora ou custo justificado nos dois backends; nenhuma cidade completa transferida ao visitante.
  - Verificar: testes espaciais existentes e QA mapa, frio/cache e alternância mapa/maquete em aparelhos físicos.

- [ ] **T16 — Implementar simulação solar por data/hora.**
  - Dependências: T06, T07, T12 no perfil completo; norte, coordenadas e implantação validados; decisão de ampliar o escopo.
  - Responsabilidade: separar sol direto/sombras móveis das contribuições fixas e expor data/hora com limites declarados.
  - Escopo provável: `EXP/solar.js`, `EXP/lighting.js`, cadastro de orientação, controle de data/hora, testes/capturas de referência.
  - Aceite: direção/sombra coerentes em datas/horas verificadas; ausência de sombra solar fixa conflitante; qualidade e desempenho dentro do orçamento.
  - Verificar: posições solares por fonte técnica, cenas manhã/meio-dia/tarde e comparação de backends. Só usar o rótulo de simulação depois dessa comprovação.

## Comandos existentes a adaptar na execução

Estes comandos não foram executados neste planejamento. Usar URLs/destinos novos e conferir onde cada script grava relatórios antes de rodá-lo.

```powershell
python -m http.server 8788 --bind 127.0.0.1 --directory backups/liv-webgpu-2026-10-09/site-v3
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_miniatura.py --base-url http://127.0.0.1:8788 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/baseline-miniatura
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_mapa.py --base-url http://127.0.0.1:8788 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/baseline-mapa
```

Servidor e QAs rodam em terminais separados. T01 deve criar o comando equivalente para o pacote de evolução.

Quando a evolução tocar geração/recorte do mapa, reutilizar também:

```powershell
python -m unittest discover -s experimentos/mapa-liv-ipanema-5km-2026-10-08 -p test_recorte_regional.py
python -m unittest discover -s experimentos/mapa-liv-ipanema-5km-2026-10-08 -p test_tiles_circulares.py
node experimentos/mapa-liv-ipanema-5km-2026-10-08/test_raster_esparso.mjs
node experimentos/mapa-liv-ipanema-5km-2026-10-08/test_liv_terreno.mjs
node experimentos/mapa-liv-ipanema-5km-2026-10-08/test_chao_circular.mjs
node experimentos/mapa-liv-ipanema-5km-2026-10-08/test_busca_proximos.mjs
```

`qa_viewer.py` canônico precisa de adaptação para a interface desta base; `verificar_http.py` precisa de saída própria. Não executar publicação, regeneração histórica ou comandos de QA que sobrescrevam evidências antigas como parte da elaboração deste plano.
