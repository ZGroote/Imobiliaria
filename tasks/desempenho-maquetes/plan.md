# Desempenho — LIV, Laranjeiras e gerador

Autorizado em 31/10/2026 no chat `01a193a3-c81d-79f2-8f50-40b6061cd0c2`: implementar e publicar nos dois prédios depois da entrega do Claude e levar as correções ao gerador. A entrega foi confirmada no commit `6aa12bd` (plantas espelhadas, iluminação e sombras), com QA e commit concluídos, ainda sem publicação.

Trabalho isolado na branch `codex/desempenho-maquetes-20261031`, worktree `_to_delete/worktree-desempenho`. A branch compartilhada `feat/predio-novo` e suas alterações pendentes permanecem preservadas. Dependências são acessadas por junções; não alterar arquivos dentro delas.

Auditoria, evidências e plano detalhado em `C:/Users/respawn/.codex/visualizations/2026/10/31/01a193a3-c81d-79f2-8f50-40b6061cd0c2/` (`auditoria-liv.md`, `auditoria-liv-complemento.md`, `plano-implantacao.md`). Métricas desktop não equivalem a homologação física.

## Tarefas e aceitação

- [x] Confirmar entrega do Claude e isolar checkout sem absorver alterações de outras sessões.
- [x] Memória/edição: liberar referências fortes a recursos descartados e eliminar recálculo de navegação que não depende dos móveis. Regressões Node e repetição de 30 ajustes com coleta de lixo; não acumular buffers antigos nem bloquear cada ajuste com busca de rotas.
- [x] Rotas/geometria: reutilizar resultados válidos e evitar cópias desnecessárias, preservando posição, portas e propriedade dos recursos compartilhados.
- [x] Iluminação: inicializar hora/lado corretos; plafons apagados fora dos shaders, compilação assíncrona das variantes, luz sob demanda com cache limitado. QA integrado das quatro plantas em conclusão.
- [x] Assets/cache: worker fora do escopo sem espera impossível, identidade por SHA, prioridade e manifesto atualizado. Dois testes reais de navegador confirmaram cache por hash e nenhum download antecipado dos recursos sob demanda.
- [x] Gerador: fontes dos dois runtimes corrigidas, empacotador/manifesto compartilhados, pacotes novos de 430/388 arquivos pelos comandos normais. Prévia LEVE também gerada pelo fluxo próprio; não usa o renderer moderno. Mapeamento em `pipeline/MAQUETES.md`.
- [x] Pacotes: construir e testar LIV/Laranjeiras, comparar visual e fluxos nos backends suportados; commits exclusivos desta tarefa assinados pelo Codex. QA local PASS: seis tipologias completas em WebGL e Canto dos dois sites em WebGPU, dia/noite e descarte, zero erros de página.
- [x] Publicar usando procedimento do Hosting compartilhado; verificar URLs, hashes, plantas espelhadas, navegação, edição, iluminação, cache e preservação dos demais sites. Registrar release anterior e recuperação.

O controle de horário não recalculou rotas no ensaio integrado; não corrigir essa hipótese descartada. O desenho deve permanecer equivalente; mudanças de resolução/compressão/preparo só ficam com ganho medido e validação visual. Não reutilizar atlas em geometria diferente.

## Evidências dos incrementos

`aabb8c4`: 28 regressões Node passaram. Chrome isolado, 30 ajustes do sofá: no LIV, mediana de 1.066,65 ms para 1,9 ms; no Laranjeiras corrigido, 1,55 ms. Depois da restauração e coleta de lixo, o backing storage voltou ao nível inicial (diferença de 19 bytes nos dois casos); antes, o LIV retinha mais 56.905.579 bytes. Sem erros de página. Relatórios `auditoria-interacoes-liv-corrigido.json` e `auditoria-interacoes-laranjeiras-corrigido.json` na pasta da auditoria.

Cache da última consulta de rotas: limitado a uma posição, limpo junto da grade em `invalidate`, devolvendo cópias para o chamador não alterar o cache. Seis regressões focadas e o oráculo de navegação real passaram (2 plantas, 48 rotas sequenciais, 8.608 verificações). No ensaio CPU sequencial, consultas repetidas de Canto/Meio passaram de aproximadamente 0,7–0,9 s para 0,02–0,03 ms; a primeira busca ainda faz o cálculo completo. Sem promessa de ganho na primeira busca ou FPS. Relatórios `benchmark-rotas.json` e `nav-regressao-corrigido.json`.

`bbd3b95`: grupos redimensionados compartilham as geometrias do template e mantêm materiais próprios; descarte remove materiais de sonda e originais sem destruir geometria compartilhada. Texturas embutidas com bytes, espaço de cor e estado UV/sampler idênticos passam a compartilhar o recurso. Não há recompressão nem redução de resolução. Horários só carregam as duas vizinhas e noite; cache de até cinco horários libera atlas/sondas antigos depois do quadro em uso. Luz apagada sai da lista de spots visíveis, e a variante nova compila antes do quadro seguinte.

