# LIV — registro de qualidade e correções

## Referência preservada

Origem: `../liv-render-blender-2026-10-26/entrega/LIV_Ipanema_Render.blend`.
Os três PNGs e o `.blend` anteriores ficam preservados nesse diretório.
O usuário rejeitou a qualidade da apresentação; não há uma versão visual aprovada.
A arquitetura, implantação e posições do apartamento vêm do LIV publicado.
Melhorias de apresentação não autorizam inventar cômodos ou alterar a implantação.

## Erros conhecidos e regra para não repetir

| ID | O que não ficou bom | Causa / evidência | Correção a verificar | Regra permanente |
|---|---|---|---|---|
| Q01 | Resultado chamado de final cedo demais | O relatório anterior dizia `aprovado` após conferir dimensões, câmeras e texturas. Isso prova integridade, não qualidade visual. | Separar conferência técnica e revisão visual com limitações explícitas. | Arquivo válido nunca equivale a imagem aprovada. |
| Q02 | Fachada fria e luz lavada | Céu azulado, preenchimento alto e sombras muito difusas. | Relação sol/céu, fundo neutro e direção de luz legível. | Conferir contraste e balanço de branco em prévia antes do render grande. |
| Q03 | Interior branco e sem hierarquia | Materiais claros muito parecidos, iluminação uniforme e pouca variação de rugosidade. | Dar identidade a tecidos, madeira, pedra e metais; luz de janela dominante. | Conferir materiais sob a luz definitiva, incluindo aproximações. |
| Q04 | Enquadramento da sala ruim | Parede ocupa grande parte da esquerda e sofá cortado domina o primeiro plano. | Testar câmeras na altura dos olhos mostrando circulação, jantar e estar. | Bloquear câmera em prévias antes de investir no cálculo final. |
| Q05 | Vegetação parece bloco | Copas simplificadas transferidas da maquete. | Folhagem com silhueta e variação orgânica, mantendo os locais das árvores. | Aumentar amostras não conserta geometria de apresentação. |
| Q06 | Ambiente sem vida | Poucos acessórios, ausência de tapete, arte e luminárias visíveis. | Montagem contida e coerente com o tamanho real dos ambientes. | Decorar para leitura e escala; não encobrir a planta nem sobrecarregar a cena. |
| Q07 | Reflexos metálicos em madeira/tecido na primeira tentativa | Fatores padrão da API do SketchUp foram interpretados como metal. Já foi corrigido no arquivo de origem. | Manter verificação de materiais dielétricos. | Nunca inferir metal só de um fator de mapa sem semântica/workflow. |
| Q08 | Expectativa exagerada de realismo | A base é uma maquete ilustrativa com móveis e veículos de detalhe desigual. | Melhorar os elementos visíveis e informar os limites restantes. | Avaliar primeiro plano e fundo separadamente; não prometer fotorrealismo por usar Cycles. |
| Q09 | Vidro da varanda parece painel opaco | A inspeção das faces provou que `Interior-m4` é perfil de caixilho e `Interior-m5` é a chapa de vidro. A classificação anterior estava invertida. | Caixilho opaco e vidro transmissivo, com verificação explícita desses dois materiais. | IDs numéricos não descrevem materiais: conferir geometria e usuários antes de classificar. |
| Q10 | Parte da arte alta aparece solta na planta em corte | O filtro usava `obj.location.z`; a arte foi desenhada com vértices já em coordenadas globais e origem em zero. | Filtrar pelo limite superior da geometria em coordenadas globais, após atualizar a view layer. | Origem não equivale aos limites da geometria; comparar bounds avaliados na cena. |
| Q11 | Base do sofá ainda cortada após a troca de câmera | A prévia foi considerada completa cedo demais. A projeção dos bounds mostrou mínimo vertical -0,113, fora da imagem. | Formato 4:3 e direção de câmera ajustada; verificar margem de 2% nos bounds do sofá e do quadro. | Sempre medir recorte dos assuntos principais; prévia mais bonita ainda pode repetir o erro de enquadramento. |
| Q12 | Relatório anterior dizia 29 texturas, mas o arquivo reaberto continha 17 | A checagem foi feita antes de salvar/reabrir. Imagens sem usuários não persistiram. A revisão tinha as mesmas 17 da base; nenhuma textura usada se perdeu. | Incorporar as 29 imagens do snapshot, preservar usuário persistente e validar depois de reabrir. | Verificar a entrega salva, não só os dados em memória. |

## Critérios antes de entregar uma revisão

- Preservar a arquitetura e a organização do LIV publicado.
- Sala legível, sem uma parede vazia dominando a imagem.
- Luz com direção, sombras de contato e brancos com textura.
- Madeira, tecido, pedra e metais distinguíveis.
- Vegetação com silhueta orgânica na resolução de entrega.
- Nenhum acessório atravessando móveis, paredes ou circulação.
- Comparação explícita com os PNGs anteriores.
- Registrar o que melhorou e qualquer limitação que permaneça.
- Conferência técnica independente da avaliação visual; sem aprovação visual automática.

