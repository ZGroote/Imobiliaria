# Cronologia e estudo detalhado do projeto Imobiliária

Histórico do desenvolvimento e funcionamento observado em 22 de setembro de 2026

O projeto Imobiliária reúne uma representação urbana em três dimensões e recursos de consulta de imóveis no navegador. A experiência inclui informações comerciais, visualização externa de empreendimentos, plantas e navegação em primeira pessoa em unidades cadastradas. Esses componentes foram desenvolvidos em momentos diferentes e possuem formas distintas de preparação, carregamento e interação.

Este documento apresenta a evolução registrada entre agosto e setembro de 2026, explica o processamento dos dados e detalha o estudo de transferência das miniaturas. As observações atuais têm como referência a inspeção de 22 de setembro de 2026. O histórico preserva acontecimentos, medições e dificuldades documentados, com indicação de seu contexto, sem converter resultados particulares em avaliações gerais sobre o projeto.

A publicação consultada possui dois acessos principais: o mapa de São Carlos e um site com três miniaturas de empreendimentos. A lista do mapa apresentou onze entradas, enquanto a galeria de miniaturas apresentou Monte dos Cedros, Monte das Colinas e Wish Castanheiras. São conjuntos de exibição diferentes; não representam, necessariamente, a mesma contagem de cadastros, plantas ou modelos disponíveis no acervo.

As miniaturas examinadas incorporam dados e código ao HTML. O mapa também contém componentes incorporados, mas carrega detalhes urbanos externos durante o uso. Essa diferença acompanha todo o estudo: tamanho do arquivo, tráfego por abertura, memória gráfica e trabalho de preparação não são medidas intercambiáveis.

### Organização da leitura

As primeiras seções descrevem a evolução por período. Em seguida, são explicados os papéis das fontes, o processamento espacial, o formato dos dados, os interiores e a iluminação. A parte final descreve a publicação observada, as medições HTTP, os cenários de tráfego e as condições necessárias para outras avaliações.

Os detalhes históricos têm como referência o documento fornecido e os registros locais associados. As verificações atuais incluem leitura do código, consulta aos sites publicados, requisições HTTP e execução da suíte Node. As fontes estão identificadas ao final. A palavra “atual”, ao longo do texto, corresponde à data de observação indicada, e não a uma garantia de que publicações futuras permanecerão iguais.

## 1 Escopo do projeto e categorias de informação

O mapa urbano e o cadastro imobiliário respondem a necessidades diferentes. O primeiro representa o contexto espacial: vias, quarteirões, volumes construídos, vegetação e elementos do entorno. O segundo descreve unidades específicas, com atributos como área, dormitórios, pavimento e distribuição interna. Uma edificação desenhada na cidade não implica que exista anúncio ou planta associada a ela.

Essa distinção permite compreender números que aparecem na documentação. O registro histórico de 96.168 volumes refere-se a uma montagem da representação urbana de São Carlos. A contagem de cinco cadastros internos, mencionada no texto de origem, refere-se a outro conjunto. As onze entradas visíveis no mapa em 22 de setembro correspondem à lista publicada naquele momento. Nenhum desses números deve substituir automaticamente os demais.

Também há diferença entre o material de origem e sua representação. Um contorno extraído de imagem aérea indica a forma detectada de uma edificação. Uma planta urbanística fornece informações sobre lotes e medidas. Uma ficha de anúncio descreve uma unidade ofertada. O pipeline combina esses materiais, mas a transformação em geometria não elimina as limitações de cobertura, data e precisão de cada fonte.

### Registros históricos

Datas, métricas e comparações anteriores são mantidas como registros do desenvolvimento. Uma redução de chamadas de desenho, por exemplo, corresponde à cena, configuração e método utilizados no ensaio original. O documento não presume que o mesmo resultado se reproduza em toda cidade, aparelho ou versão posterior.

### Observações atuais

As verificações de 22 de setembro descrevem o conteúdo que foi efetivamente consultado. O mapa carregou no navegador e apresentou seus controles e a lista de imóveis. Na miniatura do Cedros foram acessados planta 3D, editor de móveis, visita e planta 2D. Os HTMLs publicados foram comparados com os arquivos locais correspondentes, e os testes Node foram executados. Essas ações têm alcance delimitado; não abrangem todos os fluxos do sistema.

### Estimativas e questões de avaliação

Os cenários de tráfego utilizam tamanhos medidos para calcular volumes de acesso hipotéticos. Eles não são leitura de fatura nem teste de capacidade. Da mesma forma, a existência de um recurso não determina sua compreensão pelo visitante. Questões de desempenho, uso e resultado comercial exigem procedimentos específicos, descritos nas seções finais.

## 2 Agosto de 2026 e as primeiras formas de carregar a cidade

Os registros fornecidos começam em 21 de agosto, com a incorporação de pontos de interesse à página. O conjunto inicial mencionado tinha 82 pontos, selecionados em um recorte de 10 km. Os POIs acrescentavam referências de serviços e locais à visualização urbana, enquanto a base de edificações e ruas continuava sendo organizada.

Em 22 de agosto, a extração de quarteirões a partir das faces do grafo viário passou a servir ao agrupamento da geometria. O histórico menciona 4.457 quadras, com área mediana de 9.980 m². Nesse contexto surgiu o streaming por quarteirão do v4: a montagem e a permanência da geometria na GPU passaram a considerar partes da cidade, em vez de tratar toda a cena da mesma maneira.

O ensaio associado registra redução de 1.281 para 238 chamadas de desenho, de 224 para 15 MB de memória gráfica e de 14,97 para 1,88 ms por quadro. Esses valores ajudam a identificar a motivação da mudança. Não significam que qualquer subdivisão por quarteirão produza esses resultados, nem que o custo restante permaneça igual quando se acrescentam sombras, materiais ou outras bibliotecas.

Em 23 de agosto, o v5 separou a base de dados do HTML e passou a buscá-la por fetch. A página descrita no registro caiu de aproximadamente 6,6 MB para 107 KB. Essa redução ocorreu no documento inicial: o arquivo de dados externo continuava fazendo parte do carregamento necessário à visualização. Comparar apenas os HTMLs das duas versões omitiria essa transferência.

### Duas necessidades de distribuição

A separação favorecia o uso da base por componentes diferentes e a organização de uma aplicação servida por HTTP. A abertura local por duplo clique, por sua vez, dependia de evitar restrições impostas pelo navegador à leitura de arquivos relacionados por file://. O histórico registra, por isso, o retorno à incorporação de dados no v6.

Não se trata de uma medida única de eficiência. Um documento autocontido pode ser mais simples de transportar, enquanto recursos separados podem ser reaproveitados entre páginas por cache. O comportamento depende do formato de entrega e do ambiente. Na publicação observada em setembro, ambas as ideias permanecem presentes: miniaturas autocontidas e mapa com partes externas.

## 3 Agosto de 2026 e a organização de casas e lotes

Entre 25 e 28 de agosto foram registrados ajustes de cor, tipologia, reconstrução de lotes e orientação de contornos. O projeto passou a diferenciar a geometria detectada em imagens da geometria usada para organizar a representação de casas dentro de um terreno.

O histórico descreve oito arquétipos de edificação selecionados de forma determinística. Em um ensaio, a introdução dessas variações manteve 882 chamadas de desenho e acrescentou 29% de triângulos. O dado indica que, naquela organização da cena, a variedade geométrica não aumentou a quantidade de submissões registrada. Não indica ausência de custo de memória, transformação de vértices ou rasterização.

Em 26 de agosto, uma reconstrução por subdivisão de quadras produziu 113.501 lotes. No Jardim Embaré, o registro comparou 2.558 lotes gerados com uma referência de 10 por 25 m: frente mediana de 9,9 m, profundidade de 25 m e área mediana de 247 m². Essa comparação avalia a distribuição de medidas naquele conjunto. Ela não comprova que cada polígono individual reproduza a divisa real de uma propriedade.

Em 27 de agosto foi preparado o acervo de 265 pranchas OpenPlots, com cerca de 169 MB segundo a cronologia. No dia seguinte, o v7 passou a utilizar lotes derivados de plantas no assentamento das casas. A montagem citada nesse momento continha 86.228 volumes de edificações.

### Orientação dos contornos

Uma ocorrência documentada envolveu a função de recuo do contorno. Parte dos anéis usava uma orientação e parte usava a orientação oposta. O cálculo destinado a encolher a casa ampliava determinados contornos, alterando recuos e indicadores usados para escolher o telhado. O registro menciona 1.389 anéis com um sinal de área orientada e 57.607 com o outro.

O efeito visual aparecia como predominância de lajes: uma medição registrou 9.520 casas de laje e apenas 65 com telhado. A investigação relacionou o resultado à geometria de entrada, e não somente à rotina de cobertura. Esse caso mostra por que uma diferença de convenção geométrica pode se manifestar em uma função distante da origem do cálculo.

No v8, o histórico registra um artefato de 10,9 para 4,4 MB e redução de 838 para 172 chamadas de desenho. Também registra a redução de precisão textual das coordenadas. São mudanças distintas: uma afeta armazenamento, outra afeta seleção e desenho da cena. Seus resultados não devem ser somados como se medissem a mesma grandeza.

## 4 Padronização por cidade no final de agosto

De 29 a 31 de agosto, o desenvolvimento passou a organizar parâmetros e fontes por cidade. O arquivo de configuração de cada município reuniu caminhos, projeção, origem, larguras de vias e critérios de validação. A intenção registrada era permitir repetir o processamento sem manter regras municipais espalhadas pelo código.

O renderizador também passou a ter arquivos de fonte separados. Segundo a cronologia, a montagem anterior dependia de 59 pontos de busca e substituição em uma cadeia de versões e de um HTML de aproximadamente 6,9 MB. A reorganização separou JavaScript, estilos e montagem. A comparação histórica registrou identidade dos dados e bibliotecas, com diferenças intencionais em cinco linhas do código principal.

### Largura da rua e limite disponível para os lotes

Uma mesma via era interpretada de maneiras diferentes pelo processamento e pelo desenho. Para uma rua residencial de 7,5 m, a borda visual citada ficava a 5,81 m do eixo, enquanto o recorte do pipeline ficava a 7,85 m. O resultado era um intervalo de 2,04 m. Em uma via primária de 13 m, os valores registrados foram 10,07 m e 9,10 m, produzindo sobreposição aproximada de 1 m.

Ao alinhar as definições, o registro menciona redução de 5,29% para 0,22% do comprimento de muros dentro da rua. A referência é a rua representada pelo renderizador. Não se trata de levantamento da largura física de todas as vias, mas de coerência entre duas partes da mesma representação.

### Ampliação para outras cidades

Araraquara foi utilizada como segundo caso de aplicação do padrão. Os registros descrevem problemas de caminhos que ainda apontavam para dados de São Carlos e diferenças de referência espacial. O uso de material de outro município produziu deslocamentos e processamento de pranchas que não pertenciam à cidade selecionada.

Depois foram trabalhadas Ribeirão Preto, Sorocaba e São José do Rio Preto. A cronologia menciona aproximadamente vinte minutos e duzentos megabytes por cidade em determinadas execuções. A aquisição de dados pela rede e os critérios incluídos nessas medições precisam permanecer associados ao registro de origem.

No mesmo período, limitações de requisições ao Overpass motivaram o uso de um extrato OSM do Geofabrik. Também foram introduzidos árvores, níveis de qualidade gráfica, atualização seletiva de quadros e materiais procedurais. A existência desses recursos no histórico de várias cidades não demonstra que todas receberam posteriormente a mesma publicação de São Carlos.

## 5 Primeira semana de setembro e cadastro de interiores

O histórico de 29 de agosto registra a definição de que plantas e fotografias de unidades seriam fornecidas para o cadastro. A geração de interiores genéricos foi retirada do fluxo descrito. Essa decisão separou a representação urbana aproximada da representação interna associada a uma unidade específica.

