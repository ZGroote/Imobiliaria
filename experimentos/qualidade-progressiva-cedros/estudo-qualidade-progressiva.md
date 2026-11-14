# Estudo de qualidade progressiva — Cedros

Data: 27/09/2026. **Primeira entrega, anterior ao protótipo.** Inspeção local dos artefatos e código. Não houve alteração de produção, montagem de builds, deploy ou implementação de botão. LEVE e PREMIUM foram preservados.

## Referências e limite de escopo

- **LEVE provisório:** `v1.5/miniaturas/publicado/maquete-monte-dos-cedros-37.html`, 3.361.828 bytes. É o artefato anterior descrito no estudo de peso de 22/09. Não há documentação local nomeando explicitamente esse artefato como “LEVE”. A confirmação dessa referência foi solicitada ao usuário; os resultados abaixo identificam a hipótese, sem promover o arquivo a padrão canônico.
- **PREMIUM:** `v1.5/miniaturas/publicado-atual/maquete-monte-dos-cedros-37.html` e os quatro recursos referenciados pelo HTML, release `62549ac12936f290`. Fontes aprovadas em `v1.5/miniaturas/padrao-atual/`.
- **Controle adicional:** `padrao-atual/anterior/v2.html`. Esse template contém o acabamento V2 e é a entrada do montador PREMIUM, mas não é automaticamente o LEVE do usuário.

O escopo principal é abrir diretamente a mesma unidade e acessar os modos exterior/interior. Não soma galeria, miniaturas estáticas, downloads GLB/Blender, HTML offline, QA ou cenas de bake à carga online. Esses arquivos e fontes têm inventário complementar com SHA-256 em `fontes-e-exclusoes.csv`. Somar HTML offline e recursos online duplicaria o mesmo conteúdo. A pasta publicada contém diretórios de releases antigos vazios: a seleção usa as referências reais do HTML, não uma soma recursiva de pastas.

## Tabela solicitada — bytes locais, sem compressão HTTP adicional

| Categoria | LEVE | PREMIUM | Comum | Só PREMIUM |
|---|---:|---:|---:|---:|
| runtime | 920.793 | 956.896 | 14.047 | 942.849 |
| geometria | 2.261.912 | 2.261.912 | 2.261.912 | 0 |
| texturas | 0 | 0 | 0 | 0 |
| UV / remapeamento / correções | 0 | 22.450.367 | 0 | 22.450.367 |
| lightmaps | 128.700 | 13.531.355 | 128.700 | 13.402.655 |
| materiais/dados | 29.550 | 29.830 | 29.550 | 280 |
| outros | 20.873 | 21.275 | 0 | 21.275 |
| **TOTAL** | **3.361.828** | **39.251.635** | **2.434.209** | **36.817.426** |

**Dos 37,433 MiB do PREMIUM, pelo menos 2,321 MiB (6,202%) são conteúdos embutidos idênticos ao LEVE provisório; 35,112 MiB são o delta conservador por conteúdo, ainda não o pacote mínimo necessário para um upgrade funcional.**

As medidas pedidas, nesta decomposição, são `peso_LEVE = 3.361.828`, `peso_PREMIUM = 39.251.635`, `bytes_comuns = 2.434.209`, `bytes_exclusivos_PREMIUM = delta_PREMIUM = 36.817.426`, `percentual_compartilhavel = 0,062015480374257015`. MiB = 1.048.576 bytes.

**Interpretação necessária:** não existe um pacote incremental pronto de 35,112 MiB. A coluna “Só PREMIUM” significa “sem correspondência exata nas fatias auditadas”; inclui código semanticamente reutilizável com serialização diferente. Portanto ela é um limite conservador, não uma justificativa para baixar todo esse conteúdo no upgrade. O mínimo funcional exige fechar a comparação das malhas geradas em runtime e definir a referência LEVE.

### Como os bytes foram contabilizados

