# Execução da modularização

Referência: [plan.md](plan.md). Implementação local em andamento na branch `refactor/modularizacao`. Evidências e limitações em [baseline/README.md](baseline/README.md).

Cada linha abaixo é uma entrega. As linhas marcadas como lote devem ser repetidas para cada submódulo indicado, mantendo no máximo cinco arquivos alterados por entrega. Os caminhos de destino são propostas, não arquivos já criados. Registrar a verificação e o checkpoint de reversão ao concluir cada item.

| ID | Tarefa e arquivos prováveis | Depende de | Aceite e verificação | Escopo |
|---|---|---|---|---|
| 01 | Registrar variantes e baseline: documentação de build, fixtures e relatório de referência | — | Identificar qual cidade usa qual variante; registrar artefatos, dados disponíveis e fluxos mapa/ficha/interior; estabelecer checkpoint recuperável | M |
| 02 | Extrair resolução de build: `pipeline/build/config.py`, `montar.py`, `publicar.py`, `rodar_qa.py` | 01 | Consultar versão não carrega cidade nem interpreta argumentos; chamadas antigas mantêm destinos; testes de cidade e variante explícitas | M |
| 03 | Manifesto de fontes: `pipeline/build/manifest.py`, `rodar.py`, teste focado | 02 | Runner considera fontes da variante, packs e mudanças de configuração; teste de invalidação para app, módulo externo e entrada opcional | M |
| 04 | Interface de QA: `scene/diagnostics.js`, `app.js`, `padrao/pagina.py`, sonda representativa | 01 | Sonda funciona sem injetar por nome de função; interfaces antigas permanecem durante transição; executar medição de terreno e passo de quadro | M |
| 05 | Composição por manifesto: `montar.py`, manifesto, `app.js`, primeira peça JS | 03, 04 | Ordem explícita e fragmentos reunidos no escopo existente; conferir dados e funcionamento dos HTML aberto/comprimido | M |
| 06 | Extrair decodificador: `core/city-data.js`, `app.js`, teste de fixture | 05 | Sem DOM/estado de cena; mesmos B/R/G/grp, q e índices urbanLots; teste de quantização e integração no mapa | M |
| 07 | Extrair geometria pura: `core/geometry.js`, `app.js`, teste focado | 06 | Mesmos contornos, tolerâncias e orientação em casos convexos/irregulares; API explícita | M |
| 08 | Extrair armazenamento: `core/storage.js`, `app.js`, teste focado | 06 | Chaves e dados antigos legíveis; storage bloqueado não quebra navegação; teste de leitura/salvamento e falha | M |
| 09 | Extrair terreno: `world/terrain.js`, `app.js`, sonda/teste | 07 | Grade/cache/registro têm dono; relevo, muros e modelos mantêm altura; QA de assentamento | M |
| 10 | Extrair materiais em lotes: materiais de fachadas, vias e interior, cada qual com seu consumidor | 09 | Shaders e parâmetros preservados; comparar imagem fixa e compilação em cada lote | M por lote |
| 11 | Extrair ruas: `world/roads.js`, `app.js`, teste/sonda | 09, 10 | Fita e junções iguais; teste de larguras, interseções e ausência de novas colisões | M |
| 12 | Extrair edifícios: `world/buildings.js`, `app.js`, integração UrbanModels | 07, 09, 10, 11 | Mesmo registro selecionado, mesmo encaixe e fallback; auditorias de colisão e cadastro protegido | M |
| 13 | Extrair vegetação: `world/vegetation.js`, `app.js`, sonda | 09, 11 | Mesmas espécies/posições e atualização incremental; comparação remendo versus reconstrução completa | M |
| 14 | Extrair divisas em dois lotes: muros, depois portões; consumidor app e teste de cada lote | 09, 11 | Mesmos encontros/alturas; QA de muro sobre via e alinhamento dos portões | M por lote |
| 15 | Extrair streaming: `world/streaming.js`, `app.js`, adaptadores dos módulos visuais | 12, 13, 14 | Fila e grupos explícitos; percorrer trecho e voltar sem crescimento contínuo de recursos ou perda de objetos; subdividir adaptadores se exceder 5 arquivos | M por lote |
| 16 | Extrair imóveis em lotes: identidade/vínculo, ficha, visualização do cadastrado | 08, 12 | Clique seleciona o mesmo imóvel e mantém confirmação/âncora; testar ficha e abertura/fechamento do modelo | M por lote |
| 17 | Extrair UI em lotes: POIs/perto, busca/link, minimapa, controles mobile | 15, 16 | Preservar consulta, raio, links e navegação por toque; testes de UX/ficha/minimapa por lote | M por lote |
| 18 | Extrair geometrias de móveis em lotes por família, catálogo e app | 07, 10 | Dimensões, materiais e geometria iguais; comparar peça simples e paramétrica e interior montado | M por lote |
| 19 | Extrair planta/casca em lotes: planta, vãos, esquadrias e geometria da casa | 07, 16, 18 | Mesmos cômodos, vãos e unidades métricas; verificar interior de referência e colisões | M por lote |
| 20 | Extrair iluminação/bake em dois lotes, com consumidor e sonda | 10, 19 | Mesmo resultado de exposição; orçamento incremental preservado; medição de interior e imagem fixa | M por lote |
| 21 | Extrair navegação interior e editor em lotes: entrada/saída, colisão, seleção, gestos | 08, 18, 19, 20 | Entrar/sair, mover/girar/redimensionar e recarregar preservam estado; verificar limpeza e persistência | M por lote |
| 22 | Concluir composição da cena em lotes: câmera/qualidade, loop, inicialização | 15, 17, 21 | Um único loop; APIs explícitas; app.js deixa de conter lógica dos domínios; repetir testes de governador e quadro preguiçoso | M por lote |
| 23 | Separar build em lotes: encaixes, bibliotecas, serialização HTML e compressão | 03, 05 | HTML não calcula encaixe por efeito lateral; mesmos blocos e saídas; manifesto inclui cada entrada | M por lote |
| 24 | Migrar Python ativo em lotes: v4, quadras, lotes, ocupação, divisas e chão/ruas de v7 | 01, 03, 23 | Novos caminhos canônicos e wrappers antigos funcionam; mesmas saídas/índices; runner atualizado por lote | M por lote |
| 25 | Deduplicar plantas em lotes de um par de scripts e seus consumidores | 24 | Fonte única para cada duplicata confirmada; demais pares comparados antes; executar fixture e verificar CLI antiga | M por lote |
| 26 | Separar CSS por fluxo em lotes: mapa/ficha/interior/mobile | 17, 21 | Ordem e especificidade preservadas; comparação desktop/mobile e estados de ficha/interior | M por lote |
| 27 | Consolidar variantes por capacidade em lotes | 22, 23, 26 | Matriz de diferenças resolvida; cidades legadas preservadas; nenhuma biblioteca atualizada durante a consolidação | M por lote |
| 28 | Centralizar preparação de publicação: módulo, wrappers e teste de manifesto | 02, 23, 27 | Hash, nomes e URLs coerentes; preparar em diretório isolado; manter artefatos anteriores e testar mapa com tiles; não fazer deploy | M |
| 29 | Documentar comandos e dependências por ambiente: package.json, documentação Python/Blender e PADRAO/PIPELINE | 24, 25, 28 | Comandos de verificação reais substituem placeholder; dependências comuns separadas das de Blender/Unreal; validar instruções no ambiente definido | M |
| 30 | Aceite final e classificação de histórico: relatório e inventário atualizado | 29 | QA completo das cidades representativas, comparação visual/desempenho, teste file:// e publicação local; ausência de medição não conta como sucesso | M |

