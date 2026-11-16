# Matriz de reuso — PA-G0

Auditoria estática em 16/11/2026, na worktree `imobiliaria-projetista`, branch `viabilidade/projetista-g0`, HEAD `3104504aa1ca16fdbf1ab04c5ef4ec325786dd1c`. A tarefa cita a base `633ddaeb`; esta matriz descreve o código encontrado no HEAD acima. PRD lido: `viabilidade/PRD-PROJETISTA-0.1.md`. Não houve execução do produto, testes, build, deploy ou alteração de código.

**Conclusão:** há peças reutilizáveis para terreno, volumetria, edição de uma planta, normalização e renderização. Não achei um compositor geral que transforme a meta de seis apartamentos por pavimento em unidades posicionadas, circulação, núcleo e torres editáveis. O caminho menor é adaptar o editor e traduzir o modelo arquitetônico para os consumidores existentes. Não é necessário criar outro motor 3D.

As referências são relativas à raiz desta worktree. Os rótulos de reuso valem para a função indicada, não significam que o módulo inteiro esteja pronto para o Projetista. **P** = adaptação localizada; **M** = integração entre componentes existentes; **G** = capacidade nova de domínio ou mudança de contrato em várias camadas. São tamanhos relativos, não estimativas de prazo.

## 1. Estudo de viabilidade atual

| O que existe | Entrada → saída | Reuso | Por quê |
|---|---|---|---|
| `viabilidade/motor/estudar.py:estudar` | Base + índices ou ponto + zona + premissas → `lote.json`, `estudo.json`, relatório e resumo | adaptar | Já encadeia terreno, motor e relatório; o estudo recebe hash dos bytes. Falta vínculo imutável entre revisão do estudo e revisão arquitetônica. A função grava arquivos: não é uma API de edição interativa. |
| `viabilidade/motor/motor.py:gerar_estudo` | Lote + zona + premissas → estudo com domínio, envelope, alternativas, métricas e incertezas | usar como está | Serve como estudo de origem. Não fornece apartamentos desenhados nem comprova sua distribuição. Versão no código: `0.8.3`. |
| `viabilidade/motor/motor.py:eixos_da_frente`, `_para_local`, `_para_mundo` | Frente + geometria → orientação local e transformação de volta | usar como está | Operações geométricas úteis no domínio existente; preservar origem e orientação no adaptador. |
| `viabilidade/motor/motor.py:caixa_recuada` | Polígono + frente + três distâncias → polígono recuado | adaptar | Recebe distâncias, mas infere frente/laterais/fundos por orientação e proximidade. Conserva a maior parte quando a operação fragmenta o lote. Não é validador geral de qualquer conjunto de divisas ou de múltiplas frentes. |
| `viabilidade/motor/motor.py:maior_retangulo`, `dois_quadrados`, `_maior_lamina` | Região + área/proporção/afastamento → pegadas candidatas | adaptar | Reaproveitáveis para busca geométrica limitada; duas torres são quadrados iguais e a lâmina usa proporções predefinidas. Não posicionam plantas arbitrárias. |
| `viabilidade/motor/motor.py:_gerar_estudo` — geradores `fazer_a`, `fazer_b`, `fazer_c`, `tenta_d` | Limites + premissas → torre única, duas torres, lâmina baixa, embasamento com torre | adaptar | Já explora famílias de massas. Falta substituir as lajes abstratas por pavimentos compostos e admitir transformações/instâncias de projeto. |
| `viabilidade/motor/motor.py:_avaliar` | Volumes + contexto → métricas, subsolos e avisos | não serve | Não serve como quadro de áreas arquitetônico: estima privativa por eficiência e área comum escalar; conta unidades por divisão da área por unidade. Núcleo, vagas e áreas computáveis também entram por premissas/regras. Não mede unidades ou corredores desenhados. |
| `viabilidade/motor/motor.py:_melhor`, `_chave`; `motor.py:1024` | Candidatos → seleção por unidades estimadas e depois área privativa | adaptar | Busca determinística limitada, sem IA generativa; a própria saída nega prova de ótimo global. Novo objetivo precisa avaliar instâncias reais, mix e área comum explícita. |
| `viabilidade/motor/motor.py:840` — `busca` e `fecha` | Resultado/erro de uma busca → opção ou ausência classificada | adaptar | Já distingue `impossivel`, `busca_inconclusiva`, `dados_insuficientes`, `erro`. Reaproveitar a distinção, acrescentando elementos, tentativas, versão e limites da busca arquitetônica. |
| `viabilidade/motor/dominio.py:classificar` | Medidas do lote + parâmetros → `dentro`, `fora` ou `dados_insuficientes` | usar como está | É domínio observado do motor de viabilidade, não certificação normativa. Não usar `dentro` como sinônimo de projeto conforme. |
| `viabilidade/motor/busca_fina.py:Fina`, `_posicoes` | Mesmas entradas e funções do motor → investigação de alternativas ausentes | não serve | Ferramenta de auditoria volumétrica, com amostragem de posições; não é gerador de apartamentos nem prova geral de impossibilidade arquitetônica. |