## Método

Skill de revisão: `quality-refinement-autoloop`, com as skills existentes de
composição, iluminação, materiais e renderização. O problema é aplicação e
critério de aceitação; as técnicas necessárias já existem. Não há motivo para
alterar skills globais, publicar conteúdo ou comitar sem solicitação.

## Rodadas

### R00 — diagnóstico

Trabalho iniciado a partir do `.blend` preservado. Próxima etapa: inventário de
objetos e coordenadas, depois prévias pequenas de composição e iluminação.

### R01 — não aprovada

Evidências: `previas/r01/`. Folhagem agora tem folhas individuais e silhueta
orgânica; tecidos, objetos e eletrodomésticos já são distinguíveis.

Problemas encontrados: exterior escuro demais; enquadramento A ainda corta o
estar e inclui uma parede grande; almofadas com cantos facetados; portas muito
escuras. A classificação compartilhada `Interior-m3` inclui partes de portas,
não só esquadrias. Escurecê-la inteira foi um erro de classificação semântica.

Correções para R02: aumentar preenchimento/exposição com controle, tratar
portas separadamente de esquadrias externas, testar três câmeras na mesma luz,
almofadas com superfície arredondada contínua e folhas do vaso com tamanho real.
A bancada da planta recebe a mesma classificação da bancada no interior.

Regras adicionadas: não trocar luz lavada por sombras sem leitura; inspecionar
o uso real de um material compartilhado antes de alterar todos os seus usuários;
testar a silhueta de objetos macios em aproximação.

### R02 — câmeras A/B/C descartadas

Evidências: `previas/r02/`. Exterior mais legível; portas claras restabelecidas;
almofadas sem cantos facetados. O balanço do exterior passou de ambiente 0,34,
sol 3,1 e exposição -0,3 para ambiente 0,6, sol 2,8 e exposição +0,3.

A câmera A ainda inclui a quina da divisão do dormitório; B aumenta essa parede;
C mostra a mesa de muito perto e o fundo do sofá. A planta irregular da sala
exige escolher qual ambiente contar em cada foto. Não insistir num só ângulo
para mostrar estar, jantar e cozinha. Próximos testes: estar, jantar e parede TV.

Decoração complementar: painel de madeira na parede existente da TV, arte na
parede sul e assentos estofados nas cadeiras existentes. Sem mover paredes ou
móveis principais. O primeiro tom de armário ficou cinza demais; corrigido para
madeira natural mais quente na rodada seguinte.

### R03 — acabamento e distância de câmera

Evidências: `previas/r03/`. D permite ver o tecido e as almofadas do sofá, mas
está perto demais e corta o quadro. E é um detalhe de cozinha, ainda não uma
foto ampla do jantar. F mostra a TV e a circulação; o painel de madeira não
aparece porque foi posicionado 6 cm dentro da parede.

Correções: afastar D pelo corredor existente e E pela sala; corrigir a face do
painel para x=-0,614 m, com 1,4 cm de espessura; usar folhas largas no vaso e
reduzir reflexos especulares nas folhas. A nuvem de pequenas folhas funcionou
à distância nas árvores, mas não serve para uma planta vista de perto.

Regras: posicionar acessórios pela face acabada da parede, não só pelo eixo;
um método que funciona no fundo não é suficiente para primeiro plano; conferir
o objeto completo na câmera antes de chamar a foto de ambiente.

### R04 — composição selecionada; material da abertura corrigido

Evidências: `previas/r04/`. D agora inclui o sofá e o quadro completos e E
inclui mesa e pendente. F comprova que o painel da TV aparece sem encobrir a
circulação. Selecionadas D para estar e E para jantar/cozinha em cenas próprias.

A inspeção detalhada do vão da varanda revelou Q09. O vidro estava opaco e o
caixilho transmissivo. Corrigido pelo papel real das faces, e não pelo número
do material. Próxima rodada deve conferir também o efeito na iluminação.

Foi acrescentada verificação dos vértices e matrizes dos objetos de origem:
substituições de malhas da origem ficam restritas à folhagem; a arquitetura e
o posicionamento original dos móveis principais permanecem idênticos. Alguns
móveis receberam chanfros não destrutivos, além de acessórios novos separados.

### R05 — composição e vidro conferidos; corrigir o corte

Evidências: `previas/r05/`. Vidro transparente mostra a varanda; caixilho opaco
permanece legível. A luz mantém desenho e os brancos não apagam os tecidos.
Estar e jantar ficam em câmeras separadas. Planta revelou Q10, corrigido antes
de gerar as imagens grandes.