## Acompanhamento

- [x] 02–03: configuração e dependências de build; 11 testes Python aprovados.
- [ ] 01: baseline registrada; falta concluir a matriz comportamental das cidades legadas.
- [x] 04–06: diagnóstico, composição e decodificador; equivalência dos dados e imagem fixa aprovada.
- [x] Checkpoint A: decodificador modular, HTML abre e sondas medem a variante correta.
- [x] 07–08: geometria e armazenamento; testes focados e equivalência geométrica em 89.895 edifícios.
- [x] 09: terreno extraído; testes unitários, HTML comprimido, imagem fixa e alternância de relevo aprovados.
- [x] 10–12: materiais, ruas e edifícios (lotes 10a–10f, 11a–11b, 12a–12b abaixo).
- [x] Checkpoint B: geometria, assentamento e imagem externa equivalentes. Os 10 portões de geometria na página modular batem com o monólito (`baseline/qa-checkpoint-c-modular.json`) e a imagem de câmera fixa é idêntica em todos os lotes.
- [x] 13–15: vegetação, divisas e streaming.
- [x] 16–17: imóvel, ficha, busca, POIs, minimapa e abas móveis.
- [x] Checkpoint C: navegação externa desktop/mobile e recursos preservados. Ver "Checkpoint C — página modular" abaixo.
- [ ] 18–20: móveis e planta/casca concluídos; iluminação, bake e `geoDaCasa` pendentes (20).
- [ ] 21–22: editor, navegação interna, câmera e loop.
- [ ] Checkpoint D: interior completo e persistência equivalentes.
- [ ] 23–25: build, scripts geográficos e duplicatas.
- [ ] 26–28: CSS, variantes e preparação de publicação.
- [ ] Checkpoint E: fontes canônicas e builds rastreáveis, com compatibilidade dos comandos antigos.
- [ ] 29–30: documentação e aceite final.

