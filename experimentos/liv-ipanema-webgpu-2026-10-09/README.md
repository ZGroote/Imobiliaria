# LIV Ipanema — evolução visual e WebGPU

[Catálogo de 170 posições e espelho](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio), com seleção por pavimento/final. [CATALOGO.md](CATALOGO.md) distingue a contagem publicada dos vínculos comerciais/arquitetônicos ainda pendentes.

Ensaio no aparelho: [coletor de diagnóstico](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/diagnostico.html) com caminhada independente nas duas plantas e exportação local. [DIAGNOSTICO.md](DIAGNOSTICO.md) registra procedimento, limites e QAs desktop/emulados; qualificação física continua pendente.

Revisão de 11/10: quinas e vão da cobertura corrigidos, UV de luz mais denso nas bordas finas e união da moldura interna de Canto, com bake próprio. Meio mantém seu modelo independente. Detalhes em [modelo/CONTORNO.md](modelo/CONTORNO.md) e [RODATETO.md](RODATETO.md).

Continuação em 11/10: o decoder nativo reduz em 72–73% a etapa de montagem da geometria no desktop e conserva o fallback para navegadores antigos. O lote integrado passa no teto frio provisório e tem reload mediano abaixo da base nos dois backends; rede/memória e aparelhos físicos continuam pendentes. Dados e limites em [BUFFERS.md](BUFFERS.md).

Na qualificação anterior das instâncias, o exterior reutiliza sombras fixas, importa os reflexos preparados e compartilha programas de vértice pelo caminho de atributos das instâncias. Entrada: 2.489 ms frio em WebGPU / 2.643 ms em WebGL2, contra base de 2.915 ms no mesmo lote. Abertura fria passa no limite provisório do desktop; reload WebGPU, rede/memória e aparelhos físicos continuam pendentes. Noventa e nove comparações de imagem são idênticas. Resultados e receita em [INSTANCIAS.md](INSTANCIAS.md); reflexos em [AMBIENTE.md](AMBIENTE.md).

Implementação iniciada em 09/10/2026, conforme [plano](../../tasks/liv-ipanema-webgpu/plan.md). A base é a edição `strict-circle-v3` do [endereço indicado pelo usuário](https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app/maquete-liv-ipanema.html). Este diretório separa a evolução do experimento histórico.

Refinamento atual dos interiores: **Paredes baixas** revela a distribuição das duas plantas em 3D, com alternância para paredes inteiras e recuperação da cena completa no Tour. Reutiliza os materiais PBR existentes e conserva os bakes próprios. Ver [CORTES.md](CORTES.md).

Seleção atual: **Explore os finais** oferece dez posições aproximadas do 1º pavimento tipo por lista, teclado ou toque na fachada, com realce/ficha e retorno entre modos. Canto e Meio continuam referências gerais, com vínculo por final em conferência e dados comerciais não informados. Ver [UNIDADES.md](UNIDADES.md).

Exterior da prévia completa: **Acesso de perto** enquadra a entrada em telas pequenas e grandes; vidros da implantação e letreiro recebem acabamentos PBR padrão independentes dos materiais fonte. A [prévia com a entrada revisada](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=entrada) liga portal, marquise, janela e placa com UV/bake próprios ao piloto de dez finais, mapa e fila. Canto e Meio continuam experiências gerais separadas. Qualificação e custo em [INTEGRACAO-ENTRADA.md](INTEGRACAO-ENTRADA.md); autoria em [modelo/entrada/README.md](modelo/entrada/README.md). A revisão continua opcional até fechar o orçamento e os ensaios físicos.

Novo estudo do exterior em 11/10: **Contorno com recuos** reproduz os rasgos laterais e das cabeceiras em lajes, paredes e parapetos, com UV/bake próprios. [Comparação navegável](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/modelo/comparacao.html), incluindo vista de cima ampliada, original/variante e uma cena ativa por vez. A comparação isolada não tem cadastro; a prévia integrada já reúne seleção aproximada e o modelo corrigido no mapa. Extensão vertical e vínculos comerciais continuam em conferência. Ver [modelo/CONTORNO.md](modelo/CONTORNO.md) e [MAPA-MODELO.md](MAPA-MODELO.md).

## T01 — reprodução isolada

O preparador histórico confundia o hash/tamanho da publicação minificada com o HTML fonte. Agora valida separadamente:

- Publicação: `htmlSHA256` **e** `htmlBytes`.
- Fonte anterior à minificação: `htmlOriginalSHA256`, somente quando `minificada` é `true`; `htmlOriginalBytes` também é exigido se estiver registrado.

Um hash novo não é aceito automaticamente. A rejeição ocorre antes de qualquer cópia. O registro de release existente já identifica a fonte correta de 53.580.328 bytes; ele foi conservado sem edição.

`preparar_pacote.py` monta o site em um diretório temporário dentro deste experimento, no mesmo volume do destino. Confere a preservação e a identidade de cada saída e só então promove a pasta completa por renomeação para `site-baseline/` ausente. Uma falha intermediária não deixa um destino parcialmente gravado. Os **125 arquivos de conteúdo** reproduzem byte a byte a edição pública: HTML da maquete, mapa, índice, GLB, Blend e 120 tiles de quintais. Total do conteúdo: **58.291.990 bytes**.

O pacote tem 126 arquivos. Somente `manifesto-teste.json` foi regenerado com campos separados de fonte e publicação anterior. A mudança de metadados está declarada em [manifesto.json](manifesto.json), que registra hashes das entradas/saídas, Python 3.14.4, Three.js r168 embutido e procedência local. Não se afirma um commit exato da origem.

O comando reutiliza o mapa e os tiles regionais já gerados em `mapas-v3/`. Demonstra a montagem fiel a partir desses artefatos e da fonte HTML correspondente; não reexecuta o recorte municipal, o gerador da geometria, unwrap ou bake. Esses arquivos locais e o inventário em `backups/` são pré-requisitos; um checkout sem os artefatos deve recuperá-los e verificar seus hashes antes da execução.

Uma repetição só aceita um destino cujo conteúdo ainda seja idêntico à montagem esperada e apenas o confere, sem regravar seus arquivos. Destinos existentes vazios, arquivos extras ou mudanças feitas por outra tarefa são rejeitados, sem limpeza automática. Os destinos ficam restritos a pastas `site-baseline*` diretamente neste experimento. O pacote histórico `site-v3/`, seus relatórios e os recursos canônicos não são reescritos.

## Executar localmente

Na raiz do repositório:

```powershell
python -m unittest discover -s experimentos/liv-ipanema-webgpu-2026-10-09 -p test_reproducao.py
python experimentos/liv-ipanema-webgpu-2026-10-09/preparar_pacote.py
python -m http.server 8791 --bind 127.0.0.1 --directory experimentos/liv-ipanema-webgpu-2026-10-09/site-baseline
```