Em 1 de setembro, o v13 passou a apresentar primeiro a ficha e a consulta de arredores, em vez de entrar diretamente no interior. A informação sobre o que havia por perto utilizava um recorte de 1 km. Na mesma data, nove sondas de comportamento foram reunidas em uma rotina de validação; o tempo histórico citado para essa execução era de 223 segundos por cidade.

O extrator de plantas foi desenvolvido nesse contexto. Sua função era reduzir a transcrição manual de paredes e medidas, mantendo a identificação dos ambientes e a conferência do cadastro como atividades específicas. A geometria do interior continuava dependendo dos dados atribuídos à unidade.

### Alterações entre 3 e 5 de setembro

Os registros incluem consulta a 231.572 lotes do Geoportal de Ribeirão Preto, incorporação de pontos CNEFE e revisão da distribuição de lotes no interior das quadras. Em uma ocorrência, a profundidade de 25 m deixava área sem cobertura em uma quadra de 86 m. A alteração registrada elevou a cobertura de 76,9% para 93,8% no recorte avaliado.

Em 4 de setembro, a montagem de São Carlos citada passou de 77.145 para 96.168 volumes. Também foram cadastrados quatro lançamentos e acrescentados recursos de iluminação do v15. As contagens descrevem saídas de processamento, não uma auditoria individual das edificações existentes na cidade.

Entre 4 e 5 de setembro foram investigadas oclusão, projeção de sombras e sondas de ambiente. Houve ainda um experimento com Unreal para comparar a imagem obtida com a visualização Three.js. O trabalho prosseguiu no navegador com ajustes de iluminação, sem que essa continuidade constitua uma conclusão geral sobre a superioridade de uma tecnologia.

### Mobiliário e céu

Nos dias 7 e 8, os registros tratam de forros, plafons, céu e bibliotecas de móveis. O mobiliário passou a combinar modelos preparados no Blender e variações paramétricas, nas quais dimensões e componentes podem ser ajustados pelo código. As alterações urbanas incluíram a posição do sol, cuja influência na projeção das sombras foi medida em enquadramentos específicos.

## 6 Modularização e reorganização em setembro

Os registros de 14 a 18 de setembro descrevem a extração de um app.js de aproximadamente dez mil linhas para cerca de oitenta módulos. O histórico menciona 130 commits em oito dias, com parte relevante voltada à reorganização e às comparações de comportamento. Essas quantidades são referências históricas do processo, sem nova contagem integral nesta revisão.

A separação procurava tornar explícitos os componentes de câmera, ficha, interiores, materiais e navegação. Um dos exemplos documentados era a coexistência de funções com o mesmo nome e parâmetros diferentes em um escopo amplo. Nesse ambiente, uma definição podia substituir outra e produzir comportamento inesperado em eventos da interface.

### Comparação com o código anterior

Foram usados testes que executavam trechos anteriores em um contexto controlado e comparavam a saída com o módulo extraído. A documentação chama esse mecanismo de oráculo. Ele responde se dois trechos produzem resultados equivalentes nos casos exercitados; não cobre automaticamente todas as relações com o restante da aplicação.

Por isso, os registros também descrevem sondas na página e capturas antes e depois das extrações. Em um caso, a mudança de uma função da ficha afetou outro fluxo distante no arquivo. O teste do trecho isolado e a observação da página ofereciam evidências sobre partes diferentes do comportamento.

### Dependências e inicialização

Entre as ocorrências relatadas estão referências usadas antes de sua inicialização e código que dependia do escopo do arquivo original. Transformar esse código em um módulo exigiu explicitar dependências e o momento de criação de seus componentes. Fábricas, isto é, funções que criam um componente com entradas definidas, foram utilizadas para preservar essa ordem.

A modularização reduz determinados compartilhamentos de escopo, mas não torna conflitos ou falhas de integração impossíveis. Dependências podem continuar ausentes, contratos podem divergir e transições podem envolver mais de um módulo. A constatação atual de dez falhas Node deve ser entendida nesse contexto de testes, sem presumir que todas sejam defeitos observáveis pelo visitante ou que todas sejam apenas problemas de fixture.

Nos dias 18 e 19, a organização incluiu a retirada de caminhos antigos e a movimentação dos dados de São Carlos. O monólito histórico permaneceu relevante para comparações. Apagar caminhos redundantes e preservar material de referência são ações com propósitos distintos; a necessidade de cada arquivo depende de quem ainda o utiliza.

## 7 Consolidação da base e surgimento das miniaturas

O período de 19 a 21 de setembro inclui as variantes que organizam mapa, interior e planta como etapas, além da miniatura independente. O v17 aparece associado à separação das cenas e o v18 à maquete vinculada à ficha e às transições para a visita. Esses nomes descrevem momentos e variantes do desenvolvimento.

Em 21 de setembro, as fontes foram reunidas em v1.5. O README consultado identifica essa base como desenvolvimento. A configuração de montagem reconhece v15 e v16-moveis; os diretórios de v17 e v18 também aparecem no acervo. A numeração do produto, o nome de uma variante e o caminho de um arquivo publicado não são necessariamente a mesma identificação.

### O papel da miniatura independente

A miniatura permite abrir um empreendimento e sua unidade sem iniciar a cidade inteira. O HTML inclui informações da ficha, modelo do prédio, dados da planta e código dos modos disponíveis. Nas três páginas examinadas, essa forma de entrega incorpora o conteúdo necessário à visualização principal.

O README das miniaturas descreve modelos preparados no Blender para Castanheiras, Cedros e Colinas. As páginas usam essas exportações na visualização interativa. Renders de conferência, projetos Blender e arquivos GLB são artefatos relacionados, mas não substituem o HTML como documento de entrada da experiência examinada.

No Cedros, o editor de móveis aparece dentro da planta 3D. A interface consultada informa que as alterações ficam no navegador. O código confirma uso de localStorage, de modo que essa persistência é local ao contexto do navegador e não representa, por si só, edição de um cadastro compartilhado em servidor.

### Estado local e estado publicado

Há arquivos da pasta de trabalho que não pertencem aos commits recentes. Por isso, a data de um commit não foi utilizada como prova única de disponibilidade de todos os recursos. Na inspeção de 22 de setembro, os três HTMLs publicados corresponderam aos arquivos locais comparados. O mapa versionado também apresentou correspondência com sua cópia preparada para publicação.

A presença de um recurso nesse dia confirma a observação, mas não informa exatamente quando ocorreu seu primeiro deploy. A cronologia registra a implantação atual como estado observado quando não há evidência suficiente para atribuir uma data mais precisa de publicação.

## 8 Overture e OpenStreetMap na composição urbana

O Overture entra no histórico como fonte de contornos de edificações. O conjunto citado continha aproximadamente 126 mil footprints e 75 MB. O documento original atribui a composição desse arquivo a Google Open Buildings e Microsoft ML Buildings, nas proporções de 67% e 33%. Essas proporções pertencem ao acervo descrito; não são apresentadas como composição geral de toda edição do Overture.

Um footprint é uma forma em planta detectada ou registrada para uma construção. Uma casa, uma garagem e uma edícula podem aparecer como polígonos diferentes. Isso interfere em contagens: três polígonos não significam necessariamente três unidades imobiliárias, e uma união de polígonos não determina automaticamente uma única propriedade.

Os registros associam ao OSM informações como nomes, endereços, classificação e número de pavimentos quando disponíveis. No cruzamento descrito, 4.528 de 125.994 contornos receberam correspondência. O número mostra a cobertura daquele casamento entre bases, dependente de posição, regras e conteúdo disponíveis.

### Forma detectada e forma desenhada

O histórico descreve a substituição de parte dos contornos anônimos por casas assentadas em lotes. A informação de construção passou a apoiar a ocupação, enquanto a geometria exibida podia ser produzida a partir do lote e de tipologias. Edificações com identificação específica recebiam tratamento diferente em etapas do processamento.

Essa abordagem produz uma representação organizada espacialmente, mas requer distinguir desenho ilustrativo de reconstrução individual. Um volume que acompanha o alinhamento da rua pode comunicar o tecido urbano sem reproduzir a fachada, os recuos ou a cobertura exatos do imóvel real.

### Experimento de união de contornos

O documento original registra uma tentativa de unir footprints por adjacência. A área construída total citada passou de 3.684 para 3.697 hectares, em vez de apresentar a redução esperada para remoção de duplicatas. Também houve uma união que agregou 102 casas, segundo o relato. O resultado foi interpretado naquele experimento como agrupamento de construções contíguas.

A ocorrência não estabelece que toda base esteja livre de duplicação. Ela mostra que a regra de união utilizada não correspondia à hipótese pretendida naquele conjunto. Para deduplicar, seria necessário definir evidências de que duas feições representam o mesmo objeto, diferenciando esse caso de edificações apenas vizinhas ou geminadas.

## 9 Extração de quadras e endereços municipais

O histórico descreve o uso de camadas do SigaSC por meio de um serviço MapServer. As tentativas daquele período com WFS e WMS não produziram o vetor esperado, e a extração utilizada seguiu o modo CGI que retornava imagens PNG. Isso caracteriza a rota adotada nas consultas registradas, sem afirmar que todos os serviços municipais ou suas configurações atuais tenham a mesma limitação.

A extração começou por sondagens de baixa resolução. Células de 3 km eram consultadas com imagens de aproximadamente 300 pixels para localizar regiões com conteúdo. O registro aponta presença de desenho em 22 de 132 células para uma camada de quadras. A sondagem permitia direcionar a aquisição de imagens maiores, em vez de consultar toda a área com a mesma resolução.

Nas regiões selecionadas, eram preparados tiles de 2.048 pixels. A montagem de um mosaico exigia reconhecer a cor da camada, combinar bordas e tratar as emendas. Quando a informação representava linhas de quadra, o polígono procurado correspondia ao espaço delimitado por elas. Quando a camada representava endereços, eram detectadas manchas e extraídos seus centros.

### Referência espacial e escala de exibição

O documento original registra uma divergência entre a zona informada no mapfile e a interpretação espacial que produziu alinhamento no projeto. A solução relatada utilizou EPSG:29193. Esse código e a ocorrência são mantidos como registro técnico do tratamento da fonte, e não como identificação verificada nesta revisão de todos os serviços relacionados.

Também havia diferenças de escala entre as camadas. O endereçamento citado tinha MAXSCALE 5000; a consulta em uma área extensa podia retornar imagem vazia mesmo sem demonstrar ausência de endereços. O histórico relata a utilização de tiles de 1.500 m para essa camada, aumentando o número de requisições em relação às células maiores.

### Fechamento de linhas e regiões sem cobertura

Uma dilatação de dois pixels não fechava todos os intervalos entre linhas nas emendas. A alteração para quatro pixels foi associada à recuperação de um polígono em Santa Angelina. A operação ajuda a fechar pequenas interrupções, mas também modifica a máscara; seu efeito deve ser entendido na escala da imagem utilizada.

No Jardim Araucária, os registros citam 0,34% de pixels na camada de quadras e 0,00% na de endereços, contra 1,73% e 1,26% em um bairro de controle. A comparação ajudou a distinguir cobertura da fonte, escala inadequada e problema de extração. Uma imagem vazia, considerada isoladamente, não permite escolher entre essas explicações.

## 10 Plantas urbanísticas e pontos de endereço

O acervo OpenPlots descrito contém 265 pranchas digitalizadas. O histórico as caracteriza como TIF bitonal Group4, em 200 ou 300 dpi, com escalas como 1:1.000, 1:2.000 e 1:2.500. A informação relevante pode estar tanto nas linhas do desenho quanto em cotas, legendas e observações sobre medidas padrão.

