# Fontes e geração das maquetes

Existem dois runtimes. A prévia LEVE (`python -m pipeline.gerar_maquete`) passa por
`e2e_leitura.py` e `v1.5/miniaturas/pagina_maquete.py`; o PREMIUM do Cedros usa as
fontes aprovadas em `padrao-atual/`. Esses caminhos não usam o renderer experimental
do LIV nem o cache de iluminação por horário. Não copiar bundles modernos nesses templates.

Os pacotes modernos do LIV e do Parque das Laranjeiras usam as fontes em
`experimentos/liv-experimental-2026-10-14/` e `experimentos/laranjeiras-2026-10-30/site/`.
As correções de navegação, propriedade de recursos, geometrias, texturas, iluminação
e transferências estão nessas fontes, e não apenas em arquivos publicados.

Os dois preparadores chamam `pipeline/empacotar_runtime.mjs` para gerar os três
entrypoints com a mesma versão fixada do Three.js. Depois chamam
`python -m pipeline.transfer_manifest`: o manifesto nasce dos catálogos presentes
no pacote, verifica tamanho/SHA dos recursos e inclui móveis e luz por horário.
Atlas estático substituído pelo horário sai da fila; GLBs, mapas e outros horários
ficam sob demanda. Catálogo pequeno e plantas 2D podem antecipar o download.

Gerar novos pacotes em **pastas novas ou vazias**:

```powershell
node experimentos/liv-experimental-2026-10-14/preparar_pacote.mjs <release-base/liv-classico> <destino/liv-classico>
node experimentos/laranjeiras-2026-10-30/publicar/preparar_pacote.mjs <destino/laranjeiras>
```

O LIV preserva dados, HTML e ajustes da release-base indicada. O Laranjeiras monta
o site, as quatro plantas, iluminação e biblioteca aprovada; mantém `noindex`.
Nenhum preparador publica. Os binários ignorados precisam existir e corresponder
aos catálogos; falha de identidade aborta a geração.

Validação das correções:

```powershell
node --test tests/test_maquetes_desempenho.mjs
python -m unittest tests.test_transfer_manifest
python tests/qa_maquete_cache.py --saida <pasta-evidencias>
```

`tools/publicar_desempenho_maquetes.mjs` faz primeiro a conferência do Hosting,
registra versão anterior/inventário/configuração e só publica com `--publicar`.
Conserva conteúdo fora do pacote e os chunks antigos usados por páginas abertas.
O LIV público tem HTML servido por Cloud Function: atualizar os bundles de nome
estável não exige substituir essa função. A reversão verifica se nenhuma outra
sessão publicou depois. Não usar o `firebase.json` da raiz para essas maquetes.

Em 31/10/2026 foram gerados pacotes novos pelos dois comandos, com QA integrado
registrado em `tasks/desempenho-maquetes/plan.md`. A prévia LEVE também foi gerada
pelo seu comando normal, sem alterar o padrão visual do Cedros. Ensaios desktop
e viewport mobile não substituem homologação em aparelho físico.


A revisão da entrada de 31/10 também vive nessas fontes: `shader-scheduler.js`
completa apenas a API de agendamento ausente; cada interior carrega móveis da sua
tipologia e canais de luz com peso positivo; referências de autoria são liberadas
após a montagem. O viewer conserva até dois interiores, salva snapshots no descarte
e recupera falhas iniciais WebGPU em um iframe WebGL novo, uma única vez. Links de
unidades para 2D validam os vínculos sem abrir primeiro o renderer exterior. Sem
GPU, a seleção de apartamentos com planta validada fica disponível no aviso.

Os testes de entrada e recuperação estão em `test_viewer_flow.mjs`, nos testes do
scheduler/iluminação/biblioteca do LIV e em `tests/test_maquetes_desempenho.mjs`.
O desenho interior só é reenviado à GPU quando há mudança; o acompanhamento de
teclado, toque, portas e rotas continua ativo. Esses mecanismos usam as APIs dos
runtimes modernos; o template LEVE usa outro Three e não constrói grafos TSL.


