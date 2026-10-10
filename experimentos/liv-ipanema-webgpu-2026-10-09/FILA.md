# Preparação automática por prioridade

Diretriz do usuário em 09/10/2026: **tela inicial → Tour 3D → mapa → Planta 2D**. A fila começa quando a cena inicial está utilizável. O clique tem prioridade: interrompe a transferência de outro grupo, prepara o escolhido e depois continua os recursos pendentes. Planta 3D e Tour compartilham o HTML legado; baixar duas cópias não é necessário. Voltar à Maquete suspende a fila durante a abertura do exterior.

## Arquivos e execução

`gerar_manifesto_transferencias.py` confere as fontes preservadas e produz `transfer-manifest.json`, com versão, grupo, bytes e SHA-256 de cada recurso. Catálogo atual:

| Grupo | Arquivos | Bytes de conteúdo |
|---|---:|---:|
| Tour / Planta 3D | 1 HTML autossuficiente | 38.378.801 |
| Mapa | HTML + GLB + 120 tiles | 18.575.441 |
| Planta 2D | 1 JPG | 63.548 |
| Total secundário | 124 | 57.017.790 |

Estes são bytes após a descompressão HTTP, usados para validar a identidade e estimar armazenamento. A transferência na rede depende de compressão da hospedagem. Preparar tudo consome mais dados que carregar somente os modos visitados. Os recursos da primeira cena, bancada de materiais, arquivos Blend e scripts mutáveis ficam fora do catálogo.

`transfers.js` registra `transfer-worker.js` no escopo deste experimento, recebe progresso e despacha comandos. O Service Worker faz uma transferência por vez e atende também os requests normais de imagem, iframe, GLB e tiles. Um pedido pelo arquivo já em transferência usa o mesmo job. CacheStorage fornece a resposta verificada na visita seguinte, evitando depender do cache HTTP/revalidação para aproveitar a preparação. Nenhum renderer, canvas ou cena é criado pelo worker.

O HTML e o GLB essenciais precedem os tiles do mapa. A abertura não espera o download dos 120 tiles: pedidos visíveis ganham prioridade dentro do grupo. A fila volta ao restante da ordem após atender o grupo escolhido. O mapa preservado não foi reescrito.

## Interrupção, coerência e limites

- Ao interromper outro grupo, o arquivo incompleto é descartado e reinicia quando voltar à fila. Não há promessa de retomada parcial/Range, especialmente sob compressão HTTP.
- Só respostas completas, com tamanho e SHA-256 corretos, entram no cache da versão. Uma falha permite nova tentativa pelo modo solicitado. Arquivos fora da allowlist continuam com fetch normal.
- Se o cache estiver indisponível ou sua quota falhar, a fila informa a interrupção e os pedidos do modo aberto continuam podendo receber dados válidos. Não se garante retenção em disco: o navegador pode remover o cache.
- Requer HTTPS ou loopback seguro e Service Worker habilitado. Sem esse suporte, os quatro modos continuam abrindo diretamente; a preparação automática é indicada como indisponível.
- A fila funciona enquanto a página/worker está ativo. Fechar o navegador não garante conclusão em segundo plano. O ciclo de vida do worker pode interromper arquivos incompletos.
- Emulação desktop não qualifica armazenamento, conexão e memória de Android/iPhone físicos. A fila melhora a reutilização; não elimina compilação ou reconstrução da cena ao mudar de renderer.

## Verificação

- `evidencias/transferencias-fixture/runtime.json`: **nove casos aprovados** com Service Worker real e catálogo pequeno próprio. Ordem Tour → mapa → Planta 2D; native iframe/imagem usam cache; foreground compartilha um download em andamento; outro grupo cancela a demanda anterior e reinicia o arquivo depois; pause permite demanda explícita sem retomar o fundo; corpo com SHA incorreto é rejeitado; versões ficam isoladas e o catálogo pode atualizar no mesmo worker. Um pedido de tile não interrompe o modelo essencial do mapa; uma consulta de cache antiga retida pelo teste não ressuscita a demanda cancelada após outro clique.
- `evidencias/fila-integrada/runtime.json`: **quatro casos aprovados** usando os arquivos reais do LIV. O atlas inicial foi retido para comprovar ausência de downloads secundários antes da cena utilizável. Planta 2D interrompe o Tour; os 124 recursos completos entram no cache; Tour/Planta 3D compartilham a cena; HTML/GLB/tiles do mapa são servidos sem novas transferências. O mapa também foi solicitado com cache frio durante o prefetch do Tour: seu GLB precede os 120 tiles, sem downloads duplicados entre foreground/fundo. Injeção de quota cheia no worker ainda permite abrir Tour e Planta 2D com os dados verificados. Ausência da API permite Planta 2D por fetch nativo. Somente uma cena ativa, sem cenas ocultas.
- `evidencias/integracao-fila/runtime.json`: quatro modos, câmera/pavimento, caminhada, captura PNG, três ciclos por perfil e fallback passaram em desktop WebGPU, desktop WebGL2 e toque emulado 390×844.
- `evidencias/navegacao-fila/runtime.json`: layout 320/768/1440 px, mapa de 5 km, retorno pelo link e histórico do navegador com recuperação de câmera/pavimento aprovados.
- `evidencias/carregamento-fila/runtime.json`: quatro cenários aprovados na versão com fila. Fluxo com progresso ultrapassa 90 s no relógio acelerado sem abort; download parado aciona a recuperação; pedido repetido/alternância de interior durante a inicialização aguarda a mesma cena. Slow4G emulado a 1,6 Mbps/150 ms abriu a maquete em **124,56 s**, com relógio normal e sem o abort fixo anterior. Demonstra tolerância à espera, sem comprovar ganho de velocidade.

Chrome 154.0.8037.98, Windows 11; WebGPU NVIDIA/Turing e WebGL2 ANGLE/D3D11. Os relatórios da fila registram o catálogo e os hashes dos scripts. As falhas são injetadas somente nas origens HTTP dos testes, sem alterar o pacote preservado. Capturas PNG ficam locais. Qualificação de rede/aparelhos físicos e tráfego comprimido da hospedagem continua pendente; não houve publicação.

As medições antigas em `PERF.md` antecedem esta política. `medir_runtime.py` agora captura os recursos completos na primeira cena utilizável e pausa a fila para isolar a amostra de órbita; não contabiliza o tráfego HTTP comprimido do worker como ResourceTiming dos documentos. Testes da fila e novas medições de rede devem registrar esse tráfego separadamente.
