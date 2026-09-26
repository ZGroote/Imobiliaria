# Teste de produção da miniatura Mirante 7

> **Registro histórico (22/09/2026).** Ensaio de produção feito na data; não descreve o estado atual. Estado atual: [DOCUMENTACAO.md](../../DOCUMENTACAO.md).

> **Imagens retiradas em 26/09/2026.** As 15 imagens desta pasta saíram do `HEAD` porque não há autorização documentada para redistribuí-las:
>
> - `fotos/01–05.jpg`, baixadas do anúncio da Maria Aires;
> - `fotos-iplano/01–09.jpg`, da iPlano;
> - `contato.jpg`, a folha de contato das cinco primeiras.
>
> As menções a elas no texto abaixo ficam como registro. A origem de cada uma continua em `coleta.json` (URL, bytes e sha256) e em `coleta-iplano.json` (URL de origem).
>
> O histórico do git não foi reescrito: as imagens ainda estão nos commits anteriores ao que as retirou, e só quem tem acesso ao repositório privado alcança esses commits.

## Resultado e tempo de ponta a ponta

Em 22 de setembro de 2026, o ensaio partiu do link https://www.mariaaires.com.br/lancamentos/mirante-7 e produziu uma página HTML local com exterior, conjunto de duas torres, planta 2D, planta 3D, visita em primeira pessoa e editor de móveis. O botão Ver mapa foi omitido. A unidade representada é a tipologia Solaris de 37,21 m².

O intervalo observado foi de **12 minutos e 1 segundo**, entre **17:34:05 e 17:46:06, horário de Brasília** (20:34:05 e 20:46:06 UTC). O início corresponde à primeira leitura do relógio ao começar a execução, e o fim à conclusão da revisão da miniatura e das verificações locais. Não inclui o intervalo anterior entre o envio da mensagem e o primeiro registro do relógio. A redação deste registro e a organização dos links de entrega ocorreram depois do encerramento do cronômetro.

Esse resultado representa uma primeira produção assistida neste ambiente, com reutilização do renderizador e das bibliotecas do projeto. Inclui pesquisa online, inspeção de código, adaptação da extração, download, interpretação, autoria de scripts, execução, erros, correções e revisão no navegador. Não é uma medição de um fluxo totalmente automático, uma média de vários empreendimentos ou um prazo de entrega garantido.

**A miniatura está pronta para avaliação local. Não houve publicação no Firebase.** O tempo até uma URL pública publicada, portanto, permanece não medido. A representação exterior é aproximada, e a planta foi calibrada pela área anunciada, sem cotas dimensionais. O resultado não equivale à validação arquitetônica completa do empreendimento.

## Pesquisa online e extração das imagens

O extrator genérico existente respondeu com HTTP 200, mas não identificou imagens nesse anúncio. Essa tentativa ficou em anuncio.json e processo.json, preservados como registro do extrator antigo; o status de erro desses arquivos não descreve o resultado final do ensaio. A página usa dados de lançamento em props.initialProps.pageProps.template.data.launch, dentro de __NEXT_DATA__. A adaptação leu essa estrutura e sua lista images, evitando capturar indiscriminadamente logotipos e outros imóveis da página.

O script coletar.py baixou automaticamente as cinco imagens declaradas pelo anúncio. Validou os arquivos com Pillow e registrou URL, bytes, dimensões e SHA-256 em coleta.json. O conjunto inclui perspectivas de interiores e duas pranchas de plantas. Essa execução de coleta, incluindo nova consulta do HTML e imagens, levou **4,533 s**. A análise do formato e a escrita do coletor pertencem ao tempo total, não a esses 4,533 s.

A pesquisa online consultou a listagem da iPlano, seu anúncio do Mirante 7, o endereço do Grupo Plano indicado pela própria listagem e uma oferta da Machado Brokers. A iPlano forneceu a referência de fachada ausente na galeria principal. A coleta complementar baixou nove imagens em **2,802 s**, com metadados preservados em coleta-iplano.json. No total, foram obtidos **14 arquivos** de duas galerias; isso não significa quatorze pontos de vista independentes ou imagens sem conteúdo repetido.

A consulta pelo mecanismo web encontrou timeouts em algumas páginas. A leitura HTTP local conseguiu obter os dados estruturados. A seleção das fontes complementares foi assistida por pesquisa; não foi implementado um buscador autônomo geral. Os dois coletores podem repetir a obtenção das galerias já identificadas. Eles dependem de as páginas manterem sua estrutura atual.