### Formato efetivamente produzido

`viabilidade/motor/motor.py:1011` retorna `versao_motor`, `lote`, `zona`, `premissas`, `caixa_maxima`, `opcoes`, `opcoes_ausentes`, `criterio_escolha`, `incertezas`; `gerar_estudo` acrescenta `dominio`.

- `caixa_maxima`: `projecao_utm`, `altura_m`, áreas de referência, `recuo_frontal_m`, `degraus` e, quando aplicável, faixa de parede cega. É envelope de referência, não uma planta.
- Cada opção: `id`, `nome`, `volumes`, `metricas`, `alertas` (`motor.py:875`).
- Cada volume acima do solo: `base_utm`, `z0_m`, `altura_m`, `pavimentos`, `uso`, `recuo_lateral_m`, `recuo_fundos_m`; pode receber `parede_cega`. `_volume` guarda geometria interna temporária; `fecha` exclui campos iniciados por `_` antes de exportar.
- As métricas incluem áreas construída, computável, não computável, privativa, garagem e permeável, CA, TO, vagas, pavimentos e `unidades_estimadas` (`motor.py:510`). Não existe nesses volumes uma lista de apartamentos, cômodos, paredes ou instâncias de pavimento.
- O hash do estudo é calculado por `viabilidade/motor/estudar.py:135`; não achei um `DesignRevision` arquitetônico vinculado a esse hash no caminho auditado.

## 2. Modelo geométrico do lote

| O que existe | Entrada → saída | Reuso | Por quê |
|---|---|---|---|
| `viabilidade/terreno/novo_lote.py:ler_ponto`, `Cadastro.localizar` | Latitude/longitude WGS84 → ponto projetado e índice do lote | usar como está | Seleção por ponto já existe no backend/CLI. Interface integrada do Projetista ainda precisa chamá-la e mostrar ambiguidades/recusas. |
| `viabilidade/terreno/novo_lote.py:unir`, `Cadastro.gerar` | Índices de feições → lote único validado e metadados | usar como está | Trata remembramento, índices repetidos, geometria com buracos, sobreposição e frente. Preservar recusas e proveniência. Não equivale a confirmação cadastral em campo. |
| `viabilidade/terreno/gerar_lotes.py:avaliar` | Polígono, vizinhos e malha de ruas → qualidade e frentes candidatas | adaptar | Critérios de triagem geométrica/cartográfica: sobreposição, proximidade do asfalto, comprimento da frente e esquina inferida. Esses limiares não são regras universais de aprovação urbanística. |
| `viabilidade/terreno/novo_lote.py:236` | Geometria e qualidade → contrato de `lote.json` | usar como está | Explicita `poligono_utm`, `frente`, `area_m2`, `crs`, origem, qualidade, relevo e zona. É a referência de implantação; acrescentar transformação do projeto sem alterar o lote de origem. |
| `viabilidade/terreno/sugerir_zona.py:MapaZonas.sugerir`; `novo_lote.py:242` | Polígono → sugestão cartográfica de zona e motivos | usar como está | Já distingue zona sugerida de zona conferida; incerteza pode recusar a escolha automática. Manter os estados e a exigência de resolução da dúvida. |
| `viabilidade/terreno/areas_especiais.py:AreasEspeciais.ler`; `novo_lote.py:249` | Lote → incidências e pendências de áreas especiais | usar como está | Triagem separada existe, mas seu resultado é consumido pelo motor geométrico. Não suprimir pendências ao gerar arquitetura. |
| `viabilidade/terreno/novo_lote.py:218`; `viabilidade/motor/motor.py:827` | Coordenadas + superfície de elevação → resumo de relevo; volumes → assentamento plano | adaptar | O lote guarda relevo, mas o motor declara que o ignora e assenta em z=0. O primeiro domínio deve assumir plano explicitamente; relevo real exige outra integração. |
| `viabilidade/motor/motor.py:701`, `recuo_divisa` | Zona/premissas + altura → recuos usados | adaptar | Recuos não são atributos intrínsecos do polígono do lote: vêm de `zona.parametros`, com premissa frontal quando a zona não fornece valor. Separar essa decisão da operação geométrica. |