1. No nível de **arquivos completos**, nenhum dos cinco arquivos PREMIUM tem SHA-256 igual ao HTML LEVE. Assim, `bytes_comuns_arquivos = 0` e `bytes_exclusivos_PREMIUM_arquivos = 39.251.635`. Isso mede reaproveitamento dos arquivos atuais sem reempacotar, não a arquitetura possível.
2. A tabela acima abre o HTML em fatias disjuntas: corpos de scripts, JSONs embutidos e envelopes HTML/CSS. Separa também o literal `CASTANHEIRAS_BLENDER` dentro do programa principal. Cada fatia tem intervalo de bytes e SHA-256 em `conteudos-embutidos.csv`. A soma reconstrói exatamente o tamanho original; não há dupla contagem. Igualdade depende de conteúdo, nunca do nome.
3. Fatias idênticas são um **mínimo comprovado**; não se procurou o maior delta binário possível dentro de cada programa. No Three.js, o LEVE tem 678.588 bytes e o PREMIUM 682.425. Os hashes brutos diferem, mas o SHA-256 fica igual após converter CRLF para LF. Essa equivalência transformável está em `runtime.json` e não foi inflada na coluna comum exata.
4. A linha geometria contém o catálogo `__moveis` e o objeto `CASTANHEIRAS_BLENDER`, incluindo metadados e materiais desses recipientes. Não mede só buffers de posição. A igualdade desses dados não implica igualdade das malhas finais criadas pelo programa.
5. Texturas = zero significa **nenhum arquivo de textura independente adicional nesse escopo**. Existem texturas procedurais geradas em Canvas e conteúdo embutido. O código gerador está contado em runtime ou materiais/dados. `__luzue` foi contado integralmente como lightmap legado, incluindo metadados/base64; não como pixels GPU.
6. UV inclui o JSON de remapeamento, grupos, contagens e correções de geometria, não só coordenadas UV. A separação abaixo mede o custo específico de `uv1`.

Usando o **template V2** como controle, o conjunto-base pesa 3.380.905 bytes; o mínimo de fatias comuns sobe para 3.242.948 bytes e o residual cai para 36.008.687 bytes. Não substituir silenciosamente a referência LEVE por esse controle: V2 já troca móveis, materiais e navegação.

## Inventário dos arquivos carregáveis

Os hashes completos, função, presença nos dois padrões, regenerabilidade e necessidade antes do primeiro frame estão em `inventario-arquivos.csv`. O primeiro frame básico não aguarda os atlas; o modo com iluminação calculada depende deles. Isso é leitura do código, não medição de timestamps.

| Recurso | Bytes | Função |
|---|---:|---|
| LEVE: HTML Cedros | 3.361.828 | Programa, geometria, dados e recursos embutidos |
| PREMIUM: HTML Cedros | 3.398.613 | Programa/base + acabamento V2 + hooks V3 |
| exterior-uv.json | 15.765.284 | Remapeamento por instância, UV1 e grupos |
| interior-uv.json | 6.685.083 | Remapeamento, UV1 e correções |
| exterior-luz.rgbm.gz | 7.031.755 | Atlas RGBM 4096² |
| interior-luz.rgbm.gz | 6.370.900 | Atlas RGBM 2048² |

Os quatro recursos externos somam **35.853.022 bytes (34,192 MiB)**, dos quais **13.402.655 bytes** são atlas. Não incluem a diferença do código V2/V3. Os hashes dos recursos publicados coincidem com as fontes canônicas; todos os hashes listados no manifesto de release foram conferidos.

### Rede: estimativa separada de medição

Com `gzip.compress(..., mtime=0)` local, sem recomprimir os `.gz`, HTML+recursos seriam **677.077 bytes para LEVE** e **17.792.870 bytes para PREMIUM completo**. Os quatro recursos externos totalizam **17.106.223 bytes** nessa simulação: UV externo 2.860.708; UV interno 842.860; atlas externo 7.031.755; atlas interno 6.370.900.

Esses números **não são tráfego HTTP observado**: dependem da configuração do servidor, cache, cabeçalhos, protocolo e modos usados. Não representam bytes até o primeiro frame. O PREMIUM já adia o atlas interno até planta/visita; não é correto dizer que toda a carga de ambos os modos bloqueia a abertura exterior. O estudo anterior de 22/09 mediu 673.852 bytes HTTP para o LEVE; é evidência histórica, não uma nova medição nem discrepância a esconder.

## Geometria e UV

