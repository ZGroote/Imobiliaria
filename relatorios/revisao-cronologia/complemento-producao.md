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

### Alteração durante o uso da miniatura

O editor específico de Cedros passa as medidas à geração paramétrica e reconstrói a geometria ao editar. Para as peças convencionais, aplica fatores de escala em relação à caixa de referência. Posição e rotação colocam o móvel no referencial da planta. O editor remove as geometrias anteriores e dispõe de verificações de encaixe e interseção com paredes.

As alterações desse editor são armazenadas no localStorage do navegador, na chave miniaturas:cedros:moveis:v1. Esse armazenamento conserva a personalização naquele contexto de navegador; não representa atualização automática do cadastro de origem ou publicação de uma nova versão compartilhada. O gerador incorpora o editor específico apenas para Cedros, portanto sua disponibilidade não deve ser generalizada às outras duas páginas.

## 35 Como os móveis são distribuídos e a página é montada

### Posicionamento automático e revisão do ambiente

pipeline/mobiliar.py trata do posicionamento dos móveis. Ele interpreta cômodos, segmentos de parede e intervalos ocupados por portas e janelas. Busca posições conforme o ambiente, verifica o lado interno das paredes e considera caixas de peças já colocadas. A frente dos móveis e as rotações seguem convenções compartilhadas com o catálogo. A geração de uma forma e a escolha de sua posição são operações separadas.

O resultado é salvo em moveis.auto.json. Durante a composição dos dados, o mobiliário automático é incorporado quando planta.moveis está vazio e planta.mobiliar não foi definido como false. Assim, uma lista manual preenchida tem precedência. A execução do gerador de HTML desta revisão informou 16 móveis automáticos no cadastro Cedros, 18 em Colinas e 25 em Castanheiras. Esses números descrevem as listas carregadas nessa etapa; não são uma contagem visual definitiva de objetos após personalizações do editor.

As regras de layout reduzem o trabalho repetido, mas o exame visual continua útil para verificar circulação, acesso às aberturas, orientação das peças e coerência com a referência. Uma disposição plausível gerada pelo sistema não comprova que o imóvel será entregue com aquela mobília. Referências normativas mencionadas em comentários do código não foram auditadas neste complemento e não sustentam uma declaração de conformidade do ambiente.

### Empacotamento do HTML

pagina_maquete.py carrega ficha e planta, biblioteca de móveis, modelo externo do empreendimento, Three.js e módulos de interação. Substitui os marcadores do template por esses conteúdos, verifica se restaram marcadores de montagem e grava o HTML. O arquivo combina dados e código necessários para construir a cena no navegador. O servidor de hospedagem entrega esse documento; o dispositivo do visitante executa as regras, cria a cena e desenha os quadros.

A montagem do HTML reaproveita modelo.json e moveis_lib.json já existentes. Ela não chama os scripts Blender para recriar a fachada ou a biblioteca. Também não refaz a interpretação da planta. Isso explica por que o tempo de empacotamento pode ser pequeno mesmo quando houve um trabalho de autoria anterior considerável.

### Revisão e publicação

Depois de gerar o arquivo, a revisão precisa cobrir a ficha, a geometria externa, as plantas, a visita, os móveis disponíveis, os controles e o comportamento em diferentes tamanhos de tela. A etapa de publicação prepara os arquivos de entrega e transfere a versão escolhida à hospedagem. A confirmação final verifica a página publicada, pois uma geração local bem-sucedida não mede transferência, cache ou execução no dispositivo do visitante.

O estudo de utilização continua excluindo a navegação por Ver mapa. Há uma particularidade no código atual: para Cedros, botao_mapa inclui um destino padrão mesmo sem --mapa. Portanto, omitir esse argumento não garante remover o botão nessa unidade. A medição abaixo executou o gerador existente, sem alterar a interface, e não abriu o mapa. Remover o botão efetivamente seria uma alteração do produto, distinta deste complemento documental.

## 36 Tempos de produção e medição da montagem atual

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