**Coordenadas e unidade:** o lote novo declara `crs: "EPSG:31983"` (SIRGAS 2000 / UTM 23S), com pares `[E, N]` em metros; `frente` tem dois pontos no mesmo referencial. `Cadastro.gerar` arredonda coordenadas a seis casas e área a três. A lista produzida pelo cadastro inclui fechamento do anel; `_coords` do motor exporta anel sem fechamento e coordenadas a quatro casas. Não depender de igualdade bruta entre essas representações.

**Zona e confirmação:** `zona_id`, `zona_origem`, `zona_conferida`, `conferido`, `qualidade`, `fonte`, `observacoes`, `relevo` e `areas_especiais` fazem parte do lote novo; `zona_sugestao` entra no modo automático. A seleção manual não torna a zona conferida. O exemplo legado `viabilidade/motor/exemplos/lote-exemplo.json` não contém `crs` e registra diferença entre as coordenadas do GeoJSON e campos legados em outro datum: o adaptador deve exigir/resolver o referencial, não presumir que todo par do repositório seja UTM compatível.

## 3. Criação, leitura e edição de plantas

| O que existe | Entrada → saída | Reuso | Por quê |
|---|---|---|---|
| `painel/src/components/construtor-planta/modelo.ts:aplicar`, `desfazer`, `refazer`, `snap` | Sessão + ações → nova planta editável | adaptar | Já oferece adicionar/editar/mover/excluir cômodos, mesclar partes ortogonais, abrir vãos e histórico. Falta entidade apartamento-tipo, instâncias, travas e composição de pavimento. Rotação de móvel não é rotação de unidade arquitetônica. |
| `painel/src/components/construtor-planta/modelo.ts:problemas`, `problemasAberturas`, `documento` | Layout → problemas com IDs ou leitura versionada | usar como está | Boa base para uma planta: verifica sobreposição, conexão por adjacência, vãos e mesclagem. Exporta milímetros, eixos nominais e retângulos ortogonais. Conexão entre cômodos não prova rota acessível ou saída de emergência. |
| `painel/src/components/construtor-planta/editorDocument.ts:documentoEditor`, `carregarEditorState` | Sessões → `projeto-planta.json` → sessões restauradas | adaptar | Preserva geometria, móveis e andar ativo, mas `Floor=0|1`; recusa pavimentos adicionais. Não armazena torres, tipos/instâncias ou referência ao estudo. O histórico de desfazer não é persistido como histórico de projeto. |
| `painel/src/app/imoveis/planta/page.tsx:55`; `painel/src/lib/leituras.ts:salvarVersao`, `listarVersoes` | Planta + companion + identidade → versão salva e leitura posterior | adaptar | Já há fluxo de snapshots e conferência do conteúdo retornado. Está vinculado a imóvel/agência e a uma leitura do andar ativo; não é persistência completa do novo modelo arquitetônico. |
| `pipeline/validar_leitura.py:validar` | Leitura nominal → lista determinística de erros | usar como está | Valida esquema, referências, IDs, geometria e relações sem alterar a entrada. Serve ao domínio ortogonal existente. Não verifica lei, incêndio, estrutura ou acessibilidade. |
| `pipeline/normalizar_planta.py:normalizar`, `serializar` | Leitura em mm → planta nominal em m, polígonos, portas/janelas e hash da origem | usar como está | Ponte existente do editor ao consumidor 3D; não aplica espessura construtiva. A saída declara `measurementBasis: wall-centerlines` e `construction: not-applied`. Não chamar a área resultante de área útil/privativa legal sem definição própria. |
| `pipeline/extrair_planta.py:achar_linhas`, `montar` | Imagem + leitura de retângulos/áreas → cômodos, escala e relatório de erro | adaptar | Extração e calibração determinísticas depois da transcrição. Não inventa o programa de uma planta nova; depende de alguém identificar cômodos e áreas. Não precisa de IA generativa quando a leitura é humana. |
| `pipeline/mobiliar.py:mobilia`, `confere` | `unidade.planta` + aberturas → móveis e diagnósticos | usar como está | Heurísticas já aproveitam paredes e folgas. Serve depois de existir planta; não distribui apartamentos. O estilo do sofá é fixado por identificador, conforme o código, não por acaso a cada execução. |
| `pipeline/gerar_maquete.py:gerar_maquete_da_leitura`; `pipeline/e2e_leitura.py:unidade` | Leitura + contexto explícito → unidade para consumidor e prévia | adaptar | Caminho pronto entre leitura validada e maquete de uma unidade. Contexto aceita dimensões/pavimentos de prédio e confere encaixe, mas não composição de várias unidades ou implantação real. |
| `tools/gerar_planta_aleatoria.mjs:gerarPlantaAleatoria` | ID → sequência fixa de ações no editor e exportação | não serve | Apesar do nome, é uma planta codificada com medidas e móveis fixos; o ID padrão usa `Math.random()`. Não atende metas de distribuição nem reprodutibilidade integral sem ID explícito. `validarNormativo` chama o validador geométrico, não uma verificação legal. |
| `experimentos/laranjeiras-2026-10-30/interiores/construir.ts:19` e `:47` | `planta.json` com retângulos em pixels, calibração, vãos e móveis → leitura, companion e contexto | adaptar | Já reutiliza o modelo do editor e confere ida e volta. É um importador de traçado de referência, com escala e orientação próprias; não é gerador de apartamentos a partir de metas. |
| `experimentos/containers-mooca-2026-11-05/interiores/escrever_plantas.py:W` | Dados de tipologias codificados no script → `planta.json` | não serve | Serve como acervo de exemplos, não como algoritmo geral: escreve especificações fixas de interiores. Não transportar essas convenções de imagem para o modelo canônico. |
| `experimentos/laranjeiras-2026-10-30/interiores/gerar_plantas2d.py:gerar`; `experimentos/liv-experimental-2026-10-14/planta2d.js:createPlan2D` | Imagem/traçado registrado → recorte, cotas e visualização 2D | adaptar | Úteis para consulta de referência. O visual 2D usa imagem, zoom e régua; não é um editor nem garante atualização automática quando a geometria arquitetônica mudar. |
| `experimentos/laranjeiras-2026-10-30/modelo/modelar_laranjeiras.py:unidade`, `posicao`, `andar`, `coloca` | Plantas fornecidas + implantação → unidades transformadas, pavimentos repetidos e torres Blender | adaptar | Evidência concreta de prédio derivado de plantas e instâncias de malha. A distribuição por finais, alas e tipos está codificada para aquele caso; extrair a lógica de instância, não copiar um layout como solucionador universal. |
| `experimentos/vistas-da-quinze-2026-11-07/implantacao/montar.py:unidades`, `main` | Descrição de alas, degraus e tipologias → implantação métrica, unidades e contagem por andar | adaptar | Existe precedente de pavimentos excepcionais e contagens derivadas das unidades geradas. Depende de regras específicas de uma implantação, não faz busca geral no lote. |
| `experimentos/containers-mooca-2026-11-05/modelo/modelar_containers.py:container` | Implantação métrica + módulos conhecidos → geometria Blender | adaptar | Reuso como referência de montagem modular com medidas explícitas. Dimensões e tratamento do módulo são específicos; não resolvem plantas de apartamentos genéricas. |
| `pipeline/plantas/vetorizar_planta.py:carregar`, `rotular` | Planta urbanística raster → segmentação de lotes | não serve | Outra acepção de “planta”: cadastro urbano, não organização interna de ambientes. Não confundir este pipeline com geração de apartamento. |

