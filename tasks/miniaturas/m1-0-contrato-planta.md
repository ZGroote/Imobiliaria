# M1-0 — contrato canônico de entrada da planta

Decisão proposta para revisão em 30/09/2026. Versão **1.0.0**.
[Schema](../../schemas/leitura/1.0.0.schema.json) e
[validador normativo](../../pipeline/validar_leitura.py) (estrutura + semântica).

## Fronteira e identidade

`leitura.json` registra declarações humanas sobre uma planta em um pavimento.
Não é cadastro, resultado de CV, unidade pronta para Blender ou autorização de build.
`id` identifica a leitura; `revision` identifica uma edição. IDs de cômodos,
paredes, relações, aberturas e referências são únicos no documento, independentes
de nomes e posições nas listas. Produtores devem preservá-los entre edições e não
reciclar IDs removidos. Este validador de snapshot não compara histórico.

Imóvel, prédio/lote, agência, perfil/família e autorização continuam no domínio
do painel e são rejeitados no JSON geométrico. Um futuro envelope ligará
leitura/revisão ao contexto real. Validar sem contexto não libera build.
Ausência de contexto não é erro geométrico; `CONTEXT_REQUIRED` fica reservado
para a integração posterior e **não é emitido no M1-0**.

## Unidade e geometria

- `unit: "mm"` obrigatório, em todas as medidas. Valores inteiros: `4`, `400`,
  `4000` significam 4 mm, 400 mm, 4 m. Nunca interpretar pela magnitude.
  Produtor converte metros decimais multiplicando exatamente por 1000 e rejeita
  fração de mm, sem arredondamento: 0,875 m → 875; 0,0005 m não representável.
  Parser de texto/localidade e conversão da interface ficam para depois.
- JSON Schema considera `4000` e `4000.0` o mesmo inteiro. Essa equivalência
  numérica é aceita; produtores devem serializar sem parte decimal. M1-0 não
  normaliza bytes, hashes, unidades ou posições.
- Origem local declarada, preservada; x cresce à direita, y para cima na planta.
  `south/north/west/east` são lados locais, não orientação geográfica.
  `xMm/yMm` é canto inferior esquerdo; `widthMm` segue x, `depthMm` segue y.
- Retângulos representam delimitações **nominais pelos eixos das paredes**,
  sem espessura. Distâncias entre eixos não são medidas livres acabadas. Quem só
  tiver medidas livres incompatíveis precisa esclarecer a declaração; não
  se inventa espessura. M1-A deverá explicitar o tratamento construtivo.
- Cada retângulo tem quatro paredes com IDs, sem coordenadas redundantes.
  Paredes de dois cômodos podem compartilhar segmento total ou parcial.
  `ceilingHeightMm` é único para o pavimento. Não se promete área útil real.
- Posições: −1.000.000 a +1.000.000 mm; comprimentos positivos até 1.000.000 mm.
  Até 100 cômodos, 100 referências, 400 relações, 400 aberturas. São limites de
  representação/custo, não aprovação arquitetônica.

## Relações e aberturas

Interiores dos retângulos não se sobrepõem. O conjunto precisa ser conexo por
segmentos de comprimento positivo; contato só no vértice não conecta.
`relations` exige exatamente uma relação `adjacent` por par de paredes opostas
com segmento comum positivo; ordem de `wallA/wallB` não importa.
Relação faltante, repetida ou incompatível bloqueia. Não há tolerância ou snap.
Conexão geométrica não comprova circulação por portas nem acesso ao exterior.

Abertura: `wallId`, `offsetMm`, `widthMm`, `heightMm`, `sillMm`,
`kind: door|window`. Offset parte da menor coordenada da parede, crescendo em x
nos lados north/south e em y nos east/west. Peitoril é altura sobre o piso;
porta exige zero; peitoril + altura deve caber no pé-direito.

A abertura cabe integralmente na parede. Em trecho compartilhado, exige
`pairedWallId` e cabe no segmento comum: uma única abertura vista pelos dois
cômodos. Em trecho externo, omitir par. Não atravessar junções de três cômodos
nem misturar trecho externo/interno. Duas aberturas não ocupam a mesma região
física (inclusive quando declaradas pelo lado oposto). Bordas podem encostar;
regiões verticais disjuntas podem coexistir.

## Procedência

Documento, cômodos, relações e aberturas exigem `provenance` com
`kind: "declared"` e `referenceIds`. Lista vazia significa declaração sem
anexo; referências preenchidas devem existir. A procedência do objeto cobre
todos os seus campos geométricos, sem mistura de derivados.
Referências: ID, tipo measurement/sketch/photo/document, descrição e locator
opcional opaco. O validador não abre arquivos/URLs nem extrai medidas.