## Coordenação

Iniciar por 01–06. Só depois distribuir frentes com contratos definidos. Produção de dados, testes e UI podem ser trabalhados separadamente quando seus arquivos e interfaces não se sobrepõem. Alterações no app.js residual, no montador e na configuração precisam de sequência coordenada. Este plano não cria agentes ou tarefas externas.

Ao iniciar uma linha com vários lotes, registrar os subitens concretos e seus arquivos antes de editar. Não marcar a linha completa até verificar todos. Checkpoints exigem registrar os resultados e revisar diferenças; falha retorna ao último lote conhecido. O plano existente de ocupação continua independente: alterações visuais desse plano não devem ser misturadas à extração arquitetural.

## Lotes em andamento

- 09: `world/terrain.js`, consumidor `app.js`, manifesto e `tests/test_terrain.mjs`. API de grade, amostragem, registro, recomputação e liberação. Concluído em `7db2893`.
- Compatibilidade das auditorias: `world/building-type.js` e consumidores substituem os recortes de texto do monólito em `auditar_ruas.mjs` e `auditar_substituicoes.mjs`. Concluído em `c93bc7b`. Antecipação limitada da tarefa 12; não conclui a extração dos edifícios.
- 04: sonda aguarda API também no HTML comprimido; teste no navegador aprovado (`72ff50f`).

A composição 05 precedeu a extração 04/06 para fornecer uma ordem explícita de carregamento. Os checkpoints locais até 08 são `0fcb1b4`, `f81acd2`, `1aea668`, `44d875a` e `b1e7d07`.

- 10a: fachadas e linhas de crescimento em `materials/facades.js`, consumidor `app.js`, manifesto e teste de equivalência de shader. Texturas continuam carregadas pelo consumidor e entram por dependência explícita. Os próximos lotes estão registrados na continuação de 15/09.

- [x] 10a: fachadas e linhas extraídas; quatro testes de equivalência de shader e imagem fixa idêntica à referência. Tarefa 10 permanece parcial: outros shaders de chão/muros e geração de texturas ainda estão no consumidor.

## Continuação 15/09

- [x] 10b: `matVia` e compilação GLSL extraídos para `materials/roads.js`; consumidor, manifesto e teste de equivalência com ambas as configurações de via e pista/calçada. Commit `8351273`; imagem externa e alternância de relevo equivalentes.
- [x] 10c: sete materiais de interior extraídos em `materials/interior.js` (`524756c`); parâmetros, texturas, shader de forro e entrada no imóvel aprovados. Critérios de exposição aprovados antes/depois, mesma câmera e estado de iluminação; pequena variação de pixels registrada. Texturas procedurais continuam no consumidor.
- Revisão de over-engineering dos módulos de produção e testes gerados; registrar achados separadamente, sem apagar ferramentas de diagnóstico durante a revisão.

