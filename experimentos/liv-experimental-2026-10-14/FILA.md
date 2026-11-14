# Preparação automática por prioridade

Diretriz do usuário em 09/10/2026: **tela inicial → Tour 3D → mapa → Planta 2D**. A fila começa quando a cena inicial está utilizável. O clique tem prioridade: interrompe uma transferência de fundo substituída, prepara o escolhido e depois continua os recursos pendentes. Uma transferência ainda solicitada por outra aba termina antes de atender a nova escolha. Planta 3D e Tour compartilham os recursos e a cena da tipologia atual. Canto e meio possuem plantas e geometrias próprias; a escolha pode interromper uma transferência de outra tipologia dentro do mesmo grupo. Voltar à Maquete suspende o fundo durante a abertura do exterior.

## Arquivos e execução

`gerar_manifesto_transferencias.py` confere as fontes preservadas e produz `transfer-manifest.json`, com versão, grupo, bytes e SHA-256 de cada recurso. Catálogo anterior, preservado como registro da primeira etapa (a versão atual usa pacotes de interior descritos em INTERIORES.md):

| Grupo | Arquivos | Bytes de conteúdo |
|---|---:|---:|
| Tour / Planta 3D | 1 HTML autossuficiente | 38.378.801 |
| Mapa | HTML + GLB + 120 tiles | 18.575.441 |
| Planta 2D | 1 JPG | 63.548 |
| Total secundário | 124 | 57.017.790 |

Estes são bytes após a descompressão HTTP, usados para validar a identidade e estimar armazenamento. A transferência na rede depende de compressão da hospedagem. Preparar tudo consome mais dados que carregar somente os modos visitados. Os recursos da primeira cena, bancada de materiais, arquivos Blend e scripts mutáveis ficam fora do catálogo.

`transfers.js` registra `transfer-worker.js` no escopo deste experimento, recebe progresso e despacha comandos. O Service Worker faz uma transferência por vez e atende também os requests normais de imagem, iframe, GLB e tiles. Um pedido pelo arquivo já em transferência usa o mesmo job. A prioridade por prefixos seleciona somente arquivos do catálogo, cancela demandas anteriores do cliente que fez a escolha e prepara dados compartilhados e da tipologia escolhida. O catálogo é o único pré-requisito do grupo; os outros recursos de interior são independentes da tipologia não escolhida. CacheStorage fornece a resposta verificada na visita seguinte, evitando depender do cache HTTP/revalidação para aproveitar a preparação. Nenhum renderer, canvas ou cena é criado pelo worker.

O HTML e o GLB escolhido precedem os tiles do mapa. A abertura não espera o download dos 120 tiles: pedidos visíveis ganham prioridade dentro do grupo. A fila volta ao restante da ordem após atender o grupo escolhido. Os dados regionais e o renderer preservados continuam iguais; o carregador do modelo foi ajustado em um HTML derivado, conforme [MAPA-MODELO.md](MAPA-MODELO.md).

## Interrupção, coerência e limites

- Ao interromper outro grupo ou tipologia, o arquivo incompleto é descartado e reinicia quando voltar à fila. Não há promessa de retomada parcial/Range, especialmente sob compressão HTTP.
- Cada demanda pertence ao `clientId` que a iniciou. Prioridade e pause cancelam as demandas desse cliente; outras abas continuam aguardando a mesma resposta verificada, sem um segundo download. Comandos também removem demandas de clientes fechados. Quando não sobra demanda para o arquivo abandonado, a escolha atual pode interrompê-lo.
- Consultas de cache em andamento respeitam a prioridade do próprio cliente. Uma mudança de catálogo invalida consultas e demandas da versão anterior para todos os clientes.
- Só respostas completas, com tamanho e SHA-256 corretos, entram no cache da versão. Uma falha permite nova tentativa pelo modo solicitado. Arquivos fora da allowlist continuam com fetch normal.
- Se o cache estiver indisponível ou sua quota falhar, a fila informa a interrupção e os pedidos do modo aberto continuam podendo receber dados válidos. Não se garante retenção em disco: o navegador pode remover o cache.
- Requer HTTPS ou loopback seguro e Service Worker habilitado. Sem esse suporte, os quatro modos continuam abrindo diretamente; a preparação automática é indicada como indisponível.
- A fila funciona enquanto a página/worker está ativo. Fechar o navegador não garante conclusão em segundo plano. O ciclo de vida do worker pode interromper arquivos incompletos.
- Cada inicialização do worker recebe um `workerInstance`. O cliente aceita o contador de progresso menor da nova instância, conserva a ordem dos eventos dentro dela e ignora broadcasts/replies do controller anterior ou de instâncias já substituídas. O worker novo começa com o fundo pausado e reutiliza respostas verificadas do cache do mesmo catálogo.
- Emulação desktop não qualifica armazenamento, conexão e memória de Android/iPhone físicos. A fila melhora a reutilização; não elimina compilação ou reconstrução da cena ao mudar de renderer.

