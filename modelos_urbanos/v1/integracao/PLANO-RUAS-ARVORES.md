# Plano de melhoria das ruas e árvores

Status: execução iniciada pela profundidade das ruas, conforme pedido em 09/09/2026.
Segunda entrega: copas revisadas nas 20 espécies e recortes de calçada ajustados
pela largura/ângulo das vias conectadas. LOD por distância e acabamento completo
das esquinas continuam nas próximas etapas.

Objetivo: melhorar a vista do bairro e a aproximação da rua mantendo a navegação
leve que já foi aprovada. Primeiro validar um trecho ao redor do Sanca 135 e uma
praça; depois ampliar para a cidade.

## Base existente

O renderizador já tem asfalto com ruído, manchas, marcações, juntas de calçada e
meio-fio (`buildRibbons`, `_compilaVia`, `matVia` em `app.js`). Melhorar apenas a
textura não resolve os encontros entre as ruas.

As árvores já vêm de 20 espécies no Blender (`arvores/arvores.blend`,
`arvores/especies.py`, `arvores/export_arvores.py`). O código atual usa instâncias
por espécie e atualiza a entrada/saída de quarteirões incrementalmente. Já existem
variação de porte/cor, agrupamentos de espécies e exclusão do asfalto. Preservar
essas funções; não é necessário substituir a biblioteca inteira.

## Ordem de execução

### 1. Registrar uma comparação fixa

- Fotografar o mesmo percurso em vista aérea, oblíqua e ao nível da rua, com e sem
  relevo, nos níveis alto e baixo.
- Medir tempo de quadro, chamadas, triângulos e memória após estabilizar a cena.
- Selecionar uma esquina, uma avenida, uma rua residencial e uma praça como casos
  de aceite. Separar defeitos da geometria de defeitos do material.

Entrega: capturas e medição de referência antes de alterar os assets.

### 2. Ruas: corrigir continuidade e acabamento

**Prioridade acrescentada pelo usuário: profundidade real.** A calçada precisa
ser percebida acima do asfalto, com sarjeta baixa e face vertical visível no
meio-fio. Não basta desenhar uma linha clara sobre uma superfície plana.

Primeira implementação: pista em 0,10 m e passeio em 0,32 m (22 cm de degrau),
sarjeta de 30 cm, quina chanfrada de 4 cm e fechamento das laterais/pontas expostas.
Essas cotas são relativas à malha-base do mapa, não altitudes reais levantadas.
Foi corrigida a orientação dos triângulos: antes, um lado do passeio e do meio-fio
ficava virado para dentro e desaparecia com o descarte de faces traseiras.
Materiais diferenciam o fundo da sarjeta, a face do meio-fio e o topo, sem criar
novas chamadas de desenho por rua. Medir o custo adicional de geometria.

Verificação da primeira entrega: `testar_ruas.mjs` confirmou as duas faces
superiores, os meios-fios voltados para a rua, o fechamento das pontas e a
preservação das cotas sobre terreno inclinado. Chrome/WebGL passou sem erros de
shader, com relevo, seleção de imóveis e ida/volta do streaming funcionando.
Comparação de câmera fixa: 159 chamadas antes e depois; triângulos de 2.042.983
para 2.119.615 (+3,75%). Isso mede a cena, não FPS em GPU real. Imagens de controle:
`ruas-antes.png` e `ruas.png`. Página local reconstruída; nenhuma publicação.

Na sequência: encontros entre pistas e calçadas. Gerar recortes nas esquinas
para evitar meio-fio atravessando a pista, superfícies sobrepostas e mudanças
bruscas de largura. Preservar o eixo e a largura da base geográfica.

Implementado: índice global de nós das vias (incluindo outras regiões do streaming),
recuo pelo ângulo e largura da via transversal e tratamento de nós intermediários
da linha. Calçadas curtas podem ser omitidas quando o cruzamento ocupa todo o trecho.
O recorte depende de nós compartilhados/coincidentes na base; ainda não gera curvas
de concordância, rebaixos ou travessias. Testes incluem avenida larga e ângulo oblíquo.