Não achei, nos caminhos auditados, uma função geral que receba número de unidades, tipos e envelope e devolva apartamentos posicionados com núcleo/circulação contabilizados. Há modelos manuais e geradores específicos; isso é reuso parcial importante, mas não o fluxo automático solicitado.

## 4. Renderizadores das maquetes e do mapa

| O que existe | Entrada → saída | Reuso | Por quê |
|---|---|---|---|
| `viabilidade/visual/index.html:validar`, `carregar`, `criarVista` | `estudo.json` → volumes extrudados, lote e envelope | usar como está | Menor caminho para ver a massa completa de uma alternativa sem outro renderizador. Recebe polígonos UTM e alturas, não GLB nem cômodos. Não desenha divisões de pavimento apenas porque `pavimentos` existe. |
| `pipeline/build/blocos.py:bloco_unidades` | `plantas_fornecidas/*/unidade.json` + móveis automáticos opcionais → lista JSON das unidades | adaptar | Ponto de entrada do cadastro no mapa; filtra cidade e incorpora móveis. Precisa receber a projeção da revisão do projeto, sem gravar por cima do acervo. |
| `v1.5/renderizador-v16-moveis/app.js:anelNoLote`, `anelDoLote`, `recsDoLancamento` | `unidade.lote.predio.blocos` + posição → registros 3D de blocos | adaptar | Já posiciona vários blocos retangulares e identifica o principal. Altura é `pavimentos * LV`; blocos nascem no chão. Não atende diretamente contornos arbitrários, cotas-base distintas e alturas de pavimento variáveis. |
| `v1.5/renderizador-v16-moveis/interior/floor-plan.js:plantaDaUnidade`, `paredesDaGrade` | Cômodos/aberturas + registro do prédio → paredes, pisos, esquadrias e referencial | adaptar | Núcleo de geometria existente. Centraliza a planta e a alinha ao eixo maior do prédio; não preserva a transformação de uma unidade no pavimento. Paredes são derivadas em grade, não lidas como objetos de parede canônicos. |
| `v1.5/renderizador-v16-moveis/interior/house-mesh.js:geoDaCasa`; `interior/entry.js:enterInterior` | Planta processada → malhas e navegação da unidade | adaptar | Reaproveitar malhas, materiais e interação; o fluxo trabalha com interior selecionado. Não achei montagem geral simultânea de todas as unidades do empreendimento nesse caminho. |
| `v1.5/miniaturas/pagina_maquete.py:da_unidade`, `anel_do_bloco` | Cadastro de uma unidade + prédio em blocos → página de maquete | adaptar | Já leva todos os blocos à página, mas centraliza uma única planta no bloco principal e usa altura de pavimento convencionada. `--cadastro` explícito não busca modelo especial pelo ID do acervo. |
| `experimentos/liv-experimental-2026-10-14/viewer.js:460`; `prova-rgbm.html:22`; `renderer.js:152` | Página → iframe exterior → manifesto + cena compactada + atlas → malhas Three.js | adaptar | O exterior detalhado atual não recebe simplesmente “um GLB novo”: valida manifesto, geometria, materiais, atributos, matrizes e iluminação preparados. É reutilizável, mas custa mais integrar que o visual de volumes. |
| `experimentos/laranjeiras-2026-10-30/site/renderer.js:152`; `experimentos/containers-mooca-2026-11-05/site/renderer.js:152`; `experimentos/vistas-da-quinze-2026-11-07/site/renderer.js:152` | Mesmo protocolo de manifesto/cena preparada → exterior detalhado | adaptar | Os três consumidores conferidos usam `liv-proof-manifest-v1` e `liv-exterior-proof-v1`, apesar dos diretórios diferentes. Evitar outro fork: adaptar a entrada do renderizador escolhido. |
| `experimentos/laranjeiras-2026-10-30/modelo/exportar_cena.py:227` | Modelo preparado → `scene.json.gz`, atlas e `manifest.json` | adaptar | Existe exportação para o contrato detalhado. Hashes ligam os recursos; o manifesto inclui horário de exportação, portanto igualdade de geometria não significa igualdade de todos os bytes do pacote. |
| `experimentos/liv-experimental-2026-10-14/interior-renderer.js:697` | Catálogo + unidade + runtime/material/móveis + receita ou cena congelada → interior | adaptar | Há dois caminhos: `native-factories` e `frozen-source`. Ambos exigem vínculos de identidade/hashes. Uma cena congelada com luz calculada não se atualiza fielmente só trocando a planta. |
| `experimentos/mapa-liv-ipanema-5km-2026-10-08/inserir-maquete.js:17`; `maquete-no-mapa.js:create` | GLB carregado por `GLTFLoader` + centro/giro/cota → grupo do modelo no mapa | adaptar | Caminho GLB real encontrado: metros e Y para cima. Ainda contém contorno e referências fixos do modelo; não é importador genérico do projeto canônico. |
| `v1.5/renderizador-v16-moveis/urban-models.js:select` | Registro urbano + catálogo de modelos → modelo de contexto encaixado | não serve | Seleção de casas/edificações de contexto. Exclui lançamentos e não deriva arquitetura de plantas; não deve substituir a geometria projetada. |