## Verificação da etapa com HTML legado

- `evidencias/transferencias-fixture/runtime.json`: **nove casos aprovados** com Service Worker real e catálogo pequeno próprio. Ordem Tour → mapa → Planta 2D; native iframe/imagem usam cache; foreground compartilha um download em andamento; outro grupo cancela a demanda anterior e reinicia o arquivo depois; pause permite demanda explícita sem retomar o fundo; corpo com SHA incorreto é rejeitado; versões ficam isoladas e o catálogo pode atualizar no mesmo worker. Um pedido de tile não interrompe o modelo essencial do mapa; uma consulta de cache antiga retida pelo teste não ressuscita a demanda cancelada após outro clique.
- `evidencias/fila-integrada/runtime.json`: **quatro casos aprovados** usando os arquivos reais do LIV. O atlas inicial foi retido para comprovar ausência de downloads secundários antes da cena utilizável. Planta 2D interrompe o Tour; os 124 recursos completos entram no cache; Tour/Planta 3D compartilham a cena; HTML/GLB/tiles do mapa são servidos sem novas transferências. O mapa também foi solicitado com cache frio durante o prefetch do Tour: seu GLB precede os 120 tiles, sem downloads duplicados entre foreground/fundo. Injeção de quota cheia no worker ainda permite abrir Tour e Planta 2D com os dados verificados. Ausência da API permite Planta 2D por fetch nativo. Somente uma cena ativa, sem cenas ocultas.
- `evidencias/integracao-fila/runtime.json`: quatro modos, câmera/pavimento, caminhada, captura PNG, três ciclos por perfil e fallback passaram em desktop WebGPU, desktop WebGL2 e toque emulado 390×844.
- `evidencias/navegacao-fila/runtime.json`: layout 320/768/1440 px, mapa de 5 km, retorno pelo link e histórico do navegador com recuperação de câmera/pavimento aprovados.
- `evidencias/carregamento-fila/runtime.json`: quatro cenários aprovados na versão com fila. Fluxo com progresso ultrapassa 90 s no relógio acelerado sem abort; download parado aciona a recuperação; pedido repetido/alternância de interior durante a inicialização aguarda a mesma cena. Slow4G emulado a 1,6 Mbps/150 ms abriu a maquete em **124,56 s**, com relógio normal e sem o abort fixo anterior. Demonstra tolerância à espera, sem comprovar ganho de velocidade.

Chrome 154.0.8037.98, Windows 11; WebGPU NVIDIA/Turing e WebGL2 ANGLE/D3D11. Os relatórios da fila registram o catálogo e os hashes dos scripts. As falhas são injetadas somente nas origens HTTP dos testes, sem alterar o pacote preservado. Capturas PNG ficam locais. Qualificação de rede/aparelhos físicos e tráfego comprimido da hospedagem continua pendente; não houve publicação.

As medições antigas em `PERF.md` antecedem esta política. `medir_runtime.py` agora captura os recursos completos na primeira cena utilizável e pausa a fila para isolar a amostra de órbita; não contabiliza o tráfego HTTP comprimido do worker como ResourceTiming dos documentos. Testes da fila e novas medições de rede devem registrar esse tráfego separadamente.

## Duas tipologias — 10/10/2026

O grupo Tour usa `interiores/catalogo.json`, entradas PBR/fábricas compartilhadas e geometria/UV/atlas próprios de cada planta. O HTML legado permanece preservado fora da fila nova. Planta 2D prepara as duas imagens oficiais. Após o bake de Meio, o manifesto contém 139 arquivos e 33.298.171 bytes: Tour com 15 arquivos / 14.602.948 bytes; mapa com 122 / 18.575.441; plantas 2D com 2 / 119.782. O incremento acrescenta 5.959.748 bytes ao conteúdo secundário. Os atlas/JSON `.gz` já estão comprimidos; a compressão HTTP da hospedagem não foi medida.

