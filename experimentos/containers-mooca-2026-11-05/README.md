# Moradia estudantil em containers (Mooca) — terceiro empreendimento no molde do Laranjeiras

Branch `feat/containers-mooca`. Fonte única: o caderno do TCC de Tamires Ruffino (Escola da Cidade, 2025),
em `plantas_fornecidas/containers-mooca/` (ficha, páginas e o que falta no `LEIA-ME.md`). O caderno só
autoriza o uso para estudo e pesquisa, com a fonte citada: publicar exige o OK da autora.

Ordem, a mesma do Laranjeiras: plantas → implantação → modelo externo → luz do exterior + visualizador →
cadastro dos dormitórios → página → interiores e luz por hora → mapa 2D da Mooca → pacote.

## Plantas (feito)

Os cinco dormitórios do caderno foram traçados pela API real do construtor de plantas do painel.
`interiores/construir.ts` e `interiores/exportar.py` são cópias dos do Laranjeiras; os pontos ficam em
`interiores/<tipo>/planta.json`, em pixels da imagem original do caderno.

```
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts individual
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts individual-pne
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts casal
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts quadruplo
node experimentos/containers-mooca-2026-11-05/interiores/construir.ts casal-bebe
```

Os cinco saem `PASS` em `conferencia.jpg`/`conferencia.json`: todo móvel fica dentro de um cômodo, e
nenhum se sobrepõe a outro.

| Tipo | Container | Área | Aluguel | Cômodos / portas / janelas / móveis |
|---|---|---|---|---|
| individual | 6 m | 14,8 m² | R$ 500 | 2 / 2 / 2 / 8 |
| individual-pne | 6 m | 14,8 m² | R$ 500 | 2 / 2 / 2 / 6 |
| casal | 6 m | 14,8 m² | R$ 800 | 2 / 2 / 2 / 8 |
| quadruplo | 12 m | 29,7 m² | R$ 1.000 | 2 / 2 / 2 / 10 |
| casal-bebe | 12 m | 29,7 m² | R$ 900 | 3 / 3 / 2 / 9 |

Como cada coisa foi aproximada:

- **Escala:** as plantas são 1:50, mas sem cotas. O contorno externo do container foi igualado à área
  do container marítimo: 6,058 × 2,438 m = 14,8 m² e 12,192 × 2,438 m = 29,7 m². São os dois números
  do caderno.
- **Pé-direito:** 2,35 m. O corte dá 2,69 m de piso a piso (container de 2,59 m mais a laje).
- **Catálogo:** o construtor não tem beliche, banheira nem berço. O beliche virou cama de solteiro (a
  ficha diz 4 moradores), a banheira virou box e o berço virou uma cama de solteiro pequena.
- **Quádruplo:** quarto e estudo são um cômodo só, porque a divisória do meio não chega à bancada.
- **Esquadrias:** lidas no desenho quando aparecem (portas do PNE, do casal e dos 12 m, vidros do lado
  comprido). No individual, a porta e a janela são aproximadas.
- **Prédio declarado:** 45 × 40 m e 2 pavimentos, que é a pegada do conjunto. O pipeline exige um prédio,
  e o container não serve como prédio.
- O desenho preto da folha dos dormitórios 6 m (dois vasos, quatro lavatórios, copa e dois armários)
  não é um dos cinco tipos do caderno e ficou de fora.

## Implantação (feito)

`implantacao/leitura_da_planta.py` registra o que foi lido nas duas plantas gerais 1:200, gravando
`implantacao.json`. Depois, `implantacao/montar.py` assenta cada container com a medida real, centrado
onde o caderno o desenha, e grava `implantacao-m.json` (metros + coordenadas geográficas) e
`conferencia.jpg`. O térreo aparece em azul, o 1º pavimento em vermelho e as superfícies em cor clara.

```
python experimentos/containers-mooca-2026-11-05/implantacao/montar.py
```

- **Escala:** 18,9 px/m na `planta-terreo.png`, medida pelos próprios containers. Com ela, o lote dá
  ~2.150 m² (o caderno diz 2.179,7 m²), e o trecho diagonal da Rua João Antônio de Oliveira mede 58 m
  (61 m no OSM).
- **Rumo:** norte para cima (seta da p. 90). A Rua Guaratinguetá corre leste-oeste na planta e no OSM.
- **Âncora:** esquina das ruas Guaratinguetá e João Antônio de Oliveira (−23,5581268, −46,6057803), no
  cruzamento das duas faixas hachuradas da planta. O conjunto fica 37 a 76 m ao norte dela. O bloco
  noroeste fica 7 m a leste da rua, do lado de dentro do lote.
- **1º pavimento:** a imagem dele está deslocada (58, −58) px em relação ao térreo. O deslocamento foi
  achado por correlação das linhas, e a leitura já foi feita com as duas plantas sobrepostas.
- **Conjunto:** 30 containers, sendo 20 dormitórios e 10 áreas comuns, numa pegada de 44 × 39 m.
  - Térreo: 6 individuais, 2 PNE e as áreas comuns (banheiros coletivos, refeitório, cozinha,
    convivência, administração, lavanderia e estudos).
  - 1º pavimento: 3 quádruplos, 1 casal com bebê, 2 casais e 6 individuais. Os 12 m passam por cima
    dos 6 m do térreo, como no caderno.
  - Decks de madeira, passarelas de grade, pergolados, escadas e pátio verde.
- **Tipos aproximados:** o caderno não diz qual dormitório 6 m é de qual tipo. Os 2 PNE ficaram no
  térreo, perto da entrada sul, e os 2 casais no bloco noroeste de cima. Para os 12 m, a proporção 3:1
  entre quádruplos e casal com bebê é a do diagrama da p. 77.
- **Ficaram de fora:** o volume da escada oeste (7,3 m, que não é container) virou passarela.

## Modelo externo (feito)

`modelo/modelar_containers.py` monta o conjunto no Blender com as ferramentas do LIV
(`v1.5/miniaturas/blender_maquete_base` + árvores de `liv-ipanema/modelar_implantacao`) e exporta
`modelo.json` + `containers.glb` (fora do git, regeneráveis).

```
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python experimentos/containers-mooca-2026-11-05/modelo/modelar_containers.py
```

- Cada container tem a medida real (6,058 ou 12,192 × 2,438 × 2,591 m), com chapa corrugada (passo de
  30 cm), quadro e colunas de canto.
- Os dormitórios têm porta e vidro nos dois lados compridos. As áreas comuns têm uma faixa de vidro
  maior. A posição exata das esquadrias de cada container não está no caderno.
- **Cores:** dormitório em chapa branca e área comum em azul "Oceano Pacífico" (Suvinil, aproximado
  pelos renders: a amostra da p. 79 é de madeira).
- Decks de madeira, passarelas de grade com guarda-corpo e pilares, terraço sobre o refeitório coberto,
  pergolados, escadas de 15 degraus até +2,69 e 5 árvores no pátio.
- O conjunto fica centrado na origem da cena; `metadata.origemM` guarda o deslocamento até a esquina.
- `preview-aerea.jpg` e `preview-patio.jpg` são renders de conferência (Cycles, 32 amostras).
- **Falta:** os caminhos de concreto, os bancos, os postes e as mesas do pátio que aparecem nos renders
  do caderno.
