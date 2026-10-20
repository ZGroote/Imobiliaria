# M2 — o worker do ciclo de publicação (especificação)

Proposta de 20/10/2026, revisada no mesmo dia com a decisão do usuário: **o quanto o worker anda
sozinho depende do tipo da conta** (§1). **Só documento: nada implementado, nada no ar, nenhum
deploy.** Escrita sobre a pilha #86→#91 (`feat/cloud-run-preparo`, `dc3e121`). Cada incremento
da §15 é um PR pequeno, revisado e mergeado só com "MERGE AUTORIZADO". Ligar o worker em
produção (M2-8) é uma ação à parte, com autorização própria.

Base lida: [`tools/buildjob.mjs`](../../tools/buildjob.mjs), [proposta §2, §3, §6–§9](proposta.md),
[`firebase/firestore.rules`](../../firebase/firestore.rules), a linha do M2 no `tasks/README.md`
(da `liv-melhorado`), o [plano do religar](religar-2026-10-20.md) e o
[`deploy/README.md`](../../deploy/README.md).

Palavras usadas aqui:

- **worker**: o programa que roda sozinho, sem ninguém no teclado, os comandos que hoje o
  operador roda à mão.
- **job** (`buildJobs/{id}`): uma tarefa do worker, com estado (`pending`, `running`, ...).
- **trava com prazo** (em inglês, *lease*): um documento que diz "o worker X está trabalhando
  até tal hora". Se o worker morre, o prazo vence e outro pode assumir.
- **sinal de vida** (*heartbeat*): o worker renova o prazo da trava a cada minuto.
- **repetir não duplica** (*idempotente*): rodar o mesmo passo duas vezes dá o mesmo resultado
  que rodar uma.
- **portão**: uma conferência que recusa seguir quando algo não bate (hash, estado do site,
  regra).

---

## 0. Resumo

1. A equipe deixa de rodar comandos. O worker gera o build e a prévia, confere os bytes servidos,
   põe no ar o build aprovado e registra no painel.
2. **O quanto ele anda sozinho depende da conta** (§1):
   - **imobiliária com publicação automática ligada:** o ciclo inteiro roda sem a equipe, do
     build até o registro da publicação. Só a planta e a aprovação são de gente;
   - **imobiliária com ela desligada** (o padrão de toda conta nova): o worker para na revisão
     interna, e a equipe libera para a imobiliária;
   - **construtora:** revisão interna sempre, e publicar no ar é um clique do admin.
3. **A aprovação do gerente é sempre humana.** Nada vai ao público sem ela, e as regras do banco
   garantem isso: o worker não tem como aprovar.
4. **Portão que falha derruba o pedido para a revisão interna**, com o motivo registrado (§4),
   mesmo com a publicação automática ligada.
5. **O worker escreve no pedido como um usuário do painel** (`users/worker`), pelo mesmo SDK do
   navegador. As mesmas regras de um clique valem para ele, e uma regra nova o impede de pular a
   revisão interna onde a conta não permite.
6. **Onde roda, recomendado: GitHub Actions.**
   - O repositório é público, então os minutos são de graça.
   - O checkout já é o repositório com os dados.
   - Funciona no plano Spark, sem esperar o Blaze.
   - Plano B: Cloud Run Job (§11).
7. **Os bytes ficam onde já estão.** Os builds no ar moram no site de imóveis, e o build em
   revisão mora no canal de prévia. O worker baixa e confere byte a byte.
8. **Uma trava só para tudo:** um worker por vez. Ela fecha a corrida na criação de jobs (a
   pendência do `buildjob.mjs`) e entre dois deploys do live (o `ponytail` da proposta §7).
9. **Custo zero dentro das cotas** (§14). O limite real é o tráfego do Hosting, 360 MB/dia
   divididos com os visitantes. Ele aperta perto de ~15 imóveis no ar, e o próximo passo para
   esse caso já está apontado.
10. **Dependência que precisa ficar clara:**
    - o ciclo automático começa na leitura fixada, mas hoje o `e2e_leitura` só gera a maquete
      LEVE local. Não gera tour nem `manifest.json`, e pede um contexto (ficha, andar, cores)
      que não mora no Firestore;
    - o **build a partir da leitura (M2-R) é pré-requisito** do ciclo automático pela planta;
    - até ele existir, o worker atende o fluxo legado (`pipelineUnitId`, como o Cedros), que
      começa no clique "Gerar prévia". Daí em diante, a mesma política por conta vale.

---

## 1. A política por tipo de conta (decisão do usuário, 20/10)

Nas palavras dele: "imobiliária com botão de publicação automática por conta (desligado na conta
nova, cai para revisão interna se um portão falhar, aprovação do gerente sempre); construtora com
revisão interna sempre."

As etapas são as de hoje (`painel/src/lib/status.ts`): `production → internal_review →
agency_review → approved → published`.