## 5. Cobertura do fluxo solicitado

| Passo | O que já cobre | O que falta | Tamanho do que falta |
|---|---|---|---|
| Selecionar terreno | `novo_lote.py:Cadastro.localizar`, `Cadastro.gerar`; `estudar.py:estudar` aceitam ponto/índices | Integração com a tela do Projetista, confirmação de fonte/frente/zona e referência estável ao lote escolhido | M |
| Calcular viabilidade | `motor.py:gerar_estudo`, alternativas, envelope e incertezas; visual e relatório existentes | Abrir resultado/revisão no novo projeto, sem promover domínio geométrico a aprovação legal | M |
| Pedir seis apartamentos por pavimento | Premissas de área por unidade e área comum; editor permite desenhar uma planta | Meta explícita de quantidade/mix, plantas-tipo, acesso e definição das áreas; o número estimado do motor não é restrição de distribuição | M para a entrada/modelo; a solução está no passo seguinte |
| Gerar distribuições | Geometria ortogonal, normalização, validação de planta e exemplos específicos de composição | Busca determinística de posições/rotações, área comum/núcleo, conflitos, balanço de áreas, elementos travados e falhas classificadas por tentativa | G |
| Organizar torres | Busca de massas A–D, blocos posicionados e exemplos de repetição de pavimentos | Compositor geral de tipos/instâncias, pavimentos excepcionais, cotas, implantação e validação desacoplada das regras | G |
| Ver empreendimento inteiro em 3D | Volumes já aparecem no visual; blocos e cenas preparadas já mostram conjuntos | Adaptador de volumes: P. Representação coerente derivada de plantas, IDs/seleção, transformações e atualização: M. Cena detalhada com preparação de materiais/luz: G se exigida | P/M para o escopo esquemático; G para o caminho detalhado |
| Modificar o projeto | Editor de planta, histórico local, exportação/importação e snapshots existentes | Edição em hierarquia, propagação controlada de tipos, travas, revisão vinculada ao estudo e revalidação após mudar geometria/regras | G |

