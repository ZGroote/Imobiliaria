# Vínculo entre posição, planta 2D e interior — 11/10/2026

Associações também podem ser cadastradas pelo painel, junto com a disponibilidade, conforme [ESTOQUE.md](ESTOQUE.md). Com `estoque=ID_DO_IMOVEL`, o cadastro ao vivo substitui o arquivo local e aceita somente associações explicitamente confirmadas de Canto/Meio na orientação original.

O catálogo completo pode receber associações explícitas por ID técnico em `vinculos.json`. O arquivo entregue está **ausente/vazio**: nenhum final foi atribuído por ser uma cabeceira, lado do lazer, número comercial ou semelhança visual. Canto e Meio permanecem referências gerais.

Com uma associação fornecida e validada, selecionar o final escolhe sua tipologia, a ficha mostra fonte/data/orientação e **Ver planta associada** abre a imagem correspondente. Planta 3D/Tour reutilizam a mesma tipologia conferida. Se a pessoa escolher manualmente a outra referência, a ficha distingue essa visualização da associação fornecida. Os interiores continuam ilustrativos, com medidas inferidas; o vínculo não transforma a reconstrução em projeto executivo.

## Formato a preencher com uma fonte confirmada

O arquivo usa `schema: "liv-unit-relations-v1"`, `status: "fornecido"`, `bookSHA256` igual ao cadastro, `source: {label, asOf}` e `units`. Cada linha exige:

| Campo | Conteúdo |
|---|---|
| `id` | ID técnico exato existente no catálogo completo; nunca inferir `101 → primeiro final`. |
| `typology` | `canto` ou `meio`, confirmado pela fonte. |
| `orientation` | `original`, para as variantes já preparadas. |
| `interiorUnitSHA256` | `unitSHA256` da tipologia em `interiores/catalogo.json`. |
| `interiorSourceSHA256` | `sourceSHA256` da mesma tipologia. |
| `planSHA256` | Hash da imagem publicada correspondente em `PLAN_HASH`, no módulo `vinculos.js`. |

Datas inválidas, IDs desconhecidos/duplicados, origem ou revisão diferente e campos extras de linha são rejeitados. O conjunto é validado antes de substituir qualquer vínculo ativo. Em falha, os últimos vínculos validados são mantidos, com aviso visível mesmo quando o espelho está fechado. `__livViewer.reloadRelations()` permite repetir a leitura; a primeira leitura ocorre após a cena utilizável, somente no catálogo completo.

**Espelhamentos ainda precisam de variantes próprias qualificadas.** Esta entrega rejeita `orientation: "espelhada"`: virar só a imagem 2D deixaria geometria, navegação, vãos e luz do Tour inconsistentes. Não usar `original` como substituto quando a orientação não foi confirmada. Gardens, limites cotados e áreas por final permanecem independentes do vínculo.

## Evidência

Três testes Node verificam ausência, associação exata sem alterar geometria/campos fonte e rejeições de origem/revisão/duplicata/espelhamento/data. O QA usa **fixtures sintéticas em interceptação privada**, nunca escreve associações reais. Confere Canto e Meio em 2D/3D/Tour, ficha, seleção, retorno, referência manual distinta, rejeições com retenção do último conjunto e remoção dos vínculos. O arquivo real permanece vazio.

```powershell
& 'C:/Program Files/nodejs/node.exe' --test experimentos/liv-ipanema-webgpu-2026-10-09/test_vinculos.mjs
& 'C:/Python314/python.exe' experimentos/liv-ipanema-webgpu-2026-10-09/qa_vinculos.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/vinculos-novo
```

T08/T09/T10/T11 continuam parciais até receber a associação autorizada e qualificar os aparelhos. O mecanismo de integração está preparado; fonte pública que mostre duas plantas e dez finais não confirma automaticamente seus vínculos.

Resultado em [evidencias/vinculos-conferidos/runtime.json](evidencias/vinculos-conferidos/runtime.json): três perfis aprovados, WebGPU/WebGL2 desktop e toque emulado. A primeira execução localizou um aviso dentro do espelho fechado; os avisos foram movidos para uma região visível e o conjunto completo foi repetido.
