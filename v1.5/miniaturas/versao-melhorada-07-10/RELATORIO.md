# Miniatura v4 — relatório da versão melhorada (07/10/2026)

Imóvel: **Monte dos Cedros** (PREMIUM, padrão aprovado em 23/09). Comparação feita contra a
versão atual publicada (`padrao-atual/`, montada por `padrao_atual.py`), com o mesmo
instrumento de medição para as duas. Tudo o que mudou está em `versao-melhorada-07-10/`;
nada fora desta pasta foi alterado.

## Resumo

| | Versão atual | v4 |
|---|---:|---:|
| Bytes para abrir a maquete | 8,91 MB | **3,23 MB** (celular fraco: **1,51 MB**) |
| Bytes a mais ao entrar no apartamento | 6,87 MB | **3,57 MB** (celular fraco: **1,28 MB**) |
| Primeira imagem — computador / celular 4G / celular fraco | 0,6 / 0,8 / 3,4 s | **0,1 / 0,3 / 1,2 s** |
| Maquete com a luz calculada — computador / 4G / fraco | 4,7 / 11,3 / 51,3 s | **3,4 / 3,6 / 8,4 s** |
| Entrar na Planta 3D — computador / 4G / fraco | 9,4 / 16,6 / 46,1 s | **6,9 / 9,0 / 10,2 s** |
| Memória de vídeo com a maquete — computador / 4G / fraco | 113 / 83 / 83 MiB | **50 / 21 / 16 MiB** |
| Desenhos por segundo com a planta ou a visita paradas | 85–181 | **0** |
| CPU com a Planta 2D aberta, celular | 46–67% | **0–2%** |
| Servidor, 1.000 acessos/dia (40% entram no apartamento) | 262 GB/mês ≈ US$ 37,73 | **93 GB/mês ≈ US$ 12,31** |
| Gerar um imóvel novo (tempo de máquina) | ~7 min | ~10–11 min (≈ R$ 0,06 no próprio computador) |
| Visual no computador (perfil alto, 6 poses) | — | **44,8–47,8 dB** contra o aprovado: igual a olho nu |
| Visual no celular (perfil médio, 6 poses) | — | **38,8–46,2 dB** contra o aprovado para celular |

- **Mesmo desenho, mesma luz:** nada foi recalculado. A diferença medida pixel a pixel contra
  o padrão aprovado é de 0,2 a 1,0 nível de cor (de 255) em média.
- **Onde a qualidade cai, por escolha:** só no perfil **baixo** (celular fraco): luz em meia
  resolução, sem sombra em tempo real nas fachadas e na visita, 30 quadros por segundo.
- **O que saiu:** "Ver mapa" e a versão offline/duplo clique, como pedido. A página precisa
  de servidor (o Firebase de sempre).

## Como foi medido

- **Instrumento:** `medicoes/medir.mjs` abre a página num Chromium real e intercepta as
  chamadas WebGL: memória de cada buffer, textura e alvo de desenho, chamadas de desenho e
  triângulos. Nenhum número depende de a página "dizer" quanto gasta.
- **Servidor:** `medicoes/servidor.mjs` imita o Firebase Hosting (Brotli/gzip só para
  texto, os cabeçalhos de cache de cada versão, ETag/304). Bytes são os transferidos de fato,
  depois da compressão.
- **Perfis:** rede e CPU simuladas pelo próprio Chrome (DevTools Protocol):
  computador em Wi-Fi 50 Mbps; celular intermediário em 4G de 12 Mbps com CPU 4× mais lenta;
  celular fraco em "4G ruim" de 1,6 Mbps (o perfil *Slow 4G* do Lighthouse) com CPU 6× mais
  lenta. Três execuções por perfil, mediana. A v4 é medida no perfil de qualidade que um
  aparelho dessa classe recebe (alto, médio, baixo).