Uma imagem de planta não fornece, por si só, a posição de cada vértice em coordenadas geográficas. O processamento precisa separar linhas e textos, identificar polígonos, inferir ou ler a escala e ajustar o desenho a referências espaciais. Uma escala correta não resolve automaticamente rotação ou deslocamento; esses componentes do registro precisam ser tratados separadamente.

### Filtragem dos lotes extraídos

O projeto utilizou medidas da própria prancha como referência para avaliar polígonos. O resultado histórico menciona 21.163 lotes classificados como confiáveis em 67 bairros. Essa classificação corresponde aos filtros adotados pelo pipeline. Ela não substitui certificação cadastral nem implica que todo polígono rejeitado seja incorreto: lotes de esquina, áreas especiais e exceções de projeto podem exigir tratamento específico.

O documento original também registra que um bom alinhamento global de uma planta não garantia alinhamento de todas as quadras. Um caso citado combinava indicador global de 0,99 com desvio angular de 42 graus em uma quadra. Por isso, a combinação com lotes sintéticos passou a considerar recortes locais, em vez de aceitar todo o desenho com uma única decisão.

### Pontos CNEFE e endereçamento municipal

Os conjuntos históricos mencionam 54.111 pontos municipais e 143.200 pontos CNEFE para São Carlos. Eles possuem origens e datas diferentes. Somá-los sem uma regra de deduplicação não produziria automaticamente uma contagem de endereços distintos. O título anterior que mencionava 166 mil pontos não vinha acompanhado, no trecho consultado, de uma composição suficiente para reproduzir esse total.

O projeto considerou indicadores de qualidade das coordenadas e uma tolerância espacial no casamento com lotes. No experimento descrito, contenção estrita associava 28,6% dos pontos; uma tolerância de oito metros elevou o indicador para 76,1%. A distância mediana registrada ao lote era de três metros, compatível com diferenças entre posição do endereço e geometria disponível.

Uma tolerância maior também pode associar pontos a lotes vizinhos. O percentual de casamento mede cobertura segundo a regra, não acerto individual de todas as associações. Da mesma forma, a ausência de um endereço no Censo 2022 não comprova que um terreno estivesse vazio ou permaneça vazio na data atual.

## 11 Etapas do processamento espacial

O runner consultado organiza aquisição de fontes, transformação dos dados e montagem. Há rotinas de rede e subetapas opcionais. Em vez de adotar uma contagem fixa de quatorze etapas para qualquer execução, é mais preciso identificar qual intervalo e quais opções participaram do processamento analisado.

### Preparação da base e das quadras

A etapa 0a cruza atributos OSM e contornos Overture. A 0b extrai faces do grafo formado pelas vias selecionadas, e a 0c organiza as edificações por quadra. Essa ordenação fornece índices usados pelo renderizador para localizar conjuntos espaciais sem percorrer toda a base da mesma maneira.

Na seleção de vias, o histórico diferencia ruas que delimitam quarteirões de caminhos internos. Incluir acessos de serviço, trilhas ou percursos de pedestres indiscriminadamente poderia subdividir uma quadra em partes que não correspondem à organização pretendida. A regra é uma escolha de representação do projeto, dependente da classificação disponível na base.

A etapa 1b complementa o cadastro de quadras com faces do grafo. O código consultado contém critérios de urbanização para esse complemento. O histórico compara 3.270 quadras com ambas as fontes e registra IoU mediana de 0,85 e contenção de 94% da quadra oficial na face. IoU expressa a área de interseção dividida pela área da união dos polígonos; não mede, sozinha, a exatidão de cada esquina.

### Espaço interno da quadra e lotes

A etapa 2 calcula o miolo disponível após considerar a faixa viária representada. A etapa 3 produz lotes sintéticos ao longo desse espaço. A etapa 4 combina os lotes derivados de plantas com os sintéticos, utilizando verificações locais. No código consultado, os comentários descrevem critérios como desvio angular e proporção fora do miolo.

A etapa 5 estima ocupação a partir das evidências disponíveis. A 6 prepara muros, e a 6b trata portões. A etapa 7 consolida volumes; a 7b prepara chão e asfalto. Montagem e QA completam o fluxo de saída. Essa descrição explica relações entre componentes, sem afirmar que todos sejam refeitos em cada comando.

O uso de endereço ou footprint como evidência permite controlar onde são produzidas casas. A interpretação continua sendo uma estimativa vinculada às fontes. Um lote com endereço não descreve a fachada, e um lote sem evidência pode refletir cobertura insuficiente da base, além da possibilidade de não estar ocupado.

## 12 Dependências entre etapas e tempo de processamento

O histórico registra ocorrências em que artefatos de etapas diferentes deixaram de corresponder entre si. Uma delas envolvia a ocupação armazenada por índice da lista de lotes. Se a lista é reordenada ou substituída, o mesmo índice pode passar a indicar outro elemento. A consequência pode aparecer na posição da casa, embora o arquivo de ocupação continue sintaticamente válido.

Outra ocorrência envolveu a etapa de volumes lendo quadras diferentes das utilizadas para calcular o miolo. O relato associa essa divergência a 11.237 descartes por sobreposição e a um recorte com cinco casas para 99 lotes classificados como ocupados. O resultado dependeu da incompatibilidade entre entradas, não apenas da contagem de lotes disponíveis.

A preparação de chão e asfalto também precisa acompanhar os limites usados nas etapas anteriores. O histórico descreve bairros com geometria de solo ausente e ruas ocupando áreas de casas quando essas listas divergiam. A compatibilidade espacial entre arquivos é, portanto, uma condição diferente da simples existência de todos eles na pasta.

### Verificação por conteúdo

O projeto registra hashes de conteúdo para decidir sobre reaproveitamento de saídas. Se um arquivo é regenerado com bytes idênticos, sua data pode mudar sem que o dado tenha mudado. Verificar apenas o horário marcaria desnecessariamente as etapas seguintes como desatualizadas.

O inverso também ocorre: diferenças de final de linha podem alterar os bytes sem alterar a intenção do texto. A revisão histórica da base 1.5 registra uma exportação com CRLF que invalidou cache de encaixes e outra com LF que reutilizou 50.277 encaixes. O custo observado depende de quais arquivos entram no hash e do que precisa ser recalculado.

### Tempos que constam no documento original

| Etapa descrita | Tempo histórico em segundos |
| --- | --- |
| Complemento de quadras | 41 |
| Miolo | 18 |
| Lotes sintéticos | 123 |
| Combinação de lotes | 68 |
| Ocupação e muros | 23 e 18 |
| Volumes | 76 |
| Chão e ruas | 3 e 68 |
| Montagem e QA | 0,2 e 41 |

As parcelas apresentadas somam 579,2 segundos. O total indicado no documento de origem era 485 segundos. Sem o log correspondente, não é possível atribuir a diferença a erro de transcrição, sobreposição, execuções distintas ou outro critério. Ambos permanecem identificados como registros históricos; não há um tempo atual de pipeline confirmado por esta revisão.

## 13 Formato dos dados e organização da geometria

O formato compacto descrito no histórico utiliza arrays para armazenar registros de edificações. Em vez de repetir nomes de propriedades para cada vértice, a sequência posiciona valores em campos conhecidos pelo leitor. Essa decisão reduz parte da repetição textual, mas exige que produtor e consumidor mantenham o mesmo contrato de estrutura.

O registro de uma edificação é descrito como classe, altura multiplicada por dez, quantidade de pontos e pares de deslocamentos. Os deltas são reiniciados a cada edificação. Dessa maneira, um registro pode ser movido para outra posição do array sem depender da última coordenada da construção anterior.

### Coordenadas geográficas e coordenadas locais

O documento de origem descreve uma projeção local aproximada por diferenças de longitude e latitude, usando fatores em metros por grau. Também descreve quantização em decímetros. É necessário distinguir o dado geográfico das fontes, o dado compacto preparado para renderização e a posição final usada pela cena: eles não precisam armazenar as mesmas unidades em todos os arquivos.

A fórmula histórica apresentada é x = (longitude − longitude de origem) × MLON e z = −(latitude − latitude de origem) × MLAT. O texto cita MLAT de 111.132,92 e MLON de 111.319,49 multiplicado pelo cosseno da latitude. Esses valores descrevem o esquema documentado; o formato de cada artefato deve ser confirmado no código que o escreve e no que o lê.

### Índice por quarteirão

O índice bl contém centro, raio, início e quantidade de registros de um grupo. Ele auxilia a seleção espacial e a montagem da cena. A referência histórica de setecentos metros corresponde a uma configuração daquela etapa; módulos de detalhes atuais possuem distâncias próprias. Não há motivo para aplicar uma única distância a todos os componentes urbanos.

### Precisão textual e precisão da fonte

A cronologia registra redução de 254,7 para 182,4 MB ao diminuir o número de casas decimais em coordenadas do acervo. Mais dígitos não significam que a fonte tenha a mesma precisão física. O efeito dessa transformação deve ser avaliado contra a escala de uso e a incerteza dos dados, sem converter resolução numérica em garantia de posição.

O documento também menciona 82,7 para 58,4 MB de memória gráfica após retirar atributos não utilizados. Trata-se de outra camada de custo: buffers enviados à GPU. Um arquivo compactado pode ser pequeno na rede e gerar buffers maiores depois de decodificado, assim como uma redução de memória não implica redução proporcional de tráfego HTTP.

## 14 Plantas internas e geração das paredes

O cadastro de uma unidade reúne dimensões, ambientes, aberturas, altura e mobiliário. No histórico, os arquivos ficam associados ao identificador do imóvel em plantas_fornecidas, ao lado de plantas e fotografias. As imagens funcionam como referências para interpretação, inclusive quando ajudam a identificar materiais ou a disposição de elementos que não estão claros no desenho.

A geração de paredes descrita utiliza os limites dos cômodos e uma grade de cinco centímetros para identificar divisas. Os segmentos são transformados em volumes, com espessura de treze centímetros no exemplo documentado. Esses valores pertencem à configuração relatada e não devem ser tratados como especificação construtiva de todas as unidades.

O histórico menciona cerca de dez kilobytes para uma representação de dados de interior. Esse número não equivale ao tamanho de uma experiência completa: código de renderização, catálogo de móveis, modelo do empreendimento e outros componentes também participam da página. Ele tampouco representa a memória ocupada pela geometria depois de criada.

### Extração assistida de uma planta

O procedimento registrado procura traços de parede e utiliza operações direcionais para reduzir interferência de texto e móveis. Uma abertura de sessenta pixels aparece no exemplo. A escala inferida nesse caso foi de 109 pixels por metro, próxima da anotação manual de aproximadamente 110 pixels por metro.

Reconhecer linhas não resolve integralmente o significado de cada região. O ensaio com watershed semeado em rótulos registrou 26% de dispersão conforme o critério utilizado. A identificação de ambientes e a separação entre área interna e exterior continuaram exigindo interpretação. O número caracteriza aquele experimento, não um limite universal da técnica.

A escala também foi estimada a partir de áreas rotuladas, com combinação geométrica das razões. A escolha procura trabalhar com relações multiplicativas entre área observada e área informada. Ela continua dependendo da correspondência entre os rótulos e as regiões medidas; um ambiente identificado incorretamente pode comprometer a estimativa.

### Correspondência entre anúncio e desenho

Um caso do histórico apresentou 64,40 m² e uma suíte na planta, contra 114,32 m² e três suítes na ficha. A ocorrência indica que os dois materiais não podiam ser tratados automaticamente como descrição da mesma unidade. A conferência envolve área, quantidade de ambientes, orientação e identificação do imóvel, além da legibilidade da imagem.

## 15 Empreendimentos sem correspondência direta na base urbana

Um lançamento pode não aparecer como torre na fonte de edificações utilizada pelo mapa. A captura pode ser anterior à construção, a detecção pode ter cobertura insuficiente ou o cadastro pode se referir a um projeto futuro. A ausência do contorno não permite escolher sozinha entre essas situações.

