# Croqui → planta → LEVE

Esta frente adiciona uma entrada nova ao pipeline sem substituir o fluxo existente por links/cadastros.

## Contrato do MVP

O croqui **nao vira publicacao diretamente**. O caminho e:

1. imagem do croqui;
2. uma medida conhecida fornecida por quem enviou;
3. deteccao automatica de eixos de parede e sugestao de comodos;
4. `croqui.intermediario.json`;
5. revisao humana: confirmar/nomear comodos e cadastrar/corrigir portas e janelas;
6. `leitura.croqui.json`;
7. `pipeline/extrair_planta.py montar`;
8. `unidade.extraida.json`;
9. somente depois, build LEVE pelo fluxo normal.

O JSON intermediario nasce com `status: revisao_obrigatoria`.

## Primeiro uso

Para um croqui aproximadamente ortogonal:

```powershell
python pipeline/croqui.py analisar .\croqui.png --ref 120,80,520,80 --metros 4.00
```

`--ref` sao dois pontos em pixels, `x0,y0,x1,y1`, sobre uma distancia conhecida no desenho.

O comando grava `croqui.intermediario.json`, contendo:

- escala em px/m derivada exclusivamente da medida fornecida;
- eixos verticais/horizontais de parede detectados;
- retangulos fechados sugeridos como comodos;
- confianca de fechamento de cada candidato;
- listas vazias de portas e janelas;
- incertezas e obrigacao de revisao.

Antes de exportar, edite o intermediario. Pelo menos um comodo precisa ter:

```json
{
  "nome": "Sala",
  "px": [120, 80, 520, 410],
  "confirmado": true
}
```

Opcionalmente informe `area_rotulada` e `piso`. Portas e janelas seguem o contrato que
`extrair_planta.py` ja consome.

Depois:

```powershell
python pipeline/croqui.py exportar .\croqui.intermediario.json --id meu-imovel
python pipeline/extrair_planta.py montar .\leitura.croqui.json
```

## O que o MVP ainda nao promete

- perspectiva fotografica forte;
- paredes curvas;
- croquis predominantemente diagonais;
- reconhecer nomes escritos a mao;
- inferir portas/janelas sem revisao;
- publicar automaticamente.

Esses limites sao intencionais. A primeira versao precisa provar que a geometria revisada
entra no pipeline LEVE com escala controlada antes de automatizar interpretacao mais
ambiciosa.

## Proximo passo de produto

Depois de provar o pipeline em croquis reais, a mesma estrutura intermediaria pode ganhar
uma tela no painel para:

- upload da foto;
- marcar a medida conhecida clicando em dois pontos;
- visualizar paredes/comodos detectados sobre a imagem;
- corrigir nomes, paredes, portas e janelas;
- aprovar a planta;
- solicitar preview LEVE.

A aprovacao visual continua sendo um gate separado da publicacao.