Próximos lotes da tarefa 10: recursos compartilhados de GLSL e carregamento de texturas externas. A geração procedural do interior foi extraída em 10e. Os quatro materiais externos foram extraídos em 10d. A geometria das ruas (tarefa 11) ainda não foi extraída.

Revisão de complexidade: [over-engineering.md](over-engineering.md), dois achados corrigidos em `35fcefb`: capturador duplicado excluído e argumento sem uso removido.

- [x] 10d concluído (`de166a1`): `materials/surfaces.js` reúne quatro materiais externos (chão, muros, asfalto de preenchimento e fundo), com consumidor, manifesto e teste de shader. Ruído permanece uma dependência tardia; texturas são fornecidas pela cena.

Verificação de 10d: 37 testes aprovados; imagem externa idêntica à referência e relevo reversível. Evidências em `baseline/surface-results.json`. O QA completo e as cidades legadas mantêm as pendências já registradas.

- [x] 10e concluído (`3608849`): `materials/interior-textures.js`, consumidor e manifesto; comparação dos nove mapas em canvas real com sorteio controlado somente no teste. API única `create({THREE, document})`, geração uma vez no boot. Nove mapas e configurações idênticos no Chrome com sorteio de teste controlado; HTML comprimido abriu ficha e interior com 7 cômodos, 32 paredes e 18 móveis. Evidências em `baseline/texture-results.json`.

- [x] 10f concluído (`19b0155`): `materials/resources.js` para ruído GLSL e texturas embutidas da cidade; consumidores recebem recursos prontos. Remover leitura tardia `getNoise` e flag `TEX_ON` sem consumidor. Testar string de shader original e carregamento assíncrono de imagens.

Validação de 10f: 39 testes, imagem externa idêntica e alternância de relevo aprovada. `baseline/resource-results.json` registra hashes e medições. Próxima frente: geometria das ruas (11); a sonda de ambiente e materiais de apoio permanecem junto aos respectivos fluxos e serão tratados na extração de iluminação/editor.

- [x] 11a concluído: `world/roads.js` passa a possuir o índice de junções e a construção de fitas de pista/calçada; recebe Three.js, largura por tipo e registro de terreno. Comparar buffers e cruzamentos com o checkpoint anterior.

Verificação 11a: 9.292 vias, 186 lotes de comparação, 4.236.996 vértices com todos os atributos idênticos antes do registro no relevo. Imagem externa idêntica, relevo reversível e 41 testes aprovados. Evidências em `baseline/road-geometry-results.json`. A tarefa 11 permanece parcial: composição das malhas de ruas na cena e rótulos ainda estão no consumidor.

- 11b/17a: `ui/street-labels.js` possui criação, projeção, cache e descarte de rótulos de ruas; testa reconstrução, filtro e ocultação. `world/roads.js` recebe composição de suas malhas por método concreto; streaming continua dono da inserção/descarte.

- 12a: `world/buildings.js` para geometria procedural, paleta e coberturas. Biblioteca UrbanModels e seleção permanecem no consumidor até o lote seguinte. Comparar buffers, sombras, metadados e casos de cadastro explícito.

- 12b: `world/building-placement.js` para filtro de colisão e escolha de modelo urbano, preservando cache por registro, cadastro explícito e altura máxima da pegada.

- 13a: `world/vegetation-planning.js` para catálogo, índice de asfalto e plantio determinístico; comparar buffers e registros de plantas com o checkpoint anterior.

### Checkpoint de mundo — continuação

- [x] 11b/17a: rótulos (`77f966b`) e composição das vias (`e0c8ea1`); teste DOM e imagem externa idêntica.
- [x] 12a/12b: edifícios (`a7115a1`) e seleção urbana (`8712430`); buffers, colisão, cadastro explícito e assentamento aprovados; imagem externa idêntica.
- [x] 13a: catálogo e plantio (`e628bf6`); catálogo real, seleção ponderada, cruzamentos e reconstrução de índice equivalentes.
- [x] 13b: instanciamento (`786fd08`); estado privado, crescimento, remoção, teto, raio e relevo testados; conferidor incremental preservado.
- 14: portões e muros extraídos; comparação dos quatro modelos de portão e dos buffers/metadados das divisas aprovada. Validação integrada aprovada: imagem idêntica, relevo reversível e 54 testes aprovados.