| | Imobiliária, automática **ligada** | Imobiliária, automática **desligada** (padrão) | Construtora |
|---|---|---|---|
| Planta | a equipe desenha no capturador e fixa a leitura (PR #90) | igual | produção artesanal (prédio, Tour em splat, várias rodadas, conferência visual) |
| Início do ciclo | a leitura fixada com o pedido em `production` (M2-R), ou o clique "Gerar prévia" | igual | só o clique "Gerar prévia", se a unidade usar o pipeline de imóveis |
| Prévia pronta | o worker registra a prévia e leva o pedido **direto para `agency_review`** | o worker registra a prévia e **para em `internal_review`**; a equipe olha e clica "Enviar para a imobiliária" | igual à desligada: **para em `internal_review`**, sempre |
| Aprovação | **gerente** | **gerente** | **gerente** |
| Publicar no ar | o worker, logo depois da aprovação | o worker, logo depois da aprovação | o admin clica "Publicar no site"; o worker faz |
| Registrar a publicação | o worker | o worker | o admin clica "Registrar publicação" (como hoje) |
| Portão falhou | `internal_review` + motivo | `internal_review` + motivo | `internal_review` + motivo |

Atenção ao nome: **"publicação automática desligada" não desliga a publicação depois do
gerente.** Na imobiliária, a ida ao ar depois da aprovação é automática nos dois estados. O
botão decide só se o pedido passa pela revisão interna antes de a imobiliária ver.

O que já é automático na construtora continua igual: estoque, preço e disponibilidade ao vivo
(`salesInventory`), "no ar" da vitrine, métricas e link por corretor. O site do LIV
(`imobilaria-deccb-miniaturas`) fica fora do worker. Só entra o que segue o contrato do site de
imóveis (`b/<id>/<build>/` + `manifest.json` + `estado.json`).

### 1.1 Onde mora o botão e quem muda

- **Campo:** `agencies/{id}.autoPublish` (`boolean`). Ausente = desligado. No painel, o rótulo
  é "Publicação automática", na tela da conta, só para o admin.
- **Regras** (M2-1), no bloco `agencies`, que já só deixa o `platform_admin` escrever:
  - `autoPublish`, se existir, é `bool`;
  - **na criação, só `false` ou ausente**: desligado em toda conta nova;
  - **construtora nunca tem `autoPublish == true`**. Isso vale também para quem muda o `kind`
    para `construtora`: o mesmo write tem de deixar o botão desligado. É o "botão travado";
  - gerente, corretor e operador não mudam o botão; continua só o admin, como o resto da conta.
- Toda mudança do botão é auditada como as demais da conta: AuditLog `entityType: 'agency'`,
  `action: 'auto_publish:on' | 'auto_publish:off'`, interno, no mesmo batch.

### 1.2 Como o worker decide o próximo status

O worker lê a conta **na hora da decisão**, nunca de cópia: `kind` (ausente = imobiliária) e
`autoPublish`. A política lida fica gravada no job (`policy`), para a história dizer por que ele
foi para onde foi.

```text
prévia pronta e conferida:
  conta imobiliária e autoPublish == true   -> agency_review   (registra a prévia no mesmo write)
  qualquer outro caso                       -> internal_review (registra a prévia no mesmo write)

pedido em approved (só o gerente põe ali):
  conta imobiliária                         -> o worker publica sozinho; deu certo -> published
  construtora                               -> nada sozinho; espera o clique "Publicar no site"

qualquer portão falhou, em qualquer conta   -> internal_review + motivo (§1.3)
```

**As regras do banco repetem essa política para o usuário do worker** (M2-1). Assim, um defeito
no worker não pula a revisão interna. Esboço:

```text
request.auth.uid != 'worker' || (
     (to() == 'internal_review' && from() in ['production', 'approved'])
  || (to() == 'agency_review'   && from() == 'production'
                                && conta é imobiliária && conta.autoPublish == true)
  || (to() == 'published'       && from() == 'approved' && conta é imobiliária))
```

- O worker **não chega a `approved`**: `managerDecision` já exige o gerente.
- Em `properties` e `publications`, o worker só escreve a ação `publish`, e só de imobiliária.
- Não pode reverter: reverter continua sendo clique do admin.

### 1.3 O motivo quando um portão derruba o pedido

Num só batch, pelas regras de hoje (`auditedAs`):

1. o pedido vai para `internal_review`;
2. o AuditLog `status:internal_review`, visível à imobiliária como toda mudança de status, leva
   só `{ status, jobId }`;
3. um segundo AuditLog, **interno**, `action: 'worker:retido'`, leva o motivo:
   `{ jobId, stage, code, message }`, por exemplo `CHANNEL_MISMATCH` com "o canal serve outro
   manifest.json".

O job guarda o mesmo `error`. O painel mostra o motivo à equipe a partir dos dois. A imobiliária
vê só "Revisão interna", como hoje, sem texto técnico.

Um pedido que cai de `approved` perde a aprovação na prática. Publicar exige `approved`, e só o
gerente volta o pedido para lá. Depois do conserto, o caminho é o normal: a equipe envia, o
gerente aprova de novo, e o worker publica.

---

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| W1 | O worker é **um comando** (`node tools/worker.mjs rodar`), não um servidor | Roda igual no computador, no GitHub Actions ou num Cloud Run Job. Onde ele roda é um detalhe que se troca sem mexer na lógica |
| W2 | **Gatilhos:** a leitura fixada e a aprovação do gerente, que são atos humanos deliberados e já auditados; e, para o resto, um **pedido de trabalho auditado** (AuditLog `worker:*`) gravado por um clique | A volta para `production` sozinha não dispara build: depois de um ajuste, o build só pode começar quando o conserto (leitura nova ou merge) existir |
| W3 | **O worker escreve no pedido, no imóvel e na publicação como o usuário `users/worker`** (`platform_admin`), pelo SDK do navegador e com um token próprio. Pelo Admin SDK, ele só escreve no que é dele: `buildJobs` e `workerLeases` | Assim as mesmas regras de um clique conferem cada escrita, e uma regra a mais trava a política (§1.2). Pelo Admin SDK, as regras seriam ignoradas e virariam código repetido. **Desligar de emergência:** `users/worker.active = false` faz as regras negarem tudo o que ele escreve |
| W4 | **Uma trava global**: um worker trabalhando por vez, para todas as etapas | `ponytail:` trava única. O volume é de poucos imóveis por semana. Trava por imóvel só se a fila começar a esperar |
| W5 | O **site no ar guarda os builds publicados** e o **canal guarda o build em revisão** | A máquina do worker nasce vazia a cada execução. Os dois lugares já existem, e o `estado.json` e o `manifest.json` provam os bytes. O teto está na §14 |
| W6 | **A política mora na conta** (`kind` + `autoPublish`) e é conferida duas vezes: pelo worker e pelas regras | Decisão do usuário (§1). A regra é a autoridade |
| W7 | **Portão falhou: o pedido vai para `internal_review` com o motivo**, e não fica parado nem tenta de novo sozinho | Gente olha. Falha de infraestrutura tenta de novo até 3 vezes antes (§8) |
| W8 | O worker **nunca usa `--estado-vazio`** | Um `estado.json` ausente (404, site desligado) não pode virar "site vazio" e apagar os outros imóveis. A primeira publicação de um site vazio fica à mão, como no religar |
| W9 | **Build a partir da leitura fixada só pelo `e2e_leitura`** (ou o que vier dele), nunca pelo `--cadastro` direto | Fronteira do M1-F. É o incremento M2-R |
| W10 | **Executar os scripts e reaproveitar as funções de hoje, não reescrevê-los** | `build_imovel.py` e `publicar_imovel.py` são os portões testados. As escritas do worker usam as funções que o painel já usa (`mudarStatus`, `lerPreview`, `registrarPublicacao`): o mesmo código e as mesmas regras de um clique |

---

## 3. Etapas, gatilhos e identidade

A **identidade** de um job é o id do documento `buildJobs/{id}`. Ela sai do fato que o
disparou, então o mesmo fato lido duas vezes vira o mesmo job (`create()` falha se o documento
já existe).

| Etapa | Gatilho | Identidade do job | Para quais contas |
|---|---|---|---|
| **prévia automática** | pedido em `production` com `productionInput` fixado (a fixação é o AuditLog `production_input:set` de hoje) | `previa-<requestId>-<readingId>` (a mesma leitura não gera build de novo) | imobiliária, depois do M2-R |
| **prévia por clique** | AuditLog `worker:previa`, gravado pelo botão "Gerar prévia" (equipe) | o id desse AuditLog | todas (fluxo legado, construtora, gerar de novo) |
| **publicar automático** | pedido em `approved` (só o gerente põe ali) | `publicar-<id do AuditLog status:approved>` (cada aprovação, um job) | imobiliária |
| **publicar por clique** | AuditLog `worker:publicar`, gravado por "Publicar no site" (admin), com `after = {build, manifestSha256}` | o id desse AuditLog | construtora |
| **reverter** | AuditLog `worker:reverter` (admin) | o id desse AuditLog | todas |
| **cancelar** | AuditLog `worker:cancelar` (equipe; admin para publicar/reverter) | não cria job; marca o job alvo (§10) | todas |

O pedido de trabalho por clique é um documento em `auditLogs`. A regra de criação de hoje já o
aceita, e o M2-1 a aperta: `worker:*` só da equipe, só com `visibility: 'internal'`, e
`publicar`/`reverter` só do admin.

```ts
{ agencyId, userId,                       // quem clicou (= request.auth.uid, pelas regras)
  entityType: 'request' | 'property' | 'buildJob', entityId,
  action: 'worker:previa' | 'worker:publicar' | 'worker:reverter' | 'worker:cancelar',
  visibility: 'internal', after: { ... }, timestamp }
```

Um pedido de trabalho com mais de 48 h e sem job é ignorado. O painel mostra "pedido expirado,
peça de novo".

### O que cada etapa confere e faz

| Etapa | O worker confere de novo, no momento | O que faz | Termina com |
|---|---|---|---|
| **prévia** | o autor do clique (se houver) está ativo e é da equipe. O pedido está em `production`, e vale o resto do `planejarBuildJob`: modo LEVE/PREMIUM, imóvel da mesma agência com `pipelineUnitId` ou `productionInput` | 1. monta o build **duas vezes**, em pastas separadas, e exige o mesmo build ID: `build_imovel.py <id> --modo <modo>` no legado, ou o M2-R. 2. `montar-preview`. 3. `hosting:channel:deploy imovel-<id> --expires 30d --json`. 4. Baixa `tour.html`, `maquete.html` e `manifest.json` do canal e confere os bytes. 5. Registra a prévia com `lerPreview` e o status da §1.2 | `build`, `manifestSha256`, `tourUrl`, `maqueteUrl`, `previewExpiresAt`, `commit`, `policy` |
| **publicar** | o pedido está em `approved`, com `approvedBuild` e `approvedManifestSha256`; no clique da construtora, iguais aos do clique. O imóvel tem `pipelineUnitId` | 1. Baixa o `estado.json` do ar. 2. Reconstrói os builds no ar e traz o aprovado do canal. 3. `montar-live promover --estado <baixado> --manifest-aprovado <sha>`. 4. Portão de escopo (§13, portão 8). 5. Relê o `estado.json`. 6. `firebase deploy --only hosting:imoveis`. 7. Relê o `estado.json` até mostrar o novo. 8. Na imobiliária, `registrarPublicacao`, que relê o `estado.json` de novo | `stateBeforeSha256`, `stateAfterSha256`, `build`, `manifestSha256` |
| **reverter** | o imóvel tem `publishedBuild` e `previousBuild`; o ar mostra esse par; o manifest do anterior é o que o pedido anterior aprovou (a conferência de `conferirReversao`) | `montar-live reverter`, o mesmo portão de escopo, relê o estado e faz o deploy. O registro é do admin | os mesmos do publicar |

---

## 4. O BuildJob

O tipo cresce sem quebrar o que existe. Um job sem `stage` é um job manual de antes do M2.

```ts
export type BuildJobStage = 'preview' | 'publish' | 'rollback'
export type BuildJobStep = 'build' | 'channel' | 'check_channel' | 'register' | 'state' | 'assemble'
  | 'deploy' | 'check_live'

export interface BuildJob {               // buildJobs/{id}; escrita só pelo worker (Admin SDK)
  id: string                              // a identidade da §3
  stage?: BuildJobStage                   // ausente = job manual anterior ao M2
  trigger?: 'reading' | 'approval' | 'click'
  requestId?: string                      // rollback não tem pedido
  propertyId: string; pipelineUnitId?: string; agencyId: string
  productionMode?: ProductionMode
  requestedBy?: string; createdBy: string // createdBy = quem clicou, ou 'worker' no gatilho automático
  policy?: { kind: 'imobiliaria' | 'construtora'; autoPublish: boolean }   // lida na decisão
  status: BuildJobStatus                  // pending | running | succeeded | blocked | failed | cancelled
  attempt: number                         // 1, 2 ou 3
  step?: BuildJobStep                     // onde está ou onde parou
  lease?: { owner: string; expiresAt: Timestamp }
  heartbeatAt?: Timestamp
  cancelRequested?: boolean
  commit?: string                         // a main que o worker usou
  build?: string; manifestSha256?: string
  tourUrl?: string; maqueteUrl?: string; previewExpiresAt?: Timestamp
  stateBeforeSha256?: string; stateAfterSha256?: string
  nextStatus?: RequestStatus              // para onde o worker levou o pedido
  error?: { code: string; message: string }
  startedAt?: Timestamp; finishedAt?: Timestamp
  lastAuditId?: string
  createdAt: Timestamp; updatedAt: Timestamp
}
```

**Estados do job:**

```text
pending ──(o worker assume)──> running ──> succeeded
   │                             │  ├────> blocked    um portão recusou; o pedido vai para internal_review (§1.3)
   │                             │  ├────> failed     infraestrutura falhou 3 vezes; o pedido vai para internal_review
   │                             │  └────> cancelled
   │                             └─(o prazo venceu)─> reconciliação (§9): succeeded, nova tentativa ou failed
   └──(cancelar)──> cancelled
```

Estado final não volta. "Tentar de novo" é um job novo: um clique ou uma leitura nova.

**Códigos de erro** (`error.code`; a mensagem vai no job e no AuditLog interno, nunca no log
público, §11):

- `blocked`:
  - `NOT_STAFF`, `NOT_ADMIN`, `WORKER_INACTIVE` (o desligamento de emergência);
  - `REQUEST_CHANGED`: o pedido saiu do estado esperado;
  - os de `planejarBuildJob` (`PIPELINE_UNIT_REQUIRED`, `AGENCY_MISMATCH`, ...);
  - `PRODUCTION_INPUT_UNSUPPORTED`: só leitura fixada, antes do M2-R;
  - `NAO_PUBLICAR`: `mirra-114`;
  - `BUILD_REFUSED`: o `build_imovel.py` recusou, por exemplo uma fonte mudou durante a
    montagem;
  - `BUILD_NOT_REPRODUCIBLE`: as duas montagens deram builds diferentes;
  - `PROBE_MISMATCH`: a sonda da maquete não bate com a planta (M2-R);
  - `CHANNEL_MISMATCH`: o canal serve outros bytes;
  - `PREVIEW_GONE`: o canal venceu ou recebeu outra prévia;
  - `APPROVAL_MISMATCH`;
  - `STATE_UNREADABLE`: `estado.json` ausente ou fora do formato;
  - `STATE_CHANGED`: o ar mudou durante o job;
  - `OUT_OF_SCOPE`: §13, portão 8;
  - `LIVE_DIFFERENT`: depois do deploy, o ar não mostra o que se publicou.
- `failed`: `NETWORK`, `DEPLOY_ERROR`, `TIMEOUT` e `LEASE_LOST`, depois da 3ª tentativa.

AuditLog do job: `created` e o estado final, com `entityType: 'buildJob'`, gravados pelo Admin
SDK. Sinal de vida não gera log. As mudanças do pedido têm os AuditLogs delas, gravados como
`users/worker`.

---

## 5. Trava com prazo e sinal de vida

Um documento: `workerLeases/global` = `{ owner, jobId, expiresAt }`. O `owner` identifica a
execução (`gha-<run_id>-<run_attempt>`, ou `local-<máquina>-<pid>`).

- **Pegar**, numa transação: se o documento não existe ou se `expiresAt` já passou, grava
  `owner = eu` e `expiresAt = agora + 15 min`. Se outro tem a trava, a execução termina sem
  fazer nada.
- **Sinal de vida**, a cada 60 s, numa transação:
  - com `owner == eu`: `expiresAt = agora + 15 min` e `job.heartbeatAt = agora`, juntos;
  - com outro `owner`: a trava foi perdida, e o worker **para na hora, sem nenhum efeito a
    mais** (`LEASE_LOST`).
- **Antes de cada efeito externo** (deploy do canal, deploy do live, escrita no pedido): uma
  transação confere `owner == eu` e pelo menos 10 min de prazo, e relê o pedido e a conta. O
  deploy leva ~1–2 min (medir no M2-5).
- **Soltar** no fim, numa transação: só apaga se `owner == eu`.
- **Criar job, assumir job e encerrar job** acontecem com a trava na mão. Assim a criação é
  feita uma de cada vez, e a regra "um job ativo por pedido" (`ACTIVE_BUILDJOB_EXISTS`) deixa
  de ter corrida. Hoje a consulta roda antes do batch e não garante isso (proposta §9).
- **Relógio:** o da máquina do worker, sincronizado por NTP. A margem de 15 min cobre a
  diferença entre relógios.
- No GitHub Actions, `concurrency: worker-imoveis` também impede duas execuções juntas. É
  proteção a mais; a autoridade é a trava.

**Uma execução:**

1. Olha, sem trava, se há trabalho: pedidos de trabalho novos, leituras fixadas sem job, pedidos
   `approved` de imobiliária sem job, jobs `pending`, jobs `running` com sinal de vida velho. Se
   não há, termina sem escrever nada.
2. Se há, pega a trava e reconcilia (§9).
3. Cria os jobs novos.
4. Processa os `pending` em ordem de criação até ~45 min de relógio.
5. Solta a trava. O que sobrar fica para a próxima execução.

---

## 6. A identidade do worker no banco

- **Usuário:** `users/worker` = `{ name: 'Worker', role: 'platform_admin', active: true, ... }`.
  É criado uma vez, pelo Admin SDK, no M2-8, com autorização. No histórico, as ações dele
  aparecem como "Worker".
- **Login:** o Admin SDK cria um token próprio (`createCustomToken('worker')`). O worker entra
  com ele no SDK do navegador (`signInWithCustomToken`), com a configuração pública do painel.
  Daí em diante, cada escrita em `requests`, `properties`, `publications` e `auditLogs` passa
  pelas regras com `request.auth.uid == 'worker'`.
- **Por que `platform_admin`:** registrar a publicação exige `isAdmin()` (`publishedAs`, bloco
  `publications`). As regras do M2-1 limitam o que esse admin pode fazer (§1.2). O worker não
  aprova e não reverte.
- **Desligar de emergência**, pelo painel, sem deploy: o admin põe `users/worker` como inativo.
  As regras passam a negar as escritas dele, e os jobs terminam `blocked` com `WORKER_INACTIVE`.
  Para parar de vez, desligar também o workflow (§10).
- **Limite, dito com clareza:** a regra nova é proteção contra **defeito** do worker, não contra
  roubo da credencial. Quem tiver a conta de serviço tem o Admin SDK, que ignora regras (§11).

---

## 7. O que muda para quem usa o painel

| Passo | Hoje | Com o worker |
|---|---|---|
| Aceitar e pôr em produção | admin clica | **igual** |
| Planta | a equipe desenha e fixa (PR #90) | **igual**; na imobiliária, fixar a leitura com o pedido em produção já dispara a prévia (M2-R) |
| Build + prévia | alguém roda 3 comandos | automático pela leitura, ou o botão **"Gerar prévia"** (equipe) |
| Registrar a prévia | o admin **cola a URL** | o worker registra. Com a automática desligada e na construtora, o pedido para em "Revisão interna", e a equipe clica **"Enviar para a imobiliária"**, que relê os bytes servidos (`lerPreview`) |
| Aprovar | gerente | **igual, sempre** |
| Pôr no ar | alguém roda `montar-live` + deploy | imobiliária: **automático depois da aprovação**. Construtora: o admin clica **"Publicar no site"** |
| Registrar | admin: "Conferir o site" + "Registrar publicação" | imobiliária: o worker. Construtora: o admin, como hoje |
| Reverter | comandos + admin registra | o admin clica **"Voltar ao build anterior"**; o worker faz; o admin registra |
| Portão falhou | o operador vê o erro no terminal | o pedido aparece em "Revisão interna" com o motivo, só para a equipe |

Enquanto o worker estiver desligado, o painel continua mostrando os comandos à mão, como hoje,
dentro de "Sem o worker". Antes de rodar à mão, desligue o worker (§10).

---

## 8. Nova tentativa sem efeito duplicado

| Passo | Se rodar de novo | Por que não estraga |
|---|---|---|
| criar o job | `create()` com a mesma identidade falha | a identidade é o fato que disparou (§3) |
| build | com a mesma `main`, gera o mesmo `tour.html`/`maquete.html` (mesmo `build`), com outro `manifest.json`, porque o `gerado_em` muda | o job só grava o manifest **depois** de conferir os bytes servidos no canal. Nada fora do job apontava para o manifest de uma tentativa que morreu |
| deploy do canal | sobe a mesma pasta de novo | o canal fica com a última prévia, e é essa que se registra |
| registrar a prévia | o pedido já tem a mesma prévia (`build` + `manifestSha256`) e já está no status de destino | conta como feito; não escreve de novo |
| deploy do live | **não refaz às cegas**: primeiro reconcilia pelo `estado.json` (§9) | o ar é a fonte do que está publicado (proposta §2) |
| registrar a publicação | o pedido já está `published` com o imóvel apontando esse build | conta como feito. As regras recusariam o segundo registro de qualquer jeito |

**Regra das tentativas:**

- até 3, e só para falha de infraestrutura (rede, tempo esgotado, trava perdida, erro do deploy
  que não seja recusa de portão);
- a próxima tentativa só acontece na próxima execução (≥ 10 min), e essa é a espera entre elas;
- portão que recusa: `blocked` na hora, e o pedido vai para `internal_review` com o motivo
  (§1.3);
- 3ª falha: `failed`, e o mesmo caminho.

---

## 9. Reconciliação depois de uma falha

Logo depois de pegar a trava, toda execução procura jobs `running` com `heartbeatAt` de mais de
15 min. São jobs de um worker que morreu.

| Etapa do job morto | O que o worker olha | Decisão |
|---|---|---|
| prévia | o pedido: se já tem esta prévia registrada, terminou | registrado: `succeeded`. Se não: recomeça com `attempt + 1`, ou `failed` se já era a 3ª |
| publicar | o `estado.json` do ar, agora | (a) mostra `approvedBuild` com `approvedManifestSha256`: **o deploy aconteceu**. Na imobiliária, registra se faltar (§8), e o job vira `succeeded` sem novo deploy. (b) o sha256 dele é o `stateBeforeSha256` do job: **nada aconteceu**, então recomeça. (c) é outra coisa: `blocked` com `STATE_CHANGED`, e o pedido vai para `internal_review` |
| reverter | o mesmo, com o par anterior | o mesmo, sem registrar (é do admin) |

Ficam com o painel, que calcula a partir do job e do pedido:

- pedido de trabalho com mais de 48 h e sem job: "expirou";
- construtora com o job `publish` `succeeded` e o pedido ainda em `approved`: "no ar, falta
  registrar";
- prévia com `previewExpiresAt` a menos de 5 dias: "a prévia vence em X dias";
- fato gatilho sem job há mais de 30 min: "a fila está parada". Ver o Actions (§11).

O Firestore e o Hosting continuam sem transação conjunta. O job é a ponte, e o `estado.json`
relido no registro continua sendo a autoridade. Isso reduz a janela do `ponytail` de
`publicar.ts` ("na Fase 2, um BuildJob no servidor coordena a promoção e o registro"), mas não a
fecha: a leitura do registro continua sendo a autoridade.

---

## 10. Cancelar e desligar

- **Job `pending`**: vira `cancelled` na próxima execução.
- **Job `running`**: a cada sinal de vida, o worker procura um `worker:cancelar` para o job dele.
  Achou: marca `cancelRequested` e para na próxima fronteira de passo, antes de qualquer efeito
  externo novo. O pedido fica onde está; cancelar não é portão falhando.
- **Depois que o deploy do live começou, não se cancela.** O deploy termina e é conferido. Se o
  ar mudou, o caminho de volta é "Voltar ao build anterior".
- **Cancelamento implícito:** se o pedido sair do estado esperado (por exemplo, `production` →
  `cancelled`, ou o gerente pede ajuste), a conferência antes do efeito externo dá
  `REQUEST_CHANGED`, e o job termina sem mexer no pedido.
- **Desligar o worker** (para rodar à mão ou numa emergência): `gh workflow disable worker.yml`,
  e, se for urgente, `users/worker` inativo (§6). Religar: `gh workflow enable worker.yml`.

---

## 11. Onde roda e com quais credenciais

### Recomendado: GitHub Actions (`.github/workflows/worker.yml`)

- **Por quê:**
  - `ZGroote/Imobiliaria` é **público**, e a documentação do GitHub diz que o Actions é de graça
    para repositório público com os runners padrão;
  - o checkout da `main` já é "o repositório com os dados": as 150 entradas do build, os 239
    tiles e o `pagina_maquete.py`. O PREMIUM do Cedros lê `geometry-compact.json` e
    `lightmap.rgbm.gz`, que estão no git, e não os `source.json` do repositório privado de
    artefatos;
  - Python 3.14 e Node 24 já sobem no CI (`.github/workflows/ci.yml`);
  - `firebase-tools`, `firebase-admin` e `firebase` vêm do `package.json` da raiz;
  - nada disso depende do Blaze.
- **Gatilho:**
  - `schedule` a cada 10 min, mais `workflow_dispatch` para rodar na hora;
  - fila vazia: a execução termina em ~1 min, sem gastar nada;
  - o GitHub pode atrasar (e até pular) um agendamento em horário de pico. Como tudo fica no
    Firestore, uma execução pulada só adia o trabalho para a próxima.
- **Configuração do workflow:**
  - `permissions: { contents: read, id-token: write }`;
  - `concurrency: { group: worker-imoveis, cancel-in-progress: false }`;
  - `timeout-minutes: 60`;
  - nenhum gatilho de `pull_request`.
- **Credenciais, sem chave guardada e sem segredo no painel:**
  - *Workload Identity Federation*: o GitHub entrega um token de curta duração que o Google
    troca pela conta de serviço `worker-imoveis`;
  - o provedor só aceita `repository == 'ZGroote/Imobiliaria'`, `ref == 'refs/heads/main'` e
    `workflow_ref` do `worker.yml`. PR de fork não recebe esse token;
  - papéis:
    - `roles/datastore.user` (Firestore);
    - `roles/firebasehosting.admin` (deploy de canal e de live);
    - `roles/serviceusage.apiKeysViewer`, que a documentação da action oficial de deploy
      (`FirebaseExtended/action-hosting-deploy`) pede para deploy pelo CLI;
    - `roles/iam.serviceAccountTokenCreator` **sobre a própria conta**, para assinar o token do
      `users/worker` (§6);
    - ficam de fora, de propósito, o `firebaseauth.admin` e o `run.viewer` da lista da action:
      o domínio da prévia não precisa de login, e o site de imóveis não tem rewrite para o Cloud
      Run;
    - o primeiro deploy de canal do M2-8 confirma a lista;
  - o painel não ganha segredo nenhum: ele só grava AuditLogs e muda a conta com a sessão do
    próprio usuário.
- **Os limites dessas credenciais, ditos com clareza:**
  - `datastore.user` vale para o banco inteiro, porque o IAM não separa por coleção. A regra do
    worker (§1.2) só vale para o que ele escreve como `users/worker`. Pelo Admin SDK, quem
    segura é um teste que falha se o worker escrever, por ali, fora de `buildJobs`,
    `workerLeases` e dos AuditLogs dos jobs (M2-2);
  - `firebasehosting.admin` vale para todos os sites do projeto (mapa, painel, miniaturas/LIV e
    imóveis). Quem segura é um teste que falha se algum comando montado não tiver
    `--config firebase.imoveis.json` e `--only imoveis` / `hosting:imoveis` (M2-3);
  - quem tem escrita na `main` muda o que o worker faz. Isso já vale hoje para o que vai ao ar;
    a proteção continua sendo o ritual de PR com "MERGE AUTORIZADO".
- **Os logs do Actions são públicos.**
  - O worker imprime só: id do job, etapa, passo, slug do imóvel, build, sha e código de erro;
  - nunca nome de imobiliária, título de pedido, e-mail, nota, motivo por extenso ou mensagem do
    Firestore;
  - o detalhe vai para o job e para o AuditLog interno, que só a equipe lê;
  - um teste (M2-3) roda com textos "sensíveis" de propósito e falha se eles aparecerem na
    saída.
- **Riscos do Actions:**
  - repositório público sem atividade por 60 dias tem o agendamento desligado. O aviso "a fila
    está parada" (§9) mostra; religar com `gh workflow enable`;
  - **se o repositório virar privado**, os minutos passam a contar (2.000 por mês no plano
    gratuito). Aí é o plano B.

### Plano B: Cloud Run Job (com o Blaze ativo)

- O mesmo `node tools/worker.mjs rodar` numa imagem Python 3.14 + Node 24, igual ao
  `deploy/leituras.Dockerfile`, com o repositório de uma `main` conhecida.
- O `deploy/contexto.py` ganha o alvo `worker`.
- Job em `southamerica-east1`, com a conta de serviço anexada (sem chave), `--max-retries 0` (a
  regra de tentativas é do worker), `--task-timeout 60m` e CPU/memória medidas no M2-5.
- **O custo muda de figura.** A cota grátis de jobs fica na casa de 200 mil vCPU-s por mês;
  conferir na página oficial antes de ligar. Uma varredura a cada 10 min, 30 s com 2 vCPU,
  daria ~260 mil vCPU-s por mês: estoura sozinha. No Cloud Run, a saída é:
  - varrer de 30 em 30 min no horário comercial (~50 mil vCPU-s), ou
  - ter um serviço pequeno que só acorda o job quando há trabalho.
- **Outro custo:** uma imagem nova a cada merge que mude dados ou pipeline. Sem isso, o worker
  gera com dados velhos.
- **Quando trocar:** se o repositório virar privado, se os logs públicos deixarem de ser
  aceitáveis, ou se a espera do agendamento do GitHub atrapalhar.

---

## 12. O que continua manual, de propósito

- **A planta**, que a equipe desenha no capturador e fixa. O ciclo automático começa nela.
- **A aprovação ou o pedido de ajuste do gerente.** Sempre. Nada vai ao público sem ele.
- Aceitar o pedido e pô-lo em produção.
- A revisão interna: na imobiliária com a automática desligada, na construtora, e sempre que um
  portão falha.
- Na construtora: "Publicar no site" e "Registrar publicação" (admin). A produção artesanal
  (splat, rodadas de treino, conferência visual) fica fora do worker.
- Ligar ou desligar a publicação automática de uma conta (admin).
- Reverter e registrar a reversão (admin).
- A **primeira publicação** de um site vazio (`--estado-vazio`) e qualquer religar/desligar do
  site (`SITE_DISABLE`). Ficam à mão, com autorização (W8 e o
  [plano do religar](religar-2026-10-20.md)).
- Ligar, desligar e mudar credenciais do worker.

---

## 13. Os portões de hoje continuam valendo

| # | Portão | Onde mora hoje | No M2 |
|---|---|---|---|
| 1 | `mirra-114` não se publica | `NAO_PUBLICAR` em `build_imovel.py` e `confere_build` | o worker chama os mesmos scripts: `blocked` com `NAO_PUBLICAR` → revisão interna |
| 2 | build = conteúdo; pasta nunca sobrescrita; fonte estável durante a montagem | `build_imovel.py` | igual, e **mais**: duas montagens têm de dar o mesmo build ID (`BUILD_NOT_REPRODUCIBLE`) |
| 3 | sem rebaixar PREMIUM para LEVE em silêncio | `modo_producao` + `--modo` | o worker passa o `productionMode` do pedido; sem modo, `blocked` |
| 4 | a maquete representa a planta | a sonda do `e2e_leitura` (M1-F, F2) | no caminho da leitura fixada (M2-R), `PROBE_MISMATCH`. O legado não tem sonda |
| 5 | identidade da prévia = sha256 dos **bytes servidos** do manifest | `montar-preview` devolve `manifest_sha256`; o painel calcula em `lerPreview` | o worker confere os bytes servidos e registra com `lerPreview`, a mesma função do painel. Na revisão interna, o "Enviar" da equipe relê de novo |
| 6 | só o gerente aprova, e exatamente o par do preview | regras: `managerDecision` | igual: o usuário `worker` não passa nessa regra |
| 7 | promover só o artefato aprovado | `montar-live --manifest-aprovado` recusa manifest local diferente | o worker lê `approvedBuild`/`approvedManifestSha256` no começo e de novo logo antes do deploy. O build vem do canal e é conferido contra o sha aprovado e contra o próprio manifest **antes** do `montar-live`, que confere outra vez |
| 8 | promover X não mexe em Y | só teste (`test_promoting_x_keeps_y_byte_for_byte`), sem conferência na hora | **portão novo, na hora:** compara o `arquivos` do `estado.json` do ar com o do novo. Só podem mudar `b/X/…`, `imovel/X`, `maquete/X`, `index.html`, `quintais/<conjunto novo>/…` e a saída do antigo `anterior` de X. Qualquer outra diferença dá `OUT_OF_SCOPE`, com a lista. Exemplo real: uma mudança no `vitrine_ao_vivo.js` mudaria o ponteiro de Y. Isso vira decisão de alguém, não efeito colateral |
| 9 | o `estado.json` é o **do ar**, não uma cópia | o operador baixa à mão | o worker baixa sem cache. Os builds no ar baixados são conferidos contra ele (`_confere_contra_estado`). **Logo antes do deploy, relê** e aborta com `STATE_CHANGED` se mudou, o que pega até um deploy à mão no meio-tempo. 404 ou formato errado dá `STATE_UNREADABLE`, nunca "vazio" |
| 10 | registrar só com o artefato aprovado no ar | `conferirPublicacao` relê o `estado.json` | igual: o worker usa a mesma `registrarPublicacao` |
| 11 | regras do Firestore | `firebase/firestore.rules` | iguais para todo mundo, inclusive o `worker`, que entra como usuário. Ganham a política por conta (§1.1, §1.2) e a trava do pedido de trabalho `worker:*` |
| 12 | o site de imóveis é isolado dos outros | `firebase.imoveis.json`, `--only` | o worker só monta esses comandos, com teste (§11) |

---

## 14. Custo dentro das cotas gratuitas

| Item | Cota grátis | Uso esperado |
|---|---|---|
| GitHub Actions | sem limite para repositório público com runner padrão | ~144 execuções por dia; as vazias levam ~1 min. A montagem dupla (portão 2) dobra o tempo do build, sem custo |
| Firestore (Spark) | 50 mil leituras e 20 mil escritas por dia | execução vazia: ~5 leituras e nenhuma escrita, ~720 leituras/dia. Por job: ~20 escritas (criar, assumir, ~10 sinais de vida, pedido + 2 AuditLogs, encerrar) |
| Authentication | login por token próprio sem custo | uma entrada por execução com trabalho |
| Hosting, armazenamento | 10 GB | por imóvel no ar: 2 builds de ~19 MB (tour ~15 MB, maquete 3,3–4,0 MB) mais os ponteiros; os 239 tiles (17 MB) são um conjunto só. Dá ~250 imóveis. Conferir no M2-8 quanto as versões antigas guardadas pelo Hosting e os canais de prévia (~19 MB cada) somam, e limitar a retenção se precisar |
| **Hosting, tráfego** | **360 MB por dia, dividido com os visitantes** | estimativa abaixo |

Estimativa do tráfego do worker:

- **Pedir compressão é obrigatório.** O worker baixa com `Accept-Encoding: gzip`. Medido aqui:
  a maquete de 4,0 MB cai para 688 KB em gzip. A compressão do tour não foi medida; a
  estimativa é ~4 MB, e o número certo sai do M2-5.
- **Os tiles nunca são baixados.** Vêm do git.
- **Prévia:** ~5 MB, a conferência dos bytes servidos no canal. O upload não conta como
  tráfego.
- **Publicar:** ~10 MB por imóvel no ar (atual + anterior), mais ~5 MB do build aprovado. Com 1
  imóvel, ~15 MB; com 10, ~105 MB.
- **Teto:** perto de **~15 imóveis no ar**, uma publicação passa de 1/3 da cota diária. Aí vem o
  M2-9: cópia no servidor. Pela API REST do Hosting (documentação conferida em 20/10):
  - `versions.clone` copia a versão no ar sem baixar nada; com `finalize: false`, a versão
    nasce `CREATED`;
  - `versions.populateFiles` acrescenta os arquivos novos, e "um caminho com hash vazio remove
    o caminho";
  - depois, finalizar e liberar.
  - Assim, os bytes de Y nem saem do servidor: é a "garantia central" da §7 da proposta, levada
    ao pé da letra.
- **No Spark, passar da cota de tráfego pode tirar o site do ar até o dia seguinte.** A página de
  preços não detalha o que acontece; trate como risco. O que já aperta a cota hoje são os
  visitantes: ~5 MB por tour aberto, ~70 tours por dia. O worker é pequeno perto disso.

---

## 15. Incrementos

Cada um é um PR pequeno, com teste que roda no emulador (`firebase emulators:exec --only
auth,firestore`, o mesmo padrão de `npm run test:painel`). O Auth do emulador aceita o token
próprio do `users/worker` sem assinatura.

**A matriz da política** aparece em vários incrementos. São os 3 casos da §1 e um 4º, o da regra:

| Caso | Prévia pronta | Portão falha na prévia | Gerente aprova | Portão falha ao publicar |
|---|---|---|---|---|
| imobiliária, ligada | `agency_review` | `internal_review` + motivo | o worker publica e registra → `published` | `internal_review` + motivo, sem `published` |
| imobiliária, desligada | `internal_review`; o "Enviar" da equipe → `agency_review` | `internal_review` + motivo | o worker publica e registra → `published` | `internal_review` + motivo |
| construtora | `internal_review` | `internal_review` + motivo | **nada sozinho**; admin clica, o worker faz o deploy, o admin registra | `internal_review` + motivo |
| construtora com `autoPublish: true` | **a regra recusa gravar** (criar ou mudar o `kind` com o botão ligado) | — | — | — |

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **M2-1** | **Contrato e regras.**<br>• `BuildJob` ampliado (§4) em `types.ts` e na proposta §3.<br>• `agencies.autoPublish` (§1.1).<br>• Política do `worker` em `requests`, `properties` e `publications` (§1.2).<br>• `worker:*` só da equipe e interno; `publicar`/`reverter` só do admin.<br>• `workerLeases` (equipe lê, ninguém escreve).<br>• Índice `auditLogs (action, timestamp)` | `regras.test.mjs`:<br>• conta nova com o botão ligado: negado;<br>• construtora com o botão ligado, na criação e na troca de `kind`: negado;<br>• gerente ou operador mudando o botão: negado;<br>• `worker` em `production → agency_review`: só passa em imobiliária ligada;<br>• `worker` em `approved → published`: negado em construtora;<br>• `worker` → `approved`: sempre negado;<br>• `worker` em `production`/`approved → internal_review`: passa;<br>• `worker` inativo: tudo negado;<br>• os casos de `worker:*` | testes verdes, e cada regra quebrada de propósito é pega (o padrão da T03) |
| **M2-2** | **Trava, fila e identidade, sem build.**<br>• `tools/worker.mjs`: pegar, renovar e soltar a trava.<br>• As identidades da §3, com `create`.<br>• `planejarBuildJob` reaproveitado.<br>• Cancelar `pending`; reconciliar trava vencida.<br>• Lista fechada do que escreve pelo Admin SDK.<br>• `tools/buildjob.mjs criar` passa a gravar um `worker:previa`: um caminho só para criar job | relógio falso no emulador. **Prova de concorrência:**<br>• dois workers ao mesmo tempo, só um pega a trava;<br>• o mesmo fato lido duas vezes dá um job;<br>• a mesma leitura fixada de novo não gera job;<br>• aprovar duas vezes dá dois jobs;<br>• trava vencida é assumida;<br>• quem perde a trava para antes do passo seguinte;<br>• escrita fora da lista falha o teste | `npm run test:worker` (novo) verde no CI |
| **M2-3** | **Prévia do legado, com deploy falso.**<br>• Os scripts de verdade num repositório de teste.<br>• O "canal" é uma pasta servida por um HTTP local; a conferência dos bytes é a de verdade.<br>• Montagem dupla.<br>• Decisão do próximo status e motivo (§1.2, §1.3) como `users/worker` | **a matriz** nas colunas "prévia pronta" e "portão falha na prévia".<br>Os portões:<br>• `CHANNEL_MISMATCH`;<br>• `BUILD_NOT_REPRODUCIBLE` (montagem falsa que muda);<br>• `NAO_PUBLICAR`;<br>• `REQUEST_CHANGED`;<br>• `PRODUCTION_INPUT_UNSUPPORTED`.<br>O motivo sai no AuditLog interno, e o de status não leva texto técnico. Comandos sempre com `--config firebase.imoveis.json`. Textos sensíveis não aparecem na saída | testes verdes; nenhum deploy real |
| **M2-4** | **Painel, prévia e conta.**<br>• O botão "Publicação automática" na conta (admin; travado em construtora).<br>• "Gerar prévia".<br>• Cartão do job (fila, rodando, último sinal, pronto, motivo em português).<br>• "Enviar para a imobiliária" a partir de `internal_review`.<br>• Comandos à mão em "Sem o worker" | testes do painel no emulador:<br>• o botão aparece desligado em conta nova e não liga em construtora;<br>• o motivo só aparece para a equipe;<br>• "Enviar" relê com `lerPreview` | testes verdes; tela conferida no `painel:dev` |
| **M2-5** | **Publicar, com "ar" e deploy falsos.**<br>• `estado.json`, reconstrução, build do canal, `montar-live`, portão de escopo, deploy, releitura.<br>• `registrarPublicacao` como `worker` na imobiliária.<br>• Medir tempo e memória | **a matriz** nas colunas "gerente aprova" e "portão falha ao publicar".<br>**Prova de falhas:**<br>• `APPROVAL_MISMATCH`;<br>• `STATE_UNREADABLE` (404 nunca vira vazio);<br>• `STATE_CHANGED`;<br>• `OUT_OF_SCOPE`;<br>• `PREVIEW_GONE`;<br>• **o worker morre depois do deploy:** a execução seguinte registra e marca `succeeded`, sem novo deploy;<br>• **morre antes:** recomeça;<br>• 3ª falha dá `failed` → `internal_review` | testes verdes; tempo e memória anotados aqui |
| **M2-6** | **Painel, publicar.** Construtora: "Publicar no site" e "Registrar publicação" (admin). Imobiliária: "publicando…" e "no ar", sem botão; avisos da §9 | testes do painel: "Publicar no site" só para admin e só em construtora; "Registrar" continua relendo o `estado.json` | testes verdes |
| **M2-7** | **Reverter**, no worker e no painel | o esquema do M2-5 com o par anterior; reverter sem anterior dá `blocked` | testes verdes |
| **M2-R** | **Build a partir da leitura fixada.** O `e2e_leitura` ganha a saída de build (tour + maquete + `manifest.json` em `b/<id>/<build>/`), com a sonda. **Precisa de especificação própria antes** (§16, pergunta 3) | o `tests/test_e2e_leitura.py` estendido; a matriz da prévia pelo gatilho da leitura | a imobiliária ligada vai da leitura fixada ao `published` com só a aprovação do gerente |
| **M2-8** | **Ligar de verdade**, depois do religar, com o site de imóveis no ar e com `estado.json`. `worker.yml`, provedor de identidade, conta de serviço e `users/worker`: cada um é ação em produção, com autorização | 1º: uma execução com fila vazia; conferir o log público. 2º: uma **prévia** do Cedros (imobiliária, desligada), parando em revisão interna, sem live. 3º: um ciclo inteiro, com os cliques do usuário | ciclo inteiro sem comando à mão; log sem dado sensível; anotar aqui o tempo real |
| **M2-9** | **Depois, se precisar:** cópia no servidor (§14, perto de ~15 imóveis); plano B no Cloud Run (§11) | cada um com o seu teste | — |

**Depende de:** a pilha #86→#91 na `main` (o `agencies.kind` é do #87); para o M2-8, também o
religar dos passos 1–4. O ciclo automático pela planta depende do M2-R. Nada do M2 depende do
plano Blaze, a não ser o plano B.

---

## 16. Perguntas para você decidir

1. **GitHub Actions ou Cloud Run Job?** A recomendação é Actions (§11). A troca é uma decisão,
   porque deixa produção nas mãos do GitHub e os logs ficam públicos, mesmo sem dado sensível.
2. **Construtora: entendi certo "o worker, no máximo, publica o pacote aprovado"?** A leitura
   adotada: na construtora, o admin clica "Publicar no site", o worker faz o deploy, e o admin
   registra. Nada vai ao ar sozinho. A outra leitura possível: o worker publica sozinho depois
   do gerente, como na imobiliária. Seria trocar uma linha da regra.
3. **M2-R: de onde vem o contexto do build pela leitura?** O `e2e_leitura` pede ficha, andar,
   cores e prédio (`CONTEXTO.json`), "declarado à parte e nunca deduzido da planta". Hoje isso
   não mora no Firestore. O tour precisa do lote no mapa da cidade. Sem essas duas respostas, o
   ciclo automático pela planta não fecha.
4. **O nome do campo:** `autoPublish`, com o rótulo "Publicação automática", segue as suas
   palavras. O comportamento real é "pular a revisão interna", porque a publicação depois do
   gerente é automática nos dois estados. Se preferir que o nome diga isso, a troca é barata
   agora e cara depois.
