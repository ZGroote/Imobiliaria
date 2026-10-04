# Guia de acabamentos PBR para maquetes imobiliárias

Procedimento de reprodução e proposta de padronização

Versão 1.0 · 4 de outubro de 2026 · Referência da implementação `9508838`

Este guia explica como aplicamos texturas reais às paredes e aos móveis do piloto, de onde vieram os arquivos, como reduzimos seu peso e como verificamos o resultado. Ele serve à equipe de produto e a quem for manter o renderizador. O processo de obtenção e preparação já pode ser repetido; a aplicação a outras casas ainda exige adaptar algumas regras do piloto.

A solução usa mapas PBR da Poly Haven, preparados no computador e servidos pelo próprio site. PBR descreve como a superfície responde à luz. A imagem de cor mostra o acabamento; o mapa de normal simula pequenos relevos; o mapa de rugosidade controla o reflexo. Esses mapas acrescentam detalhe visual sem subdividir paredes ou transformar cada fibra de tecido em geometria.

O exemplo é uma casa sintética de 59,64 m², com dois dormitórios, sete ambientes e treze aberturas. A planta foi gerada pelo pipeline existente, a partir de `CASAS[2]` em `tools/benchmark_10_casas.mjs`, e mobiliada pela biblioteca atual. A demonstração não representa um imóvel real nem comprova o desempenho de todas as casas.

## 1 O problema e a mudança realizada

A opção Base já continha materiais procedurais. A primeira tentativa de acrescentar grão fino à pintura produziu pouca diferença percebida entre Lisa e Texturizada. A comparação enviada pelo usuário mostrou que o controle funcionava, mas o acabamento não atendia ao objetivo visual.

Substituímos essa tentativa por um reboco decorativo com marcas de desempenadeira e tom quente de argila. Também separamos a madeira do piso da madeira dos móveis e trocamos o tecido pouco evidente por uma trama bouclé. A diferença passou a depender de imagens reais do acabamento, além do relevo calculado na iluminação.

Os dois controles têm funções distintas. Base restaura as geometrias e os materiais originais. Acabamentos aplica o conjunto preparado. Dentro de Acabamentos, Lisa restaura apenas paredes e rodapés; Texturizada aplica o reboco, mantendo pisos e móveis. Escolher Texturizada a partir de Base ativa Acabamentos. Nenhuma dessas trocas reposiciona a câmera.

O tecido escolhido tem desenho marcado e fios de cores diferentes. Ele demonstra a aplicação, mas sua paleta não deve ser imposta a todos os imóveis. A seleção de um estilo neutro, por exemplo, deverá passar pelo mesmo processo de preparação e aceite.

## 2 Origem e licença dos materiais

Todos os mapas usados nesta versão vieram dos downloads oficiais da Poly Haven. Cada linha abaixo representa um material composto por cor, normal OpenGL e rugosidade. O tamanho indica a soma dos três WebP preparados, em bytes; a área de repetição informa o tamanho físico representado por uma imagem completa.