As imagens de 11b até 13b e dos portões são idênticas à referência de câmera fixa; detalhes em `baseline/world-extraction-results.json`. Esse resultado não substitui a matriz comportamental completa, ainda pendente. Próxima frente: gerenciamento da fila de streaming e ciclo de montagem/descarte, preservando as chamadas de diagnóstico.

- [x] 15: fila e ciclo de streaming em `world/streaming.js` (`12180d4`); 15 pontos do percurso idênticos antes/depois, sem crescimento de recursos entre ciclos. A falha inicial da sonda era da comparação entre trajetos distintos (`baseline/streaming-test-investigation.md`).
- [x] 16a: identidade e vínculo imóvel↔prédio em `listings/identity.js`, consumidor `app.js`, manifesto e `tests/test_listing_identity.mjs`. Prioridade fixado > `predio_id` > âncora, chave `ancora_<slug>_<id>`, lote sem volume, blocos de lançamento e `?planta=` testados. HTML aberto: vitrine 4, ficha abriu e entrou em `monte-das-colinas-39` com 7 cômodos, 32 paredes e 18 móveis (`baseline/listing-identity-entry.json`). 46 testes Node e 12 Python aprovados. Não medido: saída do interior e clique direto no prédio no navegador.

- [x] 16b: preenchimento da ficha (`m2`, `areaDoComodo`, preço/estatísticas, cômodos numerados, avisos de terreno/prédio) em `listings/sheet.js`, copiado byte a byte do consumidor; voo, farol, botões e `FICHA` continuam no `app.js`. Teste `tests/test_listing_sheet.mjs` (venda com área pelo polígono e cômodo repetido; aluguel em lote sem planta). `browser_realtime.mjs --listing` grava a ficha de cada item da vitrine e entra no primeiro: antes/depois com as 4 fichas idênticas, entrada em `monte-das-colinas-39` com 7/32/18, imagem externa com o mesmo hash (`baseline/listing-sheet-before.json`, `listing-sheet-after.json`). Não commitado. A sonda antiga por relógio virtual (`testa_duplo_clique.py`) não responde nestas páginas; usar a de relógio real.

- [x] 16c: texto da ficha do anúncio sem planta (`preencheAnuncio`: tipo, preço, quartos, vagas, link e nota/botão do estudo de exterior) em `listings/sheet.js`, recebendo `ListingModels`; voo, farol e troca de cartão continuam no `app.js`. `--listing` passou a clicar os anúncios e abrir/fechar cada modelo: 7 anúncios e 4 fichas idênticos antes/depois, 6 modelos abrem e fecham, entrada 7/32/18 e imagem com o mesmo hash (`baseline/listing-ads-before.json`, `listing-ads-after.json`). 49 testes Node e 12 Python.
- [x] 16 concluída (16a–16c).

Próxima frente: 17 (17a rótulos já feita): POIs/perto, busca/link, minimapa, controles mobile.

