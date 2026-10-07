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