CV e `kind: "derived"` são recusados nesta entrada. O futuro normalizador
preservará a leitura e registrará derivações em saída separada, vinculando
leitura/revisão e regra aplicada. O schema dessa saída pertence a M1-A.
Declarar procedência não comprova autoria, licença ou verdade da medida.

## Suporte e exclusões

Suporta retângulos alinhados aos eixos, adjacência parcial/total, união conexa
inclusive em L, translação negativa, portas e janelas retangulares.
Não suporta cômodo individual em L/poligonal, diagonal, curva, rotação, múltiplos
pavimentos, desníveis, pés-direitos variáveis, espessura/material, giro de porta
ou extração de imagem. Não repartir ambiente em cômodos fictícios para contornar
o gate. Outro discriminador `geometry` recebe `UNSUPPORTED_GEOMETRY`; campos
fora do schema também são recusados. Não há UI, normalizador, emissão de
`unidade.json`, integração produtiva ou remoção de CV.

## Gate automático e erros

Instalar `python -m pip install -r requirements.txt`; isoladamente, basta Python
e `jsonschema>=4.26,<5`. Não importa Blender, OpenCV, NumPy, fábrica ou navegador.

```sh
python -m pipeline.validar_leitura tests/fixtures/leitura/v1/apartamento-simples.json
python -m pipeline.validar_leitura tests/fixtures/leitura/v1/sobreposicao.json
python -m unittest discover -s tests -p test_leitura.py
```

CLI somente lê e imprime JSON: `{"valid": true, "errors": []}`. Saída 0 se válido,
2 se bloqueado/ilegível (erro de uso também retorna 2 via argparse).
Erros: `code` estável, `path` JSON Pointer, `message` humana em português.
Consumir código, nunca texto. Ordem por path/código, sem duplicatas nem mutação.
Estrutura inválida ou IDs ambíguos interrompem semântica; sobreposição interrompe
topologia/aberturas. Corrigir e revalidar; diagnóstico não é exaustivo.

| Código | Bloqueio |
|---|---|
| INVALID_JSON / INPUT_UNREADABLE | JSON inválido, chaves repetidas, não finitos / leitura UTF-8 |
| INVALID_STRUCTURE | Campos, tipos ou estrutura incompatíveis |
| UNSUPPORTED_VERSION / INVALID_UNIT | Versão ou unidade incompatível/ausente |
| UNSUPPORTED_GEOMETRY | Discriminador geométrico incompatível/ausente |
| INVALID_DIMENSION | Medida fora do domínio inteiro |
| INVALID_PROVENANCE / UNKNOWN_REFERENCE | Procedência inválida / referência inexistente |
| DUPLICATE_ID | Identidade ambígua |
| ROOM_OVERLAP / DISCONNECTED_ROOM | Sobreposição interior / componente desconectado |
| INCONSISTENT_RELATION | Adjacência incoerente, faltante ou repetida |
| INVALID_OPENING / OPENING_OVERLAP | Abertura inválida / ocupação duplicada da parede |

Schema fechado Draft 2020-12 com referências internas. Schema sozinho valida
estrutura; o gate é **schema + semântica** de `validar_leitura`.
Somente versão 1.0.0 aceita. Mudança incompatível exige nova versão principal;
campos/semântica novos exigem schema/validador versionados e revisão explícita,
nunca aceitação silenciosa. `revision` é edição, não versão de contrato.
Referências: [JSON Schema](https://json-schema.org/draft/2020-12/json-schema-validation),
[API python-jsonschema](https://python-jsonschema.readthedocs.io/en/stable/validate/).

## Confronto com os contratos atuais

| Contrato | Decisão |
|---|---|
| `pipeline/extrair_planta.py` | Usa pixels, áreas rotuladas, calibração, snap/offset. Não reutilizar sua interpretação para esta entrada declarada; nenhum import/chamada adicionado. |
| `plantas_fornecidas/_exemplo/unidade.json` | Mistura cadastro/ficha e polígonos/aberturas em metros. Conceitos reaproveitáveis, mas IDs, eixos, espessuras e procedência exigem mapeamento explícito em M1-A. |
| `pipeline/fonte_leve.py` | Exige lote/prédio e perfil de imóvel. Não impor esse contexto para validar a planta. |
| `painel/src/lib/types.ts` | Property/Request/BuildJob já contêm vínculos comerciais. Preservar esse domínio, sem inventar cadastro geométrico. |

Onde parou: contrato, validador e fixtures para revisão, sem consumidor produtivo.
Próximo passo somente após autorização: M1-A e seu contrato de saída/mapeamento.
UI, integração, E2E, M1.1 e remoção física de CV continuam bloqueados.