`evidencias/transferencias-tipologias/runtime.json` registra **12/12 cenários PASS** com o worker e o cliente daquela revisão: ordem, troca de tipologia, duas abas, compartilhamento de download, prioridade entre grupos, pause, consulta de cache retida, integridade, pré-requisitos do mapa, isolamento de versão, atualização de catálogo e reinício do worker. Na prova de duas abas, a escolha de meio cancela somente a demanda anterior da aba que clicou; a outra recebe canto íntegro, e ambas compartilham meio. Canto e meio tiveram uma transferência cada na rede. Na prova de reinício, o mesmo catálogo conserva seu cache, o cliente aceita o contador menor da nova instância e ignora o evento antigo, sem baixar os recursos novamente. O relatório registra hashes de `transfer-worker.js`, `transfers.js` e do QA, além de `browserArgs: ["--disable-gpu"]`; o fixture não cria cenas ou renderers. A matriz anterior permanece como histórico da etapa com HTML legado.

`evidencias/fila-tipologias/runtime.json` conserva quatro cenários PASS com o manifesto anterior de 135 arquivos. A repetição em `evidencias/fila-luz-estatica/runtime.json` passou nos quatro cenários com os 139 arquivos daquela revisão: abertura inicial antes do fundo, prioridade da imagem 2D, preenchimento completo do cache, uso dos pacotes de interior e do mapa sem novo download, GLB antes dos tiles com cache frio, quota cheia e fallback sem Service Worker. O clique seleciona recursos compartilhados e da tipologia escolhida; não precisa esperar os dados da outra planta.

## Modelo corrigido no mapa — 11/10/2026

Na revisão do contorno, o catálogo continha **140 arquivos / 35.294.664 bytes**, versão `945631d8…`. O mapa usava um único HTML regional compartilhado e os dois GLBs original/contorno. A preparação completa acrescentava 2.276.774 bytes em relação à revisão do rodateto; o carregamento inicial do exterior não mudou. O fragmento da edição é removido somente na consulta ao catálogo/cache, pois não altera o recurso HTTP. Não se presume redução do tráfego comprimido ou do tempo de abertura.

[fila-mapa-contorno-final/runtime.json](evidencias/fila-mapa-contorno-final/runtime.json) registra **13 cenários PASS** com o worker daquela revisão. Inclui a edição escolhida antes do GLB alternativo e dos tiles, compartilhamento de transferência e reutilização do HTML em cache com `#contorno`. [fila-mapa-real-conferida/runtime.json](evidencias/fila-mapa-real-conferida/runtime.json) registra a repetição com os 140 arquivos reais: preparação após a cena inicial utilizável, preempção e cache, mapa da variante com GLB incompleto retido, quota indisponível e ausência de Service Worker. O QA aguarda a interface para inspecionar a transferência retida; só declara o mapa pronto depois do modelo verificado. Fontes e reprodução em [MAPA-MODELO.md](MAPA-MODELO.md).

## Entrada e prioridade na saída da maquete — 11/10/2026

O catálogo atual contém **141 arquivos / 37.830.820 bytes**, versão `03204482b5e3d8c2c0f74a7951118e290b6e0aaaf3810fc2b98fb00623c87ba5`. O GLB adicional da entrada tem 2.535.936 bytes; o HTML compartilhado cresceu 220 bytes. Os atlas iniciais continuam fora da fila, e os pacotes independentes de Canto/Meio conservam suas identidades.

O teste com o GLB retido revelou uma janela entre clicar em Mapa e a inicialização da página seguinte: o clique priorizava todo o grupo, permitindo começar o GLB original. `viewer.js` agora envia HTML, GLB da edição atual e prefixo dos tiles já nesse clique. O adaptador mantém a mesma escolha. A correção evita essa transferência antecipada e conserva a preparação completa das outras edições após os recursos selecionados.

[fila-entrada-corrigida/runtime.json](evidencias/fila-entrada-corrigida/runtime.json) passou nos cinco cenários com dados reais: 141 arquivos em cache, preempção/reuso, mapas frios de contorno e entrada com GLB antes das outras edições e dos 120 tiles, nenhuma transferência nativa/fundo duplicada, quota cheia e ausência de Service Worker. O primeiro [relatório que reproduz a falha](evidencias/fila-entrada-integrada/runtime.json) foi preservado. Demais regressões e medição em [INTEGRACAO-ENTRADA.md](INTEGRACAO-ENTRADA.md).