| Questão | Evidência / classificação |
|---|---|
| Dados embutidos do prédio e catálogo | **IDÊNTICO** por SHA-256 das fatias; o objeto exportado contém 35 geometrias-base |
| Biblioteca Three.js | **TRANSFORMÁVEL** por normalização exclusiva de quebras de linha; o conteúdo normalizado é idêntico |
| Interior LEVE → acabamento V2 | **DIFERENTE**: V2 intercepta `FURN.geoDoMovel`, substitui sofá/cama por volumes arredondados, adiciona detalhes e sombras de contato, refaz UVs e materiais dos demais móveis |
| Base V2 → bake interior | **TRANSFORMÁVEL**: remapeia vértices, altera uma posição de malha e 50 matrizes; troca buffers mantendo o objeto nos casos não instanciados |
| Exterior → bake | **TRANSFORMÁVEL**: expande 282 instâncias em buffers e reagrupa por 64 slots; substitui `InstancedMesh` por `Mesh` |
| Mesma topologia e contagem final? | **Não**: remapeamento desindexa e expande instâncias. Igualdade do literal de origem não cobre essa transformação |
| Mesmas posições? | Não em toda a cena: móveis V2, correções de batentes/molduras e base de apresentação mudam |
| Objetos apenas no PREMIUM? | Sim: acabamento V2, suporte de apresentação, luzes/controles internos. O inventário exato de objetos vivos LEVE × PREMIUM ainda precisa de captura de runtime |
| Troca sem reconstrução total? | O código existente modifica/substitui malhas em cena e mantém câmera. Isso evidencia possibilidade, mas não comprova sobrevivência de seleção/referências em upgrade manual |
| `geometry-compact.json` como base comum? | Não isoladamente: ele depende de buffers originais, slots, instâncias e `sourceVertexCount`; não é uma malha completa autossuficiente |

| Medida | Interior | Exterior |
|---|---:|---:|
| Registros de remapeamento | 84 | 282 |
| Slots originais únicos | 84 | 64 |
| Vértices de origem somados por slot | 145.010 | 47.560 |
| Vértices finais desindexados | 153.606 | 367.380 |
| Índices no `BufferGeometry` final | 0 | 0 |
| UV1 Float32, só buffer | 1.228.848 bytes | 2.939.040 bytes |
| Custo serializado de adicionar campo UV1 | 5.799.375 bytes | 14.161.316 bytes |
| Restante do compacto sem UV1 | 885.708 bytes | 1.603.968 bytes |
| Registros com posição corrigida | 1 | 0 |
| Registros com matriz corrigida | 50 | 0 |

As contagens são dos **registros de bake**, não de toda a cena nem do LEVE vivo. Para cada registro verificou-se: objeto existe na fonte do bake; contagem de posições confere; índice está no intervalo; há dois componentes UV por vértice final. A serialização compacta foi reconstruída byte a byte antes de remover UV1 e calcular sua contribuição exata. A posição corrigida carrega 3.672 componentes Float32, 14.688 bytes em buffer.

O LEVE possui UVs para texturas e mecanismos anteriores de iluminação; isso **não os torna compatíveis com o atlas xatlas PREMIUM**. O PREMIUM usa `uv1` e `map.channel = 1`. Manter esse canal numa base preparada, sem carregar o atlas, é uma hipótese implementável. O custo mínimo dos buffers UV1 é **4.167.888 bytes (3,975 MiB)**; o campo serializado em JSON custa **19.960.691 bytes**. Acrescentar UV sem aplicar o remapeamento necessário não funciona. Portanto esse número não é o custo total de preparar a base: desindexação, expansão e correções também contam.

O código atual reconstrói buffers ao ativar o bake, logo não demonstra “trocar só material sem recriar geometria”. O atlas pode ser associado após preparar os buffers, mas a ausência de artefatos/reload exige o protótipo e comparação visual. As diferenças de móveis e correções não tiveram contribuição visual isolada medida nesta entrega; não é possível afirmar quais detalhes poderiam ser removidos mantendo equivalência visual.

## Materiais e recursos

Inspeção estática, não testes de troca em runtime:

| Material/recurso | LEVE provisório | PREMIUM | Troca em runtime / restrição |
|---|---|---|---|
| Base color | Materiais e vertex colors originais | Novas cores e acabamento V2, tint do piso | Propriedades mutáveis; conferir interação com vertex colors |
| Roughness | Valores base | Madeira/paredes/piso e móveis ajustados | Possível sem nova geometria; medir recompilação quando variar mapas |
| Metalness | Valores originais | V2 aplica .68 a grupos de eletrodomésticos | Propriedade mutável; equivalência visual pendente |
| Normal map | Mapas procedurais do interior | Madeira remove normal map, paredes/piso ajustam escala; V2 adiciona bump | Exige UV/material correspondente; não é download de normal map novo |
| Emissive | Materiais originais do modelo | Difusores reagem aos interruptores | Preservar estado de iluminação do usuário |
| Lightmap | Atlas legado/vertex bake | RGBM + shader de transporte difuso | Requer UV1/remapeamento e decodificação RGB × alpha × 16 |
| Transparência | Materiais originais | Mantida em clones; contatos V2 usam transparência | Testar ordem, profundidade e recompilação |
| Vidro | Material do modelo embutido | Dados de origem iguais; runtime de iluminação difere | Igualdade dos dados não prova equivalência visual final |
| Sombras | Dinâmicas/base | Bake, spots e invalidação por layout/interruptores | Não é só propriedade de material; depende de luzes e geometria |
| Acabamento adicional | Móveis originais | Linho, madeira, pedra, reboco e móveis arredondados | Código/texturas procedurais e geometria; exige incluir a preparação V2 |

O runtime clona materiais, conecta o atlas e altera shaders. Não há validação criptográfica antes de aplicar o pacote; a validação atual de contagem de vértices é insuficiente para garantir mesma topologia/base. A aplicação percorre e modifica a cena progressivamente; uma falha no meio pode deixar mudanças parciais. Isso precisará de preparação e validação completas antes da troca visível.

## Memória e limites de evidência

- Atlas interno: 2048 × 2048 × 4 = **16.777.216 bytes (16 MiB)**.
- Atlas externo: 4096 × 4096 × 4 = **67.108.864 bytes (64 MiB)**.
- Ambos: **83.886.080 bytes (80 MiB)** de pixels RGBA8; sem mipmaps automáticos. Cabeçalhos de oito bytes por atlas não entram nos pixels.
- São alocações teóricas dos pixels enviáveis à GPU, verificadas por descompressão/cabeçalho, **não VRAM física medida**. Não incluem overhead do driver, buffers da geometria, sombras, render targets ou outras texturas.
- No carregamento coexistem buffers comprimidos, descomprimidos e representação das malhas. `DataTexture` mantém uma referência CPU aos bytes; sua liberação e pico de heap precisam ser medidos. Somar apenas o tamanho do `.gz` seria incorreto.
- O interior descarta geometrias antigas não mais referenciadas por malhas na cena. O exterior substitui objetos instanciados, mas não faz descarte explícito dos buffers antigos nesse caminho. Isso é um ponto de auditoria de memória, não prova de vazamento medido.
- Downgrade atual não foi demonstrado. Desativar `lightMapIntensity` ao editar móveis **não libera o atlas**. Retorno que realmente reduza memória precisa remover referências, descartar recursos e verificar reconstrução das instâncias, sem perder estado.

`tempo_download_lightmaps`, `tempo_upload_GPU`, heap antes/depois, texturas GPU antes/depois, FPS e travamento: **não medidos**. Nenhuma emulação ou número de disco foi apresentado como teste de celular físico. Desktop bom/intermediário, mobile intermediário e rede limitada pertencem à próxima entrega, após o gate. Não há comparação visual nova nem validação de preservação de câmera/seleção nesta fase.

## Gate, arquitetura candidata e pipeline

**Inventário local concluído para as referências explicitadas; gate de implementação ainda não liberado.** Não há decisão final VIÁVEL / VIÁVEL COM RESTRIÇÕES / NÃO VIÁVEL AGORA nesta primeira entrega. Há potencial técnico, mas marcar viabilidade comprovada agora ignoraria a identificação provisória do LEVE, a diferença dos móveis e a ausência de medições de memória/dispositivos.

