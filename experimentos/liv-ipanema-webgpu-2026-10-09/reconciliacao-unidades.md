# LIV Ipanema — reconciliação de referências, pavimentos e finais

09/10/2026. Entrega documental de T02 e preparação de T08. Matriz legível por máquina em [referencias.json](referencias.json). Esta etapa não altera geometria, iluminação, cadastro ou publicação.

## Decisões para a execução

O material público permite seguir com o exterior WebGPU e com seleção ilustrativa de um pavimento. A numeração comercial e o interior correto de cada final continuam sem comprovação. O piloto deve distinguir essas duas coisas na ficha e no realce.

1. **Índice 0 representa o térreo; índices 1 a 16 representam pavimentos tipo acima dele.** A ficha técnica confirma 17 níveis residenciais, compostos por térreo + 16 tipo. A correspondência com a designação comercial dos andares ainda depende de cadastro oficial.
2. **O interior existente representa canto, 47,59 m² publicados.** A planta de meio tem outra distribuição e precisa de base própria. Não atribuir a planta de canto a todos os finais.
3. **A ordem dos finais é conhecida na implantação:** portaria → 01/02 → 03/04 → 05/06 → 07/08 → 09/10 → bosque. A prancha coloca ímpares à esquerda e pares à direita, junto à faixa de lazer/rua. Isso não define automaticamente pontos cardeais ou limites exatos de cada unidade.
4. **Usar identificação técnica por pavimento/final.** Nenhuma regra como “101”, “102” ou “1701” está comprovada. Disponibilidade fica “não informada”; preço, número comercial e vaga atribuída ficam vazios.

## Matriz de evidências e consequências