- [x] 17b: camada 3D dos POIs (textura de brilho, halo e feixe por categoria, registro no relevo) e contagem por raio em `ui/poi-layer.js`, copiadas byte a byte; marcadores HTML, categorias, ficha do POI e o modo "por perto" continuam no `app.js`. Teste `tests/test_poi_layer.mjs`. `--listing` passou a gravar hash dos 42 buffers da camada e o "por perto" de cada item da vitrine (texto, contagem/ordem das 21 categorias, voltar). Antes/depois idênticos: camada, "por perto" (0, 30, 162 e 27 estabelecimentos), fichas, anúncios, entrada e imagem (`baseline/poi-before.json`, `poi-after.json`). 51 testes Node e 12 Python. O zero de `monte-das-colinas-39` é dado real: o POI mais próximo fica a 1.012 m.
- [x] 17c: índice e consulta da busca (`semAcento`, `BUSCA`, `indexaBusca`, `buscaAgora`) em `ui/search.js`, copiados byte a byte; recebe `POIS`, `CLS` e o `target` da órbita (nunca reatribuído). Campo, lista, teclado, `vaiPara` e o link de posição continuam no `app.js`; `__int.BUSCA`/`buscaAgora` mantidos. Teste `tests/test_search.mjs`. `--listing` digita 8 termos (acento, caixa, via, prédio, sem resultado) e grava a lista renderizada: antes/depois idênticos, junto com camada de POIs, "por perto", fichas, anúncios, entrada e imagem (`baseline/search-before.json`, `search-after.json`). 53 testes Node e 12 Python.
- [x] 17d: minimapa de rua (`MM`, `MM_CEL`, índice por célula de 600 m, `montaBaseMinimapa`, `desenhaMinimapa` com cache de Path2D) em `ui/minimap.js`. Cópia byte a byte com duas trocas: `$("mmc")` vira `canvas` injetado e `!poiHidden` vira `!isPoiHidden()`, porque `poiHidden` é `let`. Clique no minimapa, botão `tMapa`, laço (`v12Frame`) e planta do interior continuam no `app.js` lendo o mesmo `MM`. Teste `tests/test_minimap.mjs` (células de via longa, reuso do Path2D por janela/escala, pontos por pino e categoria, desligado). `--listing` grava hash dos pixels do minimapa em 7 estados (base, longe girado, perto, pinos todos/nenhum/um, fechado): antes/depois idênticos, junto com todos os fluxos anteriores e a imagem (`baseline/minimap-before.json`, `minimap-after.json`). 55 testes Node e 12 Python.
- [x] 17e: abas móveis (mapa/imóveis/opções, `inert` por área, observador de classes e mudança de largura) em `ui/mobile-tabs.js`; recebe `$`, `PERTO` e `fechaTudo` com as três linhas originais de `abreAbaMobile`. Joystick e pinça ficam para 21/22 (movem câmera e interior). Teste `tests/test_mobile_tabs.mjs`. `browser_realtime.mjs --mobile` emula 390×844 e grava aba, `aria` e `inert` em 9 passos (alternar, ficha forçando o mapa, opções fechando a ficha): antes/depois idênticos (`baseline/mobile-before.json`, `mobile-after.json`); `--listing` na página nova idêntico a `minimap-before`. 57 testes Node e 12 Python.
  - Armadilha: `--listing` termina DENTRO do imóvel, e com `body.dentro` toda aba volta para o mapa. A primeira sonda móvel rodou junto e "passou" com a aba presa em `mapa` nos dois lados. Rodar `--mobile` sem `--listing`.
- [x] 17 concluída (17a–17e).

Checkpoint C — primeira rodada (`baseline/qa-checkpoint-c.json`): 19 portões, mesmos valores e as mesmas 2 reprovações de `qa-after.json`, 0 não medidos. **Não vale como aceite do comportamento**: só os 10 portões de geometria leram a página nova (`html_saida` redirecionado para `work/mobile-tabs`). Os 9 de comportamento rodam como subprocesso e cada `pipeline/testa_*.py`/`mede_*.py` abre `v16-moveis/<slug>-v16-moveis(-aberto).html` direto, que era o build de 14/09 02:18, anterior à modularização. É provável que `qa-after.json` tenha o mesmo problema. Refeito com as páginas modulares copiadas temporariamente para `v16-moveis/` e restauradas depois (`baseline/qa-checkpoint-c-modular.json`, com o SHA-256 das páginas medidas).

Checkpoint C — página modular: `work/furniture-catalog` (HEAD `044b220`, todos os lotes até 18b), SHA-256 `c7686472…` (comprimido) e `c753d85a…` (aberto). 19 portões com os mesmos valores do monólito em `qa-after.json`: 17 aprovados, 0 não medidos e as mesmas 2 reprovações preexistentes, com o mesmo detalhe: "UX: busca, link, noite, minimapa" e "ficha e 'o que tem por perto'" (`a busca acende o pino do lugar achado`). A modularização não criou nem corrigiu essas duas; elas continuam pendentes fora deste plano. Páginas de 14/09 restauradas e conferidas por hash. Somam-se as sondas por lote (`--listing`, `--mobile`, `--streaming`) com equivalência antes/depois.