O histórico descreve a criação de um bloco de dados de lote com latitude, longitude e orientação. Esse registro permite posicionar a unidade e criar uma representação mesmo sem depender de um footprint existente. O restante do programa pode receber um objeto com estrutura compatível com os demais registros, reduzindo diferenças entre os caminhos de apresentação.

### Localização e confirmação

Foram usadas informações do anúncio, endereços próximos e imagens aéreas na preparação dos quatro lançamentos mencionados. A interpolação entre números vizinhos pode apoiar uma estimativa, mas não comprova a posição exata de um terreno. A ausência do número em uma base histórica de endereços também não prova que o local estivesse vazio.

Na inspeção atual, os quatro empreendimentos da lista do mapa exibiam “terreno não confirmado”. Essa indicação deve acompanhar a descrição da localização observada. O documento não transforma a existência de coordenadas no cadastro em confirmação independente de implantação.

### Representação por blocos

O campo lote.predio.blocos aparece no histórico como forma de descrever mais de um volume, cada qual com dimensões e rotação. Isso permite representar conjuntos em L, torres e portaria. Agrupar os volumes pode manter determinadas chamadas de desenho, dependendo de materiais e organização, mas não elimina o custo de armazenar e processar geometria adicional.

As miniaturas atuais utilizam também modelos preparados em Blender. O README descreve sacadas, guarda-corpos, esquadrias, peitoris, marquises e elementos de cobertura. Parte das dimensões e das faces não documentadas foi aproximada. No Colinas, o conjunto é descrito como quatro blocos representativos do cadastro, não como reprodução integral de uma implantação oficial.

### Unidade e pavimento

O destaque do andar conecta a ficha ao volume externo. A posição exata de uma planta dentro da laje exige informação além da área e do número do pavimento. O histórico da revisão 1.5 registra centralização quando o cadastro não fornece essa posição. Portanto, o destaque de um andar e a visualização de uma planta não equivalem, isoladamente, à confirmação da orientação real do apartamento.

## 16 Iluminação e materiais nos experimentos registrados

A aparência final de uma superfície depende de geometria, normais, material, fontes de luz, exposição e transformação de cor. Alterar o código hexadecimal de uma parede não garante que a diferença apareça com a mesma intensidade na imagem, porque essa cor participa de cálculos antes de ser apresentada na tela.

O histórico registra experimentos com ACES, iluminação hemisférica e paletas. Em uma comparação, a saturação medida passou de 0,059 para 0,077 com troca de cores, e depois para 0,084 após redução de dez por cento em um conjunto de valores. A proporção classificada como estourada caiu de 22,6% para 17,5%. Esses indicadores dependem do recorte, dos limiares e do tratamento da imagem.

O asfalto aparece em outro exemplo: uma cor de material 0x141B29 foi associada a uma leitura aproximada de 80, 97 e 123 na imagem observada de cima. A diferença ilustra a influência das condições de iluminação e apresentação. Não estabelece que asfalto deva ter sempre um determinado matiz no material.

### Materiais procedurais e imagens

Parte dos detalhes foi produzida por funções no shader, como padrões de telhas e variação de superfície. Isso pode evitar um arquivo de textura específico para aquele efeito e pode manter a organização de desenho existente. O shader, entretanto, precisa executar cálculos; a ausência de um download de imagem não significa ausência de custo no aparelho.

O conjunto atual também contém texturas, atlas e modelos preparados previamente. Por esse motivo, as frases históricas de que nenhuma imagem entra na página ou de que todo detalhe é feito sem geometria não foram mantidas como regra geral. Há diferentes técnicas utilizadas para elementos diferentes.

### Métricas visuais e objetivo da avaliação

O documento original relata um critério de luminosidade média entre 120 e 175 que influenciou a calibração de interiores. Um ensaio posterior registrou ausência de pixels abaixo de setenta e saturação média de 0,044. Passaram a ser consideradas também a presença de regiões escuras e de variação cromática.

Uma média de brilho resume apenas um aspecto de uma imagem. Cenas distintas podem ter a mesma média e distribuições de contraste diferentes. Da mesma forma, aumentar a proporção de sombras não significa necessariamente melhorar legibilidade ou correspondência com uma referência. O indicador precisa estar relacionado à pergunta que o ensaio pretende responder.

## 17 Sombras e comparação com Unreal

O histórico descreve um experimento no Unreal com geometria, móveis, câmera e luminárias equivalentes às usadas na comparação com Three.js. O brilho médio das imagens foi ajustado para a leitura relatada. A faixa dinâmica registrada foi de 64,1 em uma imagem e 156,8 na outra, aproximadamente 2,45 vezes a primeira medida.

Essa razão caracteriza a métrica aplicada às imagens do ensaio. Ela não informa, por si só, desempenho em tempo real, custo operacional, fidelidade arquitetônica ou preferência de usuários. Também não permite atribuir toda a diferença exclusivamente ao motor, sem considerar as configurações de iluminação, exposição e processamento envolvidas.

O relato menciona dificuldades para obter o resultado de Lumen em uma execução por commandlet e a necessidade, naquele fluxo, de permitir a evolução de quadros. A ocorrência permanece como particularidade do experimento documentado. Não é apresentada como impossibilidade geral de automação ou como avaliação atual das ferramentas do Unreal.

### Ocorrências de iluminação identificadas no projeto

Uma investigação encontrou ausência de castShadow em elementos da casa. A ativação dessa propriedade passou a permitir que tais elementos participassem da projeção de sombras prevista na cena. Isso é diferente de alterar o material da parede: muda a participação da geometria no cálculo de sombra.

Outra ocorrência envolvia superfícies quase coincidentes entre topo de parede e forro. O histórico a relaciona a z-fighting e registra aumento de seis centímetros na parede, com redução de um indicador de crista luminosa de +30,2 para +3,9. O ajuste descrito é uma solução daquele encontro geométrico, e não uma recomendação construtiva universal.

Um terceiro caso envolvia raios usados no bake de oclusão próximos ao piso. Raios que não encontravam superfície podiam contribuir como céu. O registro menciona mudança na altura mínima de origem e uma leitura de parede que passou de cem para 62 no recorte avaliado. Trata-se da resposta de um cálculo aproximado de iluminação naquele cenário.

### Sonda de ambiente e posição do sol

O uso de uma sonda no maior cômodo produziu uma representação do entorno luminoso que era reaproveitada em outras superfícies. O relato associa esse compartilhamento a paredes recebendo uma direção de luz que não correspondia à janela de seu próprio ambiente. Foi descrita uma alteração para reduzir essa dependência direcional na componente difusa.

Na cidade, a mudança da elevação solar de aproximadamente 48,7 para trinta graus foi associada a mais área de sombra nas imagens: de cerca de dois por cento para 18,8% na rua e 25,2% em um bairro. O dado documenta a influência da posição da luz no enquadramento, sem determinar uma posição solar correta para todos os objetivos de visualização.

## 18 Bibliotecas urbanas e estratégias de desenho

Árvores, móveis, casas e detalhes de quintal acrescentam variedade à cena. Seu custo depende não apenas da quantidade de triângulos, mas também de materiais, instâncias, sombras, atualizações e visibilidade. O projeto experimentou formas diferentes de distribuir essas geometrias entre grupos e objetos.

O histórico descreve vinte espécies de árvores preparadas no Blender e uso de InstancedMesh por espécie. A instanciação permite reutilizar uma geometria e um material para várias ocorrências, fornecendo transformações para posicioná-las. Isso pode reduzir submissões em comparação com objetos separados, embora cada ocorrência ainda participe de operações e ocupe dados de transformação.

### Mesclagem e limites de agrupamento

Mesclar geometrias por quarteirão reduz a quantidade de objetos independentes em determinadas situações. O agrupamento, porém, afeta a seleção de visibilidade: uma malha grande pode continuar sendo considerada visível quando apenas uma parte pequena aparece na câmera. A escolha envolve a granularidade espacial, e não apenas a menor contagem possível de objetos.

Uma tentativa de aplicar agrupamento a árvores encontrou uma célula com 59.935 ocorrências, segundo o documento original. O sintoma relatado foi interrupção da entrega de outras partes da cena. O caso não demonstra que mesclagem seja inadequada em qualquer vegetação; indica que aquele tamanho e fluxo de processamento precisavam ser tratados.

### Frustum e área visível

O frustum é a região que a câmera pode enxergar. O teste de visibilidade usa limites geométricos para decidir se um objeto pode ser descartado antes do desenho. Uma esfera de limite excessivamente ampla pode manter objetos no processamento por mais tempo. O histórico vincula uma correção nessa seleção à mudança de 838 para 172 chamadas em um ensaio.

### Distância e detalhes atuais

No módulo de exteriores consultado, as configurações compacta e comum usam limites distintos: 240 ou 360 m para a faixa de detalhes e tetos diferentes de muros e quintais. Há também controle de requisições simultâneas, com quatro ou seis cargas no trecho examinado. Esses números pertencem ao módulo e não descrevem toda a política de visibilidade da cidade.

A presença de limites por distância e quantidade indica como o código administra recursos. Para avaliar seu efeito em um aparelho, seria necessário medir o percurso, a taxa de quadros, as tarefas de CPU e a memória. O formato da estratégia não determina antecipadamente o resultado de desempenho.

## 19 Testes e instrumentos de observação

O projeto reúne validações geométricas, testes de módulos e sondas de navegador. O histórico menciona dezenove verificações agrupadas entre geometria e comportamento. A quantidade de verificações e seus nomes descrevem o conjunto daquele registro; não significam cobertura de todos os comportamentos possíveis.

Na modularização, testes de equivalência usaram versões históricas do código recuperadas pelo Git. O documento original menciona 41 testes com essa característica. O mecanismo ajuda a preservar resultados nos casos exercitados, mas pressupõe que o comportamento de referência seja apropriado ao objetivo e que as entradas relevantes estejam representadas.

### O próprio teste pode observar a coisa errada

Um caso relatado utilizava o caminho padrão de saída, em vez do destino da montagem em avaliação. Assim, o teste consultou um arquivo anterior. Outro envolvia um limiar de realce que não era alcançado na imagem da cena e podia ser influenciado pelo texto da interface. Em ambos, a interpretação do resultado dependia de verificar o objeto efetivamente medido.

A geração determinística também foi tratada. O histórico descreve o uso de hash de string do Python em uma distribuição que mudava entre execuções e sua substituição por crc32. A mudança buscava manter a mesma entrada associada ao mesmo resultado. Isso é relevante para comparações de imagem, nas quais variação não intencional pode parecer mudança funcional.

### Navegador sem interface e captura

Foram registrados problemas de animação em abas ocultas, leitura do buffer fora do momento de renderização e coleta de console por stderr. O texto de origem associa uma alteração de comportamento do Chrome 151 a falhas de coleta e relata o uso de chrome-headless-shell. Trata-se de experiência registrada no ambiente de teste, sem nova comparação dessas versões nesta revisão.

O README das miniaturas também descreve cuidados com o instante de captura e com a renderização da câmera da visita. Verificar apenas a existência de um canvas ou de um botão não confirma que a cena correta esteja visível. Captura de pixels, estado da interface e logs fornecem informações complementares.

### Resultado local de 22 de setembro

A suíte Node executou 113 testes, com 103 aprovações e dez falhas, em aproximadamente 40,3 segundos. Entre os erros há referência a PLANTA não definida no contexto de um teste do loop. A causa de cada falha não foi isolada nesta revisão. Os 43 testes Python aprovados pertencem ao registro de 21 de setembro e não foram executados novamente.

## 20 Publicação observada e navegação disponível