Ocorrência técnica: a nova cena copiada de jantar desapareceu ao salvar por não
ter usuário persistente. `use_fake_user=True` e reabertura imediata passaram a
ser obrigatórios para as quatro cenas. A existência em memória não prova que a
cena está no `.blend` salvo.

### R06 — candidata à entrega de revisão

Sem alterar luz e câmeras já comparadas; corrigido apenas o filtro de decoração
do corte. Conferir a prévia da planta e depois gerar os quatro PNGs grandes.
As versões anteriores continuam preservadas por rodada.

### R07 — enquadramento medido

A revisão ampliada de R06 revelou Q11. A avaliação anterior que dizia "sofá
inteiro" estava errada: a base ainda ultrapassava a imagem em 11,3% da altura.
O teste `verificar_composicao.py` mede os oito cantos dos bounds dos objetos do
sofá e da moldura na câmera. Foi introduzido formato 2048 × 1536 no estar e
alvo z=0,93 m, sem mover câmera, paredes ou móveis.

O modo `--apply` só salva se os assuntos ficarem com pelo menos 2% de margem.
Ele não concede aprovação estética. A imagem R06 deve ficar preservada e o
estar deve ser renderizado de novo; as outras três vistas não mudam.

Resultado medido de R07: mínimo projetado (0,2035; 0,0340), máximo
(0,9572; 0,8924). Sofá e moldura inteiros, com margem mínima superior a 2%.
A prévia R07 e o render grande foram conferidos visualmente. O estar foi
recalculado em 2048 × 1536, sem cortar a base do sofá.

### Conferência de persistência das texturas

A auditoria `auditar_texturas.py` confirmou 17 imagens empacotadas na base salva
e as mesmas 17 na revisão, sem perdas nem arquivos externos ausentes. As 12
restantes do snapshot eram descartadas ao salvar porque estavam sem usuários.
Para preservar o conjunto de 29 prometido, foram importadas do snapshot original,
empacotadas e marcadas com usuário persistente. O fechamento agora salva, reabre
e só então confirma a quantidade e a presença das quatro cenas.

## Fechamento da revisão

As quatro imagens grandes foram abertas e inspecionadas. Verificação técnica
concluída após salvar e reabrir o `.blend`; relatório em
`entrega/validacao_tecnica.json`.

| Entrega | Resolução | Resultado da revisão |
|---|---|---|
| Condomínio | 2560 × 1600 | Folhagem detalhada e direção de luz legível; geometria simplificada de veículos permanece. |
| Apartamento em corte | 2400 × 2000 | Materiais distintos, layout preservado e decoração alta sem partes soltas. |
| Estar | 2048 × 1536 | Sofá e quadro dentro da imagem, tecido legível e sombras de contato. |
| Jantar/cozinha | 2048 × 1280 | Mesa e pendente com assunto definido, varanda visível através do vidro e materiais separados. |

Confirmações técnicas: 29 texturas incorporadas e persistentes; quatro cenas
presentes após reabertura; 366 malhas da origem com vértices e matrizes iguais;
646 objetos de folhagem substituídos; arquivos da base preservados por hash;
margem de câmera do sofá e do quadro conferida.

**Estado visual:** revisão mais consistente da maquete ilustrativa, com os
limites abaixo. Não representa aprovação pelo usuário nem promessa de fotografia.
O comparativo e as versões anteriores permanecem disponíveis. Scripts e notas
ficaram sem commit, pois não houve autorização para comitar.

## Limites que permanecem nesta revisão

- Veículos, louças e parte dos móveis/eletrodomésticos conservam geometria da
  maquete ilustrativa. Não houve substituição completa por ativos de fotografia.
- A vegetação, o quadro e os acessórios novos são procedurais; a apresentação
  mantém uma linguagem de maquete e não deve ser anunciada como fotorrealista.
- O painel da TV existe no projeto e foi conferido no teste F, mas a vista do
  estar foi escolhida para mostrar o sofá. Não se tenta mostrar toda a sala em
  uma única câmera.
- A conferência técnica não é aprovação visual pelo usuário. As evidências
  devem acompanhar qualquer próxima decisão de qualidade.

## Próxima vez: sequência obrigatória para evitar repetição

1. Confirmar a versão publicada usada como fonte e preservar a tentativa anterior.
2. Inventariar geometria, materiais e coordenadas avaliadas antes de classificar.
3. Escolher o assunto da foto e medir seus limites na câmera.
4. Fazer prévia de composição; depois revisar luz e materiais na mesma câmera.
5. Examinar objetos próximos com mais detalhe que os elementos de fundo.
6. Conferir o corte com bounds globais, nunca só com a origem do objeto.
7. Reabrir o `.blend` para conferir cenas persistidas e texturas incorporadas.
8. Só então calcular imagens grandes e repetir a inspeção visual nessa resolução.
9. Registrar causa e regra de prevenção para qualquer falha encontrada.
