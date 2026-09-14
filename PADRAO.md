# Padrão do mapa 3D — como uma cidade entra sem retrabalho

Este arquivo é o contrato. Ele existe porque o retrabalho de hoje teve uma causa só, e
ela se repete em toda cidade nova se nada mudar: **o mesmo conceito estava escrito em
mais de um lugar, com valores diferentes.**

A largura da rua estava em quatro arquivos — no renderizador (`ROAD_W × 1,55`), no
`quadras_miolo.py` (`ROAD_W/2 + 2,6 + 1,5`), no `gen_streets.py` (`ROAD_W/2 + 5`) e nos
scripts de diagnóstico. Ninguém estava "errado": cada um tinha uma conta razoável. O
resultado no mapa foi muro flutuando na rua residencial e muro em cima do asfalto na
avenida — e três rodadas de investigação para achar isso.

## As três regras

**1. Um conceito, uma definição, num arquivo de dados.**
Tudo que muda de cidade pra cidade vive em `padrao/cidades/<slug>.json`: projeção
métrica, origem do mapa, tabela de largura de via, multiplicador da fita, tamanho de
terreno padrão, limiares de QA e o caminho de cada fonte. Código de pipeline não pode
ter número de cidade escrito dentro dele.

**1b. O renderizador é código, e a cidade não mora dentro dele.**
Os 97 KB de JS vivem em `renderizador/app.js`, não dentro de um HTML de 6,9 MB, e a
página é montada por concatenação (`pipeline/montar.py`) em vez de 59 âncoras de texto
encadeadas. Centro, quantização, grade de relevo e nome saem do bloco `__cidade`, escrito
a partir de `padrao/cidades/<slug>.json`. O portão `cidade fora do código do renderizador`
reprova quem escrever coordenada de volta no código.

**2. A rua é a fita que o renderizador desenha.**
`buildRibbons(R, 0.18, mul_fita)` pinta a calçada e `buildRibbons(R, 0.35, 1.0)` a
pista. A borda externa da primeira — a `ROAD_W[tipo]/2 × mul_fita` do eixo — é *a linha
onde a rua acaba*. Quadra, lote, muro e casa param nela. Quem precisar dessa geometria
chama `padrao.vias.fita()` / `fita_utm()`, não reimplementa o buffer.

**3. O que o olho reclamou vira número com limite.**
Toda reclamação visual atendida deixa um portão com limiar no JSON da cidade. Um build
só sai depois de `python padrao/rodar_qa.py <slug>` passar. "Parece certo nesta janela"
não é aceite — a cidade tem 3.373 quarteirões.

**3b. Reclamação sobre o CLIQUE também vira portão.** Metade do que o v11→v13 entregou
não é coordenada, é interface: a ficha do imóvel, o pino que nasce apagado, o rótulo que
não se redesenha à toa, o minimapa que vira planta dentro da casa. Nada disso aparece
numa foto e todo modo de falhar é silencioso. Esses portões abrem a **página pronta** num
Chrome headless e mexem nela (`padrao/comportamento.py`), e valem tanto quanto os de
geometria: são a mesma regra 3, aplicada ao que se faz com o mouse.

**Por que isso virou regra:** entre 30/08 e 01/09 as nove provas de comportamento
existiam — como scripts soltos em `pipeline/testa_*.py`, rodados a mão, na cidade que o
autor da mudança tinha aberto. `padrao/rodar_qa.py` continuava dizendo *aprovado* com as
nove medidas de geometria de 29/08 enquanto a página que saía já era o v13. Cidade nova
recebia carimbo sem que nada tivesse conferido se ela tinha o comportamento do v13. É o
mesmo defeito da largura da rua, na forma "o aceite está escrito em mais de um lugar".

## O que já é padrão

    arvores/                     as 20 especies + o gerador (Blender) e a ponte
    padrao/cidades/<slug>.json   a cidade inteira em dados
    padrao/cidade.py             carrega o JSON, faz as projeções (para_utm, para_mapa…)
    padrao/vias.py               eixos + fita da rua (a ÚNICA implementação) e a
                                 leitura da tabela de dentro do HTML, pro portão
    padrao/qa.py                 os portões de GEOMETRIA (abre arquivo, mede polígono)
    padrao/comportamento.py      os portões de COMPORTAMENTO (abre a página e mexe nela)
    padrao/pagina.py             sonda que roda JS dentro do HTML pronto (Chrome headless)
    padrao/rodar_qa.py           roda tudo, grava relatorios/qa_<slug>.json, sai 1 se reprovar

