# Relatório da tarefa 11 do Projetista: a vitrine dos 7 terrenos piloto

Data: 17/11. Nada foi commitado. Não toquei em `fluxo.py`, `cargas.py`, `pacote.py` nem nos testes deles, e não mudei `gerador`, `torre`, `para_vista` nem `editor` (tentei um conserto na `torre.py`, não deu certo e **desfiz**; o `test_torre` passa de novo). Criei `vitrine.py`, `test_vitrine.py` e a pasta `vitrine/` (a amostra que a tela lê).

## Resultado, um terreno por linha

"Andares" conta o térreo quando ele existe (formato do Visual: `pav`). Unidades por andar: o gerador tenta 6 e, se não couber, 5, 4, 3, 2.

| Terreno | Piloto | Sem térreo | Com térreo |
|---|---|---|---|
| 1 | 22421 | 2 andares, 12 unidades | 2 andares (térreo + 1), 6 unidades, 12 vagas |
| 2 | 22426 | **falhou**: o pavimento não cabe dentro da área em que se pode construir | — |
| 3 | 25297 | **falhou**: o mesmo motivo (lote de 327 m²) | — |
| 4 | 30516 | 5 andares, 12 unidades (3 por andar) | 5 andares, 9 unidades, 9 vagas |
| 5 | 37607 | 2 andares, 12 unidades | 2 andares, 6 unidades, 15 vagas |
| 6 | q1382-11984-11988 | **falhou**: o térreo não saiu, o contorno da garagem se cruza | — |
| 7 | remembramento-75352-75354 | 6 andares, 30 unidades | 6 andares, 24 unidades, 15 vagas |

- **Terrenos 2 e 3** não têm desenho de pavimento nem com 2 unidades. Isso é do gerador (não mexi).
- **Terreno 6**: sem térreo a torre sai (21 andares, 93 unidades), mas a garagem do térreo fica com um vértice encostado na própria borda e, ao arredondar a 4 casas, o contorno se cruza. A vitrine precisa das duas versões, então ele ficou como `falhou`, com o lote ainda no mapa. Consertar é um ajuste pequeno na `torre.py` (outra regra de recorte da garagem); **não fiz** porque a tarefa pede para não mudar a torre. Diga se quer.
- **Terreno 4** saiu com 3 unidades por andar, não 6. Isso aparece no índice como `unidades_por_andar`. Se preferir que "não coube com 6" seja `falhou`, é só tirar a tentativa menor (uma linha: `PROGRAMAS`).

## Coordenadas

- `pyproj` **não serve**: ele existe no Python do usuário, mas `python -I` (obrigatório aqui) não enxerga pacotes do usuário. Usei a fórmula inversa da projeção UTM (série de Krüger, GRS80, meridiano −45°, EPSG:31983), em Python puro.
- Erro medido contra `pyproj` 3.7.2 em 2.000 pontos aleatórios na região: **no máximo 1,4 nanômetro** (e 2 nm na ida e volta). O teste fixa um ponto de referência e confere ida e volta com as 7 casas gravadas (≤ 1 cm).
- Saída `[lon, lat]`, 7 casas (cerca de 1 cm). O centro é um ponto garantidamente dentro do lote (`representative_point`, não a média, que cai fora em lote côncavo).

## Gravação

Não usei `esquema.gravar`: o selo dele arredonda tudo a **4 casas decimais**, e isso destruiria as 7 casas do WGS84 (11 m de erro). Usei a mesma ideia (arquivo temporário no mesmo diretório + `os.replace`), dentro do `vitrine.py`. As prévias saem com o `serializar` do próprio `para_vista`. Sem relógio: duas rodadas dão os mesmos bytes (testado, e nenhum temporário sobra).

## Dados pessoais

Os pilotos não trazem nome, CPF, telefone nem endereço de pessoa (conferi os blocos `lote` e `fonte`). Só levo geometria, id do piloto e números. Também **não** levo `observacoes` (texto longo do piloto), `quadra`, `loteamento` nem `planta`.

## Formato

`indice.json`: por terreno `id`, `nome` ("Terreno N"), `lote_ref`, `centro`, `lote_wgs84`, `volumes_wgs84` e `volumes_terreo_wgs84` (cada volume: `id`, `base`, `z0_m`, `altura_m`, `uso`), `resumo`, `status`, `motivo`, mais `unidades_por_andar` (extra). Terreno que falhou: `status: "falhou"`, `motivo` em português simples, `resumo: null`, volumes vazios, e lote e centro preenchidos quando o contorno do piloto é legível.
`terreno-N/resumo.json`: exatamente o formato da TAREFA-VISUAL-22 (números com unidade; `vagas` sem térreo vale 0). Caminhos de `estudo` e `estudo_terreo` relativos ao resumo.

## Testes (`test_vitrine.py`: 7 funções, só assert; todas passam)

1. Índice e uma pasta por piloto que deu certo; 22421 com 12 unidades sem térreo e 6 com.
2. UTM→WGS84→UTM (≤ 1 cm) e ponto de referência.
3. Centro dentro do contorno; tudo em São Carlos (lat −22,2 a −21,8; lon −48,1 a −47,7).
4. Todo número do resumo tem unidade e bate com a prévia (que sai do `metrics_summary.torre`).
5. Piloto feito à mão quebrado (e outro que nem é JSON) fica `falhou` com motivo; o 22421 segue normal.
6. Mesmos bytes em duas rodadas.
7. Rodam de novo: `test_projetista`, `test_gerador`, `test_editor`, `test_torre`, `test_para_vista`.

## Como rodar

```
python -I -X utf8 viabilidade/projetista/vitrine.py <pasta-saida>
python -I -X utf8 viabilidade/projetista/test_vitrine.py
```

A amostra gerada está em `viabilidade/projetista/vitrine/` (504 KB; uma geração leva cerca de 1 minuto).

## Sobra no git

`viabilidade/projetista/` aparece inteira como não rastreada. Novos desta tarefa: `vitrine.py`, `test_vitrine.py`, `RELATORIO-11.md` e a pasta `vitrine/`. Nada alterado nos outros módulos. Nada commitado. Os ` M` em `motor/exemplos/pilotos` e `visual/evidencias` e os arquivos do Terreno não são meus.
