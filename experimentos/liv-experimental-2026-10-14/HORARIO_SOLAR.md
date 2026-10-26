# Horário solar do LIV — 26/10/2026

Controle contínuo de 0h a 24h no exterior, na Planta 3D e no Tour. A hora é
compartilhada ao trocar unidade ou modo, salva na sessão e aceita pela URL
(`hora=8.5&data=2026-10-26`). Setas, Home e End funcionam no controle nativo.
A data padrão é o dia atual em São Paulo. A interface informa luz ilustrativa.
O controle fica vertical na direita, com fundo/borda/sombra do painel transparentes.
0h fica embaixo e 24h em cima; ↑ aumenta, ↓ diminui. O input mantém 44px de
área de toque. A cor dos textos acompanha a cena para preservar a leitura.

## Referencial e procedência

- Equações solares: [NOAA](https://gml.noaa.gov/grad/solcalc/solareqns.PDF),
  latitude/longitude, calendário e UTC−3; sem refração atmosférica.
- Âncora da implantação atual: −21.98896655, −47.92314270.
  `mapa-parcela.json` declara `positionApproximate=true`.
- Ponto divulgado pela Livon e registrado em `gerar_mapa.py`/`medicoes.json`:
  −21.988640293284593, −47.921966616665976, a 126,6 m da âncora. A documentação
  também não confirma precisão cadastral. A diferença é pequena para o cálculo solar.
- O link Shadowmap fornecido centra em −22.02300, −47.89010, a 5,092 km da
  âncora do LIV. Centro de navegação não foi tratado como posição do empreendimento.
  Para 26/10/2026, seus rótulos de nascer/pôr são 05:32/18:20. O cálculo local
  conferiu 05:32/18:19, usando −0,833° somente para comparar esses eventos
  (refração/disco aproximados, conforme NOAA); a cena mantém altitude geométrica.
- Mapa: +X=leste, −Z=norte. Prédio girado +120° em Y conforme
  `mapa-implantacao.js`/`maquete-no-mapa.js`. A rotação é manual.
- Face lazer: +Z do prédio, azimute aproximado 60° (nordeste).
  Estacionamento: −Z, azimute 240° (sudoeste).
- O interior tem a abertura principal em −Z: yaw 0 para estacionamento e π
  para lazer. O contexto vem da unidade selecionada em toda ativação, inclusive
  ao reutilizar a mesma tipologia. A direção geográfica do sol é única.

## Iluminação

O sol é direcional e move as sombras reais da geometria. O céu difuso varia
suavemente. O interior troca o atlas antigo, que misturava sol fixo e plafons acesos, pela
luz gravada por hora (seção abaixo);
o teto oculto da planta mantém um oclusor de sombra. Vidros das aberturas
transmitem a luz. As paredes continuam barrando-a mesmo no corte de apresentação.

Seis plafons por tipologia acendem com a redução da luz diurna. Canto reutiliza
os seis difusores reais; Meio recebe luminárias nos ambientes. Spots sob os
difusores apontam para baixo e projetam sombras estáticas de 512 px; mudar a hora
altera intensidades, sem recriar recursos nem recalcular sombras dessas fontes.
Mudar móveis invalida as sombras. O sol recalcula sua sombra ao mudar de direção.

O exterior desliga o atlas de iluminação antiga no modo horário. O sol
dinâmico fornece o termo direto e a irradiância do céu fornece o indireto,
sem vestígios das sombras solares congeladas. Janelas existentes recebem brilho
quente discreto à noite, pois a casca exterior não contém volumes de cômodos.

## Luz gravada por hora (Canto) — 26/10/2026

O Tour do Canto lê, nas superfícies da casa, a luz calculada no Cycles a partir de
`LIV_Luz_Natural.blend`: céu e rebatimento gravados em 7 horas (6h a 18h, de 2 em 2)
para cada lado do prédio, mais uma noite com o rebatimento dos seis plafons.
O sol direto e os plafons diretos continuam em tempo real, com sombras; o site
mistura as duas horas vizinhas e reescala pela luz do dia do momento.
O sol do site passa a usar a irradiância do disco medida no Cycles, com os mesmos
3 EV da câmera aprovada. Móvel mexido volta ao modo dinâmico anterior, como no
atlas antigo. O atlas antigo de 4,3 MB não é mais baixado; o UV1 dele é reaproveitado.
Meio continua dinâmico (não tem UV1 de luz).

Refazer, na raiz, depois de mudar a cena aprovada ou o interior:

```
node experimentos/liv-experimental-2026-10-14/chaves-luz-horario.mjs > experimentos/liv-luz-natural-2026-10-26/fontes/luz-horario/chaves.json
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' -b experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend --python experimentos/liv-luz-natural-2026-10-26/bake-luz-horario.py -- --size 1024 --samples 1024  # ~2 h no total; feche o navegador (a GPU é disputada)
python experimentos/liv-luz-natural-2026-10-26/empacotar-luz-horario.py
node experimentos/liv-experimental-2026-10-14/preparar-horario.mjs
```

O que não tem UV1 (móveis aprovados, portas, moldura, caixilhos) lê a mesma hora
numa grade de sondas por cômodo (cubos de 2 cm a cada ~40 cm, 6 níveis), gravada
junto: seis direções por ponto, e um mapa de cômodos visto de cima escolhe a grade,
para a luz de um cômodo não atravessar a parede. Sonda dentro de móvel ou parede
herda a válida mais próxima do mesmo cômodo. Portais sem potência nas janelas guiam
o céu no Cycles: sem eles, o ruído dos quartos virava manchas no OIDN.

## Portas

A entrada fica sempre fechada (também na luz gravada). As de quarto e banheiro
abrem e fecham no Tour: de perto e de frente aparece o botão (ou a tecla E).
Cada folha sai da malha comum da esquadria pela cor de porta perto da dobradiça;
a fonte congelada do Canto tem as folhas a 78°, o cadastro atual diz 90°, por isso
a direção vem da geometria. A colisão segue a folha: porta fechada bloqueia a
passagem, e "Ir ao ambiente" abre as de dentro antes de traçar a rota. A luz
gravada considera as portas de dentro abertas.

`plafons-web.json` e `portas-web.json` copiam plafons e dobradiças do próprio site.

Acabamentos dos móveis (26/10): guarda-roupas e aéreos (`m12`) usam o folheado de
nogueira CC0 da Poly Haven (`folheado.js`, `interiores/shared/folheado-nogueira/`),
tingido para o albedo médio da madeira aprovada, no lugar da textura de 256 px
cinza. Geladeira, fogão e pia refletem a sonda da cozinha
(`exportar-ambiente-cozinha-web.py`), e todo reflexo cai na proporção entre a luz
gravada no ponto e a que a sonda daria na mesma normal (cuba e cantos não refletem
mais a janela da sala).

O box dos chuveiros (`m27`) era painel branco opaco encostado na janela do banho da
suíte e barrava o sol: no site virou vidro sem sombra e, na gravação, sai de cena.
O sol das fotos aprovadas (az. 80°, el. 35° no Blender) corresponde a 15/09 às 8h45,
lado do lazer (`?data=2026-09-15&hora=8.75`); em 26/10 o mais perto fica 10–15° fora.
O bake junta as 33 superfícies num objeto só: separado, o Blender sincronizava a
cena 33 vezes (137 s por gravação contra 1,8 s). Outras datas usam a mesma hora
de 26/10, reescalada pela luz do dia.

## Limites que não devem ser escondidos

É uma visualização de posição solar e iluminação ilustrativa. A rotação da
implantação não substitui levantamento do norte verdadeiro. O cadastro não
confirma todos os espelhamentos ou as aberturas por final. Não são simulados
vizinhos, árvores externas e obstruções particulares de cada pavimento dentro
do interior isolado. Céu ambiente e rebote interno são aproximações em tempo real;
não representam cálculo de iluminância ou transporte completo de luz.
O probe local transfere a luz indireta do dia aprovado, com a exposição da
fonte registrada em metadados. Sua intensidade acompanha o dia/noite; ele não
recalcula os rebatimentos por hora ou por fachada. Somente a fonte direta e
suas sombras seguem a posição solar geográfica em cada unidade.

## Erros evitados / corrigidos

- Não girar um sol enquanto o atlas mantém o dia e os plafons congelados.
- Não usar o mesmo yaw para unidades opostas só porque compartilham tipologia.
- Não retirar a sombra do teto quando a Planta 3D o esconde.
- Não criar luzes em cada evento do slider.
- Não deixar o preset antigo de entardecer tingir o albedo depois de voltar ao meio-dia.
- Primeira noite exterior ficou quase preta: ajustado o piso difuso e o brilho
  das janelas existentes. Sem adicionar um segundo sol ou luz de preenchimento direcional.
- Sombras de plafons mostraram faixas no Tour: ajustados bias/normalBias e
  suavização do cone, mantendo oclusão por paredes.
- Falha de integração apontada pelo usuário: os modelos e materiais melhores
  estavam no `.blend`, enquanto o Tour ainda usava a biblioteca antiga. Um render
  melhor não prova que a melhoria entrou no site. O fechamento exige importar os
  assets do arquivo aprovado e verificar sofá, cozinha e materiais no Tour real.
- Não redimensionar um asset usando seu bbox mundial já girado: dimensões
  canônicas são medidas antes da rotação, e as poses do Canto vêm da fonte.
  O roundtrip de 16 objetos registrou erro máximo de 0,016 mm.
- O exportador Blender 5.2 ignorou o peso 0,4 do Sheen nos tecidos e exportou
  a cor com força total. Corrigir o produto Tint × Weight, preservando a fonte.
- Não somar o Hemisphere sintético ao World importado: isso duplica o céu.
- Um HDR externo aplicado a todo o interior ignora as paredes no termo IBL.
  O probe local da sala mantém sua oclusão e luz rebatida; o céu externo é
  usado separadamente no fundo. A luz direta continua sendo o sol móvel.
- Não capturar o disco solar no panorama para depois somar outro sol na web.
  A cópia para captura esconde o disco apenas dos raios da câmera, preservando
  a contribuição solar nos rebatimentos. A fonte aprovada permanece intacta.
- Os pisos existentes usam escalas UV diferentes das do Blender: aplicar a
  razão de escala por acabamento em cópias das texturas, sem alterar outros
  móveis que compartilham os mapas. O V do glTF já inclui a inversão da origem.

## Validação e prévia

`npm --prefix experimentos/liv-experimental-2026-10-14 run test:horario`: 30 testes passaram.
`npm --prefix experimentos/liv-experimental-2026-10-14 run test:melhorias`: 19 testes passaram.
Essa suíte cobre importação GLTF/HDR, texturas separadas para ambiente/fundo,
poses, dimensões, snapshots antigos, isolamento UV e descarte de recursos.
O Look usa uma LUT logRGB 64³ extraída do AgX / Medium Low Contrast da fonte,
com saída linear e uma única conversão final para sRGB. Foram verificadas
sentinelas do Blender, hash, dados, fallback e cancelamento. Sondas de 128
amostras com OIDN substituíram o HDR ruidoso de 16 amostras; mesa, fogão e pia
usam uma captura local de jantar. Canto inclui os quatro complementos da fonte,
totalizando 17 GLBs. Evidências e causas em `evidencias-horario/cor-20261026/`.
Os testes de luz que usam Three ficam no pacote do viewer, que já declara esse
runtime; não acrescentam dependência de Three ao pacote raiz/CI.
`node --test tests/test_interior_*.mjs`: 8 testes existentes passaram.
Os testes incluem 1441 atualizações por tipologia, reversibilidade e ausência
de acúmulo de luzes/materiais/geometrias, dia com artificiais apagadas e noite acesa.

Navegador real: exterior, Planta 3D Canto/Meio, Tour, Home/End, ida/volta da hora,
troca 102 (lazer)→201 (estacionamento) reutilizando Canto, com sombras diferentes.
Teste responsivo em 390×844, com controle compacto e área de toque de 44 px.
O controle final é vertical, à direita e sem painel de fundo; teclado Home/End
atinge 0/24 e as setas aumentam/reduzem a hora. Na conferência da importação,
Canto e Meio renderizaram os novos assets; o Tour foi verificado de dia e
à noite. Falhas de download agora geram aviso explícito no interior, para
evitar considerar uma biblioteca parcialmente carregada como entrega concluída.
Capturas em `evidencias-horario/`. Os avisos observados são do transporte
Firestore e da chamada preexistente renderAsync; sem erro novo de renderização.
Conferência final do exterior sem atlas: 8h→17h→20h→8h. A região da maquete
voltou pixel a pixel à imagem inicial (diferença RGB máxima 0), inclusive ao
abrir pela URL legada `luz=entardecer`. Evidência em `reversibilidade.json`;
o console dessa sessão não registrou erros.

Preparar: `node experimentos/liv-experimental-2026-10-14/preparar-horario.mjs`.
Servir: `python -m http.server 8792 --bind 127.0.0.1 --directory publicacao/liv-horario-20261026/payload`.
Abrir: <http://127.0.0.1:8792/maquetes/liv/>.

O staging parte do payload publicado e preserva geometria `entrada`, SHA
`9ba4c3d261fae716b51ee6fa65464c574074f082ea5873bc7603407ed2b56bac`,
marca e HTML de interior sem splat. `preparacao-horario.json` registra hashes.
Não é um pacote pronto para reativar a publicação: os HTMLs públicos são
servidos pela função que respeita a pausa comercial, conforme
`relatorios/pausa-publica-liv-2026-10-24.md`. Nenhum estado comercial foi alterado.

Fontes, testes e capturas desta alteração permanecem sem commit.