- [x] 18a: móvel paramétrico em `interior/furniture-param.js` (`B`, `caixaEm`, `instanciaLib`, `geoDeParts`, cores `ARM_*` e os 9 construtores `*Param`), copiado byte a byte; única troca `MOVEIS_LIB` → `getLib()`. Criado antes de `MOVEIS`, que referencia os construtores; biblioteca e `rgbDe` chegam por função porque são definidos depois. Teste `tests/test_furniture_param.mjs` usa o bloco do commit `5d1d7e9` como oráculo (precisa do histórico Git) com a `moveis/moveis_lib.json` real: 2.520 medidas × 9 construtores com a mesma lista de peças, e buffers de posição/normal/cor idênticos em 2 cores. `--listing` passou a gravar transformação e hash dos buffers de cada móvel montado: os 18 móveis de `monte-das-colinas-39` (10 paramétricos: aéreo, box, bancada, rack, ripado, sofá, TV) idênticos antes/depois, com todos os fluxos anteriores e a imagem (`baseline/furniture-before.json`, `furniture-after.json`). 58 testes Node e 12 Python.
- [x] 18b: catálogo (`MOVEIS`, `MOVEL_KEYS`), biblioteca do Blender (`MOVEIS_LIB`, que troca a caixa digitada pela medida da malha), `geoDaLib`, `geoDoMovel` e `medidaPadrao` em `interior/furniture-catalog.js`, copiados byte a byte; única troca `matInt` → `getMaterial()` (o material nasce depois). Cores `rgbDe`/`rgbAcabamento` ficam no `app.js` porque a casa também usa. Teste `tests/test_furniture_catalog.mjs` com oráculo do commit `908381d`: catálogo, medidas e as 23 peças montadas (medida padrão e 2,4×2,3×0,6 em outra cor) com buffers, índice, material e sombra idênticos, com a biblioteca real e sem biblioteca. Página: móveis montados, fluxos e imagem idênticos (`baseline/catalog-before.json`, `catalog-after.json`). 60 testes Node e 12 Python.
- [x] 18 concluída (18a–18b). `poeNaCena`/`atualizaMovel`/`refazParam`/`recolore` dependem de `INT` e do editor e ficam para 21.