- **Primeira imagem:** na versão atual, o primeiro desenho 3D; na v4, a capa (a imagem do
  próprio visualizador) ou o primeiro desenho, o que vier antes.
- **Limite honesto:** o ambiente de medição não tem GPU. O Chrome desenha em software
  (SwiftShader), então **FPS absoluto não representa celular nenhum** e tempos de primeiro
  quadro ficam inflados pela compilação de shaders em CPU. Bytes, memória, chamadas de
  desenho, CPU parada e tempos de rede são comparáveis entre as versões. Para FPS real use
  `?perf=1` num celular (mostra quadros/s, perfil e resolução na tela).

## Resultados

### Abertura e transferência (mediana de 3 execuções por perfil)

| Perfil | | Versão atual | v4 | Ganho |
|---|---|---:|---:|---:|
| Computador (Wi-Fi 50 Mbps) | Primeira imagem da maquete | 0,6 s | 0,1 s | 6,3× |
|  | Maquete com a luz calculada | 4,7 s | 3,4 s | 1,4× |
|  | Bytes para abrir | 8,91 MB | 3,23 MB | 2,8× |
|  | Entrar na Planta 3D (clique → luz interna) | 9,4 s | 6,9 s | 1,4× |
|  | Bytes a mais na Planta 3D | 6,87 MB | 3,57 MB | 1,9× |
|  | Revisita (cache): luz pronta | 4,1 s | 3,0 s | 1,4× |
| Celular intermediário (4G 12 Mbps, CPU 4× mais lenta) | Primeira imagem da maquete | 0,8 s | 0,3 s | 2,7× |
|  | Maquete com a luz calculada | 11,3 s | 3,6 s | 3,1× |
|  | Bytes para abrir | 8,91 MB | 3,23 MB | 2,8× |
|  | Entrar na Planta 3D (clique → luz interna) | 16,6 s | 9,0 s | 1,8× |
|  | Bytes a mais na Planta 3D | 6,87 MB | 3,57 MB | 1,9× |
|  | Revisita (cache): luz pronta | 6,9 s | 3,0 s | 2,3× |
| Celular fraco (4G ruim 1,6 Mbps, CPU 6× mais lenta) | Primeira imagem da maquete | 3,4 s | 1,2 s | 2,9× |
|  | Maquete com a luz calculada | 51,3 s | 8,4 s | 6,1× |
|  | Bytes para abrir | 8,91 MB | 1,51 MB | 5,9× |
|  | Entrar na Planta 3D (clique → luz interna) | 46,1 s | 10,2 s | 4,5× |
|  | Bytes a mais na Planta 3D | 6,87 MB | 1,28 MB | 5,4× |
|  | Revisita (cache): luz pronta | 9,3 s | 3,2 s | 2,9× |

### Memória e trabalho parado (execução mediana)

| Perfil | | Versão atual | v4 |
|---|---|---:|---:|
| Computador | GPU com a maquete aberta | 113 MiB | 50 MiB |
|  | GPU depois de abrir todos os modos | 140 MiB | 65 MiB |
|  | …dos quais texturas | 101 MiB | 28 MiB |
|  | Memória JavaScript ao abrir | 23 MiB | 6 MiB |
|  | Planta 3D parada: desenhos/s | 94 | 0 |
|  | Visita parada: desenhos/s | 85 | 0 |
|  | Planta 2D parada: CPU | 10% | 0% |
| Celular intermediário | GPU com a maquete aberta | 83 MiB | 21 MiB |
|  | GPU depois de abrir todos os modos | 111 MiB | 38 MiB |
|  | …dos quais texturas | 89 MiB | 19 MiB |
|  | Memória JavaScript ao abrir | 17 MiB | 7 MiB |
|  | Planta 3D parada: desenhos/s | 137 | 0 |
|  | Visita parada: desenhos/s | 107 | 0 |
|  | Planta 2D parada: CPU | 46% | 2% |
| Celular fraco | GPU com a maquete aberta | 83 MiB | 16 MiB |
|  | GPU depois de abrir todos os modos | 110 MiB | 29 MiB |
|  | …dos quais texturas | 89 MiB | 12 MiB |
|  | Memória JavaScript ao abrir | 15 MiB | 7 MiB |
|  | Planta 3D parada: desenhos/s | 181 | 0 |
|  | Visita parada: desenhos/s | 123 | 0 |
|  | Planta 2D parada: CPU | 67% | 0% |

