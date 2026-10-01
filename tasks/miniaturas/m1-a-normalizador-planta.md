# M1-A — planta derivada nominal v1.0.0

Decisão para revisão em 30/09/2026. Entrada:
[leitura M1-0 aprovada](m1-0-contrato-planta.md).
Saída: [schema planta-derivada v1.0.0](../../schemas/planta-derivada/1.0.0.schema.json).
Implementação: [normalizar_planta.py](../../pipeline/normalizar_planta.py).

## Fronteira

A primeira etapa de `normalizar(leitura)` chama `validar_leitura.validar`.
Qualquer bloqueio M1-0 gera `LeituraInvalida.errors`, preservando códigos/caminhos/
mensagens; não há snap, reparo, preenchimento de dimensão ou coerção de entrada
inválida. O retorno é um objeto novo. Nenhum arquivo de entrada é escrito.

A saída é **planta derivada**, não o `unidade.json` comercial atual.
`propertyId`, agência, lote, prédio, ficha, preço e perfil LEVE não pertencem
ao contrato. `fonte_leve.py` e sua exigência de `lote.predio` ficam inalterados.
Nenhum consumidor produtivo passa a ler esse contrato neste PR.

## Eixos nominais e transformação

`measurementBasis: "wall-centerlines"`, `construction: "not-applied"`.
A leitura M1-0 já significa medida entre eixos; o normalizador preserva isso
exatamente, inclusive origem negativa. Não subtrai meia parede nem escolhe
espessura. Medida livre acabada não é um modo aceito: acrescentar essa semântica
à leitura é recusado pelo schema fechado. Uma declaração humana incorretamente
rotulada como nominal não pode ser detectada pelo algoritmo; precisa ser
corrigida na origem, nunca reinterpretada silenciosamente.

| Entrada M1-0 | Saída derivada / regra |
|---|---|
| x, y, width, depth em mm | `poly` em metros: inferior esquerdo → inferior direito → superior direito → superior esquerdo; CCW, quatro pontos, sem repetir o primeiro |
| `ceilingHeightMm` | `planta.pe_direito` em metros |
| `room.name` | `comodo.nome` sem classificar finalidade, piso ou material |
| `walls`, IDs de cômodos | Preservados; não há duplicação de coordenadas de paredes |
| `wallId + offsetMm + widthMm` | Centro `p` e `largura`; offset contado da menor coordenada como em M1-0 |
| `sillMm`, `heightMm` | `y0 = sill/1000`; `y1 = (sill+height)/1000` |
| kind door/window | Lista `planta.portas` / `planta.janelas` |
| Abertura compartilhada | Uma entrada com `id`, `wallId` e `pairedWallId`; não duplicar pelo outro cômodo |
| Relações, referências e procedência | Preservadas, com procedência derivada separada da declaração original |

Somar em mm inteiros antes de converter. O centro usa inteiros dobrados e divisão
por 2000: vão de largura ímpar preserva meio milímetro (quatro casas em metros).
Não aplicar round, grade de 5 cm, espessura, recentramento ou inversão de eixo.
O segundo componente da planta local torna-se o z horizontal do consumidor; y0/y1
são verticais. Não gerar área útil, cadastro, material ou geometria construtiva.

Números de saída são JSON numéricos, não strings. O Python usa float binário para
entregar números ao consumidor JS; a serialização decimal curta conserva os
valores dessas conversões limitadas pelo domínio M1-0. Não se promete aritmética
binária exata no renderer.

## Vínculo, procedência e bytes

`source` contém `id`, `revision`, `schemaVersion` da leitura e SHA-256
do conteúdo serializado conforme abaixo. Mesmo ID/revisão com conteúdo diferente
produz outro hash; hash não é assinatura ou prova de autoria.

`normalizer` identifica `nominal-floor-plan` versão `1.0.0` e registra regras:
`mm-to-m@1`, `rectangle-to-ccw-polygon@1`,
`wall-offset-to-opening-center@1`, `sill-height-to-y0-y1@1`,
`preserve-nominal-axes@1`. Não há data de execução, caminho da máquina ou aleatoriedade.