- [x] 19a: planta derivada (`projeta`, `paredesDaGrade` na grade de 5 cm, `PRIVACIDADE`, `ladosDoVao`, `folhaCabe`, `decideVao`) em `interior/floor-plan.js`, copiada byte a byte. Recebe `inside`, `shoelace`, `ESP`, `ESQ_ANG` e `ESQ_MARCO`; por isso a criação fica logo depois das medidas da esquadria. Teste `tests/test_floor_plan.mjs` com oráculo do commit `044b220` sobre as 6 plantas de `plantas_fornecidas/` em 3 pés-direitos: paredes, vãos postos e decisão de cada vão (tipo, lado, dobradiça) idênticos. `--listing` passou a gravar o hash da planta derivada da unidade (paredes, esquadrias, cômodos, casca, eixo, furo, móveis): `monte-das-colinas-39` com 32 paredes e 11 vãos (fixa, correr, vão, giro) idêntica antes/depois, junto com móveis, fluxos e imagem (`baseline/plan-before.json`, `plan-after.json`). 61 testes Node e 12 Python.
- [x] 19b: montagem da planta da unidade (`PISO_HEX`, `raioDaCasca`, `MOVEIS_ON`, `moveisDaUnidade`, `recDeLote`, `plantaDaUnidade`, `dentroDaPlanta`) no mesmo `interior/floor-plan.js`, copiada byte a byte; recebe também `safeInset`, `obbOf`, `BUILDING_INSET`, `PD`, `anelDoLote` e `MOVEIS`. `app.js` fica só com `decideVao` (usado no diagnóstico), `plantaDaUnidade` e `dentroDaPlanta`. Teste `tests/test_floor_plan_unit.mjs` com oráculo do commit `624a13f`: 6 plantas × 3 contornos (dois sentidos de enrolamento e um girado), a mesma unidade em lote (furo 0) e móveis automáticos mesclados como no `montar.py`. Os testes de planta criam o módulo num `vm` e passaram a precisar de `location` e `URLSearchParams` (`MOVEIS_ON` lê a URL na criação). Página: planta derivada, móveis, fluxos e imagem idênticos a `plan-after.json` (`baseline/plan-unit-after.json`).
- [x] 19c: esquadrias (medidas `ESQ_*`, `ESQ_COR`, `pecaOr`, `folhaVidro`, `geoDasEsquadrias` com batente, guarnição, folha aberta, maçaneta, peitoril e folhas de correr) em `interior/openings.js`, copiadas byte a byte. Criado antes de `FloorPlan`, que lê `ESQ_ANG`/`ESQ_MARCO`; recebe `THREE`, `ESP`, `rgbDe` e os três materiais. Teste `tests/test_openings.mjs` com oráculo do commit `5c5fac0` sobre as 6 plantas, com as cores do cadastro e com cores trocadas: buffers, material, sombra, ordem e posição da folha (`v.folha`, usada na colisão) idênticos. `--listing` passou a gravar as malhas de `INT.casa` e as folhas: 6 malhas da casa, folhas, planta, móveis, fluxos e imagem idênticos (`baseline/openings-before.json`, `openings-after.json`). 63 testes Node e 12 Python.
- [x] 19d: prisma de parede (`prismaQuad`: faces, gradação vertical, UV do atlas de luz, rodapé sem tampa, máscara de ponta e escurecimento da ponta) e `quadDoSeg` em `interior/shell-geometry.js`, objeto puro sem fábrica, copiado byte a byte. Teste `tests/test_shell_geometry.mjs` com oráculo do commit `5c5fac0`: 2.560 combinações com saída idêntica. Página: malhas da casa, folhas, planta, móveis, fluxos e imagem idênticos a `openings-after.json` (`baseline/shell-after.json`). 64 testes Node e 12 Python.
- [x] 20a: atlas de luz do Unreal (`_LUZUE`, `LUZ_MODO`, cache de textura, `texturaDeLuz` com canal 1 e espaço linear, `cursorDeLuz` com o endereçamento de peças do `unreal_exporta.py`) em `interior/light-atlas.js`, copiado byte a byte; recebe `THREE`, `document` e `sujaSombra`. Teste `tests/test_light_atlas.mjs` com oráculo do commit `8a3ad9a` em `?luz=` vazio, `js` e `ue`: endereços de parede/rodapé/piso/forro, recusa por contagem de peças com aviso, propriedades e cache da textura e aviso de sombra no `onload`. Na página o padrão é `auto` (bake em JS), então o atlas só é exercitado pelo teste. `--listing` passou a terminar o bake (`__int.bakeAgora`, o laço de quadro está parado na sonda) e gravar o perfil e as cores assadas: 12.475 vértices únicos, mediana 0,2704, 3 malhas com a cor alterada pelo bake, tudo idêntico antes/depois, com casa, planta, móveis, fluxos e imagem (`baseline/light-before.json`, `light-after.json`). 65 testes Node e 12 Python.
- [x] 20b: bake de luz do interior (`BAKE` e seus parâmetros, direções de Hammersley, `cenaDoBake`, `bakeRaio`, `tesselaSopa`, `bakePrepara`, `bakePasso` com orçamento por quadro, `bakeFecha`, `bakeAgora`, suavização, perfil e `bakeVertice`) em `interior/bake.js`, 557 linhas copiadas byte a byte; recebe `inside` e `PD`. O `app.js` fica com `BAKE`, `cenaDoBake`, `bakeRaio`, `bakePrepara`, `bakePasso` e `bakeAgora`. Teste `tests/test_bake.mjs` com oráculo do commit `8a3ad9a` sobre `monte-das-colinas-39` e `sanca-135-29`: cena do bake, 4 raios, tabela de vértices, passe com orçamento zero que não termina, `bakeAgora` que termina, cores assadas e perfil idênticos; `?bake=0` desliga. Página: perfil do bake (12.475 únicos, mediana 0,2704), cores assadas, casa, planta, móveis, fluxos e imagem idênticos a `light-after.json` (`baseline/bake-after.json`). 66 testes Node e 12 Python.
- [x] 19 concluída (19a–19d). `geoDaCasa` usa o bake (`BAKE`, `bakePrepara`, `cursorDeLuz`, `texturaDeLuz`, `_LUZUE`) e vai junto com a tarefa 20. A colisão (`livre`/`folga`) lê `pl.paredes` e `v.folha`, que as sondas mostram idênticos.