Comparação Chrome WebGL2 de dia/noite, planta/Tour: geometrias LIV Canto 432→385, Laranjeiras Canto espelhado 332→287. Texturas noite Laranjeiras 123→88, sem diferença visual relevante (maior média 0,0000147 em escala 0–255 nos casos comparados). O pacote LIV com deduplicação final registra 122 texturas de noite; o ensaio anterior direto registrou 158. Contadores de contextos/câmeras diferentes não devem ser somados como uma medida única de memória. Relatórios `qa-interiores-final` e `qa-pacotes-finais` na pasta de evidências.

`6262484`: manifesto verificável inclui arquivos efetivamente usados, móveis, HDRs, luz e sondas; atlas estático substituído pelo horário não entra na fila. Antecipação automática: 126.289 bytes no LIV e 648.285 no Laranjeiras. O restante continua disponível e entra sob demanda, com cache verificado. Cliente conversa com o registro ativo sem ampliar o escopo do worker ao site todo; respostas por SHA canônico funcionam e hash divergente contorna esse cache. 117 regressões Node, unittest do manifesto e dois casos reais de navegador passaram. Os 13 cenários anteriores da fila (cancelamento, prioridade, quota, atualização e isolamento entre abas) também passaram.

Decisões de qualidade: mantidos DPR máximo 2 e MSAA, formato/resolução das texturas, pré-compilação de planta/Tour e conservação das cenas prontas para reabertura. Os ensaios confirmaram que cenas estacionadas não desenham continuamente e que reconstruir um interior tem custo significativo. As mudanças mantidas removem duplicação/trabalho desnecessário; baixar resolução, descartar toda cena anterior e alterar a preparação exigem escolher outra troca entre qualidade, memória e tempo de reabertura. Não foram apresentados como ganhos já aplicados. Fonte autoral/fallback e formato JSON também não foram removidos sem validação específica.

A branch compartilhada e os arquivos pendentes de outras sessões permanecem intactos. Publicação é limitada ao site `imobilaria-deccb-miniaturas`, preservando toda configuração e inventário externos ao pacote; preflight registra versão anterior, valida a base publicada do LIV e rejeita concorrência de outra publicação. Chunks antigos ficam disponíveis para páginas/abas anteriores. Não há alteração de regras Firebase, função de rastreabilidade, estoque ou páginas de outros imóveis.

## Entrega e integração

Publicado em 31/10/2026 às 23:54:58 UTC na versão `4c56bcec8bc6c6db`, anterior `ae02e90c16116e89`.
271 diferenças, 265 uploads e 1.607 arquivos finais. A API confirmou preservação exata dos 1.198 arquivos anteriores fora do pacote e da configuração. As 77 conferências HTTP passaram, incluindo hashes dos bundles, fontes/manifests atualizados, URLs de entrada, institucional e checkup.

- LIV: https://conectaimoveis3d.com.br/maquetes/liv/
- Laranjeiras: https://conectaimoveis3d.com.br/laranjeiras/ (mantido `noindex`)

QA público PASS: seis tipologias completas em WebGL e Canto dos dois prédios em WebGPU real, zero erros de página. Conferidos planta 2D/3D, Tour, hora e unidade inicial, dia/noite, edição/restauração, alternância rápida e cache. Uma verificação adicional confirmou, nas 48 vistas locais/públicas, que os atlas e sondas exigidos pelo horário já estavam carregados; o teste público passou a aguardar explicitamente esses recursos, em vez de capturar a transição. Relatórios: `qa-publico-final/report.json`, `qa-horarios-carregados.json`, `deploy/integridade-hosting.json` e `deploy/http-publico.json` na pasta da auditoria. Não houve teste em celular físico.

As fontes também foram integradas no checkout habitual, **sem mudar `feat/predio-novo` de branch**, no commit `30867e2`. Foi preparado um merge em cópia, com backup dos cinco arquivos que tinham edições locais; o índice do commit contém apenas a árvore das correções, sem absorver alterações não relacionadas. Os 17 arquivos rastreados pendentes fora do escopo mantiveram os mesmos bytes. O cancelamento de preparação de outra planta foi conservado; o indicador de progresso da compilação e testes anteriores foram reconciliados com as correções. A política antiga de baixar as demais horas depois das urgentes foi substituída pela política verificada de carregar só as horas pedidas, e a regressão local correspondente foi adaptada.

No checkout habitual, 120 testes passaram após a integração. Novos pacotes foram gerados pelos dois preparadores normais em `gerador-integrado/liv-classico` (430 arquivos) e `gerador-integrado/laranjeiras` (388), sem publicar de novo. Isso prova que o fluxo de geração já lê as fontes corrigidas. Os ajustes locais anteriores de progresso (`interior-renderer.js`), testes (`test_viewer_flow.mjs`, `testes/horario-luz-gravada.test.mjs`), picking/renderer, painel, regras e demais arquivos continuam pendentes de suas sessões; não foram descartados ou incluídos silenciosamente nos commits desta tarefa.

Reversão, caso necessária e desde que nenhuma outra publicação tenha ocorrido: `node tools/publicar_desempenho_maquetes.mjs <pasta-evidencias>/release <pasta-evidencias>/deploy --desfazer`. O publicador verifica a identidade da versão atual antes de restaurar a anterior; não desfaz a publicação de outra sessão.