O acesso principal consultado foi https://imobilaria-deccb.web.app/. A página de entrada encaminhou para o arquivo versionado sao-carlos-exteriores-f16b0250b705. O mapa carregado mostrou busca, orientação ao norte, controles de ruas, relevo, qualidade gráfica e a lista de inspeção. A cena foi observada em navegador de computador, sem avaliação em aparelho físico móvel.

A lista apresentava sete casas e quatro empreendimentos. Os nomes destes últimos eram Monte das Colinas, Monte dos Cedros, Sanca 135 e Wish Passeio das Castanheiras. As entradas exibiam informações diferentes conforme o cadastro, incluindo valores ou referência à planta 3D. O texto “Entorno ilustrativo” estava presente na interface.

### Site de miniaturas

A galeria em https://imobilaria-deccb-miniaturas.web.app/ contém três páginas de exploração. Cada cartão inclui uma imagem de apresentação e links para abrir a maquete, o projeto Blender e o modelo GLB. Esses links de download não significam que os arquivos sejam carregados automaticamente ao abrir a página da unidade.

Na miniatura do Cedros, a ficha observada mostrou 37,3 m² de área útil, um dormitório, um banheiro, uma vaga, pé-direito de 2,60 m e pavimento oitavo de quinze. O valor estava sob consulta. Esses são dados exibidos pela página, não medidas ou condições comerciais verificadas de maneira independente.

### Ações conferidas no Cedros

Foi selecionada a planta 3D, que expôs os controles de girar, mover e móveis. A abertura do editor apresentou catálogo, seleção, posicionamento, rotação, exclusão, desfazer e restauração. O painel foi fechado sem alteração do cadastro. Depois, a visita foi aberta e a cena interna foi observada. A planta 2D também foi selecionada e identificada na interface.

O roteiro confirma essas transições na sessão consultada. Não incluiu edição completa de mobiliário, teste de todas as colisões, caminhada por todos os ambientes ou repetição em cada empreendimento. A inspeção do código fornece o mecanismo dessas funções, enquanto o roteiro de navegador fornece evidência de ações específicas.

### Relação entre os dois sites

O Cedros apresentava “Ver mapa”, e o mapa oferecia retorno à miniatura. Abrir o mapa navega para outro documento e muda o conjunto de dados carregados. O estudo de transferência das miniaturas exclui essa navegação. Manter o link no HTML acrescenta texto e código de interação, mas não equivale a baixar o conteúdo de destino durante a abertura direta examinada.

## 21 Distribuição do trabalho entre preparação servidor e navegador

A preparação inclui processamento geográfico em Python e produção de modelos ou imagens em ferramentas como Blender. Essas tarefas podem envolver cálculos extensos, leitura de bases, triangulação, texturas e exportação. Seu custo acontece ao produzir ou atualizar os artefatos; não é automaticamente repetido para cada pessoa que abre a página publicada.

O servidor de Hosting recebe requisições e entrega recursos. Na arquitetura das miniaturas examinadas, o conteúdo principal é um HTML estático. Não foi identificado um processo remoto que renderize os quadros da visita e os transmita como vídeo. O computador ou celular do visitante executa JavaScript e utiliza sua GPU para apresentar a cena.

### O que acontece depois do download

O navegador precisa descomprimir a resposta, interpretar o HTML e o JavaScript, criar estruturas de dados, preparar geometrias e materiais e apresentar os primeiros quadros. O fato de todos os dados estarem incorporados não elimina esse processamento. Duas páginas com o mesmo tamanho transferido podem ter tempos de inicialização diferentes.

Durante a interação, controles de câmera, seleção e movimentação de móveis são executados localmente no código examinado. A persistência do editor Cedros usa localStorage. Isso armazena uma representação no navegador; não equivale a enviar alterações a outro visitante, a outra máquina ou ao cadastro central.

### O caso do mapa

O mapa usa uma combinação de conteúdo incorporado e recursos externos. O módulo de exteriores consulta tiles, descomprime seus dados e administra sua permanência de acordo com a região necessária. A renderização continua ocorrendo no aparelho, mas a navegação pode provocar novas transferências.

É importante separar o streaming de recursos pela rede da seleção de geometria na GPU. Um conjunto pode já estar em memória do navegador e apenas ser incorporado à cena quando necessário. Em outro fluxo, pode ser preciso buscá-lo pela rede antes disso. O termo “streaming” sozinho não informa qual dessas operações acontece.

### O significado de peso para o servidor

Neste estudo, há medição direta de transferência HTTP e observação da forma de entrega. Não há leitura de CPU, RAM ou conexões no provedor. Portanto, a descrição de arquivos estáticos permite caracterizar a arquitetura, mas não atribuir um percentual de uso de servidor. A capacidade de um servidor próprio também dependeria de banda, configuração, cache e volume de novas requisições.

## 22 Método e resultados de transferência das miniaturas

As medições de 22 de setembro utilizaram GETs com Accept-Encoding: gzip para as páginas publicadas. Foi contado o corpo recebido antes da descompressão. Em seguida, o conteúdo descomprimido foi comparado com o HTML local correspondente. As três miniaturas apresentaram igualdade de conteúdo na comparação realizada.

Os valores abaixo utilizam unidades decimais: um kilobyte corresponde a mil bytes, um megabyte a um milhão e um gigabyte a um bilhão. Essa convenção evita misturar KB e MB com unidades binárias como KiB e MiB. A coluna de transferência não inclui cabeçalhos nem o estabelecimento de conexão.

| Página | HTML em bytes | Corpo gzip em bytes | Redução aproximada |
| --- | --- | --- | --- |
| Monte dos Cedros | 3.361.828 | 673.852 | 80,0% |
| Monte das Colinas | 3.316.385 | 651.191 | 80,4% |
| Wish Castanheiras | 4.001.617 | 679.222 | 83,0% |

### O que explica a diferença entre as colunas

O HTML contém texto, código e dados com repetição que podem ser comprimidos. O gzip reduz os bytes transmitidos, mas o navegador precisa recuperar o conteúdo antes de utilizá-lo. O tamanho descomprimido também não representa toda a memória de execução, pois objetos JavaScript, buffers de geometria e texturas podem ocupar estruturas diferentes da representação textual.

O Castanheiras possui o maior HTML dos três, mas sua transferência gzip é próxima da do Cedros. A relação depende do conteúdo e de quanto ele se repete. Por isso, comparar apenas o tamanho dos arquivos locais não reproduz necessariamente a comparação de tráfego.

### Relação com os modos de visualização

O código incorporado contém recursos para prédio, conjunto, plantas e visita. Abrir um modo a partir da mesma página não exige, pelo fluxo analisado, baixar novamente seu HTML inteiro. A análise não identificou consulta ao banco necessária a essas operações nas miniaturas.

Essa informação resulta da leitura do código e do roteiro parcial de interface. Não foi registrada uma captura de rede exaustiva de todos os cliques nas três unidades. Recarregar a página, acessar outro imóvel, abrir o mapa ou solicitar um arquivo de download são ações distintas e podem transferir novos recursos.

As medições usaram gzip especificamente. Outra negociação de conteúdo, alteração do HTML ou configuração futura de Hosting pode produzir números diferentes. Os valores são uma fotografia da resposta observada, não um tamanho fixo inerente a uma “miniatura 3D”.

## 23 Cache retornos e alterações de conteúdo

As miniaturas responderam com Cache-Control: public, max-age=0, must-revalidate e com ETag. Essa configuração permite guardar uma cópia, mas exige verificação de validade para reutilizá-la nas condições de revalidação. O ETag funciona como identificador da versão do recurso que pode ser apresentado ao servidor em uma requisição condicional.

Na segunda requisição de cada miniatura, foi enviado If-None-Match com o ETag recebido. As três respostas foram HTTP 304, com corpo de zero bytes. A entrada da galeria também respondeu dessa forma. O resultado confirma que o servidor aceitou a revalidação naquele teste, com o conteúdo inalterado.

### Corpo vazio não significa comunicação inexistente

Uma resposta 304 ainda envolve requisição, cabeçalhos e processamento de protocolo. O que se evita é o reenvio do corpo quando uma cópia válida já está disponível no cliente. Uma pessoa que nunca abriu a página, limpou o cache ou recebeu uma versão nova pode precisar do download integral.

O teste condicional foi feito por requisição HTTP controlada. Ele não mediu a taxa de aproveitamento do cache de uma população real de navegadores. Políticas locais, espaço disponível, navegação privada e atualizações podem alterar essa taxa. Assim, não foi aplicado um desconto presumido de cache às projeções principais.

### Biblioteca incorporada em cada unidade

Cada HTML autocontido inclui sua cópia do código e dos dados necessários. Uma visita a outro imóvel tende a transferir o novo documento completo se não houver uma cópia válida dele. O navegador não reaproveita automaticamente partes textuais idênticas embutidas em dois HTMLs como se fossem um arquivo externo compartilhado.

Uma alternativa técnica seria separar bibliotecas comuns e usar arquivos versionados. Isso poderia permitir reaproveitamento entre unidades, mas mudaria a forma de distribuição e introduziria requisições separadas. O ganho dependeria da proporção de código compartilhado, do percurso do usuário e das condições de cache. Não foi implementado nem medido neste estudo.

### Política diferente no mapa

O mapa versionado respondeu com Cache-Control: public, max-age=31536000, immutable. Essa resposta instrui o cliente a conservar o recurso por um prazo longo. O funcionamento esperado depende de vincular mudanças de conteúdo a novos endereços, enquanto a entrada do site direciona para a versão adequada. O cabeçalho foi observado; não houve ensaio completo de atualização entre releases em diferentes navegadores.

## 24 Galeria arquivos de download e armazenamento

A página inicial da galeria transferiu 1.600 bytes gzip e continha 3.671 bytes descomprimidos. Ela referencia três PNGs: duas imagens de detalhe de Cedros e Colinas e um preview de Castanheiras. Os arquivos locais preparados para publicação somam 2.583.491 bytes, distribuídos em 858.667, 816.147 e 908.677 bytes.

Esses PNGs não foram baixados novamente na medição. A estimativa do percurso galeria seguida de uma miniatura utiliza seus tamanhos locais e pressupõe entrega nesses tamanhos, ausência de cache e carregamento das três imagens. Os elementos examinados não declaravam lazy loading.

### Percursos com transferências diferentes

No acesso direto a uma miniatura, o corpo medido fica entre 651.191 e 679.222 bytes. Passando pela galeria antes, a soma estimada fica entre 3.236.282 e 3.264.313 bytes. Abrir as três miniaturas diretamente, sem cache, soma 2.004.265 bytes de HTML gzip; acrescentar a galeria e suas imagens leva a aproximadamente 4,59 MB.

Essas somas descrevem percursos específicos. Uma pessoa pode entrar na galeria, abrir só um imóvel e sair; outra pode retornar a uma página já guardada; outra pode baixar um modelo. Contar “visitantes” sem descrever as ações não é suficiente para reproduzir o consumo de dados.

### Downloads opcionais

A galeria oferece projetos Blender e modelos GLB. No conjunto local, os GLBs têm tamanhos próximos de 0,9 MB cada. Os arquivos Blender podem ter conteúdo diferente, incluindo elementos de edição. Eles não foram somados à abertura normal do HTML porque são links opcionais e não recursos necessários à exibição observada.

Uma previsão que inclua esses downloads precisa acrescentar quantidade e tamanho por tipo de arquivo. O nome “miniatura” não define quais materiais adicionais uma pessoa pode solicitar. O cálculo deve acompanhar as requisições efetivamente realizadas.

### Tamanho preparado para publicação

O preparador das miniaturas lista treze arquivos: entrada, três páginas, três imagens, três GLBs e três projetos Blender. O conjunto local ocupa 18.821.140 bytes. Os três HTMLs das maquetes somam 10.679.830 bytes antes da compressão HTTP.