Já consomem isso: `v7/pipeline/quadras_miolo.py` (a tabela de largura saiu de lá) e
`v7/pipeline/juntar_lotes.py` (os limiares do exame de quadra).

### `aparencia`: melhoria que vale numa cidade só

Aparência nova costuma nascer testada numa cidade e ainda não aprovada nas outras. Até a
Fase 4 esse escopo era **qual página foi montada por último** — o que não é escopo, é
atraso: a montagem seguinte, disparada por qualquer motivo, levava a mudança junto.

Agora é dado. O bloco `aparencia` do JSON da cidade vai inteiro pro `__cidade`, e o
renderizador lê `APAR` na inicialização. A regra:

> **Quem não declara a chave recebe o desenho ANTERIOR, byte a byte no GLSL.** Nada de
> `mix` com peso zero em cima de uma tabela nova: as duas versões ficam escritas e a
> chave escolhe, ou o termo novo é multiplicado por um `AP` que o compilador dobra fora.

O aceite disso é foto, não leitura: monte outra cidade com o renderizador novo e compare
com a página anterior (`pipeline/compara_print.py`), sempre depois de rodar o controle
(mesmo arquivo, duas capturas). Promover uma chave pra todas é acrescentá-la aos outros
JSONs — e aí ela deixa de ser chave e volta pro código.

### Os portões de hoje

São **duas famílias**, e a distinção não é de gosto — é de custo e de pré-requisito. Os
de geometria abrem arquivo e medem polígono: segundos, sem dependência externa. Os de
comportamento sobem um Chrome headless e mexem na página: ~3,5 min por cidade. O
`--rapido` do `rodar_qa` pula a segunda família para o ciclo curto de quem está mexendo
em geometria — **mas relatório com comportamento não medido não autoriza publicar**, e o
JSON registra qual dos dois deixou de ser medido justamente para isso.

#### Geometria

| portão | limite | São Carlos em 2026-08-29 (pós-quadra do grafo) |
|---|---|---|
| tabela de vias (HTML × JSON) | idênticas | idênticas |
| cidade escrita no renderizador | 0 | **0** |
| muro sobre a rua | ≤ 1,0% | **0,13%** (4,9 km de 3.823 km) |
| lote sobre a rua | ≤ 1,0% | **0,00%** |
| frente do lote encostada na rua (mediana) | ≤ 0,25 m | **0,01 m** |
| quadra com lote fora do eixo da rua | 0 | **0** de 953 |
| casa sobre a rua | ≤ 1,0% | **0,52%** |
| muro fora do chão (medido na página) | ≤ 1,0% | **0,00%** (era 27,8%) |
| árvore fora da calçada (medido na página) | 0% | **0,00%** de 1.652 árvores de rua (era 2,19%) |

#### Comportamento (o padrão é o v13)

Cada linha é um script que já existia, promovido a portão. `desde` é a versão que
introduziu a exigência — a lista é, na prática, o que uma cidade precisa **entregar**
para estar no padrão de hoje.

| portão | desde | o que reprova | Araraquara em 2026-09-01 |
|---|---|---|---|
| abre em `file://` (duplo clique) | v6 | a página comprimida não sobe sem servidor, ou a vitrine não leva pra dentro da casa | **ok** (10 s) |
| terreno de fundo sem buraco | v11 | chão faltando onde não há quadra, ou espetando por cima dela | **ok** (52 s) |
| quadro preguiçoso | v11 | rótulo/sombra se redesenhando à toa, nos dois níveis de gráfico | **ok** (35 s) |
| governador de gráfico | v11 | baixar/subir a resolução não chega no canvas | **ok** (14 s) |
| árvore remendada | v11 | o remendo por raio diverge da reconstrução completa | **ok** (27 s) |
| UX: busca, link, noite, minimapa | v12 | o que a barra de cima promete parou de funcionar | **ok** (14 s) |
| ficha e "o que tem por perto" | v13 | o clique na vitrine entra na casa em vez de parar na ficha; o pino nasce aceso; a contagem é da cidade e não do raio | **ok** (10 s) |
| custo do minimapa | v13 | rua, rua+POI ou planta estourando o orçamento de quadro | **ok** (14 s) |
| exposição do interior | v13 | a cena de dentro sai estourada ou chapada | *não medido* — Araraquara não tem planta fornecida |

