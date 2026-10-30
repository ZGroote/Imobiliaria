# Parque das Laranjeiras — segundo prédio no molde do LIV

Branch `feat/predio-novo`. Fonte única: o book da ADN (`plantas_fornecidas/parque-das-laranjeiras/`).

## Plantas (feito)

As quatro plantas do book foram traçadas pela API real do construtor de plantas do painel, pelo mesmo
caminho do Meio do LIV (`liv-experimental-2026-10-14/interiores/meio/construir-meio.ts`). A diferença é
que os pontos ficam em `interiores/<tipologia>/planta.json`, e um script só serve para todas:

```
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts canto
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts meio
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts terreo-canto
node experimentos/laranjeiras-2026-10-30/interiores/construir.ts terreo-meio
```

Cada um grava `leitura.json`, `projeto-planta.json`, `moveis.json`, `contexto.json`, `referencia.json`,
`unidade.json` (o arquivo que o interior do LIV lê) e `conferencia.jpg` / `conferencia.json`: contornos,
vãos e móveis desenhados por cima da imagem do book. As quatro saem `PASS`, ou seja, todo móvel fica
dentro de um cômodo e nenhum se sobrepõe a outro, fora as cadeiras sob a mesa.

| Planta | Área do book | Escala da imagem | Cômodos / portas / janelas / móveis |
|---|---|---|---|
| canto | 39,12 m² | 184,2 px/m | 5 / 5 / 4 / 23 |
| meio | até 40,79 m² | 159,1 px/m | 5 / 5 / 4 / 22 |
| terreo-canto | 60,11 m² | herda o canto | igual ao canto + jardim em L de 22,4 m² |
| terreo-meio | até 54,17 m² | herda o meio | igual ao meio + jardim de 14,5 m² |

Como cada coisa foi aproximada:

- **Escala:** a planta é humanizada e não tem cota. A área das faces internas do contorno foi igualada
  à do book. Vaso e cooktop conferem a escala (184–188 px/m no canto, 157–172 no meio).
- **Térreo:** é o apartamento do tipo. As paredes pretas das duas imagens coincidem
  (`terreo-*/comparacao-tipo.png`). O jardim fica em `referencia.json` como polígono em metros, para a
  maquete externa, e não vira cômodo, porque cômodo ganha parede de 2,60 m.
- **Portas e janelas:** lidas no desenho (folha fechada com maçaneta, rasgo na parede preta). A largura
  sai da imagem; a altura segue o padrão do LIV.
- **Móveis:** do catálogo do construtor, no lugar e na medida do desenho. Os guarda-roupas seguem o book
  ("até 1,50 m"). A churrasqueira e a bancada comprida do meio ficaram de fora, porque o catálogo não tem.

## Implantação e posição no mapa (feito)

```
python experimentos/laranjeiras-2026-10-30/implantacao/montar.py
```

`implantacao/implantacao.json` guarda o que foi lido na implantação do book, em pixels: lote em L,
3 torres com os finais 01–08, 6 vias, 11 áreas de vaga e os 14 itens de lazer, mais apoio e reservatório.
O script grava `implantacao-m.json` em metros e em latitude/longitude, e `conferencia.jpg` com tudo
desenhado por cima do book.

O terreno fica do lado de cá da avenida, atrás do LIV Ipanema: é o campo cercado na Rua José Quatrochi,
entre a obra de terra vermelha (na esquina da rotatória) e as casas. Quina norte em
−21,988808, −47,923926. A foto aérea do book confirma a vizinhança (obra ao lado, avenida à esquerda),
e o CNEFE confirma a rua.

- **Rumo:** a rosa dos ventos do book põe o alto da imagem para o SSE. Ajustei 5° para a frente correr
  junto com a rua (rumo 152°).
- **Escala: 13,2 px/m.** É a que faz o L caber na quadra 608 do cadastro, com a frente até a rua do
  sudoeste e o fundo até os quintais das casas. Duas medidas independentes conferem: vaga de 4,5 m de
  comprimento, e 285 vagas contadas nas fileiras desenhadas contra 290 no book.
- **O que não fecha:** nessa escala o lote dá 10.672 m², contra 11.894 m² no book (12,5 px/m). A ponta do
  braço do estacionamento passa ~8 m sobre um galpão branco que aparece na foto de satélite.
- **Torres:** montadas pelo tamanho real das plantas, centradas onde o book as desenha. A ala tem
  canto 6,35 m + meio 8,2 m. O fundo são duas fileiras de 6,5 m mais um corredor de 1,3 m. Com o núcleo
  de 4 m, a torre fica com 33,1 × 14,3 m, cerca de 10% maior que o desenho do book. A Torre 02 é girada 90°.
  Os cantos são os finais 01, 02, 07 e 08; os meios, 03 a 06.

A sobreposição no satélite (Esri World Imagery) serviu só para medir e não está no git.

## Próximos passos

Torres por fora com os 312 apartamentos; interiores no visualizador do LIV; luz gravada por hora;
celular e publicação em endereço de teste.