### Qualidade visual: v4 contra a versão atual, mesmas poses de câmera

PSNR (quanto maior, mais parecido; acima de ~40 dB a diferença não se percebe) e a fração de pixels que mudou mais de 8 níveis (de 255).

| Pose | Alto × atual no computador | Médio × atual no celular | Médio com luz em meia resolução × atual no celular | Baixo × atual no computador (sem MSAA, luz em meia resolução) |
|---|---:|---:|---:|---:|
| maquete | 47,6 dB · 0,3% | 43,2 dB · 1,1% | 38,0 dB · 3,5% | 30,3 dB · 6,4% |
| maquete-fundos | 47,8 dB · 0,5% | 42,3 dB · 1,6% | 36,9 dB · 4,8% | 30,3 dB · 7,3% |
| conjunto | 45,0 dB · 0,6% | 41,0 dB · 1,6% | 39,5 dB · 2,2% | 28,3 dB · 10,0% |
| planta3d | 45,4 dB · 0,3% | 38,8 dB · 1,5% | 37,3 dB · 1,8% | 31,4 dB · 3,1% |
| visita-sala | 44,9 dB · 0,9% | 44,0 dB · 0,7% | 36,4 dB · 3,6% | 32,8 dB · 9,3% |
| visita-teto | 44,8 dB · 1,1% | 46,2 dB · 0,4% | 39,9 dB · 1,8% | 33,0 dB · 6,9% |

A imagem lado a lado (versão atual, v4 e a diferença ampliada 6 vezes, nas poses acima) sai de `node medicoes/comparar.mjs --q alto` seguido de `python medicoes/montagem.py`, em `medicoes/resultados/comparacao-alto.webp`. Imagens não são versionadas fora das pastas classificadas em `tests/test_dados_privados.py`.

### O que explica os números

- **Bytes para abrir (−64% a −83%):** o atlas de luz externo saiu de 7,0 MB (RGBM, 4096²)
  para 2,4 MB (UASTC, 2048×1672) ou 0,7 MB (meia resolução, perfil baixo); as UVs de luz do
  exterior, de 1,33 MB (JSON comprimido) para 0,22 MB (binário indexado com diferenças); o
  HTML de 3,4 MB com tudo embutido virou 25 KB, com o resto em arquivos cacheáveis.
- **Luz pronta muito mais cedo no celular:** além de baixar menos, a página deixou de fazer
  `JSON.parse` de 15,7 MB e milhões de `push` para montar a malha; agora copia arrays
  tipados. A textura chega comprimida e é transcodificada em Web Workers.
- **Planta 3D:** o pacote do interior (código, móveis, atlas do Unreal) só desce quando
  alguém pede o apartamento — o tempo de abrir a página não paga por quem nunca entra. Na
  entrada, o bake de oclusão em JavaScript, que era calculado e depois descartado quando a
  luz do Cycles chegava (6,5 s no computador), ficou só de reserva.
- **Memória de GPU (−56% a −81%):** texturas comprimidas na GPU (1 byte por texel), atlas
  externo com 1/5 dos texels, e a geometria instanciada que sai de cena agora é liberada.
- **Parado não gasta:** sem toque e sem animação, a v4 não desenha (planta 3D, visita, planta
  2D). A versão atual rodava o laço de desenho a cada quadro da tela em qualquer modo, parada
  ou não, e refazia o SVG da Planta 2D a cada quadro. Na maquete, que gira sozinha, o giro ocioso roda a 30 quadros nos
  perfis médio e baixo, e o mapa de sombra não é refeito a cada quadro.