**As cinco cidades passaram em 2026-09-01**, com relatório em `relatorios/qa_<slug>.json`
carimbado `versao: v13` e `comportamento_medido: true`:

| cidade | reprovados | não medido | total |
|---|---|---|---|
| Araraquara | 0 de 18 | interior | 236 s |
| Ribeirão Preto | **0 de 18** | — (é a única com planta) | 377 s |
| São Carlos | 0 de 18 | interior | 297 s |
| São José do Rio Preto | 0 de 18 | interior | 343 s |
| Sorocaba | 0 de 18 | interior | 334 s |

Três coisas que essa tabela ensina e que não estão nos números:

- **Portão que não roda é pior que portão que reprova.** `testa_v12_ux` e
  `testa_terreno_base` tinham a lista das cinco cidades escrita à mão dentro do arquivo:
  a **sexta** cidade nasceria invisível para as duas e passaria por não ter sido olhada.
  A lista tem um dono — `padrao/cidades/` — e agora as duas leem de lá.
- **"Não medido" ≠ "passou".** Máquina sem Chrome, ou cidade sem planta fornecida, não
  reprova nada: o portão sai em branco e o relatório lista os não medidos. Sonda que
  morre por falta de ambiente devolve **2**, não 1 — sem essa distinção, notebook sem
  Chrome reprovaria o build inteiro.
- **A exposição do interior é por cidade, não do repositório.** O medidor tinha
  `ribeirao-preto` escrito dentro dele (era a única com planta). Agora recebe o slug, e o
  portão só o chama para cidade com unidade **daquela** cidade e com âncora — que é onde
  existe interior para medir. A faixa (média 120–175, queimado < 1,5%) continua calibrada
  na cena de referência.

  Duas armadilhas apareceram aí, e as duas são a mesma doença — *portão que passa por não
  ter olhado*:

  1. O primeiro teste de pertinência exigia `predio_id`. Mas o **mirra-114**, a única
     unidade de verdade do acervo, tem `predio_id: null` e se prende pela `ancora`. O
     portão saiu *não medido* exatamente na única cidade onde havia interior. O critério
     certo é `cidade == slug` (a `_exemplo`, com `cidade: null`, viaja para todas e por
     isso não é de nenhuma) **e** âncora ou prédio.
  2. Pior: o medidor tirava a foto e media **mesmo quando o clique não entrava na casa**.
     A média de uma vista aérea diurna cai confortavelmente dentro de 120–175 — ele
     aprovaria a iluminação de uma cena que nunca abriu. Agora exige `dentro: true` na
     sonda antes de olhar para os pixels. Confirmado nos dois sentidos: Ribeirão mede
     (média 159,9), Sorocaba reprova com *"a casa não abriu"* em vez de passar.

Dois detalhes de medição que valem mais que os números:

- **A fita é erodida em 25 cm antes de medir "em cima da rua".** Depois do conserto a
  divisa da frente cai *exatamente* sobre a linha, e `intersection` devolve o segmento
  inteiro: sem a erosão, o resultado certo mede 221 km de "invasão" que é justamente o
  encosto que foi pedido.
- **Alguns portões medem DENTRO da página, não em Python.** Se o defeito é decidido pelo
  renderizador — como o muro seguir o relevo, que sai do `buildMuros` —, medir em Python
  seria escrever a regra de novo em outro lugar, que é o vício que este arquivo existe pra
  matar. `padrao/pagina.py` injeta um `<script>` no HTML pronto e lê o resultado pelo
  console; o portão do muro lê a geometria que o usuário vê.
- **Só via dirigível conta.** Calçada e trilha (`footway`, `path`, `cycleway`, `steps`) o
  renderizador desenha, mas o recorte de quadra não corta por elas de propósito —
  caminho atravessando praça não pode comer lote. O que sobra em cima delas é ruído
  conhecido, não defeito.

### A arborização (v10)