Esse total local não é uma leitura do armazenamento faturado no Firebase. Versões anteriores e outros sites podem participar do consumo do projeto. A presença de um arquivo publicado também não significa que ele será transferido a cada visitante. Armazenamento e tráfego variam segundo mecanismos diferentes.

## 25 Mapa completo e recortes por imóvel

O documento entregue pelo endereço versionado do mapa transferiu 9.801.638 bytes com gzip e apresentou 13.957.621 bytes após a descompressão HTTP. O conteúdo correspondeu ao arquivo local preparado com o mesmo nome. Essa medição foi realizada separadamente da abertura das miniaturas.

O valor descomprimido descreve o documento que o navegador recebeu, não toda a cena expandida em memória. O projeto também utiliza formatos de empacotamento e recursos externos. O tamanho da resposta inicial não inclui automaticamente todos os tiles que uma navegação pela cidade pode solicitar.

### Três números com significados distintos

O histórico menciona 32,9 MB para uma página aberta e 14,0 MB para um artefato comprimido do projeto. Também menciona aproximadamente 4,5 MB gzip em um recorte por imóvel, com raio de 2,5 km. Essas medidas pertencem a saídas e ensaios anteriores. A resposta atual de 9,80 MB gzip do mapa não deve ser comparada a elas sem identificar qual conteúdo e qual compressão estão envolvidos.

Uma página pode conter um pacote interno comprimido e, adicionalmente, receber compressão HTTP. Descomprimir o protocolo não significa necessariamente expandir todos os dados internos para a forma usada pela aplicação. Essa distinção ajuda a explicar por que “aberto”, “comprimido” e “transferido” precisam vir acompanhados do método.

### Elementos que não diminuem apenas pelo raio

O registro histórico do recorte menciona aproximadamente 5,58 MB de biblioteca exterior e 4,80 MB de código, móveis, árvores e texturas, totalizando cerca de 10,4 MB em sua representação local. Essa parcela não variava diretamente com a área urbana selecionada no ensaio. Diminuir a cidade não elimina componentes compartilhados da aplicação.

A miniatura independente possui outro conjunto de conteúdo e não corresponde simplesmente ao mapa com raio reduzido. Ela concentra a experiência no empreendimento e na unidade, dispensando a preparação da cidade ao redor naquele documento. A comparação entre as duas entradas, portanto, também é uma comparação de escopo funcional.

### Relação observada sem projeção de capacidade

O corpo inicial do mapa medido foi aproximadamente 14,4 a 15,1 vezes o corpo das miniaturas. Essa razão descreve apenas as respostas comparadas. Não representa razão de tempo de carregamento, memória, custo por sessão ou dificuldade de renderização. O percurso urbano pode acrescentar tiles, e o tempo de inicialização de cada experiência depende do processamento necessário no cliente.

## 26 Projeções de tráfego e custo de transferência

O cenário principal adota 0,70 MB por abertura direta com transferência integral. É um arredondamento dos corpos gzip medidos, sem modelagem exata de todos os custos de protocolo. Abertura significa carregar o documento; alternar de planta para visita dentro dele não é contabilizado como novo download completo.

| Aberturas por mês | Corpo estimado | Custo de transferência estimado no Blaze |
| --- | --- | --- |
| 1.000 | 0,7 GB | US$ 0,00 |
| 10.000 | 7 GB | US$ 0,00 |
| 100.000 | 70 GB | US$ 9,00 |
| 1.000.000 | 700 GB | US$ 103,50 |

A referência oficial consultada em 22 de setembro informa franquia de 10 GB por mês e US$ 0,15 por GB excedente no Firebase Hosting Blaze. As cotas são do projeto e a transferência pela CDN é contabilizada. No Spark, atingir a franquia está sujeito a limite de serviço, sem a cobrança automática de excedente prevista no Blaze. [6]

### Premissas da tabela

A tabela supõe que toda a franquia esteja disponível para as miniaturas. O cálculo é: aberturas multiplicadas por 0,70 e divididas por mil para obter GB; depois, aplica-se US$ 0,15 à parcela acima de dez GB. Não foram incluídos tributos, câmbio, outros serviços, armazenamento excedente ou tráfego do mapa.

Se outros acessos já tiverem consumido a franquia, cem mil aberturas diretas representam aproximadamente US$ 10,50 de transferência adicional, e não US$ 9. Essa diferença decorre apenas da franquia remanescente. Nenhum dos valores é uma previsão da fatura real, pois o plano e a utilização do projeto não foram consultados.

### Percurso pela galeria

Com 3,30 MB como arredondamento para galeria mais uma miniatura, cem mil percursos completos sem cache resultariam em aproximadamente 330 GB. Sob a mesma hipótese de franquia integral disponível, a parcela estimada de transferência seria de US$ 48. Downloads opcionais e outros serviços precisariam ser acrescentados.

### Cache como variável de cenário

Em um exemplo puramente hipotético, cem mil aberturas com trinta mil transferências integrais a 0,70 MB produziriam 21 GB de corpos completos. As demais revalidações ainda teriam tráfego de protocolo. A participação de retornos com cache não foi medida, portanto esse exemplo explica a variável sem propor uma taxa esperada para o público do projeto.

## 27 Banda simultaneidade e experiência no aparelho

A quantidade de pessoas com a página aberta é diferente da quantidade de pessoas que iniciam o download ao mesmo tempo. Nas miniaturas, os quadros são produzidos no aparelho depois do carregamento. Uma sessão longa de exploração não equivale a transmissão contínua de vídeo do servidor.

Com o orçamento de 0,70 MB, dez novas aberturas por segundo representam cerca de sete MB/s ou 56 Mbit/s de corpo. Cem novas aberturas por segundo representam setenta MB/s ou 560 Mbit/s. São conversões aritméticas, sem teste de concorrência e sem acréscimo dos custos de protocolo.

Esses valores podem ajudar a descrever a banda necessária em um cenário, mas não identificam quantos usuários o Firebase ou uma máquina própria suportariam. A capacidade depende do serviço, rede, comportamento de cache, distribuição das requisições e demais componentes utilizados. Não foi executado ensaio de carga nesta revisão.

### Tempo de transferência e tempo até interação

Uma transferência de 0,70 MB corresponde a 5,6 megabits. Em uma conexão que entregasse continuamente dez megabits por segundo para esse recurso, a divisão simples daria 0,56 segundo de corpo. Essa conta exclui latência, conexão, concorrência, variação de velocidade, descompressão e preparação da cena. Não é uma promessa de tempo de carregamento.

Depois de receber o arquivo, o navegador ainda precisa criar objetos, enviar buffers e preparar shaders. A primeira interação pode ocorrer antes ou depois de outros eventos da página, dependendo do fluxo. Medir apenas a conclusão da requisição não identifica necessariamente o momento em que girar ou caminhar se torna responsivo.

### Memória e qualidade gráfica

A memória de execução contém estruturas que não aparecem com o mesmo tamanho no HTML. Geometrias podem usar arrays tipados, texturas podem ocupar memória gráfica e renderizações auxiliares podem exigir buffers adicionais. O tamanho gzip não permite calcular essa ocupação por uma multiplicação única.

O consumo de bateria e a fluidez dependem também de resolução, densidade de pixels, frequência de quadros e tempo de atividade. A inspeção em navegador de computador não substitui medição em celular físico. O estudo atual permite descrever transferência e arquitetura; outras dimensões permanecem como perguntas de medição.

## 28 Situação dos pontos de atenção registrados

O documento original reunia pendências de produto, organização, dados e segurança. Para atualizar essa parte sem transformá-la em parecer, cada tema precisa ser associado ao que foi observado e ao que ainda dependeria de verificação. Um item histórico não permanece automaticamente aberto, assim como a existência de código relacionado não demonstra que ele tenha sido resolvido em produção.

### Cadastros e operação multiempresa

O arquivo local de regras Firestore consultado contém condições de leitura, criação e atualização por coleção. O trecho de criação em usuarios exige autenticação sem comparar, nessa condição, o uid do caminho ao usuário autenticado. A atualização de imóveis verifica associação à imobiliária do recurso existente. Essas são descrições do arquivo local; a revisão não consultou regras implantadas nem executou cenários no emulador.

Operação multiempresa exigiria relacionar regras, autenticação, dados e fluxos realmente expostos. A presença da dependência Firebase no projeto não demonstra que as miniaturas façam consultas ao Firestore durante a visita. Essas duas questões devem permanecer separadas.

### Representação e atributos do imóvel

Os registros anteriores mencionam localização estimada de empreendimentos, centralização da planta na laje e distinção entre área útil e total. A inspeção atual observou avisos de representação ilustrativa e de terreno não confirmado. Não houve conferência arquitetônica ou comercial independente dos cadastros, e a semântica de cada campo não foi reavaliada em todas as unidades.

### Caminhos comerciais e definição de categorias

A discussão histórica sobre loja e prestador de serviço envolve modelos de cadastro diferentes: endereço fixo, área de atendimento, estoque e agenda não representam a mesma informação. O documento não define essa decisão de produto. Na miniatura do Cedros observada, os controles descritos eram de visualização; não foi identificado no roteiro um botão de contato ou agendamento.

### Outras cidades e validação com pessoas

O histórico menciona 59.737 casas não geradas em um ensaio de Ribeirão Preto e ajustes ligados a recuos. Essa ocorrência não foi reexecutada e não é apresentada como estado atual da cidade. Também não foram consultados registros suficientes para afirmar a realização ou ausência de testes de uso fora do material analisado. A documentação de uma avaliação deveria indicar participantes, tarefas, ambiente e resultados observados.

## 29 Como aprofundar as medições sem antecipar conclusões

Uma avaliação posterior pode ser organizada por perguntas. Para rede, a pergunta é quais recursos são solicitados em cada percurso e quanto cada um transfere. Para inicialização, é quando a cena aparece e quando os controles respondem. Para interação, é como o tempo de quadro e a memória variam ao alternar modos ou editar mobiliário.

### Roteiro de rede

O primeiro cenário seria abrir cada miniatura diretamente com cache vazio. O segundo seria retornar com cache disponível. Um terceiro poderia passar pela galeria e abrir uma ou mais unidades. Em cada execução, seriam registrados URL, status, codificação, corpo transferido, duração e origem do recurso no cache, quando a ferramenta permitir identificar isso.

O roteiro incluiria prédio, conjunto, planta 2D, planta 3D, visita e editor quando disponível. Seria possível verificar se cada ação gera novas requisições, em vez de inferir esse comportamento apenas pela leitura do código. A captura deveria distinguir downloads voluntários, navegação para o mapa e requisições da experiência principal.

### Roteiro de processamento

Para comparar aparelhos, seria necessário registrar modelo, sistema, navegador, resolução e condições de energia. O mesmo percurso deveria ser repetido com parâmetros equivalentes. Tempo até primeira cena, tempo até interação, distribuição dos tempos de quadro e memória seriam medidas separadas. Uma média de FPS isolada pode ocultar pausas longas entre quadros.

Não há limiar de aprovação imposto por este documento. Um limite aceitável depende do uso pretendido, do público e das condições alvo. Antes de definir esse limite, os dados podem ser apresentados como distribuições e ocorrências: quantas execuções, quais variações e em que etapa aparecem atrasos.

### Roteiro de uso

Para compreender a experiência, tarefas como localizar a área, identificar o pavimento, interpretar a planta, entrar e sair da visita ou ajustar um móvel podem ser observadas com participantes. Os registros poderiam separar conclusão da tarefa, tempo, necessidade de ajuda e interpretações divergentes. Isso produz informação sobre uso sem assumir que maior permanência na cena representa maior utilidade.

Esses procedimentos são possibilidades de aprofundamento. Não foram executados como parte deste documento e não constituem recomendação de alteração automática do produto. Seu papel é indicar como uma questão ainda aberta poderia receber evidência diretamente relacionada a ela.

## 30 Glossário e distinções usadas no estudo

