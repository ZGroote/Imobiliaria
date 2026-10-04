# Plantas fornecidas

Uma pasta por unidade. O que entra aqui e MATERIAL DO ANUNCIO -- imagem, foto, texto --
e o que sai e `unidade.json`, que e o unico arquivo que o renderizador le.

    plantas_fornecidas/<id>/
        planta.png       imagem da planta baixa, resolucao cheia
        fotos/*.jpg      fotos do anuncio
        anuncio.txt      titulo, preco, ficha, descricao (colado do anuncio)
        unidade.json     <- a saida: ficha + geometria em metros

`pipeline/montar.py` varre esta pasta, filtra por `cidade` e embute os `unidade.json`
no bloco `__unidades` da pagina. Nao ha etapa nova no `rodar.py`.

## O formato de `unidade.json`

A geometria e descrita por **comodos**, nao por paredes. Isso nao e simplificacao: e o
que a imagem de uma planta de fato entrega, e o que o extrator consegue produzir, e o
que uma pessoa consegue conferir olhando. As paredes SAO DERIVADAS -- o renderizador
rasteriza os comodos numa grade de 5 cm e emite parede em toda fronteira entre dois
donos diferentes (comodo x comodo, ou comodo x lado de fora). Consequencias:

- os poligonos dos comodos tem que ENCOSTAR uns nos outros. Espaco de 15 cm entre dois
  comodos vira DUAS paredes paralelas com uma faixa morta no meio, nao uma parede.
- contorno externo nao precisa ser declarado: e o que sobra da grade.
- planta torta (extraida de imagem) funciona igual -- a grade nao se importa com
  poligono que nao fecha em angulo reto.

Porta e janela sao PONTOS sobre a parede, com largura. A que estiver mais perto do
ponto ganha o vao. De novo: e o que se enxerga numa planta (um rasgo, um arco), e o que
sobrevive a uma extracao imperfeita.

```json
{
  "id": "mirra-114",
  "cidade": "ribeirao-preto",
  "predio_id": null,             // centroide do predio em decimetros, "1234_-567".
                                 // null = planta solta: vale pro predio que se clicar
  "andar": 7,                    // unidade fixa; a planta nasce em base + andar*3,15 m
  "ficha": { "titulo": "...", "preco": 960374.02, "quartos": 3, "suites": 3,
             "banheiros": 4, "vagas": 2, "area_util": 114.32, "url": "..." },
  "planta": {
    "origem": "planta.png",
    "escala_conferida": false,   // true so depois de bater a area medida com a rotulada
    "pe_direito": 2.70,
    "comodos": [
      { "nome": "Sala", "area": 9.00, "piso": "frio",
        "poly": [[1.75,0],[5.00,0],[5.00,2.77],[1.75,2.77]] }
    ],
    "portas":  [ { "p": [3.4, 2.77], "largura": 0.90 } ],
    "janelas": [ { "p": [3.4, 0.00], "largura": 1.60, "y0": 1.00, "y1": 2.20 } ]
  },
  "cores": { "parede": "#D8D2C8", "piso_frio": "#C9C3BA", "piso_madeira": "#8E6E4C",
             "esquadria": "#F2EFE9", "porta": "#EDE7DD", "aluminio": "#8E959C",
             "peitoril": "#D9D5CE", "vidro": "#BFD4E2" },
  "fotos": ["fotos/sala.jpg"]
}
```

Coordenadas em METROS, x pra direita e z pra baixo, na orientacao da imagem da planta.
A origem e livre: o renderizador centra a planta no centroide do predio e alinha o eixo
maior dela com o eixo maior do volume.

## O vao ganha esquadria, e o lado da porta e deduzido

Porta e janela nao sao mais so um buraco na parede. Cada vao vira **batente com
guarnicao e folha aberta** (porta de giro), **caixilho de aluminio com duas folhas de
correr e vidro** (janela e porta de varanda), **batente sem folha** (passagem: vao com
verga, como cozinha aberta pro jantar) ou **nada** -- so quando o vao vai ate o forro,
que ai nao e vao de porta, e ausencia de parede, e emoldurar inventaria um portal que a
planta nao tem.

Nada disso precisa ser declarado. O renderizador **infere o tipo** da largura e da
vizinhanca, nessa ordem:

| condicao | vira |
|---|---|
| janela com `largura` >= 0,80 | `correr` (duas folhas, uma corrida por cima da outra) |
| janela mais estreita | `fixa` (uma chapa de vidro, tipo basculante de banheiro) |
| porta com `y1` no pe-direito e `largura` >= 1,40 | `vao` -- sala e jantar sao um comodo so, sem esquadria |
| porta que da numa Varanda/Sacada/Terraco, `largura` >= 1,20 | `correr` de vidro |
| porta com `largura` > 1,10 | `vao` |
| resto | `giro` (folha, batente, macaneta) |
| **folha de giro que nao CABE no comodo** | `vao` -- batente e guarnicao, sem folha |

`vao` **ganha batente e guarnicao, so nao ganha folha** -- passagem de porta e acabada
com marco em obra, e sem ele a cozinha parece recortada a estilete. A excecao e o vao
que sobe ate o forro, que nao recebe nada.

**A ultima linha da tabela e um teste de geometria, nao de largura.** A folha nasce
aberta a 78 graus e OCUPA 80 cm de comodo; em canto apertado ela sai pelo outro lado e
aparece cravada na parede vizinha. `folhaCabe()` amostra tres pontos ao longo da folha
girada e pergunta se ainda estao dentro do comodo em que ela gira; se nao estiverem, a
peca vira `vao`. As amostras sao empurradas 6 cm pra dentro de proposito: a ponta da
folha encosta na parede lateral POR PROJETO (a dobradica vai pro canto), e testar a
fronteira crua reprovaria toda porta bem colocada. `tipo` no cadastro continua mandando
-- quem tem o desenho na frente pode saber de uma folha rebatida ou de correr.

No `monte-das-colinas-39` isso trocou as tres portas do corredor por batente: a
circulacao tem 0,95 x 1,49 m e nao cabe folha nenhuma ali. E o certo, e e o que se ve no
apartamento de verdade.

Porta que na vida nao tem folha (a entrada do corredor vinda da sala, por exemplo) se
declara com `"tipo": "vao"`: fica a passagem emoldurada, sem porta.

**Pra que lado a folha gira** tambem e deduzido, com a regra que o desenhista usa:

1. gira pra dentro do ambiente **mais privado** dos dois. A ordem e circulacao <
   varanda < sala/jantar < cozinha/servico < dormitorio < banho. E por isso que a porta
   do banheiro abre pra dentro do banheiro e nunca pro corredor -- folha aberta no
   corredor tranca a passagem;
2. empate (dois quartos, cozinha e area de servico): gira pro **menor**;
3. a **dobradica** fica na extremidade do vao mais perto do canto do comodo, pra folha
   abrir contra a parede lateral em vez de varrer o meio da passagem.

A folha **nasce aberta a 78 graus**, de proposito: fechada ela veda o comodo vizinho e a
visita em primeira pessoa vira quarto sem saida. Aberta, ela ainda mostra pra que lado
abre -- que e o que o arco da planta de arquitetura informa.

Quando a regra erra (ou quando quem cadastra tem o desenho na frente e sabe melhor),
tres campos opcionais mandam nela, em `portas[]` e `janelas[]`:

```json
"portas": [
  { "p": [4.95, 2.25], "largura": 0.95,
    "tipo": "giro",              // giro | correr | fixa | vao -- passa por cima da inferencia
    "abre_para": "Sala",         // nome do comodo pra dentro do qual a folha gira
    "dobradica": [4.60, 2.25] }  // ponto em metros da planta; vale a extremidade mais perto
]
```

As cores tem chave propria em `cores` (`esquadria`, `porta`, `aluminio`, `peitoril`,
`vidro`), com padrao de esquadria branca e aluminio anodizado. Cor por vertice: porta
branca e porta de madeira convivem na mesma malha, e a unidade inteira gasta **tres
chamadas de desenho** de esquadria -- pintado, metal e vidro -- nao uma por peca.

**A colisao recua 14 cm** na ponta de parede que encosta num vao. Sem isso porta de
70 cm era intransitavel: meia parede mais o raio do corpo pedem 36,5 cm de folga de
cada lado, e o vao inteiro so tem 35. A folha aberta tambem barra passo, com raio menor
(ela e chapa de 3,5 cm e fica no canto do comodo, nao no meio do vao).


## De onde vem cada campo

| campo | fonte |
|---|---|
| `ficha` | texto do anuncio |
| `comodos[].nome`, `.area` | rotulos da propria planta ("SALA 9,00m2") |
| `comodos[].poly` | extraido de `planta.png` |
| `comodos[].piso` | fotos -- e o que diz se o quarto e de madeira ou porcelanato |
| `cores` | fotos, cor dominante por ambiente |
| `andar`, `predio_id` | decisao de quem cadastra |

`area` rotulada nao entra na geometria: serve de PORTAO. Area medida do poligono contra
area rotulada e o que diz se a escala da extracao esta certa, comodo a comodo.


## Lancamento: a unidade mora num TERRENO, e o mapa desenha o predio

Lancamento nao esta na base de edificacao -- ela e foto de satelite, e se a torre nao
estava de pe na captura, o que existe no dado e lote vazio. Por isso a unidade pode se
prender a um `lote` em vez de a um predio, e o `lote.predio` diz o que vai ser
construido ali. O `lote` VENCE `predio_id` e `ancora`: nao e uma quarta pista sobre onde
o predio esta, e a afirmacao de que predio nao ha.

```json
"lote": {
  "lat": -22.019534, "lon": -47.917764,
  "confirmado": false,          // true so quando alguem apontou no mapa
  "rumo_graus": 14.1,           // azimute da pegada no plano do mapa (0 = +X, leste).
                                // 0 = rua leste-oeste, 90 = rua norte-sul.
                                // Predio de rua se implanta paralelo a testada, entao
                                // isto e o rumo do EIXO DA VIA no ponto.
  "predio": {
    "pavimentos": 22,           // altura = pavimentos x 3,15 m
    "largura_m": 36.0,          // a pegada e DECLARADA, nao derivada da planta: a
    "profundidade_m": 18.0,     // planta e de UM apartamento e a laje comporta varios
    "cor_parede": "#D8D2CA"     // opcional; ausente = sorteio da paleta
  }
}
```

Sem `pavimentos` o lote e so um ponto no chao (farol, sem volume). Com `pavimentos` ele
vira um registro de edificacao normal, num grupo de streaming so dele: ganha fachada com
janela, platibanda, sombra, clique nos dois sentidos e descarte fora do raio, por UMA
chamada de desenho.

### `blocos`: o empreendimento nao e uma caixa

Um retangulo extrudado e exatamente o que a base do Overture ja da pras 96 mil
edificacoes anonimas -- e lancamento e o unico caso do acervo em que existe
PERSPECTIVA PUBLICADA, ou seja alguem sabe a forma. `blocos` e uma lista de volumes; o
conjunto inteiro continua custando UMA chamada de desenho, porque todos caem no mesmo
grupo de streaming e viram uma malha so.

```json
"predio": {
  "pavimentos": 22, "largura_m": 36.0, "profundidade_m": 18.0, "cor_parede": "#D8D2CA",
  "blocos": [
    { "principal": true,                 // onde MORA a unidade (ver a regra abaixo)
      "du": 0, "dv": 0,                  // metros no frame do LOTE: du no eixo do
                                         // rumo_graus, dv perpendicular
      "largura_m": 22, "profundidade_m": 14 },
    { "du": 12, "dv": 4.5, "giro_graus": -22,   // gira ESTE bloco: e o que faz o L
      "largura_m": 17, "profundidade_m": 13 },
    { "du": 0, "dv": 0, "largura_m": 7, "profundidade_m": 5, "pavimentos": 23 },
    { "du": 2, "dv": 11, "largura_m": 38, "profundidade_m": 8, "pavimentos": 1,
      "classe": 2, "cor_parede": "#BDB6AC" }
  ]
}
```

`pavimentos`, `largura_m`, `profundidade_m` e `cor_parede` que faltarem no bloco caem no
valor do `predio`. Sem `blocos`, o `predio` inteiro e um bloco so -- o comportamento
antigo, intacto.

Quatro coisas que nao sao obvias:

* **O BLOCO PRINCIPAL E A CASCA DA UNIDADE.** E ele que a ficha devolve, que a planta
  veste por dentro e que o furo recorta. Encolher a pegada dele pra parecer mais com a
  perspectiva MEXE NO INTERIOR: medido no Monte dos Cedros, trocar a torre de 34 x 14
  por 21 x 14 derrubou a faixa dinamica do print de dentro de 80,8 pra 67,5. Regra:
  **o principal fica em `du: 0, dv: 0` e com a pegada declarada em
  `largura_m`/`profundidade_m`; sao os OUTROS blocos que se arrumam em volta.** Depois
  de mexer, confira com `pipeline/mede_interior.py <cidade> --unidade <id>`.
* **Volume no alto nao precisa de campo novo.** Parede sempre nasce no chao, entao caixa
  d'agua e casa de maquinas e so um bloco ESTREITO com mais pavimentos que a torre: o
  que esta abaixo do teto fica dentro dela e nao aparece.
* **`classe: 2` em volume BAIXO.** Sem ela, `tipoDe` classifica 1 pavimento como casa e
  poe telhado de duas aguas de 300 m2 em cima da garagem. Com ela sai laje com
  platibanda, que e o que embasamento e portaria tem.
### `sacadas`: a pilha que da relevo a fachada

A `varanda` que todo predio alto da cidade ganha e um RECUO de 20 cm na face mais longa:
devolve uma sombra fina e nada mais. Numa torre de lancamento isso e pouco -- o que se
ve na perspectiva publicada e uma pilha de lajes que AVANCAM, com guarda-corpo cheio, e
sao elas que dao a listra horizontal do predio. `sacadas`, declarado no bloco, emite
essa pilha como geometria de verdade (laje + guarda-corpo nos tres lados, ~48 triangulos
por sacada, dentro da mesma malha do grupo -- zero chamada de desenho a mais):

```json
{ "principal": true, "du": 0, "dv": 0, "largura_m": 34, "profundidade_m": 14,
  "sacadas": { "faces": "longas",   // "longas" (padrao) | "longa" | "todas"
               "por_face": 4,       // teto; cabe menos se a face for curta
               "largura_m": 3.4, "avanco_m": 1.4,
               "peitoril_m": 1.05, "de_pav": 1 } }
```

Tres coisas medidas:

* **A laje da sacada leva a cor MAIS CLARA, nao mais escura.** Ela e o piso, e vive na
  sombra da sacada de cima; com o rebaixamento de sempre, vista do alto -- que e como o
  mapa e olhado -- cada sacada virava um buraco preto na fachada.
* **A sacada nao encosta na quina.** As colunas ficam centradas na face com o mesmo vao
  entre elas e nas pontas; sacada colada na esquina do predio nao existe em projeto.
* **Bloco dentro de bloco nao da erro nenhum, so some.** A coluna de cobogo do Wish
  passou uma rodada invisivel porque estava em `du: 3,5`, dentro da ala leste (que e
  girada 22 graus). Se um bloco nao aparece, o primeiro teste e pinta-lo de magenta e
  contar pixel no print -- e mais rapido que procurar na tela.

### `faixa_pav`: a testeira da laje

```json
{ "faixa_pav": { "altura_m": 0.55, "avanco_m": 0.30 } }
```

E o elemento que mais aparece numa perspectiva de lancamento e o ultimo a ser
lembrado: a testeira da laje AVANCA e da a volta no predio inteiro, inclusive na
empena cega -- onde nao ha janela nenhuma e ela e a unica coisa que se ve. Sem ela a
torre e um pano liso com janela pintada, por mais sacada que tenha. Medida na
perspectiva do Wish: ~1/5 da altura do pavimento. Vai nas quatro faces sempre (e laje,
e laje nao escolhe fachada) e custa ~12 triangulos por pavimento por face.

* **O lado da rua e por medida, nao por conta.** O sinal de `dv` que aponta pra testada
  depende do `rumo_graus`; tire um print com `pipeline/foto.py --phi 0.6` e olhe -- o
  embasamento do Wish e a portaria do Cedros nasceram os dois no fundo do terreno.

**`cor_parede` e a excecao a paleta, e existe por um motivo so:** a edificacao da base
sorteia a cor no leque do arquetipo, porque ninguem sabe de que cor sao as 79 mil casas.
No lancamento alguem sabe -- ha perspectiva publicada. Duas armadilhas medidas:

* **cor clara nao carrega matiz.** A saida sRGB mais o ACES levantam o valor e comem a
  saturacao: um creme #CFC3B0 chega na tela como (197,195,191), que e cinza. O valor que
  se escreve aqui e o que faz a cor CHEGAR certa, nao a cor amostrada da foto -- confira
  com `pipeline/foto.py` e corrija.
* **render de anuncio e de fim de tarde.** Amostrar direto da imagem entrega a cor sob
  luz quente e fraca; o tijolo do Sanca 135 sai #5E3436 na foto e precisa de #6A3327
  para chegar em terracota na tela.

**Sem `planta.comodos` a unidade nao entra na vitrine e nao abre interior** -- o
renderizador exige `comodos.length` em `unidadeDoPredio` e na montagem da lista. O
predio aparece no mapa, com nome e ficha generica de edificacao, e a visita por dentro
fica pendente ate a planta ser extraida. `padrao/comportamento.tem_interior()` usa a
MESMA condicao, pra nao ligar o portao do interior numa cidade que nao tem interior.


## TODA divisa entre dois comodos vira PAREDE

E a armadilha numero um deste formato, e ela nao aparece na leitura da imagem: aparece
na tela, com a planta FECHADA. O renderizador rasteriza os comodos e emite parede em
toda fronteira entre dois donos diferentes -- entao um corredor declarado como "Hall"
ao lado de "Estar/Jantar", sem vao entre os dois, sai TAPADO.

    python pipeline/audita_fronteiras.py [<id>]

lista toda divisa e marca `SEM VAO` as que nao tem abertura. SEM VAO nao e erro por si
(quarto x sala E parede); a lista existe pra obrigar a conferir uma por uma contra o
desenho. **Rode antes de fechar qualquer planta nova.**

Duas regras que saem disso:

* comodo que so existe como NOME -- hall, circulacao, area de servico numa faixa
  continua com a cozinha -- quase sempre precisa de vao declarado;
* o vao de "aqui nao ha parede" precisa de **`y1` no PE-DIREITO**. Sem `y1` o padrao de
  porta e 2,10 m, e a abertura sai com verga e batente: um portal que a planta nao tem.

## Achar o VÃO sozinho: buraco no traço

Porta e janela numa planta de arquitetura sao a AUSENCIA de parede. Entao, depois de
achar as linhas (`extrair_planta.py linhas`), da pra descobrir onde estao os vaos sem
ninguem apontar: para cada parede -- um segmento reto entre dois comodos -- percorra a
mascara de traco escuro e marque os trechos em que ela some. Cada trecho e um vao;
o meio dele e o `p`, o comprimento e a `largura`.

Foi assim que sairam as 11 esquadrias do `wish-castanheiras-58` e as 8 do
`monte-dos-cedros-37`. Quatro coisas aprendidas fazendo:

* **A faixa de amostragem importa.** Amostrando +-9 px em torno do eixo da parede, o
  proprio caixilho da janela (que e desenhado DENTRO da parede) conta como parede e o
  vao some. Com +-4 px ele aparece. Comece largo pra achar porta, aperte pra achar
  janela.
* **O comprimento minimo separa vao de ruido.** Abaixo de ~18 px o que se acha e falha
  de anti-aliasing, nao abertura.
* **O vao detectado confere a escala de graca.** No Wish a frente da sacada saiu 3,82 m
  na deteccao e esta cotada 3,80 no desenho -- 0,5% de erro, e ninguem mediu nada a mao.
* **Nem todo buraco e vao.** Duto de ventilacao (a caixinha com X) e prumada tambem
  interrompem o traco. Olhe a lista antes de aceitar: no Wish tres "vaos" eram duto.

**E o metodo NAO funciona em planta humanizada.** `monte-das-colinas-39` e
`sanca-135-29` sao render visto de cima, com parede BRANCA sobre fundo claro: o limiar
de escuro so pega movel, e a deteccao devolve ruido. Nesses dois a fonte do vao foi
outra -- as badges numeradas do proprio material no Colinas ("11 = portas em compensado
de madeira", "10 = janelas em aluminio e vidro"), e a leitura da imagem ampliada no
Sanca.

## De onde sai a ESCALA, em ordem de forca

1. **Cota no desenho**, conferida pela face interna do comodo. Foi o caso do Wish
   (95,7 px/m, com quatro cotas batendo).
2. **Area da ficha**, quando nao ha cota: a area do retangulo em px dividida pela area
   em m2 da o quadrado da escala. Foi o caso do Cedros, Colinas e Sanca.
3. **Peca de catalogo desenhada**, sempre como CONFERENCIA e nunca como fonte: cooktop
   de 4 bocas 0,58 x 0,51; vaso sanitario 0,37 x 0,68; maquina de lavar 0,60 x 0,60;
   cama de casal 1,38 x 1,88; cama de solteiro 0,88 x 1,88. Movel de render mente mais
   que louca (o "sofa" inclui almofada, a "cama" inclui o edredom transbordando).

**O portao continua sendo a area.** Nenhuma escala entra sem que a soma dos comodos
feche com a area da ficha: Wish 56,69 contra 58,00 (-2,3%), Cedros 37,28 contra 37,28,
Colinas 39,28 contra 39,30, Sanca 28,73 contra 28,77.

## O chao e TABUA, e a tabua precisa de junta de topo

`piso: "madeira"` desenha regua de 20 cm com junta de topo escalonada (12 reguas por
passo de 2,40 m). A primeira versao eram quatro reguas de 40 cm sem junta nenhuma, e o
resultado nao lia como piso: regua sem topo parece infinita, e piso de regua infinita e
papel de parede. Tres coisas fazem a tabua ler como tabua e as tres estao em
`texMadeira`: largura de gente (20 cm, nao 40), junta de topo sorteada por regua, e tom
diferente por peca.

`piso: "frio"` continua sendo a placa de porcelanato de 1,20 m. A regra do acervo hoje:
madeira em tudo que e seco e interno, frio so em banho, area de servico e area externa.

**A JUNTA SEGUE A PAREDE, e nao o norte.** A UV do piso era o X/Z do MUNDO dividido pelo
passo -- e a planta e girada pra assentar no eixo maior do predio, que esta no rumo da
rua (14, 98, 136 graus...). Resultado: a regua cruzava o comodo na diagonal, em toda
unidade, e o mesmo valia pra placa de porcelanato. A UV agora e o ponto projetado de
volta no frame `(ob.ux, ob.uz)` do predio. Regra pra qualquer textura de piso que venha
depois: **UV em coordenada de PLANTA, nunca de mundo.**

## Cor de dentro tambem chega lavada

Mesma fisica da fachada, e mordeu de novo: os tons amostrados do render do anuncio
deixaram a cena de dentro com media 175,3 e faixa 77,1, os DOIS fora do portao
`exposicao do interior` (media 120-175, faixa >= 80). Escurecendo parede e piso ~9% a
cena volta pra 171,2 / 82,8. O valor que se escreve em `cores` e o que CHEGA certo na
tela, nao o que se amostrou -- confira com `pipeline/mede_interior.py <slug>`.