O reuso do editor reduz o começo do PA-G1, mas não elimina PA-G2/PA-G3/PA-G4. Não achei contrato único já implementado para apartamento → pavimento → torre → lote.

## 6. Contrato mínimo para usar o 3D existente

### 6.1 Primeiro adaptador: volumes do visual de viabilidade

**Consumidor escolhido para a primeira prévia de conjunto:** `viabilidade/visual/index.html:criarVista`. Manter o estudo de origem como contexto e gerar os volumes da alternativa a partir da revisão arquitetônica. Isto é proposta de adaptação, não um endpoint já existente.

| Campo de destino | Forma/unidade | De onde vem no modelo canônico |
|---|---|---|
| `lote.poligono_utm` | Anel de pares `[E,N]`, metros | Terreno do estudo de origem, com CRS confirmado |
| `zona`, `premissas`, `caixa_maxima` | Objetos do estudo; projeção e altura finita do envelope | Revisão fixada do estudo, preservando estado de conferência e incertezas |
| `opcoes[].id` | Texto não vazio e único no estudo | Identidade da alternativa; não usar posição do array como identidade canônica |
| `opcoes[].nome` | Texto para apresentação | Nome da alternativa |
| `opcoes[].volumes[].base_utm` | Anel simples com pelo menos três pontos | Contorno da laje/torre após compor as transformações unidade → pavimento → torre → terreno |
| `opcoes[].volumes[].z0_m` | Número finito, metros | Cota-base da peça relativa ao plano do terreno; aceita subsolo negativo |
| `opcoes[].volumes[].altura_m` | Número finito não negativo, metros | Diferença entre topo e base da peça; não deduzir de uma altura média se o modelo define outra |
| `opcoes[].volumes[].uso` | Texto, opcional para geometria | Uso da peça; o visual diferencia `embasamento` e nomes de garagem/subsolo |
| `opcoes[].volumes[].pavimentos` | Contagem, usada na informação | Instâncias de pavimento representadas pelo volume; o visual não cria lajes por esse campo |
| `opcoes[].metricas` | Objeto de números não negativos ou `null` | Métricas calculadas da mesma revisão; contagens vêm de instâncias, não de `_avaliar` aplicado às massas |
| `opcoes[].alertas`, `incertezas` | Listas de textos | Achados/restrições e pendências da revisão, convertidos para apresentação |
| `recuo_lateral_m`, `recuo_fundos_m`, `parede_cega` | Opcionais no volume | Somente informação produzida por medição/verificador; não inventar conformidade para completar a entrada |

O mínimo sintático aceito por `validar` é o invólucro com `lote`, `zona`, `premissas`, `caixa_maxima` e `opcoes`; cada opção exige `id`, `volumes`, `metricas`, `alertas`. Um objeto de métricas vazio passa nessa validação, mas produz informação incompleta: não é entrega funcional do Projetista. Preservar os metadados e gerar métricas coerentes é parte do adaptador.

**Limites conferidos no código:** até 12 opções, 200 volumes por opção e 10.000 vértices por polígono (`index.html:68`, `:112`). `base_utm` não codifica buracos; `Shape` recebe um anel. A validação verifica estrutura, finitude e área não nula, mas não faz validação topológica completa. Não mandar paredes ou todos os cômodos como milhares de volumes sem rever esse contrato. Para a primeira prévia, agregar apenas peças que possam ser representadas fielmente como prismas; vazios e formas não suportadas devem ser declarados ou exigir adaptação.