### Dados e representação

Footprint é um contorno em planta associado a uma edificação. Lote é uma parcela de terreno na representação cadastral ou estimada. Quadra é o agrupamento espacial normalmente delimitado pelas vias selecionadas. Unidade é o imóvel específico com informações próprias. Essas entidades podem se relacionar, mas não possuem correspondência obrigatória de um para um.

Raster é uma imagem organizada em pixels. Vetor é uma representação por pontos, linhas e polígonos. Vetorizar transforma características da imagem em geometria; georreferenciar associa essa geometria a um sistema de coordenadas. Nenhuma das operações, isoladamente, garante que o resultado coincida com uma divisa levantada em campo.

### Preparação e execução

Pipeline é a sequência de transformações e verificações que prepara os dados. Build é a montagem de um artefato de saída. Deploy é a publicação desse artefato em um serviço. Uma montagem local concluída não confirma, sozinha, que a mesma versão esteja publicada, e um deploy concluído não valida todos os comportamentos da página.

HTML autocontido reúne em um documento os recursos necessários a determinado escopo. GLB é um formato binário de intercâmbio de cenas e modelos glTF. Um projeto Blender contém material de edição; não deve ser confundido com o arquivo que o navegador precisa receber para a visualização examinada.

### Rede e cache

Corpo HTTP é o conteúdo de uma resposta, separado dos cabeçalhos. Gzip é a codificação de compressão utilizada nas medições. ETag identifica uma versão de recurso para validação. HTTP 304 informa, na requisição condicional, que o corpo pode ser reaproveitado da cópia existente. CDN é uma rede de distribuição de conteúdo; cache no servidor de distribuição e cache no navegador não são a mesma coisa.

### Desenho e memória

Chamada de desenho é uma submissão de trabalho gráfico. Triângulos compõem a malha renderizada. Instanciação reutiliza geometria para várias ocorrências. Frustum corresponde à região visível da câmera. Shader é o programa que participa do processamento gráfico. Esses componentes contribuem de maneiras diferentes para o tempo de quadro.

RAM é memória de trabalho do sistema; memória gráfica guarda recursos utilizados pela GPU, com particularidades conforme o aparelho. FPS mede quadros por segundo, enquanto tempo de quadro descreve a duração de cada atualização. Nenhuma dessas grandezas pode ser deduzida diretamente do número de megabytes transferidos pela rede.

## 31 Evidências utilizadas e limites de atualização

Esta versão extensa utiliza o histórico do documento fornecido e as verificações realizadas em 22 de setembro de 2026 durante a revisão. A ampliação editorial acrescenta explicações, contexto e distinções entre medidas; não apresenta os experimentos históricos como se tivessem sido novamente executados.

A observação atual abrange leitura de arquivos e configurações, consulta ao histórico Git recente, acesso ao mapa publicado, roteiro parcial na miniatura Cedros, comparação dos HTMLs locais e publicados, requisições HTTP gzip, revalidação por ETag e execução da suíte Node. Nenhuma configuração de publicação ou código de produção foi alterado para elaborar o estudo.

### Limites da verificação

Não foram refeitos os downloads das fontes geográficas, a reconstrução completa das cidades, os ensaios históricos de iluminação ou a suíte Python. Não houve teste de carga concorrente, inspeção da fatura, medição de CPU do provedor nem ensaio em celular físico. As regras Firestore foram lidas localmente, sem confirmação de implantação. A captura de rede não cobriu todas as interações das três miniaturas.

As divergências encontradas no material original foram explicitadas em seus contextos. Isso inclui a contagem de testes Node, a soma dos tempos do pipeline, o total de endereços não reproduzido no trecho histórico e as afirmações gerais sobre ausência de recursos externos. A distinção permite preservar a cronologia sem transportar automaticamente cada frase antiga para a descrição atual.

### Referências

[1] Cronologia do projeto Imobiliária.docx. Documento fornecido pelo usuário, datado de 22 de setembro de 2026. Fonte dos acontecimentos e métricas históricos, salvo indicação de verificação atual.

[2] README.md, REVISAO-1.5.md, v1.5/LEIA-ME.md e registros locais de cronologia. Histórico Git consultado, incluindo 46c1c0c, de 20 de setembro, e da01e5d e a3502ce, de 21 de setembro de 2026.

[3] Código e configuração local consultados: pipeline/rodar.py; pipeline/build/config.py; v1.5/miniaturas/pagina_maquete.py, editor_cedros.js, caminhada.js, castanheiras.js e preparar_publicacao.py; v1.5/renderizador-v16-moveis/exterior-details.js e módulos incorporados; firebase.json; firebase.miniaturas.json; firebase/firestore.rules.

[4] Mapa publicado. https://imobilaria-deccb.web.app/ e destino observado /mapa/sao-carlos-exteriores-f16b0250b705. Consulta e medição HTTP em 22 de setembro de 2026.

[5] Site das miniaturas. https://imobilaria-deccb-miniaturas.web.app/. Documentos medidos: maquete-monte-dos-cedros-37.html, maquete-monte-das-colinas-39.html e maquete-wish-castanheiras-58.html. Consulta e medição HTTP em 22 de setembro de 2026.

[6] Firebase Hosting. Learn about usage levels, quotas, and pricing for Hosting. https://firebase.google.com/docs/hosting/usage-quotas-pricing. Referência oficial consultada em 22 de setembro de 2026 para a parcela de transferência dos cenários.

## 32 Do link e das imagens ao cadastro do imóvel

A produção de uma miniatura envolve a preparação dos dados, a autoria da geometria e a montagem de uma página interativa. O gerador atual de HTML recebe uma unidade já cadastrada. Seu parâmetro --unidade identifica esse cadastro; ele não recebe um link de anúncio para executar automaticamente toda a produção. Portanto, o intervalo entre receber o material e publicar uma página inclui trabalho anterior à execução do gerador.

### Recebimento e identificação das referências

O link fornece a origem da ficha comercial e das imagens disponíveis. A primeira etapa consiste em identificar empreendimento, tipologia, área, dormitórios, pavimento e referências de fachada e planta. Diferentes plantas do mesmo anúncio precisam ser relacionadas à unidade correta. Uma fotografia de fachada, uma perspectiva comercial e uma planta baixa oferecem informações distintas e não se substituem.

No cadastro do Monte dos Cedros, a procedência registrada informa extração do anúncio em 4 de setembro de 2026, a partir de template.data.launch em __NEXT_DATA__. Esse registro histórico descreve como os dados foram obtidos; não constitui uma nova conferência do anúncio nesta revisão. O cadastro também distingue a fonte da vaga de garagem da fonte da ficha comercial. O preço é nulo e aparece como sob consulta, em vez de converter o zero presente na origem em um preço de venda.

### Leitura da planta e transformação em medidas

O script pipeline/extrair_planta.py separa detecção de linhas e montagem da leitura. A detecção usa processamento de imagem para localizar traços horizontais e verticais. A identificação de qual região corresponde a cada cômodo e a leitura das áreas exigem interpretação, que pode ser realizada por uma pessoa ou por um modelo de visão. O cálculo posterior encaixa contornos nas linhas detectadas e verifica a escala. Essa separação evita apresentar o reconhecimento semântico da planta como uma operação inteiramente resolvida pela detecção de traços.

Em uma planta cotada, as dimensões fornecem referências diretas. Quando não há cotas, a área declarada pode orientar a escala, acompanhada de verificações auxiliares e do registro das hipóteses. O cadastro Cedros registra uma planta sem cotas, área de referência de 37,28 m² e escala calculada de 67,19 pixels por metro. Louças e eletrodomésticos desenhados foram usados como comparação de proporções. Essas comparações dependem da representação gráfica e não equivalem a um levantamento dimensional no local.

O mesmo cadastro registra pé-direito de 2,60 m como valor adotado, pois o desenho não o informa. O campo escala_conferida deve ser interpretado dentro desse método: ele não transforma cada medida ou hipótese do modelo em uma dimensão documentalmente comprovada. Manter a origem de cada informação permite revisar a miniatura quando surgir uma referência melhor.

### Dados que alimentam a cena

O arquivo unidade.json reúne ficha, cômodos representados por polígonos, aberturas e descrição do prédio ou lote. A planta representa o apartamento; largura, profundidade e pavimentos da torre são dados separados. Multiplicar a planta de um apartamento por muitos andares não descreve necessariamente a forma do edifício, que pode conter circulação comum, outras unidades, escadas e volumes adicionais.

O gerador consulta pipeline/build/blocos.py para compor as unidades e exige uma planta com cômodos e dimensões da torre. Na falta desses elementos, interrompe a geração. Na miniatura, a planta é centralizada na pegada do bloco principal porque o cadastro não informa a posição exata da unidade na laje. Essa centralização é uma convenção de apresentação e deve ser considerada ao interpretar a relação espacial entre o interior e a fachada.

## 33 Como são produzidos e montados os modelos 3D

### Geometria do empreendimento no Blender

Os scripts modelar_montes.py e modelar_castanheiras.py descrevem a construção dos empreendimentos usados nas miniaturas. No primeiro, largura, profundidade e quantidade de pavimentos são lidas do cadastro. O código compõe paredes, lajes, recessos de sacada, esquadrias e acabamentos a partir de dimensões e regras. As imagens servem como referências de autoria; essa implementação não corresponde a uma reconstrução fotogramétrica automática das fotografias.

Em blender_maquete_base.py, a função box cria vértices e faces e os agrupa por material. A função flush transforma esses grupos em objetos de malha, podendo aplicar chanfros aos elementos de reboco e concreto. Também prepara coordenadas de textura por face. A função repetir reutiliza a malha de um elemento e distribui cópias por torre e pavimento, aplicando posições e rotações.

Reutilizar a geometria significa armazenar uma forma compartilhada e informar onde cada ocorrência deve aparecer. As lajes ou paredes repetidas podem manter a mesma malha, enquanto suas transformações determinam andar e torre. As particularidades do empreendimento continuam exigindo regras e parâmetros próprios. O script de Colinas, por exemplo, declara quatro blocos representativos, sem afirmar que reproduz todo o condomínio.

### Produtos da autoria

A exportação gera modelo.json para a integração web, um arquivo GLB para intercâmbio e registros de validação. O JSON contém geometrias, materiais, grupos e matrizes das instâncias, além de identificação de torre, pavimento e função do elemento. A conversão de coordenadas adapta o sistema do Blender ao usado na página. O gerador do HTML incorpora esse JSON; a visualização corrente não depende de baixar o GLB para montar o prédio.

Os arquivos de trabalho do Blender permitem conservar a cena editável. As imagens PNG são renderizações estáticas usadas para apresentação e conferência. Elas constituem uma saída diferente do modelo interativo. Renderizar um PNG com câmera, iluminação e amostras de renderização tem custo próprio, que não pode ser deduzido apenas do tamanho do HTML.

A validação de exportação dos Montes verifica a presença das sequências de pavimentos e lajes esperadas e registra quantidade de geometrias, grupos e bytes. Esses testes verificam propriedades do modelo gerado. A fidelidade às fotografias, a correspondência de cada janela e a adequação da implantação demandam revisão visual e referências suficientes.

### Interior construído a partir da planta

O interior segue outro caminho. Os módulos incorporados à página usam os polígonos dos cômodos e os dados das aberturas para construir pisos, paredes, portas e janelas. Módulos de materiais, texturas e iluminação completam a aparência. Isso permite usar os mesmos dados de planta em apresentações diferentes, como planta 2D, planta 3D e visita em primeira pessoa.

A construção de paredes e pisos não depende de cada apartamento ter uma cena completa previamente desenhada no Blender. A geometria é derivada dos dados estruturados no navegador. Ainda assim, o resultado depende da qualidade dos contornos, da escala, das aberturas e dos valores adotados no cadastro. Uma inconsistência nesses dados pode aparecer em várias modalidades de visualização.