Documento, cômodos, relações e aberturas têm
`provenance: {kind: "derived", declared: <provenance M1-0>}`.
O vínculo de cada entidade é seu ID preservado dentro de `source`.
Referências continuam opacas; não se abrem arquivos/URLs. O resultado não compartilha
listas/dicionários mutáveis com a entrada.

`serializar` define bytes UTF-8, chaves ordenadas, sem espaços, um LF final,
Unicode sem escapes ASCII obrigatórios, não finitos proibidos. Inteiros
numericamente equivalentes (4000 e 4000.0) têm a mesma representação.
Ordem das listas é preservada e participa do hash; não se promete equivalência
de documentos com entidades reordenadas. Não é RFC 8785. Essa política pertence
à versão do normalizador; mudanças exigem nova versão e revisão de compatibilidade.
Somente contratos 1.0.0 são aceitos nesta implementação.

**Atualizado no M1.1-C1 (01/10/2026):** leitura 1.1.0 gera derivada 1.1.0
(`nominal-floor-plan@1.1.0`, regra a mais `merge-parts-to-polygon@1`). A leitura
1.0.0 continua gerando a derivada 1.0.0 byte a byte igual. Ver
[cômodo composto](m1-1c-comodo-composto.md).

O schema de saída é fechado e valida estrutura. Relação matemática com a leitura
é garantida pela transformação/testes; o schema isolado não autentica o hash nem
recalcula geometria. O normalizador valida o próprio resultado antes de retorná-lo.

## Prova com o consumidor existente

`plantas_fornecidas/_exemplo/unidade.json` mistura ficha e geometria.
A nova fixture `tests/fixtures/leitura/v1/exemplo-geometrico.json` declara seus
oito retângulos e onze aberturas sintéticos, mais alturas explícitas para o teste.
O teste compara polígonos, nomes, pontos centrais e larguras ao exemplo versionado.

A prova Node chama o módulo real
`v1.5/renderizador-v16-moveis/interior/floor-plan.js:paredesDaGrade`.
Esse módulo é usado por `plantaDaUnidade` e pela maquete em
`v1.5/miniaturas/pagina_maquete.py`. Compara a grade produzida pelo exemplo e
pela saída derivada, conferindo as onze aberturas e seus IDs. Outro caso cobre
L, porta compartilhada e janela externa. Sem WebGL, navegador, Blender ou LEVE real.

**Limite da prova:** o consumidor rasteriza em grade de 5 cm, procura a parede
mais próxima e filtra segmentos/vãos pequenos. O M1-0 aceita medidas menores;
o normalizador as preserva, mas isso não prova fidelidade milimétrica ou suporte
de todas elas no renderer. A integração deverá tratar essa compatibilidade
explicitamente. As espessuras, defaults de acabamento e transformações de mundo
do consumidor não são incorporados ao contrato derivado. Não se executa
`plantaDaUnidade` com cadastro fabricado para simular integração concluída.

## Execução e continuidade

```sh
python -m pipeline.normalizar_planta tests/fixtures/leitura/v1/apartamento-simples.json
python -m unittest discover -s tests -p test_normalizar_planta.py
node --test tests/test_normalizar_planta_consumer.mjs
```

CLI lê um arquivo e emite somente a saída derivada em stdout (0). Se leitura/
JSON/arquivo forem inválidos, emite `{valid:false, errors:[...]}` (2), sem planta
parcial. Parsing mantém a política M1-0 de recusar chaves duplicadas e NaN.
Instalação usa requirements existente; não adiciona dependências.

Onde parou: contrato derivado e normalizador isolados, prontos para revisão.
M1-B/UI, salvamento no painel, contexto comercial, integração/E2E, Blender,
LEVE real e M2–M5 continuam bloqueados. Nenhum merge ou deploy autorizado.