Até o v9 toda árvore era **um icosaedro de 20 triângulos**, e só em praça: a árvore de
rua tinha sido desligada no v6 porque caía em cima da casa e do asfalto. O v10 tem 20
espécies de arborização urbana brasileira (`arvores/`, geradas por script no Blender,
cor por vértice) e devolve a árvore de rua. Três coisas viraram regra:

**A árvore de rua nasce na calçada, e isso é geometria, não bom senso.** A fita que o
renderizador desenha tem duas bordas: a pista (`ROAD_W/2 × mul_pista`) e o fim da rua
(`× mul_fita`), onde quadra, lote e muro param. Entre as duas há calçada livre *por
construção*. O tronco vai no meio dessa faixa (`mul_calcada`, hoje 1,28), então não tem
como nascer no asfalto nem dentro do lote — a copa passa por cima dos dois, que é o que
as fotos de rua mostram. É a regra 2 aplicada a mais um objeto.

E é a regra 3 funcionando: o portão reprovou o primeiro build em **2,19%**. A calçada da
*própria* via não diz nada sobre a via que cruza, e a árvore de esquina caía na pista da
avenida. Hoje o candidato é testado contra um índice de asfalto da cidade inteira — não
do quarteirão, porque a rua que atravessa a fronteira mora na célula do vizinho.

**Qual espécie vai onde é dado da cidade.** `arborizacao` em `cidades/<slug>.json`: a
mistura de rua, a mistura de praça, o passo, a densidade e os tetos. A biblioteca de
árvores é a mesma pra todo mundo — a *mistura* é que muda de cidade pra cidade. O
renderizador avisa no console e ignora nome de espécie que não exista.

**O orçamento de árvore é da cena, não do quarteirão.** Esta foi a lição cara: o v6
plantava uma árvore a cada 11 m em toda área verde, sem teto nenhum. Com icosaedro
instanciado, uma célula com mata chegava a **59.935 árvores** e ninguém via — custava uma
matriz cada. Com 261 triângulos por árvore isso vira 15,6 milhões de triângulos num
buffer só, e a primeira versão do v10 (uma malha mesclada por quarteirão) **parou de
entregar prédio**: o streaming gastava o quadro inteiro montando árvore. O conserto tem
três partes, e todas moram no JSON da cidade: teto por praça, `raio_m` (850 m — árvore
não é prédio, aos 1.800 m do streaming ela é um pixel) e `max_na_cena`, que corta pelas
mais distantes.

Daí a forma final: **uma `InstancedMesh` por espécie, global**, refeita inteira quando o
conjunto vivo muda. A cidade toda cabe em **até 20 chamadas de desenho, não importa
quantos quarteirões estejam vivos**. Medido: o v9 gastava 18 chamadas para 4.091 árvores
numa amostra de 80 quarteirões, crescendo com o raio; o v10 gasta 20 para a cidade
inteira. Na amostra empatam — o que se ganha é o teto, não a média.

### Carimbo de build no HUD

O HUD mostra `<cidade> / <versão> / <data>`. Parece bobagem e não é: um print do arquivo
antigo lido como se fosse do novo já custou uma rodada inteira de conversa. Print sem
carimbo não é evidência de nada.

## Onde estao os passos

Este arquivo e o **contrato** — as regras, os portoes e o que cada etapa promete
entregar. O caminho completo, incluindo **o que foi baixado e como foi tratado antes
da etapa 1**, esta em [`PIPELINE.md`](PIPELINE.md), e roda por um comando so:

    python pipeline/rodar.py --listar     # a tabela e o que esta velho
    python pipeline/rodar.py              # roda o que esta velho, sem tocar na rede
    python pipeline/rodar.py --rede       # inclui as etapas que baixam

## Etapas, com contrato

Cada etapa lê arquivo e grava arquivo — nada de estado escondido. As colunas obrigatórias
são o contrato; quem quebrar uma delas quebra a etapa seguinte.