## 34 Como funcionam os móveis paramétricos

### Biblioteca de peças e regras de construção

O sistema combina malhas previamente produzidas no Blender com geometrias calculadas a partir das medidas. moveis/moveis.py contém a autoria da biblioteca e moveis/export_moveis.py exporta as peças para moveis_lib.json. A exportação triangula as malhas avaliadas, reúne vértices equivalentes e registra posições em centímetros inteiros, normais quantizadas, cores e índices dos triângulos. O campo herda identifica vértices que recebem a cor escolhida para o móvel; outros conservam a cor do componente.

No navegador, furniture-catalog.js associa cada tipo de móvel a uma malha da biblioteca ou a uma função paramétrica. Peças convencionais usam a geometria exportada e podem ser escaladas pelas dimensões de referência. Peças paramétricas recebem largura, altura e profundidade e produzem uma lista de componentes. furniture-param.js converte essa lista em geometria.

Essa lista pode misturar caixas chanfradas calculadas diretamente e componentes da biblioteca, como módulos de estofado, cubas e torneiras. O sistema transforma os componentes e reúne posições, normais e cores em uma BufferGeometry. No caminho paramétrico lido nesta revisão, o catálogo cria uma malha com um material para o corpo resultante. Isso reduz a separação por componente, mas não significa que o custo total da cena ou dos passes de sombra seja uma única chamada de desenho.

### Exemplo do armário

A função armarioParam calcula de uma a seis colunas, usando o arredondamento da largura dividida por 0,50 m. A largura disponível é repartida entre essas colunas. A partir de três colunas, a última recebe gavetas na parte inferior; com altura de pelo menos 2,30 m, a regra acrescenta maleiro. Espessura de folha, folgas, recuos e canaletas são definidos separadamente.

Pela fórmula atual, um armário de 1,00 m gera duas colunas e um de 1,50 m gera três. Essa mudança altera a composição das frentes, além da dimensão externa. São regras de representação implementadas no projeto. Não constituem uma especificação de fabricação ou uma afirmação de que todos os armários comerciais adotem esses limites.

### Exemplo do sofá e dos móveis de cozinha

A função sofaParam consulta os módulos de assento e braço na biblioteca. Subtrai a largura dos dois braços e calcula entre um e cinco módulos de assento, arredondando a largura útil dividida por 0,785 m. Em seguida, distribui a folga entre os módulos. Os braços conservam sua referência de largura; altura e profundidade ainda recebem fatores de escala. Portanto, a parametrização combina repetição e escala seletiva, com limites explícitos.

Nas bancadas, a largura determina de um a quatro módulos, usando referência de 0,52 m. Gavetas, portas, tampo e acessórios são montados por regras distintas. O tratamento muda entre pia de cozinha e gabinete de banheiro. Algumas alturas e dimensões de acessórios são fixadas pela função; nem todo campo dimensional controla todas as partes da mesma maneira. Nos aéreos, a largura também pode ativar um nicho, e a altura define a posição superior do conjunto.

## 35 Como os móveis são distribuídos e a página é montada

### Posicionamento automático e revisão do ambiente

pipeline/mobiliar.py trata do posicionamento dos móveis. Ele interpreta cômodos, segmentos de parede e intervalos ocupados por portas e janelas. Busca posições conforme o ambiente, verifica o lado interno das paredes e considera caixas de peças já colocadas. A frente dos móveis e as rotações seguem convenções compartilhadas com o catálogo. A geração de uma forma e a escolha de sua posição são operações separadas.

O resultado é salvo em moveis.auto.json. Durante a composição dos dados, o mobiliário automático é incorporado quando planta.moveis está vazio e planta.mobiliar não foi definido como false. Assim, uma lista manual preenchida tem precedência. A execução do gerador de HTML desta revisão informou 16 móveis automáticos no cadastro Cedros, 18 em Colinas e 25 em Castanheiras. Esses números descrevem as listas carregadas nessa etapa; não são uma contagem visual definitiva de objetos após personalizações do editor.

As regras de layout reduzem o trabalho repetido, mas o exame visual continua útil para verificar circulação, acesso às aberturas, orientação das peças e coerência com a referência. Uma disposição plausível gerada pelo sistema não comprova que o imóvel será entregue com aquela mobília. Referências normativas mencionadas em comentários do código não foram auditadas neste complemento e não sustentam uma declaração de conformidade do ambiente.

### Alteração durante o uso da miniatura

O editor específico de Cedros passa as medidas à geração paramétrica e reconstrói a geometria ao editar. Para as peças convencionais, aplica fatores de escala em relação à caixa de referência. Posição e rotação colocam o móvel no referencial da planta. O editor remove as geometrias anteriores e dispõe de verificações de encaixe e interseção com paredes.

As alterações desse editor são armazenadas no localStorage do navegador, na chave miniaturas:cedros:moveis:v1. Esse armazenamento conserva a personalização naquele contexto de navegador; não representa atualização automática do cadastro de origem ou publicação de uma nova versão compartilhada. O gerador incorpora o editor específico apenas para Cedros, portanto sua disponibilidade não deve ser generalizada às outras duas páginas.

### Empacotamento do HTML

pagina_maquete.py carrega ficha e planta, biblioteca de móveis, modelo externo do empreendimento, Three.js e módulos de interação. Substitui os marcadores do template por esses conteúdos, verifica se restaram marcadores de montagem e grava o HTML. O arquivo combina dados e código necessários para construir a cena no navegador. O servidor de hospedagem entrega esse documento; o dispositivo do visitante executa as regras, cria a cena e desenha os quadros.

A montagem do HTML reaproveita modelo.json e moveis_lib.json já existentes. Ela não chama os scripts Blender para recriar a fachada ou a biblioteca. Também não refaz a interpretação da planta. Isso explica por que o tempo de empacotamento pode ser pequeno mesmo quando houve um trabalho de autoria anterior considerável.

## 36 Tempos de produção e medição da montagem atual

### Revisão e publicação

Depois de gerar o arquivo, a revisão precisa cobrir a ficha, a geometria externa, as plantas, a visita, os móveis disponíveis, os controles e o comportamento em diferentes tamanhos de tela. A etapa de publicação prepara os arquivos de entrega e transfere a versão escolhida à hospedagem. A confirmação final verifica a página publicada, pois uma geração local bem-sucedida não mede transferência, cache ou execução no dispositivo do visitante.

O estudo de utilização continua excluindo a navegação por Ver mapa. Há uma particularidade no código atual: para Cedros, botao_mapa inclui um destino padrão mesmo sem --mapa. Portanto, omitir esse argumento não garante remover o botão nessa unidade. A medição abaixo executou o gerador existente, sem alterar a interface, e não abriu o mapa. Remover o botão efetivamente seria uma alteração do produto, distinta deste complemento documental.

### Resultado medido em 22 de setembro de 2026

Foi cronometrada a execução local de pagina_maquete.py com os cadastros, modelos e bibliotecas já disponíveis. Foram realizadas três execuções sequenciais por unidade, cada uma em um novo processo Python, escrevendo em pasta temporária. O cronômetro incluiu inicialização do processo, importações, leitura dos insumos, composição e gravação do HTML. As nove execuções terminaram com código de saída zero.

| Unidade | Execução 1 em s | Execução 2 em s | Execução 3 em s |
| --- | --- | --- | --- |
| Monte dos Cedros | 0,274 | 0,156 | 0,167 |
| Monte das Colinas | 0,165 | 0,145 | 0,159 |
| Wish Castanheiras | 0,190 | 0,170 | 0,166 |

As medianas foram, respectivamente, 0,167 s, 0,159 s e 0,170 s. O intervalo observado foi aproximadamente 0,145 a 0,274 s. Trata-se de uma amostra pequena na máquina de trabalho, com caches de sistema não controlados. Não é um teste de capacidade do servidor, nem uma previsão de prazo em outro computador. A primeira execução não deve ser classificada como ensaio de cache frio, pois o ambiente já estava em uso.

Foram usados Windows, PowerShell e o Python do runtime disponibilizado pelo Codex. A chamada foi pagina_maquete.py --unidade identificador --saida arquivo_temporario.html. As saídas tiveram 3.361.828 bytes para Cedros, 3.318.027 para Colinas e 4.003.259 para Castanheiras. Colinas e Castanheiras não tiveram o mesmo tamanho dos documentos publicados medidos no capítulo de transferência. Os números desta tabela caracterizam a geração local atual; os valores HTTP anteriores continuam caracterizando os arquivos efetivamente publicados naquela consulta.

### O que permanece fora desse cronômetro

O ensaio não incluiu receber e consultar o link, obter imagens, identificar tipologias, interpretar a planta, conferir escala, cadastrar o imóvel, desenvolver ou ajustar a fachada, exportar no Blender, renderizar imagens de apresentação, revisar o resultado, corrigir divergências ou publicar. Também não mediu o tempo de abertura no navegador, a construção inicial do interior ou a atualização de um móvel durante a interação.

Por isso, o resultado não permite afirmar que uma miniatura completa fica pronta em menos de um segundo a partir de um anúncio. Ele quantifica a etapa final de composição do arquivo quando os insumos necessários já existem. Os tempos históricos do pipeline urbano apresentados anteriormente pertencem a outro processo e não devem ser somados a esse valor para produzir um prazo do anúncio à miniatura.

### Como registrar o tempo completo de uma produção

O tempo de ponta a ponta deve começar no recebimento do material e terminar na revisão da página publicada. Dentro desse intervalo, convém registrar separadamente trabalho de interpretação e ajuste, processamento automático e espera por referências ou decisões. Etapas simultâneas exigem horários de início e fim: somar suas durações pode exceder o tempo de calendário efetivamente transcorrido.

Um registro reproduzível associa a cada imóvel os seguintes marcos: material recebido; ficha conferida; planta estruturada e escala revisada; exterior exportado; mobiliário montado; primeiro HTML gerado; revisão concluída; versão publicada e conferida. Correções retornam à etapa correspondente, com motivo e duração próprios. Isso permite distinguir geração inicial, retrabalho e espera, sem atribuir toda a duração à modelagem.

Não há, nesta medição, uma duração integral comprovada para essas etapas. Preencher horas ou dias sem o acompanhamento de uma produção criaria uma estimativa sem base observada. O registro futuro deve incluir equipamento, versões das ferramentas, qualidade das imagens e quantas correções foram necessárias, para permitir comparar casos semelhantes.

### Primeira produção e reaproveitamento

O primeiro imóvel de um empreendimento pode exigir autoria da fachada, calibração de referências e ajustes específicos. Uma nova unidade da mesma torre pode reutilizar o exterior e a biblioteca de móveis. Se a planta também for a mesma, parte do cadastro e do layout pode ser reaproveitada, após conferir os dados da nova unidade. Uma nova tipologia exige revisar a planta e sua disposição, mesmo quando a fachada permanece reutilizável.

A distinção separa custo inicial de preparação e custo de cada variação. O código confirma esses pontos de reutilização, mas a redução de tempo depende do caso e ainda precisa ser quantificada. O relatório registra o mecanismo atual e a medição disponível, sem fixar um prazo universal de produção.

### Fontes técnicas deste complemento

Leitura local em 22 de setembro de 2026: pipeline/extrair_planta.py; pipeline/mobiliar.py; pipeline/build/blocos.py; plantas_fornecidas/monte-dos-cedros-37/unidade.json; moveis/export_moveis.py; v1.5/miniaturas/modelar_montes.py, modelar_castanheiras.py, blender_maquete_base.py, pagina_maquete.py e editor_cedros.js; v1.5/renderizador-v16-moveis/interior/furniture-param.js e furniture-catalog.js. As durações deste capítulo provêm das nove execuções locais descritas acima. Nenhum arquivo de produção foi substituído ou publicado pelo ensaio.

