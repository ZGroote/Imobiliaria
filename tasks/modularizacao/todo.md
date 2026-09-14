# Execução da modularização

Referência: [plan.md](plan.md). Nenhuma tarefa de implementação foi iniciada.

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

- [ ] 01–03: baseline, configuração e dependências de build.
- [ ] 04–06: diagnóstico, composição e primeira extração funcional.
- [ ] Checkpoint A: decodificador modular, HTML abre e sondas medem a variante correta.
- [ ] 07–09: geometria, armazenamento e terreno.
- [ ] 10–12: materiais, ruas e edifícios.
- [ ] Checkpoint B: geometria, assentamento e imagem externa equivalentes.
- [ ] 13–15: vegetação, divisas e streaming.
- [ ] 16–17: imóvel, ficha, busca, POIs e minimapa.
- [ ] Checkpoint C: navegação externa desktop/mobile e recursos preservados.
- [ ] 18–20: móveis, planta, casca, iluminação e bake.
- [ ] 21–22: editor, navegação interna, câmera e loop.
- [ ] Checkpoint D: interior completo e persistência equivalentes.
- [ ] 23–25: build, scripts geográficos e duplicatas.
- [ ] 26–28: CSS, variantes e preparação de publicação.
- [ ] Checkpoint E: fontes canônicas e builds rastreáveis, com compatibilidade dos comandos antigos.
- [ ] 29–30: documentação e aceite final.

## Coordenação

Iniciar por 01–06. Só depois distribuir frentes com contratos definidos. Produção de dados, testes e UI podem ser trabalhados separadamente quando seus arquivos e interfaces não se sobrepõem. Alterações no app.js residual, no montador e na configuração precisam de sequência coordenada. Este plano não cria agentes ou tarefas externas.

Ao iniciar uma linha com vários lotes, registrar os subitens concretos e seus arquivos antes de editar. Não marcar a linha completa até verificar todos. Checkpoints exigem registrar os resultados e revisar diferenças; falha retorna ao último lote conhecido. O plano existente de ocupação continua independente: alterações visuais desse plano não devem ser misturadas à extração arquitetural.
