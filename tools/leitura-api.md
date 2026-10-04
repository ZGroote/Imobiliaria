# Leituras e prévia local

`tools/leitura-api.mjs` é a fronteira Admin de gravação. Requer Node.js 24 ou superior: o runtime executa também os módulos TypeScript puros do modelo do editor. O navegador envia JSON; Python valida antes de qualquer snapshot. O servidor escuta em `127.0.0.1:5056` e exige `GCLOUD_PROJECT` e `READINGS_ALLOWED_ORIGIN` (origem exata, sem barra final). Auth/Firestore emulados devem estar juntos em projeto `demo-*`.

## Salvar uma versão

`POST /property-readings`, `Authorization: Bearer <Firebase ID token>` e `Content-Type: application/json`:

```json
{
  "saveId": "identificador-unico-do-retry",
  "propertyId": "imovel",
  "agencyId": "agencia",
  "leituraJson": "{...leitura M1-0...}",
  "editorStateJson": "{...companion opcional...}"
}
```

`basedOnVersionId` é opcional. Só staff ativo ou usuário ativo da agência do imóvel pode gravar. Retry usa o mesmo `saveId` e todos os mesmos conteúdos; qualquer divergência retorna 409. A resposta contém `id`, `version` e, quando enviado o companion, `editorStateSha256`.

A leitura e seu `contentSha256` conservam os contratos 1.0.0/1.1.0. `editorState` separado usa `schemas/editor-state/1.0.0.schema.json`: `schemaVersion`, `activeFloor` e `floors` ordenados, com `{floor, leitura, furniture}`. Térreo obrigatório, no máximo dois andares e 200 móveis por andar. Cada leitura passa pelo validador normativo, e a leitura ativa deve ser exatamente a leitura principal. IDs de móveis usam `mN`, reservando espaço para o próximo incremento; catálogo, dimensões, posições, rotação e cor são validados.

Após Python, a API verifica o companion pelo mesmo `carregarSnapshot` usado pelo editor. Conteúdo normativamente válido que o editor ainda não representa, como referências de procedência, recebe 422 em vez de produzir snapshot impossível de reabrir sem perda. Sem companion, a gravação mantém o contrato canônico M1 anterior; somente seu subconjunto suportado pelo editor pode ser reaberto para edição.

## Gerar uma prévia

`POST /gerar-maquete` aceita `leituraJson`, `contextoJson`, `moveisJson`, `demo`, `propertyId` e `agencyId`. Contexto e móveis são strings JSON; `moveisJson` aceita lista nominal em metros ou o envelope exportado pelo editor `{ "_gerado_por": "...", "moveis": [...] }`.

Geração com contexto declarado exige token, imóvel/agência autorizados e `contextoJson` completo. Os IDs do contexto precisam coincidir com os IDs autorizados. Móveis entram antes da geração e do cálculo dos hashes. Não declare móveis simultaneamente no contexto e no companion.

Demonstração exige `demo: true`, configuração explícita `READINGS_ALLOW_LOCAL_DEMO=1` e conexão loopback. Nesse modo o contexto é ilustrativo, rotulado **Prévia demonstrativa**, sem contagens comerciais inventadas. Demonstração vinculada a imóvel também exige token e autorização. Não combine `demo` com contexto declarado. O servidor recusa demonstração por padrão.

Para o ambiente local completo no PowerShell:

```powershell
$env:READINGS_ALLOW_LOCAL_DEMO = '1'
npm run painel:dev
```

O script de dev passa essa mesma opção explícita à API. Token e IDs do navegador são conferidos no Auth e no cadastro; a identidade transportada sozinha não autoriza geração. CORS aceita somente a origem configurada.

## CLI e artefatos

```powershell
python -m pipeline.gerar_maquete leitura.json --contexto contexto.json --moveis moveis.json --destino previa
python -m pipeline.gerar_maquete leitura.json --demo --saida previa.html
```

Sem contexto, `--demo` é obrigatório. `--destino` precisa ser uma pasta nova ou vazia, e `--saida` um arquivo novo. Ocupação é conferida também antes da promoção; nenhum conteúdo existente é apagado. O diretório conferido é promovido inteiro. Falha descarta só o trabalho temporário próprio.

A prévia usa o E2E LEVE local e retorna HTML e relatório com hashes. Não é publicação nem processamento operacional de BuildJob. O pedido pode fixar a leitura e o BuildJob conserva esse pin; worker, lease, transação operacional e reconciliação continuam pendentes no M2.