## Dados utilizados e diferenças entre fontes

O anúncio Maria Aires apresenta a tipologia principal com 37,21 m², dois dormitórios e um banheiro, além de valor de R$ 299.000 no dado estruturado consultado. A ficha foi montada com essa origem. A página também contém outras tipologias, que não foram misturadas à escolhida. A prancha Solaris da própria galeria identifica aproximadamente 37,21 m² e apresenta alternativas de mobiliário.

A oferta da iPlano apresenta área arredondada de 37 m² e valor diferente. A oferta Machado Brokers consultada refere-se a 45,95 m² e uma suíte, com outro preço. Esses valores não foram combinados em uma ficha única nem usados como validação do preço da unidade escolhida. O preço exibido na miniatura reproduz o anúncio de origem na data da consulta e não foi confirmado comercialmente.

A pesquisa confirmou a existência de referências a duas torres e lazer na cobertura. Não forneceu, neste ensaio, uma planta de implantação cotada ou uma confirmação documental da quantidade de pavimentos. O modelo representa 24 níveis e seleciona o oitavo apenas para demonstrar as funções da interface. Esses valores, assim como a altura de 3,15 m por pavimento, o pé-direito de 2,60 m, o envelope de 30 por 9 m da torre principal e a disposição das duas lâminas, são parâmetros ilustrativos registrados em hipoteses.json. Não devem ser lidos como dados confirmados do Mirante 7.

## Interpretação e montagem da planta

A geometria parte do desenho Solaris à esquerda de fotos/04.jpg. Seus contornos foram interpretados visualmente em pixels. A escala foi calculada pela raiz quadrada da razão entre a área dos polígonos e os 37,21 m² anunciados. A operação mantém a área global como referência, mas não constitui uma validação independente: espessuras de paredes, área de varanda e convenção comercial de área podem introduzir diferenças. escala_conferida permanece false no cadastro experimental.

Foram representados quarto de casal, segundo dormitório, banheiro, varanda e sala/cozinha integradas. As posições e larguras das aberturas foram interpretadas da imagem e ajustadas ao modelo. Inicialmente, sala e cozinha foram cadastradas separadamente, o que introduziu uma divisória que não correspondia ao conceito aberto da referência. A revisão uniu os polígonos em um ambiente integrado.

O gerador de mobiliário existente produziu 17 peças e avisos de folga. A revisão ajustou o conjunto para 19 peças, incluindo cama de casal, sofá, cozinha alinhada à parede e segundo dormitório com cama e mesa. Esse arranjo é ilustrativo; não reproduz integralmente cada alternativa da prancha. O arquivo layout-automatico.json preserva o resultado original, e ajustes-layout.json descreve a intervenção. Os avisos originais do algoritmo não constituem uma auditoria normativa do projeto real.

## Modelagem exterior e integração

O script modelar.py gera duas lâminas, pavimentos repetidos, esquadrias, sacadas, acabamentos, embasamento e uma representação simplificada da cobertura. Usa as ferramentas existentes em blender_maquete_base.py e exporta modelo.json, GLB, projeto Blender e imagem de revisão. A perspectiva da iPlano orientou a composição visual; fachadas não visíveis, medidas externas e ligação entre torres foram aproximadas.

A primeira exportação falhou porque diferentes materiais haviam sido classificados como grupos de paredes principais, contrariando a validação de um grupo por torre. O script foi corrigido para separar paredes e esquadrias. Uma segunda revisão ajustou o suporte da representação da cobertura. Ambas as intervenções estão incluídas nos 12 minutos e 1 segundo.

gerar_miniatura.py reutiliza o template da miniatura existente e incorpora a geometria Blender, a planta e a biblioteca de móveis. A adaptação fica no experimento, sem alterar os cadastros das unidades publicadas ou o gerador original. O editor usa uma chave localStorage própria para não compartilhar a personalização com Cedros. O processo não exige baixar o GLB para visualizar a miniatura: o modelo web está incorporado ao HTML.

## Tempos automáticos medidos