O visual subtrai o centro da caixa do lote antes de criar buffers e gira a extrusão (`index.html:362`): o resultado é `X=E-cx`, `Y=cota`, `Z=-(N-cy)`. Essa conversão pertence ao adaptador/consumidor; nunca misturar metros UTM com milímetros da planta.

**Limite encontrado entre produtor e consumidor:** `gerar_estudo`, quando faltam dados calculáveis, retorna `caixa_maxima.altura_m=null` (`motor.py:660`); `validar` exige altura finita (`index.html:93`). Esse estado precisa de tratamento de erro/informação antes da prévia. Não preencher zero só para aparentar que um estudo válido foi calculado.

### 6.2 Planta de uma unidade: ponte que já existe

Para ver ambientes, reutilizar `normalizar` → `e2e_leitura.unidade` → `plantaDaUnidade` → `geoDaCasa`. O formato geométrico de destino é:

```text
planta.pe_direito: metros
planta.comodos[]: { nome, poly: [[x,z], ...] }
planta.portas[]: { p: [x,z], largura, y0, y1 }
planta.janelas[]: { p: [x,z], largura, y0, y1 }
planta.moveis: []                         # se não houver mobiliário
```

`poly` vem do cômodo nominal; `p` é o centro do vão derivado da parede e do offset; `largura`, `y0` e `y1` vêm de largura/peitoril/altura do vão. A ponte Python recebe leitura com esquema, IDs, revisão, proveniência, relações e medidas inteiras em mm; ela já converte esses dados para metros (`normalizar_planta.py:51`). O invólucro de unidade inclui `id`, `andar`, `ficha`, `cores` e `lote.predio` pelo contexto explícito (`e2e_leitura.py:154`).

Restrições reais do caminho: `e2e_leitura.py:portoes_do_consumidor` exige grade de 50 mm e vãos de pelo menos 200 mm; isso é limitação do consumidor, não regra legal. A área usa eixos nominais, com espessuras aplicadas depois pelo renderer. Não gerar geometrias em resolução incompatível e arredondá-las silenciosamente.

**Para seis unidades no mesmo pavimento, adaptar:** `plantaDaUnidade` hoje centraliza cada planta no prédio e orienta pelo OBB. Precisa aceitar/preservar transformação de instância e cota explícita, além de manter IDs de origem na seleção/diagnóstico. Simplesmente enviar seis `unidade.json` não monta um pavimento correto. O modelo canônico deve manter IDs e relações; o formato de visualização é uma projeção descartável, não o arquivo de edição.

### 6.3 Alternativas existentes e seus limites

**Mapa por blocos:** `app.js:recsDoLancamento` consome `lote.lat`, `lote.lon`, `lote.rumo_graus`, `lote.predio.{largura_m,profundidade_m,pavimentos}` e `predio.blocos[]` com `du`, `dv`, `giro_graus`, dimensões, pavimentos e `principal`. Coordenadas globais vêm da conversão do terreno; deslocamentos/giro vêm das torres. Não traduzir uma torre irregular apenas por sua caixa envolvente: isso mudaria o projeto. Cota-base e pé-direito variável exigem adaptação; o código usa `LV` e começa no chão.

**Exterior detalhado:** `renderer.js:152` exige manifesto `liv-proof-manifest-v1`, cena `liv-exterior-proof-v1`, identidade de origem, atlas RGBM compatível, materiais, geometrias e malhas. Em `renderer.js:245`, geometrias têm atributos, índice opcional, grupos, `drawRange` e limites; malhas referenciam geometria/material, matriz e eventualmente matrizes de instâncias. A origem disso seria a malha derivada do modelo canônico e sua preparação visual. Não é o menor contrato para a primeira etapa. Reutilizar esse renderer requer exportador compatível; a entrada GLB direta encontrada pertence ao experimento de inserção no mapa, não ao caminho padrão desse exterior.

**Recomendação:** começar com volumes para o conjunto e as fábricas existentes para inspecionar uma planta. Evoluir a transformação/instanciação e o adaptador do mesmo renderer quando for necessário mostrar o conjunto derivado das plantas. Essa prévia de volumes, sozinha, não satisfaz a coerência arquitetônica completa do PRD.

## 7. Onde geometria e legislação estão misturadas