| # | script | entra | sai | contrato da saída |
|---|---|---|---|---|
| 1 | (fora do repo) | plantas, OSM, cadastro | `quadras_<cidade>.geojson` | polígono de quadra **até o eixo da via**, `id` único |
| 1b | `quadras_grafo.py` | quadras + `faces_ruas` + `city_base` | `quadras_<cidade>_completo.geojson` | cadastro + face do grafo onde ele não cobre; `fonte` ∈ {`cadastro`, `grafo_ruas`} |
| 2 | `quadras_miolo.py` | quadras + `city_base` | `quadras_miolo.geojson` | quadra menos a fita; `id` = o da quadra (vários pedaços podem repetir o id) |
| 3 | `lotes_sinteticos.py` | miolo | `lotes_sinteticos_miolo.geojson` | `quadra`, `nx`,`ny` (normal frente→fundo) |
| 4 | `juntar_lotes.py` | planta + sintético + miolo | `lotes_..._completo.geojson` | `fonte` ∈ {`planta`, `planta_refeita`, `sintetico`}, `quadra`, `area_m2` |
| 5 | `ocupacao.py` | lotes + endereços | `lotes_ocupados.json` | **índices** do arquivo da etapa 4 — refez a 4, refaz a 5 |
| 6 | `gen_muros.py` | lotes + ocupados | `muros_segs.json` | segmentos delta-encodados em decímetros |
| 7 | `build_v7_city.py` | tudo acima | `<cidade>.city.json` | volumes; casa recortada pelo **miolo** |
| 7b | `gen_chao.py`, `gen_ruas.py` | quadras_completo + `city_base` | `ground_tris.json`, `street_tris.json` | triângulos em metros, int16; a rua é `(vão + corredores) − quadras` |
| 8 | `pipeline/montar.py` | `renderizador/` + city + assets | `.html` | concatena as peças; `--conferir` compara peça a peça |
| 9 | `padrao/rodar_qa.py` | os artefatos | `relatorios/qa_<slug>.json` | **sai 1 se reprovar** |

A armadilha da etapa 5 já mordeu: `lotes_ocupados.json` guarda índices, não ids. Mexeu na
lista de lotes, tem que rodar a 5 de novo, senão a casa nasce no lote do vizinho.

### O exame de quadra (etapa 4)

A planta oficial é georreferenciada por planta inteira, mas erra **por quadra** — uma
planta com encaixe 0,99 pode estar 42° fora num quarteirão específico. Por isso cada
quadra passa por:

    delta = ângulo dominante dos lotes × eixo do quarteirão   (PERÍODO 90°)
    fora  = fração da área do lote fora do miolo
    reprova se delta > 15°  ou  fora > 20%

Quadra reprovada é refeita caminhando o perímetro do miolo com a **frente × fundo padrão
daquela planta** — perde o desenho, que ali estava errado; mantém o tamanho do terreno,
que é o que a planta tem de bom.

**O período de 90° não é detalhe.** Lote de testada é perpendicular ao lado comprido da
quadra e lote de esquina é paralelo — os dois certos. Com período 180° a média circular
dos dois se cancela (concentração 0,01), a medida vira ruído e o exame reprova quadra boa
enquanto passa quadra torta.

## Cidade nova: o checklist

1. **`padrao/cidades/<slug>.json`** — copie o de São Carlos e troque:
   - `crs.utm`: o fuso UTM da cidade (São Carlos usa SAD69 / 23S = EPSG:29193). Errar
     aqui não dá erro, dá cidade deformada.
   - `centro.lat/lon`: **o mesmo valor que o renderizador usa** como origem.
   - `vias.largura`: só se a cidade tiver caixa de rua diferente. `mul_fita` acompanha o
     renderizador — se mudar num, muda no outro, e o portão cobra.
   - `lote.frente_m/fundo_m`: o terreno típico da cidade, usado onde não há planta.
   - `fontes`: os caminhos dos arquivos daquela cidade.
2. **Quadras** (etapa 1). É a única entrada realmente obrigatória. Sem polígono de quadra
   não há miolo, não há lote, não há muro.
   **O cadastro quase nunca cobre a cidade toda** — em São Carlos ele deixava 1.359 faces
   de fora e com elas 18.898 estruturas, bairro inteiro apagado (Araucária, Zavaglia,
   Planalto Verde, Abdelnur). Rode a etapa 1b: a face do grafo de ruas é polígono até o
   eixo da via, que é exatamente este contrato, e mede o mesmo que a quadra oficial
   (mediana 9.980 m² × 10.091 m², IoU 0,85). **Só entra face com prova de urbanização** —
   lotear pasto é a mesma doença que a etapa 5 existe pra curar.
