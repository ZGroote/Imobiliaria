# Relatório da tarefa 8 do Projetista: térreo e vagas na prévia

Data: 17/11. Nada foi commitado. Não toquei em `sintese.py`, `test_sintese.py`, `gerador.py`, `visual/`, `motor/` nem em nenhum outro arquivo fora da lista. Mexi só em `para_vista.py` e `test_para_vista.py`.

## O que foi feito

- `revisao_para_estudo(revisao, estudo, pavimentos=None, terreo=False, premissas_terreo=None)` e `--terreo` na linha de comando. O padrão continua **sem** térreo.
- `PADROES_TERREO` (premissas, não norma): pé-direito do térreo 3,0 m; hall = faixa de 3,0 m ao redor do núcleo; 25 m² de garagem bruta por vaga. Dá para trocar por `premissas_terreo={...}`.
- Térreo em z = 0, três tipos de volume:
  - `nucleo`: as peças do núcleo dos andares de cima, fundidas num polígono só (fecha o vão de 0,3 mm entre elas), na mesma projeção;
  - `hall`: a faixa de 3 m ao redor do núcleo, cortada pela laje;
  - `garagem` (lilás no visualizador): o resto da laje.
- Os andares tipo começam em cima do térreo (z = 3,0 m).
- Vagas: `metricas.vagas = floor(área da garagem / 25)`, inteiro. Também vai `metricas.area_garagem_m2` (o visualizador lê esse campo). O alerta diz: "vagas por área bruta (premissa de 25 m² por vaga com circulação), não desenhadas nem conferidas pela lei". Não é desenho de vagas.
- O térreo também passa pela checagem do envelope da faixa dele. Se não couber, dá erro claro (`o térreo não cabe: ...`).

## Números no 22421

| | andares tipo | pavimentos no total | unidades | vagas |
|---|---|---|---|---|
| sem térreo | 2 | 2 | 12 | sem (nulo) |
| com térreo | **1** | 2 | 6 | **12** |

Com térreo, o 2º andar tipo (z 6 a 9 m) sai do envelope dessa altura em 15,55 m²: o mesmo limite de antes. O térreo ocupa a faixa de 0 a 3 m e leva um andar tipo. Laje do térreo 403,1 m²: núcleo 22,2 + hall 75,1 + garagem 305,8 m² (305,78 / 25 = 12,2 → 12 vagas). 17 volumes.

Conferido também no q1382 (só para ver se quebra): sem térreo 7 andares e 42 unidades; com térreo 6 tipo, 36 unidades e 16 vagas.

Print: `previa-22421-terreo.png` (não commitar). Garagem lilás embaixo, andar tipo em cima, tudo dentro do lote e da caixa máxima, nada flutuando.

## Detalhes que mudam o desenho

- Hall em volta do núcleo e garagem em volta do bloco núcleo+hall são **anéis** (têm buraco), e o visualizador não aceita buraco. Cada anel é cortado em duas peças por uma reta que atravessa o buraco, perpendicular ao lado longo da laje. Por isso aparecem `hall_terreo_01/02` e `garagem_terreo_01/02`: são a mesma área, só partida. Só um buraco por polígono é tratado; mais que isso dá erro.
- `metricas.pavimentos` conta o térreo (2 = térreo + 1 tipo). `pavimentos=N` na chamada conta só os andares tipo. `unidades_estimadas` e `area_privativa_m2` são só dos andares tipo (o térreo não tem unidade).
- A laje do térreo é o contorno inteiro da revisão (`outline_m`), um pouco maior (resíduo de ~0,09 m²) que a soma das peças dos andares de cima.

## Testes (`test_para_vista.py`: 11 funções, todas passam)

1. Térreo cobre a laje: na geometria exata (antes de arredondar) a soma, a sobreposição e a diferença com a laje ficam abaixo de 1 mm². Na saída o núcleo do térreo cobre o núcleo dos andares e as peças não se sobrepõem (0 mm²).
2. Vagas inteiras e iguais a `floor(área da garagem / premissa)`, recalculada a partir dos volumes; premissa trocada (50 m²) muda o número e o alerta.
3. Sem `terreo`, a saída é idêntica à da tarefa 6 em bytes: `sha256 7afa7c5dde65...` do 22421, gravado no teste.
4. O `validar` do próprio `index.html` aceita a saída com térreo (rodou no node, com o teste de que um volume sem altura é recusado).
5. Contagem: 22421 dá 2 andares sem térreo e 1 com; `pavimentos=2` com térreo dá erro; térreo de 20 m dá erro.
6. `test_projetista` (18) e `test_gerador` (8) continuam passando.

## Pontos de atenção

- **Tolerância de 1 mm² só na geometria exata.** Na saída em UTM (4 casas, quadro de coordenadas girado e não ortonormal) a borda da laje erra cerca de 1.000 mm² (a diferença entre a união e a laje) por arredondamento. Por isso o teste da saída usa 0,01 m² para a cobertura; a sobreposição entre peças continua 0.
- **O hash da tarefa 6 depende da revisão.** O `fonte.content_sha256` entra na saída; se o gerador mudar a revisão do 22421, o hash gravado no teste fica velho e o teste falha. Confira que só a revisão mudou e atualize `SHA_TAREFA_6`.
- Hall e garagem são premissas geométricas: não há rampa, pilar, portaria, acesso de pedestre nem desenho de vaga. Os alertas dizem isso.

## Como rodar

```
python -I -X utf8 viabilidade/projetista/para_vista.py <revisao.json> <estudo.json> --terreo --saida <arquivo>
python -I -X utf8 viabilidade/projetista/test_para_vista.py
```

## Sobra no git

`viabilidade/projetista/` aparece como não rastreada neste galho. Novos desta tarefa: `RELATORIO-8.md` e `previa-22421-terreo.png`; alterados: `para_vista.py` e `test_para_vista.py`. Nada commitado. Os arquivos do Terreno e os `viabilidade/visual/evidencias/*.png` modificados não são meus.