## Custo de servidor (Firebase Hosting)

Premissas (todas ajustáveis em `node medicoes/custos.mjs`): 1.000 acessos por dia; mistura
30% computador / 50% celular intermediário / 20% celular fraco; 25% dos acessos são
revisitas com cache; preço do Hosting: 360 MB/dia sem custo, depois US$ 0,15/GB
([tabela do Firebase](https://firebase.google.com/pricing)); dólar a R$ 5,40. **A franquia
gratuita é do projeto inteiro** (mapa, painel e miniaturas dividem os mesmos 360 MB/dia).

### 1.000 acessos por dia

| Cenário | | MB por acesso | GB/dia | GB/mês | Custo/mês (franquia gratuita aplicada) | Sem franquia |
|---|---|---:|---:|---:|---:|---:|
| Só o prédio | atual | 6,68 | 6,68 | 200,5 | US$ 28,46 (R$ 153,69) | US$ 30,08 |
|  | v4 | 2,16 | 2,16 | 64,9 | US$ 8,11 (R$ 43,78) | US$ 9,73 |
| 40% abrem a planta/visita | atual | 8,74 | 8,74 | 262,3 | US$ 37,73 (R$ 203,75) | US$ 39,35 |
|  | v4 | 3,10 | 3,10 | 92,9 | US$ 12,31 (R$ 66,46) | US$ 13,93 |
| Todos abrem a planta/visita | atual | 11,84 | 11,84 | 355,1 | US$ 51,64 (R$ 278,85) | US$ 53,26 |
|  | v4 | 4,50 | 4,50 | 134,9 | US$ 18,61 (R$ 100,49) | US$ 20,23 |

| Acessos/dia | Versão atual | v4 |
|---:|---:|---:|
| 1.000 | US$ 37,73/mês | US$ 12,31/mês |
| 10.000 | US$ 391,90/mês | US$ 137,66/mês |
| 100.000 | US$ 3.933,54/mês | US$ 1.391,20/mês |

A franquia gratuita (360 MB/dia) acaba em **41 acessos/dia** na versão atual e em **116 acessos/dia** na v4 (cenário padrão).

Observação: o estudo de 22/09 (`relatorios/estudo-peso-miniaturas-2026-09-22.md`) estimou
0,7 MB por abertura, mas foi feito **antes** da luz calculada. A versão publicada hoje
transfere 8,9 MB para abrir e mais 6,9 MB para quem entra no apartamento.

## Custo para gerar cada imóvel

Tempo de máquina de um imóvel PREMIUM, do modelo à página (tempos registrados no próprio
repositório, mais os medidos aqui):

| Etapa | Ferramenta | Tempo |
|---|---|---:|
| Modelo do exterior (gerador LEVE) | Blender 5.2.2 | ~1–10 s (Mirante 7: 0,8 s + 7,4 s de render) |
| UV de luz | xatlas | 9 s (`unwrap.json`: 7,2 + 1,8) |
| Bake da luz (interior 2048² × 512 amostras; exterior 4096² × 128) | Cycles | 357 s (`bake.json`: 305 + 52) |
| Denoise | OIDN | ~5 s |
| Codificação RGBM (padrão atual) | Python | segundos |
| **v4:** reempacotamento + binários + 4 atlas UASTC | Python + Node | 97 s (4 núcleos) |
| **v4:** capa | Chrome | ~60 s sem GPU; poucos segundos com GPU |
| **v4:** montagem do site | Node/esbuild | ~3 s |
| QA automático (fumaça) | Chrome | ~1 min |
| **Total de máquina** | | **~10–11 min** |

| Onde roda | Conta | Custo por imóvel |
|---|---|---:|
| Computador próprio | ~300 W × 11 min ≈ 0,055 kWh × R$ 1,10/kWh (tarifa média 2026 com impostos) | **≈ R$ 0,06** |
| Nuvem com GPU (AWS g4dn.xlarge, US$ 0,526/h) | 11 min | **≈ US$ 0,10 ≈ R$ 0,52** |
| Armazenamento no Hosting | ~8,9 MB próprios do imóvel (os dois tamanhos de luz, capas, dados); three.js e o transcodificador (1,3 MB) são compartilhados | 10 GB gratuitos ≈ **1.100 imóveis**; depois US$ 0,026/GB/mês ≈ R$ 0,001/mês por imóvel. O Hosting também guarda versões anteriores publicadas: limitar o histórico se o espaço apertar. |

**O que não está nessa conta, e domina:** o tempo de pessoa/assistente para interpretar a
planta, modelar, mobiliar e revisar. A única medição no repositório é o ensaio Mirante 7
(`experimentos/mirante-7-2026-09-22/ESTUDO.md`): **12 min** de produção assistida até a
conferência local (LEVE, sem bake). O custo é `minutos × custo por minuto`: por exemplo, a
R$ 60/h de uma pessoa, 12 min ≈ R$ 12; num plano de assistente por assinatura, o custo
marginal é próximo de zero até o limite do plano. A fábrica (`tasks/miniaturas/fabrica.md`)
prevê medir isso por imóvel no lote piloto (M5).

## As técnicas da lista, uma a uma

Legenda: ✅ **aplicada na v4** · ♻️ **já existia** no aprovado (mantida) · ➖ **não se aplica** a esta cena · ⏭️ **fica para depois** (com o motivo).

### 1. Renderização (GPU)

| Técnica | Situação | O que foi feito / por quê |
|---|---|---|
| Level of Detail (LOD) | ➖ | A câmera fica sempre a uma distância parecida do prédio (a órbita enquadra a maquete), e o exterior tem 122 mil triângulos. O custo medido está em pixels, sombras e memória de textura, não em geometria. Para textura há LOD: mipmaps e atlas de meia resolução no perfil baixo. |
| Occlusion Culling | ➖ | Um prédio, de fora; ou um apartamento de 6 cômodos, por dentro. Não há o que esconder atrás de quê em quantidade que pague o teste. |
| Frustum Culling | ♻️ | O three.js já descarta por objeto o que está fora da câmera (móveis e cômodos na visita). |
| Backface Culling | ♻️ | Ligado em todo material de face única. Os de dupla face (cortinas, forro, móveis do estudo v2) continuam assim: tirar abriria buracos visíveis. |
| Texture Atlasing | ✅ | A luz já vinha em atlas. Na v4 o atlas externo foi **reempacotado**: das 48.873 ilhas de UV só 11.806 recebem luz (o resto são faces escondidas, que o Cycles devolve preto). As iluminadas foram copiadas texel a texel, mesma densidade, para 2048×1672: **80% menos texels**, imagem igual. |
| Texture Compression (ASTC/ETC2/BC) | ✅ | Lightmaps em **KTX2 / Basis UASTC** (supercompressão Zstandard). O navegador transcodifica para ASTC 4×4 (iPhone e Android recentes), BC7 (computador) ou ETC2 (qualquer Android com WebGL2): 1 byte por texel na GPU (ETC2: meio) em vez de 4. Erro medido: 0,5–0,6 código de cor em média, 5–7 no percentil 99. ETC1S foi testado e descartado (erro p99 de 16–30 códigos, manchas em degradê). |
| Mipmapping | ✅ | Os atlas trazem a cadeia completa de mipmaps (gerada no codificador). Usada nos perfis médio e baixo; o alto amostra sem mipmap, como o aprovado, e descarta os níveis antes de enviar à GPU. As texturas procedurais já tinham mipmaps. |
| Normal / Bump mapping | ♻️ | Reboco, concreto, madeira e tecido já usam relevo/normal procedural. |
| Baked Lighting / Lightmaps | ♻️ ✅ | É o coração do padrão aprovado (Cycles + OIDN). A v4 não recalcula nada: entrega a mesma luz em menos da metade dos bytes e cerca de 1/4 da memória de textura, e a decodifica no shader (escala logarítmica em vez do RGBM, que não aceitava compressão). |
| Sombras otimizadas | ✅ | **Mapa de sombra em cache**: o sol não se move em relação ao prédio, então a sombra é desenhada uma vez e reaproveitada; só é refeita quando algo que projeta muda (modo, conjunto, móvel, interruptor). Antes era refeita a cada quadro. Tamanho por perfil (2048/1024/1024), filtro PCF suave só onde vale, e no perfil baixo as fachadas com luz calculada não amostram sombra (a sombra delas já está no lightmap). |
| GPU Instancing | ♻️ | As peças do Blender (andares, janelas) já eram InstancedMesh. |
| Static / Dynamic Batching | ♻️ ✅ | O exterior com luz já era agrupado por material (64 malhas). Na v4 essas malhas ficaram **indexadas** (vértices repetidos fundidos: −33% de vértices) e montadas com arrays tipados. |
| Shaders simplificados | ✅ | No perfil baixo: sem amostragem de sombra nas fachadas, PCF simples, sem sombras nas luzes da visita. O resto dos materiais fica igual (é o visual aprovado). |
| Forward Rendering | ♻️ | O WebGLRenderer do three.js é forward: o adequado para celular (GPU por blocos). |
| Dynamic Resolution Scaling | ✅ | Governador de resolução: mede a mediana do intervalo entre quadros durante animação e ajusta o DPR (−15% quando passa da meta, +8% com folga), entre o teto e o piso do perfil. |
| Upscaling (FSR etc.) | ⏭️ | Com a resolução dinâmica o navegador já escala o canvas (bilinear). Um passo de reconstrução/nitidez (tipo FSR 1) custa uma passada de tela cheia a mais; só vale depois de medir em celular real. |
| Anti-aliasing leve | ✅ | MSAA 4× no perfil alto (computadores e celulares topo de linha, cuja GPU por blocos o resolve quase de graça). Médio/baixo sem AA, como o aprovado para celular. FXAA/SMAA não entrou: borraria as linhas finas das esquadrias. |
| Impostors / Billboards | ✅ | A **capa**: uma imagem do próprio visualizador na pose de abertura (28 KB) aparece antes de qualquer 3D e é trocada pelo 3D quando a luz chega, sem salto. |
| Portal / Room Culling | ➖ | 6 cômodos; o three.js já descarta o que está fora do campo de visão. |

### 2. Geometria e modelos

| Técnica | Situação | O que foi feito / por quê |
|---|---|---|
| Low-poly + boas texturas | ♻️ | O modelo já é procedural e enxuto. |
| Simplificação de malha | ✅ | Fusão de vértices idênticos no exterior (367.380 → 244.962). Decimação de verdade exigiria refazer o unwrap e o bake: fora do escopo sem reaprovação visual. |
| Remover vértices/faces desnecessárias | ⏭️ | As faces sem luz (as ilhas apagadas) poderiam sair da malha, mas algumas são visíveis por baixo (a câmera passa do horizonte). Precisa de validação visual antes. |
| Occlusion portals / occluders | ➖ | — |
| Hierarquia de LODs | ➖ | — |

### 3. Memória e assets

| Técnica | Situação | O que foi feito / por quê |
|---|---|---|
| Texture Streaming | ✅ | Resolução da luz por perfil (cheia ou metade) e por modo: a luz interna só desce quando alguém entra no apartamento. A capa é o primeiro estágio. |
| Asset Bundles / Addressables | ✅ | Código dividido (núcleo 87 KB, carregador de luz 55 KB, interior 44 KB, sob demanda), cada arquivo com hash no nome e cache imutável de 1 ano; three.js e o transcodificador em `lib/` são **compartilhados por todos os imóveis**. |
| Object Pooling | ➖ ✅ | Quase nada é criado e destruído durante o uso. O que havia de lixo por quadro (arrays e chaves de texto montados a cada quadro para detectar mudança de móvel) foi trocado por aviso do editor. |
| Compressão de áudio | ➖ | Não há áudio. |
| Orçamento de memória por aparelho | ✅ | Perfis com resolução de luz e de sombra próprias; memória de GPU medida em cada perfil (ver números). |
| Carregamento assíncrono | ✅ | Tudo assíncrono: binários descompactados pelo navegador (`DecompressionStream`), KTX2 transcodificado em Web Workers, shaders compilados em paralelo (`compileAsync` + `KHR_parallel_shader_compile`) antes da troca de material. Pré-carga (`preload`/`modulepreload`) de tudo que a primeira imagem precisa, já no HTML. |
| Descarte agressivo | ✅ | A geometria instanciada substituída pela versão com luz agora é liberada da GPU (no aprovado ela ficava alocada). |

### 4. CPU e lógica

| Técnica | Situação | O que foi feito / por quê |
|---|---|---|
| Multithreading / jobs | ✅ | Transcodificação de textura em Web Workers. A montagem das malhas, que era o gargalo (milhões de `push` em JSON), virou cópia de arrays tipados: milissegundos, sem precisar de worker. |
| Evitar alocações (GC) | ✅ | Ver "Object Pooling". |
| Spatial Partitioning | ➖ | A colisão da visita testa ~30 paredes e ~16 caixas de móvel: partição custaria mais que o teste. |
| Física simplificada | ♻️ | Não há motor de física; colisão por segmento e caixa. |
| Colisões otimizadas | ♻️ | Idem. |
| Código perfilado (hot paths) | ✅ | Medidor próprio (WebGL interceptado). Achados corrigidos: JSON de 15,7 MB na abertura; Planta 2D refazendo o SVG a cada quadro (46–69% da CPU do celular parado). |
| Atualização em taxas diferentes | ✅ | Quadro sob demanda: parado, não desenha; giro ocioso a 30 quadros (médio/baixo); sombra só quando muda; governador por janela de 1,5 s. |

### 5. Qualidade adaptativa

| Técnica | Situação | O que foi feito / por quê |
|---|---|---|
| Scalability settings | ✅ | Três perfis (alto/médio/baixo) que mudam MSAA, resolução, sombras, resolução da luz e teto de quadros. |
| Detecção de aquecimento | ✅ (indireta) | O navegador não informa temperatura. O estrangulamento térmico aparece como quadro mais lento, e é isso que o governador mede: baixa a resolução e, se no piso ainda não segura, passa ao perfil de baixo na hora e grava para a próxima visita. O teto de quadros reduz o aquecimento na origem. |
| Presets por faixa de aparelho | ✅ | Palpite pela GPU (Adreno/Mali/Apple/PowerVR, NVIDIA/AMD/Intel), toque, memória e núcleos; `?q=` força. |
| Frame rate target dinâmico | ✅ | 60 interagindo; 30 no giro ocioso (médio/baixo); 30 sempre no baixo. |

### 6. Outras

| Técnica | Situação | O que foi feito / por quê |
|---|---|---|
| Occlusion queries | ➖ | — |
| Compute shaders | ➖ | WebGL2 não tem. Ver WebGPU abaixo. |
| Otimização por plataforma (Metal/Vulkan) | ✅ | O navegador fala com Metal/Vulkan/D3D; a v4 escolhe o formato de textura nativo de cada plataforma (ASTC no iOS, BC7 no computador, ETC2 no Android antigo). |
| Redução de overdraw | ✅ | O maior "overdraw" era redesenhar a mesma imagem 60 vezes por segundo sem nada mudar: acabou. A Planta 2D não aciona mais o 3D. |
| Early-Z | ♻️ | O three.js já ordena os opacos de frente para trás. |
| Compressão de animação / skinning | ➖ | Não há animação esquelética. |
| GPU-driven rendering | ➖ | Não existe em WebGL2. |

## O que mudou, arquivo por arquivo

| Arquivo | Mudança |
|---|---|
| `fonte/miniatura.js` | O visualizador aprovado com: quadro sob demanda, sombra em cache, perfil e resolução dinâmica, interior sob demanda, dados binários, luz KTX2, capa, sem "Ver mapa". Os comentários originais foram mantidos; cada mudança tem nota "v4". |
| `fonte/qualidade.js` | Novo: perfis alto/médio/baixo, palpite pela GPU, governador de resolução. |
| `fonte/luz.js` | Novo: carregamento KTX2 (em pedaço separado) e decodificação logarítmica no shader. |
| `fonte/binario.js` | Novo: leitor do formato MBN1 (arrays tipados em gzip, com diferenças). |
| `fonte/interior/*.js`, `fonte/mapa-geometria.js` | Os módulos do renderizador do padrão aprovado, **sem alteração**. |
| `fonte/pagina.html` | O HTML/CSS aprovado sem o "Ver mapa"/cortina, com a capa e a pré-carga. |
| `gerador/` | `derivar.py` (luz e binários, com cache), `luz.py` (reempacotamento, push-pull, codificação), `binario.py`, `codificar_ktx2.mjs`, `decodificar_ktx2.mjs`, `montar.mjs`, `capa.mjs`. |
| `derivados/monte-dos-cedros-37/` | Saída da derivação: 3,2 MB versionados, `relatorio.json` com o erro medido da compressão e `conferencia.json` com o SHA-256 de cada saída. Os dois atlas de resolução cheia (5,6 MB) passam de 1 MiB e ficam fora do git pela trava de tamanho do repositório; a codificação é determinística e o `derivar.py` os refaz idênticos em ~1 min. |
| `medicoes/` | Medidor, servidor, comparação visual, fumaça, custos, tabelas e os resultados em JSON. |

## Decisões e limites

- **three.js continua na r168**, a mesma do padrão aprovado. A r186 removeu o
  `PCFSoftShadowMap` (as sombras mudariam) e não traz ganho medível para esta cena; a troca
  fica para quando houver reaprovação visual.
- **WebGPU não entrou.** Os ajustes de luz do padrão são trechos de shader GLSL
  (`onBeforeCompile`), que o renderizador WebGPU do three não aceita: seria reescrever a
  iluminação em TSL. O gargalo medido não é o número de chamadas de desenho (onde o WebGPU
  ajuda), e o WebGL2 abre em praticamente todo navegador de celular.
- **A luz não foi recalculada.** O bake aprovado é o mesmo; o atlas externo foi só
  reempacotado (cópia texel a texel, mesma densidade).
- **Celular de verdade:** não foi possível testar aqui. O palpite de perfil é uma tabela
  de GPUs; o governador corrige em uso e grava o perfil de baixo se o aparelho não segurar.
  O próximo passo é abrir `?perf=1` em 2–3 celulares e ajustar a tabela.
- **Mipmap no atlas reempacotado:** com 4 texels de margem, de longe os níveis menores
  misturam um pouco ilhas vizinhas; o preenchimento push-pull evita borda preta. O perfil
  alto amostra sem mipmap, como o aprovado.
- **Colinas e Castanheiras** continuam na versão anterior (como no padrão atual); o gerador
  da v4 serve a qualquer imóvel PREMIUM com luz calculada.

## Próximos passos sugeridos

1. Testar em 2–3 celulares reais com `?perf=1` e calibrar a tabela de GPUs.
2. Publicar num canal de pré-visualização (`LEIA-ME.md`) e medir com a URL pública.
3. Avaliar remover da malha as faces nunca iluminadas (as ~37 mil ilhas apagadas), com
   conferência visual por baixo da maquete.
4. Converter Colinas e Castanheiras quando tiverem luz calculada.