3. **Rode 2 → 9.** O portão da etapa 9 diz se pode publicar — e desde 01/09 ele
   confere as duas famílias: a geometria **e** o comportamento do v13. Leva ~3,5 min a
   mais por cidade e precisa de Chrome. Se o relatório sair com portão de comportamento
   *não medido*, o build não está aprovado; está **sem exame**.
4. **Sem planta oficial?** Pule as etapas de planta: `juntar_lotes` cai inteiro no
   sintético e o mapa sai com terreno padrão da cidade. Sem prova de ocupação
   (endereços/footprints), `ocupacao.py` precisa de outra fonte — sem ela, ou o mapa fica
   vazio, ou volta a pôr casa em todo lote, que foi o erro que gerou 635 casas para 13
   endereços.

## Provado em duas cidades

Araraquara (2026-08-29) roda o padrão inteiro **sem nenhum dado de prefeitura**: sem
cadastro de quadra, sem ponto de endereço, sem planta. Toda quadra vem do grafo de
ruas, e a razão miolo/quadra deu **76%** — o mesmo valor de São Carlos, que veio do
cadastro oficial. 83.486 volumes, 8 portões passando. Ver `PIPELINE.md`, seção 6.

Duas regras que a segunda cidade acrescentou:

- **Entrada obrigatória × opcional.** Cidade sem cadastro/planta/endereço é o caso
  comum; São Carlos é que é a exceção. Etapa com entrada obrigatória faltando é
  **pulada** (senão a 0d processa a planta do município errado); entrada opcional não
  impede a etapa de rodar (senão a 1b, que existe pra rodar sem cadastro, nunca roda).
- **Cache e estado por cidade.** Tiles do Overpass e `_estado.json` compartilhados
  faziam a segunda cidade reaproveitar o download da primeira e sair vazia **sem erro
  nenhum**.

## O que ainda NÃO é padrão (dívida conhecida)

- **O renderizador ainda tem a própria cópia da tabela de vias** (JS). Agora que ele é
  código de verdade em `renderizador/app.js` e a página é montada por `pipeline/montar.py`,
  dá pra injetar a tabela junto do bloco `__cidade` — é o próximo conceito a sair do
  código. Até lá o portão compara as duas e reprova o build se divergirem.
- **Os scripts do pipeline moram em `v7/pipeline/` com nome e caminho de São Carlos.** A
  segunda cidade obriga a promover essa pasta pra `pipeline/` na raiz, dirigida pelo
  `CIDADE=<slug>`. Metade do caminho já está andada: os caminhos saem de
  `CID.caminho(...)` e o slug já vem de `os.environ["CIDADE"]`.
- **As fontes são de São Carlos**: OpenPlots (plantas da prefeitura) e pontos de endereço
  do SigaSC. Cidade nova precisa do equivalente, e o `filtrar_confiaveis`/`consolidar`
  assume o formato do acervo daqui.
- **A malha de asfalto do chão tem a terceira conta de largura** (`ROAD_W/2 + 5`, em
  `gen_ruas.py`). O script saiu do scratchpad e virou etapa 7b, lendo as fontes do JSON
  da cidade, mas a conta continua fora do `padrao/vias.py`. Ela não afeta o encosto do
  muro (o asfalto é recortado pelas quadras) nem nenhum portão; unificar é o próximo passo.
- **A vitrine de imóveis ainda é conteúdo de São Carlos dentro do `app.js`** (o array
  `HOUSES`), e nenhuma cidade tem `dados/imoveis.json`. Consequência direta e não óbvia
  no aceite: numa cidade nova a vitrine sai **vazia**, e o portão *ficha e "o que tem por
  perto"* só consegue exercitar os **cinco critérios de boot** (pino apagado, botão Pins
  falso, nenhuma ficha aberta, coluna fechada, coluna com categoria) — os vinte e poucos
  que testam ficha, tira, filtro e busca ficam sem ter em que clicar. Ele passa, e passa
  honestamente; só não está provando tudo que prova em São Carlos. Fechar essa dívida é
  dar à cidade nova uma fonte de anúncio (`fontes.imoveis`), não mexer no portão.