Abrir [maquete local](http://127.0.0.1:8791/maquete-liv-ipanema.html). Em outro terminal:

```powershell
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_miniatura.py --base-url http://127.0.0.1:8791 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/reproducao-miniatura
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_mapa.py --base-url http://127.0.0.1:8791 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/reproducao-mapa
```

O preparo usa somente a biblioteca padrão do Python. Os QAs existentes requerem Playwright e Chrome instalado no caminho configurado por eles. Todos os destinos acima pertencem a este experimento; não executar os exemplos históricos com saída em `site-v3/`.

## Verificação registrada

- **10 testes passaram:** fonte correta, publicação correta, tamanho divergente, fonte adulterada, uso indevido do hash original, tamanho original opcional, falha antes da primeira escrita, recurso corrompido/extra e destino histórico rejeitado. O teste de integração adicional injeta falha na segunda escrita: destino novo permanece ausente, destino aprovado permanece intacto, staging é removido e a repetição recupera a montagem sem regravar o pacote já idêntico.
- **Preparação passou**, inclusive repetição sobre o pacote ainda idêntico: 125 hashes de conteúdo correspondentes à base; recursos regionais completos.
- **QA da miniatura passou** em desktop e celular emulado: quatro modos, gestos de navegação, planta oficial, retorno à implantação completa com 56 malhas/43 da implantação, presença de cinco enquadramentos e link para o mapa. Evidências em `evidencias/reproducao-miniatura/runtime.json` e capturas PNG.
- **QA do mapa passou** em desktop e celular emulado: busca por categoria/nome/teclado, links de ida/volta, implantação e relevo, vértices do recorte de 5 km e requisições restritas ao pacote regional. Inclui verificações de layout em 320 e 768 px. Evidências em `evidencias/reproducao-mapa/runtime.json` e capturas PNG.

Estes testes demonstram reprodução e funcionamento do visualizador WebGL atual. Não medem desempenho em aparelhos físicos, não comprovam WebGPU e não substituem a qualificação T02/T12. O teste de download da função “Fotografar” nos dois backends integra T04.

Não foi feita publicação. A reprodução foi registrada no commit `fa4730d`, na branch `codex/liv-ipanema-webgpu`. A configuração produzida pelo preparador histórico fica no diretório temporário e é descartada; este fluxo não prepara configuração de deploy. O preview original expira em 16/10/2026 às 09:12:58 BRT, enquanto os pacotes locais preservados continuam disponíveis.

## T03/T04 — exterior WebGPU e quatro modos

A [maquete integrada](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html) mantém as cinco vistas e acrescenta Varandas, com câmera livre, destaque de térreo/pavimentos tipo, captura PNG e acesso ao mapa preservado. O exterior usa Three.js **0.186.1**, fixado no lockfile deste diretório, com WebGPU automático e WebGL2 quando necessário. Os interiores 3D/Tour agora usam o mesmo WebGPURenderer, com escolha Canto / Meio e geometria independente para cada tipologia. A Planta 2D mostra a imagem comercial correspondente e não requer renderer. Ver [INTERIORES.md](INTERIORES.md) para fontes, reprodução e limites.

Após a tela inicial utilizável, a nova fila prepara automaticamente **Tour → mapa → Planta 2D**, conforme solicitado. O clique interrompe outro grupo e prioriza o escolhido; a preparação somente baixa arquivos, sem abrir cenas. Ver [FILA.md](FILA.md) para cache, interrupção, uso de dados e verificação.

A sombra solar exterior agora é reutilizada durante órbita, vistas e seleção, com recálculo explícito ao alterar seus inputs. As duas edições passaram na comparação visual e na regressão dos interiores. [SOMBRAS-EXTERIOR.md](SOMBRAS-EXTERIOR.md) registra os passes removidos e a nova medição comparável: 48,0% menos conteúdo inicial na variante, mas tempo de abertura ainda acima da meta. Não há ganho físico de FPS demonstrado.

Os nove casos de fila, quatro cenários com arquivos reais, quatro modos nos três perfis e retorno pelo mapa/histórico foram aprovados. Progresso e timeout por inatividade também passaram; a abertura Slow4G emulada levou cerca de 124 s sem abort indevido. Isso não fecha a qualificação física nem o critério de velocidade.

Em 10/10, o novo interior de meio foi traçado a partir da sua própria planta oficial e integrado ao catálogo de canto. Planta 2D, Planta 3D e Tour respeitam a escolha do seletor. O primeiro incremento passou em três perfis funcionais, 17 cenários de falha/cancelamento, doze casos do worker e quatro cenários de fila com 135 recursos. Na continuação, Meio recebeu bake próprio de 2048×2048/512 amostras; Canto conserva seu atlas. As sombras solares passam a atualizar quando a cena muda, e a restauração de móveis recalcula as rotas em conjunto. [INTERIORES.md](INTERIORES.md) registra fontes, reprodução e provas por versão.

A versão com os dois bakes passou em seis ensaios de iluminação, três perfis funcionais, 19 cenários de recuperação e quatro cenários de fila com os 139 arquivos reais. Cinco regressões do empacotador passaram, e a cena autoral de Meio foi reproduzida byte a byte. WebGPU e WebGL2 foram exercitados no desktop; o perfil de toque é emulado. A validação física no Poco X6 5G continua pendente.

O ajuste das câmeras enquadra o volume inteiro das duas plantas, acrescenta **Enquadrar** e orienta as chegadas do Tour para focos do ambiente solicitado. A órbita manual é preservada ao redimensionar/restaurar. Três perfis de câmera passaram em WebGPU, WebGL2 e toque emulado, incluindo mudanças entre retrato/paisagem e telas de 320 px. Ver [CAMERAS.md](CAMERAS.md).

As capturas do usuário também permitiram reproduzir a parede que muda de claridade ao girar a câmera no renderer público antigo, com bake ativo. O interior nativo passou no mesmo ponto em WebGPU e WebGL2, mantendo o difuso associado ao atlas. [LUZ-CAMERA.md](LUZ-CAMERA.md) registra o diagnóstico visual e o limite do ensaio desktop diante do travamento relatado no Poco X6 5G.

`exportar_cena.py` extrai a cena exterior **efetivamente exibida pela base**, depois de validar o HTML local/HTTP e o bake. Transporta as 56 malhas, 41 com RGBM, geometria/UV/cores/matrizes e 15 grupos instanciados. Não substitui o exterior pelo GLB regional, que representa outro artefato. O atlas continua associado ao modelo `89f552ec…`, em RGBA linear, UV1, faixa RGBM 16, sem mipmaps ou conversão sRGB.

`material-rgbm.js` traduz a contribuição difusa baked para TSL, sem somá-la novamente às luzes diretas/hemisféricas. O PBR especular, sombras e antialiasing de r186 diferem de r168. A comparação em canvas idêntico demonstra a continuidade visual; **não é igualdade de pixels nem aprovação do refinamento artístico**. As dez comparações têm erro absoluto médio RGB no primeiro plano de aproximadamente 3,5–8,8 numa escala de 255. Ver [comparacao.json](evidencias/comparacao-render/comparacao.json).

Os acabamentos novos devem aproveitar materiais PBR padrão. A `StandardNodeLibrary` do runtime fixado converte automaticamente `MeshStandardMaterial` e `MeshPhysicalMaterial` para implementações em nós; materiais de GLTF compatíveis podem entrar por esse caminho. Não há necessidade de escrever um shader para cada acabamento. O código RGBM permanece especializado porque altera o transporte de luz da própria base. Shaders GLSL/`onBeforeCompile` personalizados precisam de adaptação para TSL.

Cada mudança entre exterior e interior interrompe a cena anterior e remove seu iframe após o descarte assíncrono. Enquanto a limpeza termina, o contexto antigo fica oculto e inerte; não continua desenhando. Planta 3D e Tour reutilizam o mesmo interior quando alternados diretamente. Esse limite de uma cena ativa favorece memória; retornar ao exterior recompõe a cena, reutilizando recursos que o navegador tiver em cache. A câmera livre/preset e o pavimento destacado são preservados. O canto conserva seu RGBM em TSL; Meio usa o transporte calculado para sua própria cena, mantendo os materiais PBR padrão. Alterar o mobiliário ativa a iluminação dinâmica até restaurar o layout nominal.

O mapa usa um adaptador de navegação em `mapa-liv-ipanema-5km.html` e um HTML regional compartilhado em `mapa-runtime/`. O renderer e os dados regionais permanecem preservados; o GLB original ou corrigido acompanha a edição e é verificado antes do parse. “Abrir maquete” retorna ao visualizador novo, recuperando edição, seleção, câmera, pavimento e modo. O layout passou em 320/768/1440 px em `evidencias/navegacao-tipologias/`; a integração atual do modelo e o retorno foram revalidados em `evidencias/mapa-contorno-conferido/`. Ver [MAPA-MODELO.md](MAPA-MODELO.md).

Para instalar o runtime e servir a evolução, na raiz:

```powershell
npm ci --ignore-scripts --prefix experimentos/liv-ipanema-webgpu-2026-10-09
python -m http.server 8790 --bind 127.0.0.1 --directory .
```

Com o pacote T01 recuperado e o servidor aberto, regenerar os assets se necessário:

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/exportar_cena.py
```

Abrir a maquete integrada acima. Para diagnóstico, acrescentar `?backend=webgpu` ou `?backend=webgl`; [prova isolada](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/prova-rgbm.html) mostra o backend efetivo. A escolha automática não promete aumento de FPS.

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_webgpu.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/prova-webgpu-responsive
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_integracao.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/integracao-final
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_falhas.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_navegacao.py
python experimentos/liv-ipanema-webgpu-2026-10-09/medir_runtime.py
```

Chrome 154.0.8037.98, Windows 11, GTX 1650: WebGPU efetivo NVIDIA/Turing e WebGL2 ANGLE/D3D11. Os testes verificam vistas/enquadramento, toque emulado, destaque/reset, retornos de modo e PNG. Nove cenários de recuperação exercitam ausência/inicialização de GPU, HTTP 503, bytes corrompidos, falha da planta, navegação rápida e perda de contexto WebGL real. A perda WebGPU foi exercitada pelo callback simulado, não por falha física da placa.

Foram realizados vinte ciclos desktop e vinte com toque emulado. Nas cinco amostras após GC de cada teste, permaneceram três documentos e 337 nós, com um iframe ativo. O heap do host foi de 13.879.568 para 13.884.420 bytes no desktop e 13.845.292 para 13.827.704 bytes no toque emulado. Isso não é medição completa da memória GPU. Os downloads PNG foram decodificados e tiveram dimensões/conteúdo não vazio conferidos por Pillow.

Depois de otimizar o compartilhamento dos nós RGBM, os quatro casos da prova, as dez comparações de render e os nove cenários de falha passaram novamente. Outros vinte ciclos WebGPU passaram em `evidencias/integracao-otimizada-20-ciclos/`: um iframe ativo, documentos/nós estáveis e heap de 13.028.388 para 13.013.780 bytes nas amostras após GC.

Os recursos binários grandes e screenshots são locais, ignorados pelo Git. `assets-prova/manifest.json` registra os hashes para recuperação/regeneração. A planta em `plantas2d/canto.jpg` é cópia sem edição de `LIV/referencias/planta-47-59.jpg`; a [matriz de fontes](referencias.json) e a [reconciliação](reconciliacao-unidades.md) documentam sua procedência e os vínculos por final ainda desconhecidos.

## Limites e próximas etapas do plano

### Reaproveitamento PBR implementado

A [bancada de materiais e modelos](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/materiais.html) importa GLB/GLTF mantendo os materiais originais do GLTFLoader. Há inspeção de propriedades/mapas, ajuste de câmera, PNG, rejeição de arquivos/recursos incompatíveis e descarte/cancelamento. Seu pacote é separado da maquete e só carrega quando aberto. [MATERIAIS.md](MATERIAIS.md) descreve o contrato, a amostra própria e a qualificação de formatos.

Dez testes Node e quatro perfis de navegador passaram: WebGPU/WebGL2 desktop e toque emulado. A importação do GLB Draco existente da Casa VistaLar, com 1.158 malhas e 44 materiais, passou nos dois backends desktop. Vinte reimportações mantiveram as mesmas contagens estimadas pelo renderer. Foi testado o encerramento durante compilação pendente e a perda WebGPU por callback simulado. Recursos intermediários de um parse falho também são liberados. KTX2/Basis e Meshopt foram configurados sob demanda, mas ainda precisam de fixtures de navegador.

O exterior mantém seus materiais não baked como MeshStandardMaterial padrão e deixa a conversão ao renderer; RGBM continua específico à geometria/atlas verificados. Os quatro perfis da maquete passaram em `evidencias/prova-materiais-stock/`. A bancada é a base técnica antecipada de T07; não substitui os acabamentos finais ou a qualificação física.


### Primeiro acabamento conferido com as referências

Em 10/10/2026, o visualizador integrado passou a usar pintura nas esquadrias e guarda-corpos da torre. O render comercial da varanda mostra barras metálicas pintadas; o material anterior representava metal exposto. Um clone MeshStandardMaterial padrão muda somente metalness/rugosidade da atribuição da torre e preserva a tipografia da portaria. A vista **Varandas** permite inspecionar o detalhe e adapta o enquadramento ao celular.

Os parâmetros são calibração visual estimada, sem especificação executiva. Malhas, matrizes, UV1, atlas e superfícies baked continuam iguais; os vidros permanecem como na base. A prova RGBM continua com o perfil original, enquanto a maquete integrada usa o novo. [REFINAMENTO.md](REFINAMENTO.md) e [refinamento-exterior.json](refinamento-exterior.json) registram fontes, comparação e limites.

O ensaio final do acabamento passou em WebGPU/WebGL2 desktop e toque emulado, incluindo assinatura incompatível, descarte, recarga de sessão e recuperação com um clique. Nove cenários de falha e a integração dos quatro modos em três perfis passaram novamente com o perfil aplicado. Evidências em `evidencias/refinamento-exterior-final/` e `recuperacao-refinamento-final/`.

A investigação identificou reentrâncias da cobertura que o modelo simplificava. [modelo/NOTAS-GEOMETRIA.md](modelo/NOTAS-GEOMETRIA.md) registra o diagnóstico; [modelo/CONTORNO.md](modelo/CONTORNO.md) descreve a variante modelada e seu bake. T06/T07 permanecem parciais.

Em 11/10, as manchas pretas das quinas da variante foram corrigidas na autoria: paredes sobrepostas passam por união exata, com UV/bake regenerados e os mesmos materiais. Os testes registram zero sobreposições nas paredes e zero amostras quase pretas entre os 102 pontos conferidos, além de capturas antes/depois em seis vistas nos dois backends. A comparação e o toque emulado passaram novamente. O pacote da variante caiu de 21.757.657 para 16.614.864 bytes. Evidências em `evidencias/quinas-geometria/`, `quinas-luz/` e `quinas-interface/`; detalhes e limites em [modelo/CONTORNO.md](modelo/CONTORNO.md).

A [prévia integrada dos recuos](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=contorno) reúne agora essa autoria com o piloto de dez finais e ambas as tipologias nos modos Planta 2D/3D e Tour. O cadastro e o realce foram recortados pela própria laje, com edição/procedência verificadas; os vínculos de planta por final continuam em conferência. O mapa mostra o mesmo contorno/cobertura e o retorno conserva edição e seleção. Evidências em `evidencias/unidades-recuos-integrado/` e `evidencias/mapa-contorno-conferido/`; reprodução e limites em [UNIDADES.md](UNIDADES.md) e [MAPA-MODELO.md](MAPA-MODELO.md). A comparação geométrica mantém seu iframe sem seleção.

### Qualificação ainda pendente

T02 tem capturas e três rodadas preliminares por viewport/cache em [medicao.json](evidencias/medicao-baseline/medicao.json). A medição inicial ocorreu durante outros QAs e usa rede local; não serve como orçamento definitivo ou comprovação de ganho. Viewport de 390 px e toque emulado não são ensaio de celular físico.

O endereço principal sem parâmetros transporta a geometria da base; contorno e entrada reconstruída possuem integração opcional em `?geometria=contorno`/`?geometria=entrada`, com cadastro e GLB conferidos no mapa. As duas edições passaram no limite provisório de abertura fria do desktop; qualificar rede/memória/aparelhos precede sua adoção como padrão. Demais volumes, materiais e iluminação ainda precisam de refinamento com as referências. Vínculos por final, espelhos/gardens, dia/entardecer e qualificação Android/iPhone permanecem no plano. Tipologia por final, limites cotados, numeração comercial, vaga, preços e estoque não foram confirmados. Canto e Meio já possuem bakes próprios; a indicação de interior ilustrativo permanece explícita.

A medição anterior registrou 23.993.373 bytes iniciais, 37,5% abaixo da base. Com materiais padrão, outra medição sequencial registrou 23.993.689 bytes; medianas frias de 2.190 ms em WebGL2 e 2.975 ms em WebGPU, contra 1.633 ms na própria base reensaiada. Naquelas revisões, T05 não atingia o critério de abertura. Antecipar o upload do atlas não melhorou de modo consistente e foi revertido. A continuação de [INSTANCIAS.md](INSTANCIAS.md) passa no teto frio do desktop; T05 conserva os critérios físicos/rede/memória e o reload WebGPU pendentes. Histórico e limites em [PERF.md](PERF.md). Não há comprovação de ganho de FPS.

Referências técnicas consultadas: [WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer.html), [NodeMaterial](https://threejs.org/docs/pages/NodeMaterial.html) e [Renderer: recuperação de contexto](https://threejs.org/docs/pages/Renderer.html). O runtime instalado e fixado é a fonte de compatibilidade efetivamente testada.

Atualização de rede em 11/10: [REDE-MEMORIA.md](REDE-MEMORIA.md) registra três rodadas com gzip, 6 Mb/s e 80 ms: entrada 26,1% menor em corpos comprimidos, 26,6–26,8 s de mediana fria contra 33,3 s da base. Memória não teve ganho geral confirmado, o atlas voltou a trafegar no reload e aparelhos físicos permanecem pendentes.

[AMBIENCIA.md](AMBIENCIA.md): controle de dia e entardecer ilustrativo com PBR padrão, mesmo atlas e sombras fixas. Três perfis aprovados, nove restaurações com diferença zero, duas plantas e retorno do mapa preservados. Não é segundo bake de entardecer nem simulação solar.

[VINCULOS.md](VINCULOS.md): cadastro separado e validado para ligar cada posição à planta publicada e à revisão do 3D/Tour. Três testes CPU e três perfis sintéticos passaram. O arquivo real permanece ausente; espelhamento sem variante conferida é rejeitado e nenhuma tipologia foi inventada por final.
