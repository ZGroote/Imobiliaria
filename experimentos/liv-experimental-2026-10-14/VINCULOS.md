# Vínculo entre posição, planta 2D e interior — 12/10/2026

Associações também podem ser cadastradas pelo painel, junto com a disponibilidade, conforme [ESTOQUE.md](ESTOQUE.md). Com `estoque=ID_DO_IMOVEL`, o cadastro ao vivo substitui o arquivo local e aceita somente associações explicitamente confirmadas de Canto/Meio na orientação original.

O catálogo completo recebe associações explícitas por ID técnico em `vinculos.json`. O arquivo local atual foi fornecido com fonte declarada “Implantação e Book Oficial do LIV Ipanema”, data 12/10/2026: 170 posições, 68 Canto e 102 Meio, todas na orientação original. O validador confere IDs, origem e revisões; não verifica por si só a correspondência arquitetônica declarada pela fonte. Não atribuir plantas por cabeceira, lado, número comercial ou semelhança visual.

Selecionar o apartamento mostra seu contexto e libera **Planta 2D**, **Planta 3D** e **Tour 3D** usando a tipologia do vínculo. **Informações do apartamento** abre a ficha com disponibilidade, preço, vaga, área e demais dados cadastrados, incluindo fonte/data/orientação. A troca manual Canto/Meio fica fora desse fluxo. Ao voltar à maquete, a seleção é mantida; selecionar outro apartamento escolhe a planta de seu cadastro. Os interiores continuam ilustrativos, com medidas inferidas.

Sem seleção, a página apresenta a maquete e a orientação para escolher um apartamento. Enquanto os vínculos carregam, ou se a unidade não possui associação utilizável, o contexto informa essa condição e conserva o acesso à ficha; não abre uma planta presumida. O produto inicia no edifício completo com a geometria de entrada. `unidades=piloto` continua disponível explicitamente para o experimento de dez posições, sem associação de plantas nesse fluxo.

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

Os testes de vínculos verificam ausência, associação exata sem alterar geometria/campos fonte e rejeições de origem/revisão/duplicata/espelhamento/data. `test_viewer_flow.mjs` cobre o fluxo por apartamento, dados opcionais assíncronos e recuperação. As evidências anteriores de `qa_vinculos.py` usaram fixtures sintéticas e registram a interface com referências gerais e troca manual; não comprovam o fluxo atual por seleção.

```powershell
& 'C:/Program Files/nodejs/node.exe' --test experimentos/liv-ipanema-webgpu-2026-10-09/test_vinculos.mjs
& 'C:/Python314/python.exe' experimentos/liv-ipanema-webgpu-2026-10-09/qa_vinculos.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/vinculos-novo
```

Os registros históricos de T08/T09/T10/T11 eram parciais pela associação pendente e pela qualificação dos aparelhos. O cadastro atual permite navegar pelas associações fornecidas; isso não substitui a conferência da fonte por final nem a qualificação física. Uma fonte pública que mostre duas plantas e dez finais não confirma automaticamente seus vínculos.

Resultado em [evidencias/vinculos-conferidos/runtime.json](evidencias/vinculos-conferidos/runtime.json): três perfis aprovados, WebGPU/WebGL2 desktop e toque emulado. A primeira execução localizou um aviso dentro do espelho fechado; os avisos foram movidos para uma região visível e o conjunto completo foi repetido.