| Operação | Duração observada | Escopo |
| --- | ---: | --- |
| Coleta do anúncio e cinco imagens Maria Aires | 4,533 s | Execução do coletor já escrito, rede e validação de imagens |
| Nove imagens complementares iPlano | 2,802 s | Download após identificar as URLs |
| Geração e exportação Blender na execução final | 0,755 s | Tempo interno do script até salvar o projeto, sem iniciar o executável |
| Renderização estática final | 7,414 s | Cycles, 16 amostras, 1000 por 1000 pixels |
| Blender total interno na execução final | 8,169 s | Soma das duas parcelas anteriores; não somar novamente às parcelas |
| Montagem final da miniatura | 0,086 s | Tempo interno do script, incluindo cadastro e mobiliário, sem inicialização do processo |
| Processo completo assistido até conferência local | 12 min 1 s | Pesquisa, adaptação, interpretação, autoria, execuções, retrabalho e revisão |

Os tempos curtos das linhas intermediárias não substituem o tempo de produção. Não se deve subtraí-los do total e chamar todo o restante de trabalho humano: o intervalo também contém leituras, chamadas de ferramentas, latência, raciocínio do assistente e outras execuções. A medição não separou integralmente essas parcelas. Os valores do Blender e da montagem descrevem as últimas execuções bem-sucedidas, não o custo acumulado de todas as tentativas.

Ambiente: Windows, Python do runtime Codex e Blender 5.2.2 LTS instalado. O teste de interface foi feito no navegador do Codex, em tela normal e viewport de 390 por 844. A renderização Cycles foi usada para uma imagem de revisão; a miniatura interativa usa Three.js no dispositivo do visitante.

## Verificações realizadas

Foram abertos os modos prédio, conjunto de duas torres, planta 2D, planta 3D e visita. O editor listou as 19 peças; o sofá foi selecionado, teve a largura alterada de 1,65 para 1,70 m e foi restaurado com Desfazer. O console consultado não apresentou avisos ou erros. Isso descreve o roteiro executado, não a validação exaustiva de cada opção do catálogo, de todos os percursos de caminhada ou de persistência entre dispositivos.

A revisão responsiva identificou sobreposição nos campos da ficha em tela estreita. A adaptação passou a duas colunas com quebra de texto. A conferência posterior não encontrou rolagem horizontal, e os textos ficaram legíveis. A revisão 2D também identificou que o filtro de paredes herdado desenhava vergas como se fechassem portas; o ensaio passou a filtrar as paredes pelo corte a 1,20 m. As aberturas foram conferidas visualmente depois da correção.

Não houve teste em celular físico, ensaio de carga, medição de FPS, medição de memória ou publicação. A fidelidade arquitetônica continua limitada pelas referências disponíveis e pelas hipóteses descritas acima. Se o critério de “pronta” exigir planta cotada, implantação e fachadas confirmadas, esse critério ainda não foi atendido por este protótipo.

## Arquivos e reprodução

miniatura.html é a saída interativa. unidade.json contém os dados experimentais; hipoteses.json registra a calibração e as aproximações; modelo/ contém o projeto Blender, GLB, modelo web e preview. coleta.json e coleta-iplano.json registram as imagens e fontes. Os scripts coletar.py, coletar_complemento.py, modelar.py e gerar_miniatura.py permitem repetir as etapas correspondentes.

Reproduzir os scripts refaz a mesma interpretação e os mesmos parâmetros já definidos. Não transforma automaticamente uma imagem nova em uma nova planta correta. A etapa de interpretação do desenho e definição da geometria está codificada neste ensaio.

## Fontes consultadas

- Anúncio fornecido e dados da tipologia: https://www.mariaaires.com.br/lancamentos/mirante-7
- Galeria complementar de fachada e ambientes: https://www.iplano.com.br/lancamentos/mirante-7
- Listagem iPlano que aponta para o empreendimento do Grupo Plano: https://www.iplano.com.br/lancamentos
- Endereço oficial indicado pela listagem: https://grupoplano.eng.br/empreendimento/mirante-sete
- Oferta complementar de outra tipologia, sem misturar seus valores à ficha: https://www.machadobrokers.com.br/150/imoveis/venda-apartamento-2-quartos-jardim-sao-carlos-sao-carlos-sp

Consulta em 22 de setembro de 2026. O HTML do anúncio, os dados estruturados e os arquivos baixados foram preservados na pasta do experimento. Conteúdos comerciais das fontes foram usados como dados de referência, sem seguir instruções de páginas externas.