Antes de construir o botão:

1. Confirmar o artefato LEVE; se diferente, repetir este inventário.
2. Capturar as malhas realmente geradas pelos dois runtimes em layout idêntico, quantificando atributos/índices/topologia, objetos adicionais e custo dos móveis V2. Medir também estado persistido do editor.
3. Decidir quais remapeamentos/correções podem ser preparados na base sem encarecer demais a abertura. Medir o custo binário e comprimido; JSON decimal de UV ocupa muito mais que Float32, mas não autoriza escolher formato sem ensaio.

A arquitetura **candidata, não aprovada** é uma fonte canônica com biblioteca comum, dados/malhas de base e pacote de remapeamento/atlas/acabamento adicional. A transição pode precisar substituir uma parte das malhas, principalmente móveis e instâncias. Não exige necessariamente uma segunda maquete inteira, mas ainda não atende comprovadamente à exigência de upgrade preservando toda a interação.

Mudanças futuras necessárias no pipeline, sem aplicá-las agora:

- Estabilizar identidade de objetos/geometria e hash de atributos/índices/transformações, em vez de depender só do número de vértices e slot.
- Gerar `base`, `padrao`, `alta` a partir da mesma fonte; dar a cada recurso `path`, `bytes`, `sha256`, `tipo`; ligar `qualityPackRevision` ao `baseRevision` derivado da geometria canônica e do contrato de materiais/UV.
- Separar biblioteca/runtime do HTML apenas no experimento; não contar normalização de CRLF como ganho visual ou conteúdo novo.
- Preparar, validar e aplicar o pacote de forma atômica; falha mantém Padrão e permite nova tentativa. Validar a base antes de qualquer mutação visível.
- Preservar câmeras, unidade selecionada, painéis, modo, móveis editados e interruptores. Se o usuário alterou o layout, não aplicar um atlas calculado para outro layout.
- Instrumentar os dez timestamps pedidos e bytes/heap/texturas GPU. Medir pico durante a transição, não só memória estável.
- Reavaliar retenção/descarte dos buffers no exterior e interior. Subida sem downgrade pode ser aceitável, desde que documentada e medida.
- Avaliar preload apenas depois do upgrade manual demonstrado; não implementar heurísticas nesta entrega.

## Reprodução e integridade

Da raiz do repositório:

```powershell
python experimentos/qualidade-progressiva-cedros/inventariar.py
```

Ambiente usado: Windows, Python **3.14.4**, biblioteca padrão (`pathlib`, `csv`, `gzip`, `hashlib`, `json`, `re`, `struct`, `collections`). Nenhum pacote instalado. O script lê fontes/builds e escreve somente nesta pasta de estudo. Não chama `publish`, `render`, Blender ou deploy.

Verificação executada: duas execuções produziram hashes idênticos para os oito resultados gerados; 48 entradas auditadas conservaram seus hashes. zlib do ambiente: `1.3.1.zlib-ng`.

Artefatos regeneráveis: `inventario-arquivos.csv`, `conteudos-embutidos.csv`, `tabela-bytes.csv`, `fontes-e-exclusoes.csv`, `bytes.json`, `estrutura.json`, `runtime.json`, `entradas-sha256.json`. O Markdown é síntese editorial desses resultados. `entrega-sha256.json` registra os hashes dos arquivos da entrega, exceto o próprio manifesto. Os JSON/CSV não incluem horário variável. A repetição deve produzir os mesmos bytes com as mesmas entradas/versão; as estimativas gzip dependem também da versão do zlib/Python.

O pipeline existente documenta geração dos modelos, UVs e atlas, mas a reprodutibilidade byte a byte de novo bake Blender/xatlas/OIDN **não foi executada nem prometida**. O template congelado e os recursos atuais têm hashes registrados. `entradas-sha256.json` permite verificar se as entradas mudaram desde a análise.

Arquivos de evidência locais: `PADRAO-ATUAL.md`, `padrao_atual.py`, `lightmap-v3.js`, `exterior-v3.js`, `interruptores.js`, `anterior/v2.html` e `source.json`/`geometry-compact.json` dos dois bakes. A análise compara artefatos locais e não atesta que o site remoto esteja na mesma release.