| Referência | Mistura atual | Separação necessária para o Projetista |
|---|---|---|
| `viabilidade/motor/motor.py:_gerar_estudo` | Monta polígono, corrige geometria inválida, escolhe frente, lê zona, aplica recuos, permeabilidade, CA, teto de projeto e altura de áreas especiais | Resolver regras/premissas com proveniência antes da geração; operações geométricas recebem limites explícitos. Correção do lote deve ser visível e versionada. |
| `viabilidade/motor/motor.py:recuo_divisa`, `_recuos_topo` | Regra por pavimento/altura entra diretamente na determinação da pegada | Verificador/resolvedor normativo calcula exigência e estado; geometria mede e constrói usando distâncias. |
| `viabilidade/motor/motor.py:_Caixas.legal`, `fixa_limite`, `mundo` | Envelopes por recuo se combinam com heurística de ocupação/permeabilidade | Distinguir região legal conhecida da região escolhida pela heurística. A palavra `legal` na função não prova conferência das fontes. |
| `viabilidade/motor/motor.py:_avaliar` | Áreas geométricas, núcleo não computável, garagem, TO, CA e unidades estimadas na mesma função | Medir geometria real primeiro; classificar áreas conforme regra/fonte depois; contar as instâncias de unidades separadamente. |
| `viabilidade/motor/motor.py:_cabe`, `_ajusta_ao_ca`, `_melhor` | Busca descarta/reduz candidatos usando métricas normativas e premissas | Modo livre deve permitir explorar violações sem corromper geometria; achados precisam de estado, medição, limite e elemento. Geração pode filtrar, mas deve registrar por quê. |
| `viabilidade/motor/motor.py:_gerar_estudo` — `tenta_d` | A exceção de parede cega muda a geometria e os recuos do embasamento | Resolver aplicabilidade/status da regra e manter essa justificativa ligada à peça. |
| `viabilidade/motor/motor.py:_alertas` | Comparações numéricas com zona viram mensagens livres | Adaptar para achados estruturados; ausência de limite conhecido deve ser `não verificado`, não conformidade implícita. |
| `viabilidade/terreno/novo_lote.py:Cadastro.gerar` | Seleção geométrica já exige zona e anexa triagens normativas | Manter terreno, associação de zona e conjunto de regras como referências separáveis. Os módulos de sugestão/áreas especiais já são peças úteis dessa separação. |
| `tools/gerar_planta_aleatoria.mjs:validarNormativo` | Nome sugere norma, mas executa `pipeline.validar_leitura.validar` | Tratar o resultado apenas como validação do contrato/geométrica. Não herdar o nome como selo legal. |

Não achei um motor normativo autônomo que retorne, por elemento arquitetônico, `conforme`/`violação`/`não verificado` com fonte e versão. O código atual guarda fontes/estados no estudo, mas as verificações principais são acopladas à volumetria e seus alertas.

## 8. Evidências, reprodutibilidade e limites desta auditoria

O motor não usa relógio/acaso na geração e ordena candidatos por critérios explícitos; o normalizador tem serialização estável. Existem verificações no repositório para sustentar o reuso: `tests/test_normalizar_planta.py:48` compara determinismo/ordem de chaves; `tests/test_capturador_editor_document.mjs:27` verifica restauração de dois andares, mesclagem, vãos e móveis; `tests/test_e2e_leitura.py:208` cobre geometria que o consumidor aproximaria; `viabilidade/motor/test_motor.py:527` verifica ausências classificadas. **Esses testes foram lidos, não executados nesta tarefa.**

Reprodutibilidade futura exige entrada geométrica, versões do esquema/algoritmo/regras, tolerâncias, ordenação e desempates fixos. Não usar `Math.random()` do script de demonstração nem horário do manifesto como identidade da geometria. O pacote visual detalhado pode variar em metadados mesmo com geometria igual.

Alcance: busca por arquivos/símbolos de planta, extração, mobiliário, interiores, unidades, blocos e carregamento 3D, seguida da leitura dos produtores/consumidores citados. Não foi uma inspeção linha a linha de todos os experimentos, arquivos gerados ou dependências. “Não achei” indica ausência na busca e nos caminhos auditados, não prova de inexistência em todo o histórico Git. Ferramentas Ruflo não apareceram entre as ferramentas disponíveis; não houve uso de swarm nem memória externa.

Não conferi a legislação vigente nem homologuei as regras do código; a análise identifica como elas entram no sistema. Não executei código de geração, build, testes, navegador, Blender, deploy ou Firebase. Só este documento foi escrito, sem commit. Riscos principais do reuso direto: perder posição das unidades por centralização, confundir área nominal/estimada com área arquitetônica, perder vazios/partes ao simplificar contornos e mostrar uma geometria alterada com iluminação preparada para outra revisão.