As páginas abaixo são páginas do PDF, contadas a partir de 1. O [book oficial](https://www.livonincorporadora.com.br/wp-content/uploads/2024/08/BOOK_LIV_Ipanema.pdf) foi preservado no [dossiê local](../../relatorios/liv-referencias-publicas-2026-10-09/README.md). `Confirmado` designa o fato publicado ou a implementação local identificada na coluna; não significa levantamento arquitetônico.

| Parte | Evidência | Estado e consequência |
|---|---|---|
| Quantidades | Book p.16: uma torre, térreo + 16 tipo, 10 unidades/nível, 170 unidades, 175 vagas | Confirmado como informação comercial publicada. Não deduzir número de cada apartamento ou vínculo com vaga. |
| Finais na implantação | Book p.15, rótulos 01 a 10 | Confirmada a ordem relativa e os lados da prancha. Limites de apartamentos, espelhamento e azimute ficam pendentes. |
| Canto | Book p.14, “Planta 1”, 47,59 m² | Confirmada a tipologia publicada. Base existente pode continuar como referência ilustrativa de canto. |
| Meio | Book p.14, “Planta 2”, 47,5 a 47,89 m² | Confirmada uma distribuição distinta. Não obter apenas espelhando o canto; construir outra base. |
| Gardens | Book p.14/p.16: quintais de 16,37 a 25,09 m² no térreo | Confirmada a existência e o intervalo; perímetro, área e associação por final pendentes. |
| Fachada do lazer | Book p.16 e galeria; vídeo agosto/2026 em 0:36 | Ritmo 2+1+2 e núcleo descentrado já usados na reconstrução, ainda inferidos quanto às dimensões e aos detalhes. Comparar câmeras equivalentes antes de corrigir. |
| Fachada oposta | Vídeo julho/2026 em 0:23 | Fonte útil para conferir o “lado B”. A simetria atual dos vãos não é comprovação arquitetônica; confronto detalhado pendente. |
| Base e lateral | Vídeo agosto/2026 em 0:57, book p.15 | Corrigir somente após confronto. O índice 0 atual repete o módulo tipo e não modela todos os gardens individualmente. |
| Piscina/implantação | Book p.15 e vídeo junho/2026 em 0:46 | Confirmada a relação de implantação ilustrada. Preservar torre, portaria, estacionamento, piscinas e bosque no conjunto. |
| Acabamento/interiores | Book p.11–13, p.16 e galeria oficial | Referência de projeto proposto; filme de obra não prova acabamento final. Móveis/dimensões continuam aproximações. |
| Norte e insolação | Rosa dos ventos do book p.15 | Azimute do modelo não validado. Não publicar orientação solar por unidade ou simulação por data/hora nesta etapa. |
| Estoque/preços | Sem tabela própria localizada | Pendentes. Anúncios e janelas iluminadas não equivalem a disponibilidade comercial. |

Vídeos oficiais já inspecionados no dossiê: [agosto/2026](https://www.youtube.com/watch?v=101Jn78Dbiw), [julho/2026](https://www.youtube.com/watch?v=H0vOjCxbkRk) e [junho/2026](https://www.youtube.com/watch?v=PKwZvA2XSCg). Nenhum vídeo foi baixado ou nova captura comparativa produzida nesta reconciliação. Campos `comparisonCapture: null` indicam essa pendência de comparação; não registrar uma aprovação visual ainda não realizada.

## Modelo atual: contagem correta, semântica a corrigir

Foi inspecionado o [modelo de autoria atual](../../v1.5/miniaturas/liv-ipanema/modelo.json), SHA-256 `89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919`. Esse hash identifica o JSON local; o HTML e o GLB da base publicada possuem identidades próprias no manifesto da base.

O JSON contém 87 geometrias, 51 materiais e 87 grupos. Paredes, varandas e esquadrias são instanciadas em `floor=0..16`, totalizando 17 repetições. As lajes têm índices `0..17`: a laje superior fecha o volume e **não constitui um 18º nível residencial**. Elementos de cobertura e hall usam `floor=-1` porque pertencem a grupos técnicos, sem designar um andar comercial.

As translações verticais são `y = índice × 2,85 m`. Os valores de trabalho são 47,70 m no eixo longo, 12,70 m no eixo curto e passo de pavimento de 2,85 m. O autor registra que essas medidas são estimadas a partir de imagens; não chamar o passo de pavimento de pé-direito livre nem apresentar esses números como cotas do arquiteto.

O [gerador atual](../../v1.5/miniaturas/liv-ipanema/gerar_pagina.py) apresenta índice 0 como “1º” e índice 16 como “17º”. O [visualizador](../../v1.5/miniaturas/liv-ipanema/liv-viewer.js) repete esse incremento no selo. O cadastro novo deve corrigir a semântica para “Térreo” e 16 tipos acima dele, preservando o índice técnico e a geometria durante a prova de paridade.

O térreo atual combina a repetição do mesmo módulo de fachada com substrato, vidros e marquise do hall. A existência desses elementos não confirma os contornos garden. Conferir o nível térreo como caso próprio antes de expandir seleção precisa para ele.

## Finais e orientação relativa

| Ordem da portaria para o bosque | Esquerda na prancha, estacionamento | Direita na prancha, faixa de lazer/rua |
|---:|---|---|
| 1 | Final 01 | Final 02 |
| 2 | Final 03 | Final 04 |
| 3 | Final 05 | Final 06 |
| 4 | Final 07 | Final 08 |
| 5 | Final 09 | Final 10 |

A implementação da implantação usa o eixo longo `x`: negativo em direção à portaria e positivo ao bosque. Em Three.js, `z` positivo aponta para a faixa de lazer/rua e negativo para o estacionamento do lado esquerdo da prancha. Isso foi conferido em `modelar_implantacao.py` e na transformação de exportação de `blender_maquete_base.py`; confirma a convenção do código, com escala e origem inferidas.

A regra local transforma a imagem de referência `(u,v)` em `x=(432-v)×0,145` e `z=(u-315)×0,145`. **Não aplicar esses mesmos pixels à rasterização do book:** ela tem resolução e margens diferentes. Qualquer registro novo precisa alinhar as imagens primeiro.

01/02/09/10 são candidatos a canto pela posição nas extremidades; 03/04/05/06/07/08 são candidatos a meio. Essa é uma hipótese de trabalho, não um vínculo validado. Os campos `typologyByFinal` e `mirroringByFinal` continuam nulos na matriz. A implantação não fornece a planta de pavimento com corredores/divisórias que permita confirmar a orientação de cada interior.

Também não se deve usar os centros das cinco varandas como centros ou limites dos apartamentos. O ritmo 2+1+2 da fachada não corresponde a cinco faixas de largura uniforme. Zonas de seleção futuras devem registrar âncoras e limites aproximados por final, sem fingir que a maquete externa contém dez apartamentos separáveis na geometria.

## Área publicada e interior existente

O [registro do interior](../../v1.5/miniaturas/liv-ipanema/interior/referencia.json) identifica a planta de canto, escala aproximada de 11 mm/pixel e pé-direito inferido de 2,70 m. Há 10 aberturas e 29 móveis. O contorno nominal entre eixos de paredes mede 47,235 m², enquanto a área comercial publicada é 47,59 m². São bases distintas; não deformar o contorno para fazer os dois valores coincidirem.

No book, o canto tem 43,18 m² + varanda de 4,41 m². O meio publica intervalo de 47,5 a 47,89 m² e componentes de 43,10 + 4,41 m² a 43,39 + 4,51 m². O limite inferior impresso é arredondado e os componentes somam 47,51 m²; conservar a fonte, sem inventar uma medição exata por final.

`interior/contexto.json` coloca 47,59 no campo `area_util_m2`. A ficha futura precisa usar **área publicada** e guardar sua procedência, mantendo “área útil aferida” pendente. O valor não deve ser promovido automaticamente a área útil oficial.

Os modos Planta 3D/Tour podem permanecer utilizáveis durante a evolução, com indicação de “Planta de referência de canto · interior ilustrativo · sem vínculo comercial”. Selecionar um final não deve transformar silenciosamente esse interior genérico no apartamento selecionado. A luz baked existente pertence à própria geometria/UV; construir meio ou gardens exige iluminação compatível com essas geometrias.

## O que basta para um pavimento selecionável

O piloto pode partir do índice técnico 1, evitando tratar o garden como unidade tipo. Pode oferecer dez IDs, por exemplo `liv-ipanema/pavimento-modelo-01/final-01`, ficha com final e nível, e planta comercial como catálogo ilustrativo. A etiqueta sugerida é “Pavimento tipo 1 · final 01 · posição aproximada”, enquanto número comercial, preço e vaga atribuída permanecem vazios.

Para aceitar picking na fachada, a implementação deve:

1. Registrar as dez zonas de seleção e o final de cada zona, com confiança e fonte. Confrontar pelo menos a vista superior e as duas faces longas. Nenhuma zona deve representar uma unidade validada quando seus limites continuam inferidos.
2. Fazer lista, realce e ficha consumirem o mesmo ID. Clicar novamente, limpar seleção e alternar WebGPU/WebGL2 devem manter o vínculo.
3. Identificar tipo e planta como pendentes quando não há associação comprovada; preservar os modos interiores gerais com a indicação ilustrativa.
4. Manter “não informada” para disponibilidade e não usar iluminação ou cor artística como status de venda.

Ainda faltam para precisão por unidade: limites cotados; correspondência tipologia/final/espelhamento; desenho do pavimento completo; gardens por final; numeração comercial; vaga atribuída; azimute validado; e tabela comercial. Essas pendências não bloqueiam paridade dos renderers, catálogo das plantas, realce ilustrativo e refinamento visual com referências públicas.

T02 fica parcialmente atendida pela matriz e pela reconciliação; a comparação visual com capturas equivalentes permanece pendente. T08 fica preparada documentalmente; a definição e verificação das zonas de seleção e do vínculo por final ainda precisam ser executadas antes de marcar a tarefa concluída.