| Uso e ID | Fonte oficial e autoria | Repetição física | Bytes |
|---|---|---|---:|
| Piso de madeira `madeira` | [Wood Floor](https://polyhaven.com/a/wood_floor) — Dimitrios Savva | 1,7 × 1,7 m | 415.050 |
| Piso frio `frio` | [Floor Tiles 08](https://polyhaven.com/a/floor_tiles_08) — Rob Tuytel | 1,5 × 1,5 m | 374.914 |
| Parede `parede` | [Patterned Clay Plaster](https://polyhaven.com/a/patterned_clay_plaster) — Amal Kumar | 2 × 2 m | 508.856 |
| Marcenaria `madeira_movel` | [Natural Walnut Veneer](https://polyhaven.com/a/natural_walnut_veneer) — Jenelle van Heerden | 1 × 1 m | 384.634 |
| Estofamento `tecido` | [Wool Boucle](https://polyhaven.com/a/wool_boucle) — colormass na fotografia e Rico Cilliers no processamento | 0,315 × 0,3901 m | 780.268 |

A [licença oficial CC0](https://polyhaven.com/license), conferida em 04/10/2026, permite modificar, redistribuir e usar comercialmente esses assets, sem atribuição obrigatória. Mantivemos origem e autoria no inventário para facilitar a manutenção. Essa licença dos assets não abrange automaticamente os renders de exemplo, textos ou logotipos do site.

A consulta aos metadados usa a [API oficial](https://polyhaven.com/our-api). Seus [termos](https://github.com/Poly-Haven/Public-API/blob/master/ToS.md) são separados da licença dos arquivos: uma futura integração que ofereça o catálogo por meio da API ao vivo precisa observar suas regras de identificação e crédito. O piloto usa os mapas baixados e hospedados localmente, sem essa integração no navegador.

CGAxis foi avaliada, mas não forneceu arquivos a esta implementação. Seus [termos oficiais](https://cgaxis.com/tos-license/) têm condições próprias para redistribuição, bibliotecas e serviços de plataforma. Uma eventual adoção precisa confirmar a licença correspondente ao uso; reduzir a resolução não muda essa condição.

## 3 Como selecionamos e registramos as fontes

A pesquisa consultou `GET /assets?t=textures`, `GET /info/<id>` e `GET /files/<id>`. Os metadados forneceram autoria, dimensões físicas, URLs, tamanho e MD5 dos arquivos. A seleção foi técnica e visual: examinamos o albedo baixado, sua repetição e os mapas disponíveis. Não usamos a imagem de apresentação do fornecedor como textura.

O inventário versionado `experimentos/piloto-qualidade-visual-2026-10-04/assets.json` registra cada fonte e fixa os bytes esperados. Para cada mapa, ele contém URL oficial, tamanho, MD5 do catálogo, SHA-256 do original e dimensões, tamanho e SHA-256 do WebP final. Também registra licença, escala física e parâmetros de processamento.

MD5 confere a correspondência com o arquivo informado pelo catálogo. SHA-256 identifica os bytes preservados. Os hashes detectam uma troca ou corrupção; a avaliação da licença e da aparência continua necessária.

O preparador baixa somente URLs fixadas em HTTPS sob `dl.polyhaven.org/file/ph-assets/Textures/`, usando o identificador `ImobiliariaVisualPilot/2026.10 (offline CC0 texture preparation)`. Ele confere arquivos novos e os originais já presentes no cache. O script atual não descobre nem importa automaticamente um novo material: a escolha e a pinagem de um candidato ainda são etapas técnicas.

## 4 Preparação dos arquivos para a web

Usamos Python e Pillow, sem Blender. O manifesto desta geração registra Python 3.14.4, Pillow 12.3.0 e libwebp 1.6.0. Para reproduzir os mesmos hashes, use o ambiente registrado; outro encoder pode produzir bytes diferentes mesmo quando a imagem parece igual.

| Mapa | Entrada escolhida | Preparação e limite | No renderizador |
|---|---|---|---|
| Cor ou albedo | Diffuse 1k JPEG | RGB; máximo de 1024 px; WebP qualidade 82 e método 6 | `map` e `SRGBColorSpace` |
| Normal | nor_gl 1k PNG | RGB; máximo de 512 px; vetores renormalizados após reduzir; WebP sem perda | `normalMap` e `NoColorSpace` |
| Rugosidade | Rough 1k PNG | Tons de cinza; máximo de 512 px; dados de 16 bits divididos por 257 antes de converter a 8 bits; WebP sem perda | `roughnessMap` e `NoColorSpace` |

A redução usa LANCZOS e preserva a proporção. Quatro materiais são quadrados: cor em 1024 × 1024 e dados em 512 × 512. O bouclé é retangular: cor em 826 × 1024 e dados em 413 × 512. Sua largura e altura físicas também ficam separadas em `tileMeters` e `tileHeightMeters`.

A normal guarda direções, por isso seus vetores são normalizados novamente após a redução. Rugosidade é um dado de superfície; converter diretamente certos PNG de 16 bits para tons de cinza de 8 bits poderia saturar valores. A divisão por 257 preserva a faixa antes de reduzir. A expressão “sem perda” refere-se à codificação WebP do resultado processado, que já foi reduzido.

Os quinze mapas somam 2.463.722 bytes, aproximadamente 2,46 MB decimais, abaixo do teto atual de 3.000.000 bytes. Esse teto substituiu o limite inicial de 1,5 MB para comportar parede e marcenaria próprias e tecido mais evidente. Os originais somam 36.671.717 bytes e permanecem no computador, fora do pacote público.

O resultado contém `manifesto.json` e arquivos `<id>-<papel>.webp`. O manifesto associa fontes, parâmetros e resultados. A regra local `.gitattributes` mantém `assets.json` com finais de linha LF, estabilizando o hash da configuração no Windows sem alterar a política global do repositório.

## 5 Organização e montagem do piloto

As fontes ficam em `experimentos/piloto-qualidade-visual-2026-10-04/`. As saídas, os originais e as evidências ficam em `publicacao/`, ignorados pelo Git. Para a rodada atual, o diretório de geração é `publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/`.

| Arquivo ou pasta | Responsabilidade |
|---|---|
| `assets.json` | Inventário fixado de fontes, escala, parâmetros e hashes |
| `preparar_assets.py` | Download, conversão, manifesto e verificação completa dos mapas |
| `montar.mjs` | Geração da casa de referência, validação e montagem da saída permitida |
| `visual.js` | Aplicação dos materiais, UVs, seleção de faces e troca Base/Acabamentos |
| `index.html` | Controles, amostras reais de materiais e download da cor da parede |
| `metricas.js` | Diagnóstico local de quadros e contagens, em memória e DOM |
| `originais/` | Arquivos do fornecedor usados na preparação; não publicar |
| `assets/` | Mapas preparados e manifesto local |
| `entrada/` e `base/` | Insumos e saída original do pipeline |
| `site/` | Apenas os arquivos destinados ao preview |

`montar.mjs` usa o normalizador, o gerador e o mobiliamento existentes. Depois deriva outro HTML com a extensão visual. O HTML base desta rodada permaneceu byte a byte igual ao anterior, com SHA-256 `3b3a4c2aefb53cb198fd271a276491d861ed285bacbb90fac6e2259571f638c0`. Não reescrevemos o gerador principal, a geometria da casa, suas colisões ou sua iluminação para instalar estes acabamentos.

O montador confere IDs, bytes, hashes, limites declarados e caminhos permitidos. A verificação do formato real, dos originais, da licença registrada e da convenção OpenGL pertence a `preparar_assets.py --verificar`; execute essa etapa antes de montar. O pacote público recebe somente a lista permitida.

O conjunto preparado produz um diretório identificado pelo hash do manifesto, nesta rodada `assets/b856fc408504c434/`. Esse caminho admite cache longo porque seu conteúdo é imutável. Páginas e scripts de apresentação têm política própria; o arquivo de download da parede é uma cópia separada, servida como anexo sem cache.

## 6 Aplicação no Three js

A casa usa Three.js r168 e materiais PBR existentes. A extensão inicia por `window.PilotoVisual.start({ THREE, maq, base, assets, assetPath, enabled })`. O objeto `base` expõe materiais, biblioteca de móveis e ambiente da casa apenas no HTML derivado. Não acrescentamos React Three Fiber, Blender ou um novo motor 3D.

### Carregamento e materiais

Cada mapa é carregado uma vez pelo `TextureLoader` e compartilhado pelas superfícies compatíveis. Cor usa sRGB; normal e rugosidade são dados sem transformação de cor. A repetição usa `RepeatWrapping`; a anisotropia é limitada a 4 ou à capacidade do dispositivo, se menor.

Se o piloto iniciar em Base, o renderizador só solicita os mapas 3D ao ativar Acabamentos. As cinco amostras de albedo da barra lateral já podem carregar pela página e usar os mesmos URLs em cache. A primeira ativação carrega os quinze mapas do catálogo; ainda não existe seleção automática apenas dos materiais presentes na casa.

A instalação aguarda o término das tentativas dos cinco materiais. Cada material só é aplicado se seus três mapas terminarem corretamente. Se um falhar, os outros mapas daquele trio são descartados e a superfície conserva o material original. Outros trios completos continuam disponíveis. Desligar Acabamentos durante o carregamento mantém a escolha do usuário ao terminar.

Clonamos os materiais originais e preservamos seus callbacks `onBeforeCompile` e `customProgramCacheKey`, além do ambiente. O metalness dos acabamentos é zero. A rugosidade escalar é 0,65 para piso frio, 1 para parede e 0,95 para os demais; ela modula o mapa. O normalScale é 0,65 na parede, 0,75 no tecido e 0,5 nos demais. Esses valores são a calibração atual e devem ser revistos para outro material ou iluminação.

Usamos normal OpenGL. O normal altera a resposta à luz, sem deslocar a malha. O bump procedural é removido dos clones que recebem normal, pois o [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) dá prioridade ao normalMap quando ambos existem. Não foi acrescentado displacement, mapa de oclusão ou HDRI novo a esta rodada.

### Paredes e pisos

A extensão clona a geometria para escrever UVs em escala física. UV é a coordenada que liga um ponto da malha a um ponto da imagem. Na parede vertical, U segue a tangente horizontal da face e V segue sua altura. Faces horizontais usam projeção X/Z. Assim, um patch de 2 × 2 m não é esticado para ocupar qualquer parede inteira.

Nas superfícies da casa, preservamos posições, índices, normais, UVs de iluminação e o atributo de cores compartilhado com o bake progressivo. Bake é a iluminação pré-calculada que a casa já usa. Compartilhar o atributo permite que suas atualizações continuem chegando ao clone. Pisos ajustam as UVs existentes para a escala física dos novos mapas.

A parede recebe um ganho neutro de cor de 1,7 para esta cena, sem emissão ou luz extra. O albedo continua com seu tom de argila. Esse ganho é uma escolha do exemplo; não deve virar constante geral da biblioteca. Lisa restaura paredes e rodapés, enquanto forro e esquadrias conservam os materiais originais em ambas as opções.

### Móveis e seleção das superfícies

A madeira dos móveis tem veios contínuos de nogueira. O piso mantém seu próprio material com juntas de tábuas. Para separar corpo, estofamento e ferragens, a extensão consulta a biblioteca real `MOVEIS_LIB` e reconstrói uma máscara pela mesma chamada `MOVEIS[type].param({w,h,d})` usada pelo gerador.

As faces selecionadas passam a grupos de material. Madeira e tecido usam albedo com cor branca e `vertexColors=false`, evitando multiplicar a imagem pela tonalidade do cadastro e escurecê-la. Ferragens, tampos, cubas e partes de outro material mantêm a aparência original. As UVs dos móveis usam projeção pela direção dominante da face e consideram a escala do objeto.

Na casa de referência, 16 das 21 peças recebem tecido ou marcenaria; cinco peças de eletros e cerâmica conservam os materiais originais. Tapetes recebem tecido em todas as faces. A cama combina grupos de tecido, madeira e partes originais. O primeiro sofá recebe módulos arredondados próprios, com 720 triângulos na nova geometria desta fixture, preservando posição, identidade e dimensões nominais. Essa contagem não representa o acréscimo líquido renderizado, pois o sofá original fica oculto em Acabamentos. Base devolve os objetos originais.

### Interface de diagnóstico

O objeto `window.__pilotoVisual` oferece `setEnabled`, `setWallsEnabled`, `ready`, `snapshot` e `getWallTextureDownload`. O snapshot informa materiais e mapas carregados, meshes alterados, geometria própria, falhas e incompatibilidades de máscara. O campo `requestedBytes` contém o orçamento declarado do catálogo, inclusive antes do carregamento; não mede tráfego real, cache ou compressão HTTP. Isso permite investigar uma aplicação parcial sem confundir carregamento com aceite visual.

`ready` conclui o carregamento. Se a casa surgir depois, sua instalação pode ocorrer apenas no próximo quadro. A extensão ainda não oferece timeout próprio, nova tentativa explícita ou descarte completo dos recursos. Esses mecanismos devem integrar o ciclo de vida do padrão futuro.

“Baixar textura cor” entrega o albedo da parede: `parede-reboco.webp`, 1024 × 1024, 94.374 bytes. É igual ao mapa usado na cena, com SHA-256 `8c8e3d92a07b07095063227f36be18ebe0e51c2b2ce170587c5d407c7ca41cad`. Esse download contém somente cor; para reproduzir o PBR completo, use também normal, rugosidade e escala do inventário.

## 7 Como reproduzir no computador

Execute os comandos a partir da raiz `C:\Users\respawn\Desktop\imobiliaria`, usando Node 24, as dependências existentes e Python com o ambiente de imagem registrado. As variáveis abaixo encurtam os caminhos no PowerShell. O destino deve estar livre; uma repetição posterior deve escolher outro diretório de geração.

```powershell
$piloto = 'experimentos/piloto-qualidade-visual-2026-10-04'
$geracao = 'publicacao/piloto-qualidade-visual-2026-10-04/repro-materiais-v2'
python "$piloto/preparar_assets.py" --destino "$geracao/assets"
python "$piloto/preparar_assets.py" --verificar "$geracao/assets"
node "$piloto/montar.mjs" --assets "$geracao/assets" --destino "$geracao/site"
```

`--verificar` recebe o caminho dos assets e não baixa arquivos. Ele precisa dos originais no diretório irmão `originais/`. A preparação recusa destinos ocupados, arquivos alterados, caminhos externos ao espaço do piloto e resultados incompatíveis com o inventário. Não desative essas verificações para forçar uma reprodução.

Para abrir o resultado e rodar os testes focados:

```powershell
python -m http.server 8871 --bind 127.0.0.1 --directory "$geracao/site"
# Abrir http://127.0.0.1:8871 em um navegador.
# Em outro terminal, na raiz do projeto:
node --test tests/test_piloto_visual_build.mjs `
  tests/test_piloto_visual_runtime.mjs `
  tests/test_piloto_visual_metricas.mjs
```

Para conferir a rodada atual, use `--verificar publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/assets`. A opção `--atualizar` do montador só serve à derivação compatível com o mesmo conjunto fixado. Uma alteração de mapas exige nova geração; não use a opção para substituir silenciosamente um pacote anterior.

## 8 Verificação e evidências do resultado

A verificação combina integridade, comportamento e aparência. Os testes automáticos passaram em 22 de 22 casos: oito de montagem, nove de runtime e cinco de métricas. Os testes de runtime consultam a biblioteca e a fábrica reais de móveis, usando um carregador de textura simulado. O navegador real confirma pixels, downloads e interação.

Os quinze mapas e o manifesto foram reproduzidos byte a byte. Alterações de arquivo e proporção, saídas externas e destinos ocupados foram recusados. No navegador local e público, comparamos os controles na mesma câmera e alvo; verificamos modos 2D, 3D e Visita 3D, download da parede, console e layout de 390 × 844 sem overflow horizontal.

![Parede com acabamento texturizado no preview](../publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/evidencias/publico-parede-texturizada.png)

Figura 1 — Reboco decorativo na comparação pública. A captura Lisa da mesma câmera está no conjunto de evidências, junto à Texturizada.

| Medição ou verificação | Resultado observado |
|---|---|
| Materiais e mapas carregados | 5 materiais e 15 mapas |
| Aplicação pública | 18 meshes alterados; zero falhas e zero máscaras incompatíveis |
| Planta 3D em Acabamentos | 44 draw calls; 63.814 triângulos; 24 texturas na GPU |
| Quadros no desktop visível | p50 aproximadamente 16,7 ms; p95 16,8 ms |
| Timestamp do primeiro quadro registrado | 1.444,4 ms em relação à origem de tempo do documento |
| Pacote enviado ao Hosting | 21 arquivos; 4.424.354 bytes antes de compressão HTTP |
| Homologação física M1.1 A | 0 das 5 sessões realizadas |

![Tecido e acabamento dos móveis no preview](../publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/evidencias/publico-moveis-texturizados.png)

Figura 2 — Aplicação do tecido e dos acabamentos no mobiliário. A escolha da trama é demonstrativa; o padrão futuro deve permitir outros perfis.

Essas medições pertencem à máquina e à aba usadas. O diagnóstico começa após iniciar o renderer e registra um timestamp de `requestAnimationFrame` relativo à origem de tempo do documento; esse valor não é a duração de abertura ou o primeiro pixel com rede controlada. Janela estreita no desktop não equivale a teste em celular real. O peso WebP descreve transferência; imagens decodificadas, mipmaps e geometria também consomem memória. Os dados não garantem FPS, memória disponível ou tempo de abertura em qualquer aparelho.

As provas locais ficam em `publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/`: `validacao-assets.json`, `verificacao-materiais-reais.json` e `evidencias/`, incluindo `publico-comparacao.json` e capturas Base/Acabamentos e Lisa/Texturizada. Esses arquivos são evidências locais ignoradas pelo Git; arquive uma cópia junto ao registro de aceite antes de remover saídas.

## 9 Publicação temporária e controle de versões

O preview atual está em [qualidade piloto](https://imobilaria-deccb-miniaturas--qualidade-piloto-20261004-tj49koea.web.app/). A publicação registrada expira em 11/10/2026 às 15:19:19 BRT. Seu release local é `f3aab36655b0c021`; a versão Hosting é `55eb39d190fa43de`, com publicação em `2026-10-04T18:19:23.501Z`. O link pode deixar de abrir após a expiração; a reprodução depende das fontes e do inventário, não dele.

Foi usado um canal isolado do Firebase Hosting, com configuração `firebase.preview.json` fora de `site/`. Originais, relatórios privados e JSON locais não entram no pacote. Os quinze mapas usam o caminho com hash; as demais regras de cache, noindex e download constam da configuração. Não foram ativadas funções ou APIs de rastreabilidade nesta publicação.

Os 21 arquivos públicos tiveram seus hashes conferidos. Os oito canais anteriores permaneceram desativados e seus URLs verificados responderam 404. A implementação e este guia não autorizam reativá-los.

Para uma publicação futura, siga `experimentos/piloto-qualidade-visual-2026-10-04/PUBLICACAO.md`, registre a nova expiração e confira os hashes. O procedimento de reprodução da seção 7 é local e não faz deploy. Base oferece uma comparação visual imediata; retirar o preview do ar exige agir apenas sobre o canal correspondente.

## 10 O que falta para virar padrão em outras casas

Já temos um procedimento repetível de fontes, preparação, manifesto, limites, verificação e pacote imutável. O adaptador visual ainda depende do formato desta casa e da fábrica atual. A padronização precisa substituir essas dependências por contratos explícitos antes de promover o piloto ao pipeline principal.

| Dependência atual | Adaptação necessária |
|---|---|
| Paredes e pisos por `house.children[0/1/2]` | Identificar meshes por papel explícito. A fábrica pode omitir malhas vazias e mudar a ordem em casas sem um dos pisos. |
| Máscara ligada à ordem de vértices e às caixas chanfradas de 132 vértices | Expor partes e slots de material na fábrica. A conferência atual detecta quantidade incompatível, mas uma mudança de ordem com igual quantidade pode passar. |
| Cama com cores e limiares de posição para distinguir partes | Identificar colchão, roupa, estrutura e pés por semântica. |
| Geometria própria só para o primeiro sofá | Definir aplicação por instância e tipo, sem depender da posição na coleção. |
| Cinco IDs fixos e calibração visual no código | Catálogo e perfis de acabamento com parâmetros documentados. Um sexto papel exige atualizar validadores, aplicação, UI e testes. |
| Um reboco e um tecido para a casa inteira | Perfis e escolhas por superfície ou ambiente, mantendo escala e limite do conjunto. |
| Extensão ligada a uma casa derivada | Gerenciar inicialização, troca de imóvel, propriedade e descarte de recursos compartilhados. |
| Evidência de uma fixture e de desktop | Comparar outras casas e concluir as cinco sessões em celulares físicos. |

Propomos realizar a evolução em cinco etapas: registrar perfis e catálogo; expor os papéis de superfícies e partes de móveis; integrar o adaptador ao pipeline mantendo Base como referência; validar casas com geometrias e pisos diferentes em celulares; e liberar o padrão após aceite visual e de desempenho. A seleção de casas deve incluir ausência de um tipo de piso, proporções de móveis diferentes e mais de um sofá.

Neutralizar cores de vértice nos móveis pressupõe que elas representam o tint do cadastro. Se um futuro catálogo armazenar iluminação baked nesse canal, será necessário separar iluminação e albedo antes de aplicar a mesma regra.

Não existe nesta versão um editor de materiais para o usuário, importação de modelos CGAxis, conversão de GLB ou biblioteca universal de móveis. O método melhora superfícies da geometria existente, com a exceção da substituição do primeiro sofá, que altera sua silhueta dentro das dimensões nominais. Outras alterações de forma, detalhes construtivos ou qualidade da luz deverão ter seus próprios limites e provas.

## 11 Procedimento para admitir um novo acabamento

1. Definir o uso e escolher uma fonte oficial com licença adequada. Registrar URL, data da consulta, autoria, papel, dimensões físicas e mapas disponíveis. Examinar o albedo real e seu padrão de repetição.
2. Preservar o inventário, originais, manifesto e evidências da geração aceita. Registrar o candidato e fixar URLs, bytes, MD5 e SHA-256 antes de trocar a fonte.
3. Usar um novo diretório pai, por exemplo `materiais-v3/assets` e `materiais-v3/originais`. O cache usa nomes por ID e papel; outra fonte no mesmo pai encontrará originais incompatíveis e será recusada.
4. Preparar com o ambiente registrado, definir os resultados esperados e conferir os três mapas. Alteração de encoder, resolução, qualidade ou escala também precisa de registro de geração. Esta atualização do inventário ainda é curada tecnicamente, sem comando pronto de importação.
5. Verificar e montar em saída nova. Comparar Base e Acabamentos na mesma câmera, perto e à distância, nos três modos. Conferir proporção, repetição, emendas, ferragens, restauração e resposta da iluminação.
6. Medir o pacote, requisições, quadros, memória quando disponível e abertura em condições registradas. Testar falha de um mapa e troca durante o carregamento. Registrar o aceite visual e os aparelhos utilizados.
7. Somente após o aceite, publicar no canal definido para a rodada e arquivar inventário, evidências, hashes, release e expiração. Um material aprovado para uma casa precisa de nova verificação quando muda a escala, geometria ou perfil de uso.

O registro de aceite deve conter: imóvel ou fixture; commit; geração; material e fornecedor; URL e licença; ambiente de preparação; hashes; escala; parâmetros de aplicação; bytes do conjunto; screenshots com câmera equivalente; testes e medições; aparelhos; pendências; responsável pelo aceite e data. Esse registro é o elo entre a escolha artística e a implementação técnica.

## 12 Diagnóstico de problemas comuns

Se Lisa e Texturizada parecem iguais, confirme o estado do controle, materiais carregados e falhas no snapshot; depois compare as capturas com a mesma câmera. Um grão muito fino, contraste baixo, escala inadequada ou luz frontal pode ocultar o relevo. A mudança precisa ser visível na distância normal de navegação, não apenas em ampliação extrema.

Se madeira ou tecido ficam escuros, verifique a multiplicação por `material.color` e por cores de vértice. Os grupos de albedo deste piloto removem o tint do cadastro. Preserve a informação de iluminação da casa quando adaptar o método; não elimine indiscriminadamente todas as cores de vértice.

Se o desenho estica ou muda de tamanho entre faces, confira UVs, escala do objeto e largura/altura físicas do patch. O bouclé não é quadrado. Se o relevo parece invertido, confira a convenção do normal e o espaço de cor; não aplique sRGB a mapas de dados.

Se parte do móvel não recebe textura, consulte `maskFallbacks` e a contagem de faces. Mudanças na fábrica podem invalidar a reconstrução da máscara. Corrija o contrato de partes antes de pintar todo o mesh. Se a geração recusa um hash, investigue o original, o cache e as versões do encoder; preserve a geração anterior.

Se a página demora ou perde fluidez, separe tempo de rede, decodificação, instalação dos materiais e quadros. Confira a quantidade de mapas e objetos compartilhados. Aumentar resolução pode piorar transferência e memória sem resolver escala errada, geometria básica ou iluminação insuficiente.

## Referências para manutenção

As fontes oficiais estão vinculadas nas seções 2 e 6. No projeto, consulte `assets.json` para os quinze registros completos; `SPEC.md` para o contrato; `README.md` para reprodução; `MATERIAIS-REAIS.md` para o resultado de 04/10; e `PUBLICACAO.md` para o preview. `PAREDES.md` preserva a tentativa procedural e explica por que foi substituída. Todos esses arquivos ficam em `experimentos/piloto-qualidade-visual-2026-10-04/`.

Os testes relevantes são `tests/test_piloto_visual_build.mjs`, `tests/test_piloto_visual_runtime.mjs` e `tests/test_piloto_visual_metricas.mjs`. A referência histórica deste guia é o commit `9508838`; atualizações do padrão devem registrar nova versão, implementação correspondente e evidências de aceite.