Em seguida, ajustar o material: asfalto menos uniforme, remendos discretos,
diferença entre pista e sarjeta e juntas de calçada menos marcadas à distância.
Usar escala em metros e reduzir detalhes subpixel para evitar cintilação.

Rever marcações por tipo de via, interrompendo-as nos cruzamentos. Travessias,
rebaixos e entradas de garagem devem usar dados disponíveis ou pontos cadastrados;
quando forem ilustrativos, não apresentá-los como informação real do endereço.

Entrega: o trecho piloto sem buracos/sobreposições, com calçada contínua e materiais
coerentes na vista próxima e aérea. Reutilizar shaders e geometria por região;
não criar um objeto ou material para cada faixa.

### 3. Árvores: melhorar primeiro a silhueta

Começar pelas espécies mais frequentes no trecho. Remodelar copas com volumes
assimétricos, pequenos vazios entre ramos e transição melhor entre tronco e copa.
Suavizar normais onde faz sentido, mantendo folhas/galhos definidos. Reduzir o
verde excessivamente luminoso e preservar diferenças entre espécies.

Criar dois níveis: copa detalhada perto e versão simplificada longe. Distâncias
iniciais de experimento: até 100 m para detalhe próximo e versão leve depois disso,
com histerese para não alternar repetidamente na borda. Ajustar pelos testes de
tamanho na tela. O nível baixo pode usar apenas a versão leve.

Evitar começar com milhares de folhas transparentes: experimentar primeiro copas
opacas modeladas. Folhagem recortada por alpha só entra se o ganho visual justificar
o custo medido. Manter instâncias compartilhadas por espécie e nível de detalhe.

Entrega: catálogo de comparação de 3–5 espécies piloto e teste no mesmo bairro.

Primeira revisão aplicada às 20 espécies: silhuetas deformadas de modo determinístico,
normais suaves nas copas e verdes moderados; nenhum aumento no orçamento de
triângulos dos dois LODs. Removidas faces degeneradas nas folhas de palmeiras:
o total do nível leve passou de 6.482 para 6.324 triângulos na biblioteca.
Arquivo Blender: `arvores/arvores-v2.blend`. As versões
leve/detalhada continuam exportadas, mas o mapa ainda usa somente a leve; a troca
por distância descrita acima permanece planejada.

Validação: buffers/índices/normais dos 40 modelos (20 espécies × 2 LODs), orçamento
de geometria e teste de arborização incremental com seis rodadas passaram. Imagens
comparáveis no mesmo enquadramento: `arvores-antes.png` e `arvores.png`.

### 4. Árvores: revisar implantação

- Escolher porte compatível com a largura útil da calçada e afastamento da fachada.
- Excluir troncos de esquinas, travessias e acessos conhecidos, além do asfalto.
- Manter agrupamentos por espécie, com variação moderada de altura, rotação e copa;
  evitar sequência perfeitamente regular e mistura aleatória de todas as espécies.
- Em praças, formar grupos com clareiras e caminhos livres, aproveitando os polígonos
  e dados de vegetação existentes.

Entrega: implantação estável após sair e voltar da região, com conferência de
interseções e reaproveitamento de `pipeline/testa_arvore_incremental.py`.

### 5. Aceite e ampliação

Comparar antes/depois com câmera, quantidade de regiões e qualidade iguais. Meta
inicial proposta: no máximo 10% de aumento no tempo de quadro no percurso do
computador de referência, sem crescimento contínuo de memória após três voltas.
Essa é uma meta de trabalho, não uma medição já obtida. Se ultrapassar, reduzir
alcance/detalhe próximo antes de ampliar para todas as espécies.

Exigir também: ausência de troncos no asfalto, ruas sem cintilação, relevo correto,
continuidade visual nas bordas dos quarteirões e seleção dos imóveis preservada.
Guardar comparação ativável para ruas e árvores separadamente.

Só após o piloto passar: ampliar o catálogo e a região. Vento e sombras mais caras
ficam para uma etapa opcional; a prioridade é forma, material e implantação.
