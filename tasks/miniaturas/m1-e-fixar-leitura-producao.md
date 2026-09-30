# M1-E — fixação da leitura de entrada para produção

Não é "aprovação da planta". No pedido, `approved` continua significando uma única
coisa: o gerente aprovou o **build 3D** (`approvedBuild` + `approvedManifestSha256`).
M1-E cria o elo anterior a isso:

```
snapshot salvo → leitura fixada como entrada do pedido → produção → preview 3D → build aprovado → publicação
```

## Contrato

`requests/{id}.productionInput`, um objeto só:

| campo | origem |
|---|---|
| `readingId` | id do documento em `propertyReadings` |
| `readingVersion`, `readingRevision`, `schemaVersion`, `contentSha256` | cópia exata do snapshot; o hash é o persistido pela API M1-D, não recalculado no navegador |
| `fixedBy`, `fixedAt` | `request.auth.uid` e `request.time` |

Tipo: `ProductionInput` em `painel/src/lib/types.ts`. Escrita: `fixarEntrada`
em `painel/src/lib/leituras.ts`.

## Regras (`firebase/firestore.rules`)

Trocar `productionInput` só passa se, no mesmo write:

- quem escreve é `platform_admin`/`operator` ativo;
- o pedido está em `accepted` ou `production`, e o write não muda `status` nem `propertyId`;
- o objeto tem exatamente as 7 chaves; `fixedBy`/`fixedAt` são o autor e a hora do write;
- o snapshot existe, é do `propertyId` do pedido e da `agencyId` do pedido, e o imóvel
  **hoje** ainda é dessa agência;
- `readingVersion`, `readingRevision`, `schemaVersion` e `contentSha256` são iguais aos
  do snapshot (hash em hexa minúsculo de 64). "Leitura X com o hash Y" é recusado;
- há um `AuditLog` `production_input:set` no mesmo batch (mesmo autor, mesma hora, mesmo
  pedido) cujo `before` repete o ponteiro anterior (`readingId`, `contentSha256`, ou null)
  e cujo `after` repete o novo (`readingId`, `readingVersion`, `contentSha256`).

Não há remoção do ponteiro e, depois de fixado, `propertyId` não muda mais. Gerente e
corretor não alteram o ponteiro (os caminhos deles usam `changesOnly` sem esse campo).
Log com `visibility: internal`: é ato da equipe.

### Gate de "Iniciar produção"

`accepted → production` exige `productionInput` que ainda confere com o snapshot
(inclusive o vínculo atual imóvel↔agência). Pedido sem imóvel não inicia.

**Exceção deliberada, fluxo legado:** se o imóvel do pedido tem `pipelineUnitId`, ele
ainda é produzido por `plantas_fornecidas/<id>/` e pelo BuildJob de hoje, que não lê
snapshot. Esses pedidos seguem iniciando como antes. A exceção sai quando BuildJob passar
a partir de `productionInput` (integração produtiva/M2). A equipe pode editar
`pipelineUnitId` de um imóvel; isso é o fluxo legado por definição, não um desvio desta regra.

Os retornos para produção (`internal_review`/`agency_review`/`approved` → `production`)
não mudaram.

## Painel

Detalhe interno do pedido (`/admin/requests/view`), cartão **Entrada da planta** quando há
imóvel: versão atual, revisão, id, SHA-256 completo, autor/data do snapshot e quem fixou.
"Escolher (outra) versão" lista só as versões daquele imóvel (50 por página) com número,
revisão, autor, data, hash abreviado e o selo da fixada; antes de confirmar, o aviso:
"Esta versão será a entrada do próximo processo de produção. Alterações posteriores na
planta não mudam esta seleção automaticamente." Fora de Aceita/Em produção o cartão é só
leitura. "Iniciar produção" fica desabilitado com o motivo enquanto faltar a entrada
(`exigeEntrada`). O histórico mostra "Entrada da planta: v1 → v3".

Salvar uma versão nova na planta não toca em pedido nenhum.

## Fora do escopo (continua proibido)

Sem deploy da API M1-D, BuildJob, normalizador de produção, `unidade.json`, Blender,
LEVE/PREMIUM, Hosting, nem alteração de `approvedBuild`/`approvedManifestSha256`.
`tools/buildjob.mjs` não foi tocado: ainda usa `pipelineUnitId`.

Evidências: [checkpoint](../checkpoints/m1-e-2026-09-30.md).