Na revisão de 01/11/2026, ambos os preparadores passaram a executar
`pipeline/preparar_interiores.mjs` antes do empacotamento. Ele conserva as fontes
originais e cria `scene-runtime.bin.gz`: posições, normais corrigidas, índices,
UV1, PNGs embutidos e rotas iniciais prontas. O leitor valida SHA da fonte e do UV,
bounds e tipos; as rotas só são reutilizadas quando versão, layout, portas e
parâmetros de colisão coincidem. Mudar uma porta invalida o cache normalmente.
O mesmo fluxo converte HDR pelo HDRLoader fixado para pixels half-float gzip,
sem mudar exposição, tamanho ou bits. O manifesto prefere esses recursos e
mantém os originais disponíveis para leitores antigos.

Os dois preparadores também executam `pipeline/preparar_biblioteca.mjs`.
Ele separa os PNG/JPEG/WebP dos GLBs sem recomprimir imagens ou modificar os
bytes dos accessors, materiais, samplers, UVs, nomes e poses. As imagens únicas
da tipologia são agrupadas em pacotes de aproximadamente 4 MiB, identificados
por SHA. `improvement-delivery.js` compartilha download e ImageBitmap, confere
limites e MIME, e libera os buffers codificados depois de montar os templates.
O manifesto de transferência usa modelos preparados e pacotes únicos; os GLBs
originais continuam disponíveis. O transporte fica em `catalog.delivery` e não
altera a revisão autoral usada por snapshots. Edições que exigem recursos fora
da seleção preparada recorrem aos originais. O preparo falha explicitamente em
layouts GLB externos ou comprimidos que ainda não suporta.

A seleção é a mesma no gerador e no runtime: móveis compatíveis, acabamentos e
decorações ativas. O Laranjeiras mantém suas posições próprias e não carrega as
decorações específicas do LIV que já não eram instanciadas nele. Uma dependência
que também corresponde a móvel ou acabamento continua selecionada.
Resultados desta etapa: `tasks/desempenho-entrada/etapa-assets.md`.

Interiores `auto`/`webgl` usam o WebGLRenderer direto, preservando os materiais
PBR, a iluminação gravada, sondas e LUT de cor em um alvo HDR antes da conversão
final. Isso evita montar grafos TSL por material durante a abertura. WebGPU
explícito continua disponível, e falha gráfica tenta o outro backend uma única
vez em contexto novo. `motor=nodes` mantém o caminho TSL para diagnóstico.
Os canais temporais são agrupados em uma textura array (atlas) e em X numa
textura 3D (sondas), usando menos samplers inclusive sob o limite de 16, sem
perder texels ou aumentar a profundidade 3D. Só camadas distintas do atlas ocupam memória e são enviadas à GPU;
nenhum canal de peso zero dispara download. O Laranjeiras conserva o bilinear
após decodificação RGBM e sua entrada de Tour junto à porta.

Evidência e resultados desta etapa estão em `tasks/desempenho-entrada/etapa-rapida.md`.
A prévia LEVE/PREMIUM usa seus próprios templates e não precisa da construção TSL
que originou este gargalo; não recebe este adaptador de renderer moderno.


A fila também separa os arquivos urgentes das transferências de fundo. Até quatro
arquivos pedidos pelo cliente avançam em paralelo, com orçamento de 16 MiB para
os buffers declarados em trânsito; um arquivo maior roda sozinho. Sem pedidos,
segue apenas um download de fundo. O cache e a conferência de tamanho/SHA continuam
antes da entrega; pedidos iguais compartilham o download, e cancelar um consumidor
não cancela outro. Pré-requisitos e trocas de catálogo continuam sendo respeitados.
`tests/test_transfer_queue.mjs` cobre orçamento/pré-requisitos/fundo;
`tests/qa_maquete_cache.py` exercita o worker no navegador, paralelismo, integridade,
reutilização e cancelamento entre abas. O tempo de abertura pública precisa ser
medido com o worker ativo: tempos locais de CPU não incluem a fila e a rede reais.
