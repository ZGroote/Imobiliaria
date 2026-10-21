# M2 — o worker do ciclo de publicação (especificação)

Proposta de 20/10/2026, revisada duas vezes no mesmo dia com decisões do usuário (§1, §16).
**Só documento: nada implementado, nada no ar, nenhum deploy.** Escrita sobre a pilha #86→#91
(`feat/cloud-run-preparo`, `dc3e121`). Cada incremento da §15 é um PR pequeno, revisado e
mergeado só com "MERGE AUTORIZADO". Ligar o worker em produção (M2-8) é uma ação à parte, com
autorização própria.

Base lida: [`tools/buildjob.mjs`](../../tools/buildjob.mjs), [proposta §2, §3, §6–§9](proposta.md),
[`firebase/firestore.rules`](../../firebase/firestore.rules), a linha do M2 no `tasks/README.md`
(da `liv-melhorado`), o [plano do religar](religar-2026-10-20.md) e o
[`deploy/README.md`](../../deploy/README.md). Os materiais que chegam com o pedido estão em
[materiais-da-solicitacao.md](materiais-da-solicitacao.md): arquivos de todo tipo, que o robô
processa um por vez e apaga; os dados do imóvel; o endereço que vira lote no mapa; e a revisão
do gerente com foto e áudio. A IA que gerencia a criação está em
[ia-da-criacao.md](ia-da-criacao.md), e o plano da conta com as vagas no ar em
[plano-no-ar.md](plano-no-ar.md).

Palavras usadas aqui:

- **worker** (o robô): o programa que roda sozinho, sem ninguém no teclado, os comandos que hoje
  o operador roda à mão.
- **job** (`buildJobs/{id}`): uma tarefa do robô, com estado (`pending`, `running`, ...).
- **trava com prazo** (em inglês, *lease*): um documento que diz "o robô X está trabalhando até
  tal hora". Se o robô morre, o prazo vence e outro pode assumir.
- **sinal de vida** (*heartbeat*): o robô renova o prazo da trava a cada minuto.
- **repetir não duplica** (*idempotente*): rodar o mesmo passo duas vezes dá o mesmo resultado
  que rodar uma.
- **portão**: uma conferência que recusa seguir quando algo não bate (hash, estado do site,
  regra).

---

## 0. Resumo

1. A equipe deixa de rodar comandos. O robô gera o build e a prévia, confere os bytes servidos,
   põe no ar o build aprovado e registra no painel.
2. **O caminho depende do tipo da conta** (§1):
   - **imobiliária: fluxo direto.** A prévia vai direto para o gerente. Se ele aprova, o robô
     publica e registra. Se ele pede revisão (texto, fotos e áudio), o pedido volta para a
     equipe revisar à mão;
   - **construtora: revisão interna sempre.** A equipe olha a prévia antes do gerente. Depois
     que o gerente aprova, o robô publica e registra.
3. **A aprovação do gerente é sempre humana.** Nada vai ao público sem o clique "Aprovar", e as
   regras do banco garantem isso: o robô não tem como aprovar.
4. **Portão que falha derruba o pedido para a revisão interna**, com o motivo registrado (§1.3).
5. **O robô escreve no pedido como um usuário do painel** (`users/worker`), pelo mesmo SDK do
   navegador. As mesmas regras de um clique valem para ele, e uma regra nova o impede de pular a
   revisão interna da construtora.
6. **Onde roda: GitHub Actions** (decidido em 20/10). São máquinas do GitHub, e o fluxo deixa de
   depender do seu computador, e funciona no plano Spark. **O repositório foi fechado em 20/10**
   (com o ok do usuário), então os minutos passam a contar: poucos dólares por mês na faixa
   esperada. O robô passa a ser acordado por evento, e não a cada 10 minutos
   ([ia-da-criacao.md](ia-da-criacao.md) §6). Limites e preços na §11.
7. **Os bytes ficam onde já estão.** Os builds no ar moram no site de imóveis, e o build em
   revisão mora no canal de prévia. O robô baixa e confere byte a byte.
8. **Uma trava só para tudo:** um robô por vez. Ela fecha a corrida na criação de jobs (a
   pendência do `buildjob.mjs`) e entre dois deploys do live (o `ponytail` da proposta §7).
9. **Custo zero dentro das cotas** (§14). O limite real é o tráfego do Hosting, 360 MB/dia
   divididos com os visitantes. Ele aperta perto de ~15 imóveis no ar, e o próximo passo para
   esse caso já está apontado.
10. **Dependência que precisa ficar clara:**
    - o ciclo automático começa na planta fixada, mas hoje o `e2e_leitura` só gera a maquete
      LEVE local. Não gera tour nem `manifest.json`, e pede dados do imóvel (ficha, andar,
      lote, cores);
    - esses dados vão sair dos materiais da solicitação: extraídos pelo robô, com o endereço
      virando lote no mapa sozinho ([materiais-da-solicitacao.md](materiais-da-solicitacao.md));
    - o **build a partir da planta (M2-R) e os materiais (MAT-4 a MAT-6) são pré-requisito** do
      ciclo automático;
    - até ele existir, o robô atende o fluxo legado (`pipelineUnitId`, como o Cedros), que
      começa no clique "Gerar prévia". Daí em diante, a mesma política por conta vale.

---

## 1. A política por tipo de conta (decisões do usuário, 20/10)

**Primeira decisão:** "imobiliária com botão de publicação automática por conta (desligado na
conta nova, cai para revisão interna se um portão falhar, aprovação do gerente sempre);
construtora com revisão interna sempre."

**Revisão, no mesmo dia:**
- o botão por conta saiu. A imobiliária vai direto, e só volta para a equipe "se o gerente pedir
  uma revisão (que contém um campo explicativo com envio de fotos, texto e áudio)";
- na construtora, o robô também publica sozinho depois da aprovação do gerente (resposta "B");
- mais tarde, um agente de IA pode inspecionar as casas geradas. Isso virou, ainda em 20/10, a
  IA que gerencia a criação inteira ([ia-da-criacao.md](ia-da-criacao.md)).

As etapas são as de hoje (`painel/src/lib/status.ts`): `production → internal_review →
agency_review → approved → published`.

| | Imobiliária | Construtora |
|---|---|---|
| Planta | a equipe desenha no capturador e fixa a leitura (PR #90) | produção artesanal (prédio, Tour em splat, várias rodadas, conferência visual) |
| Início do ciclo | a planta fixada com o pedido em `production` (M2-R), ou o clique "Gerar prévia" | só o clique "Gerar prévia", se a unidade usar o pipeline de imóveis |
| Prévia pronta | o robô registra a prévia e leva o pedido **direto para `agency_review`** | o robô registra a prévia e **para em `internal_review`**; a equipe olha e clica "Enviar para a construtora" |
| Gerente aprova | **o robô publica e registra** → `published` | **o robô publica e registra** → `published` |
| Gerente pede revisão | texto, fotos e áudio → **`internal_review`**; a equipe revisa à mão | igual |
| Portão falhou | `internal_review` + motivo | `internal_review` + motivo |

O que já é automático na construtora continua igual: estoque, preço e disponibilidade ao vivo
(`salesInventory`), "no ar" da vitrine, métricas e link por corretor. O site do LIV
(`imobilaria-deccb-miniaturas`) fica fora do robô. Só entra o que segue o contrato do site de
imóveis (`b/<id>/<build>/` + `manifest.json` + `estado.json`).

**O que se perde com o fluxo direto, dito com clareza:** na imobiliária, ninguém da equipe olha
a prévia antes do gerente. A proteção passa a ser:
- os portões automáticos (§13);
- o gerente, que aprova ou pede revisão;
- a IA que avalia cada prévia antes de ela seguir ([ia-da-criacao.md](ia-da-criacao.md) §4).

### 1.1 O que decide o caminho: o tipo da conta, sem botão

- **O caminho sai do `agencies/{id}.kind`**, que já existe (PR #87). Ausente vale como
  imobiliária. Não há campo novo na conta. Quem muda o tipo continua sendo só o admin, como
  hoje.
- **O pedido de revisão do gerente** troca o "Pedir ajuste" de hoje:
  - hoje, o "Pedir ajuste" leva o pedido para `production`, só com texto;
  - passa a levar para **`internal_review`**, com texto, fotos e áudio;
  - os anexos são materiais do pedido, e o detalhe está em
    [materiais-da-solicitacao.md](materiais-da-solicitacao.md) §7;
  - regra (M2-1): `managerDecision` aceita `agency_review → internal_review`, com o AuditLog
    da mudança listando o texto e os anexos;
  - a equipe é avisada no painel, como no aviso de pedido novo, e **um humano revisa** (por
    enquanto), preenchendo a ocorrência ([ia-da-criacao.md](ia-da-criacao.md) §7).

### 1.2 Como o robô decide o próximo status

O robô lê a conta **na hora da decisão**, nunca de cópia, e grava no job o tipo que leu
(`policy`). Assim a história diz por que ele foi para onde foi.

```text
prévia pronta e conferida (registra a prévia no mesmo write):
  imobiliária                  -> agency_review
  construtora                  -> internal_review

pedido em approved (só o gerente põe ali):
  qualquer conta               -> o robô publica; deu certo -> published (registra no mesmo batch de hoje)
                                  no ar só se houver vaga no plano; sem vaga, publicado e fora do ar (plano-no-ar.md)

qualquer portão falhou, em qualquer conta -> internal_review + motivo (§1.3)
```

**As regras do banco repetem essa política para o usuário do robô** (M2-1). Assim, um defeito
no robô não pula a revisão interna da construtora. Esboço:

```text
request.auth.uid != 'worker' || (
     (to() == 'internal_review' && from() in ['production', 'approved'])
  || (to() == 'agency_review'   && from() == 'production' && conta é imobiliária)
  || (to() == 'published'       && from() == 'approved'))
```

- O robô **não chega a `approved`**: `managerDecision` já exige o gerente.
- Em `properties` e `publications`, o robô só escreve a ação `publish`.
- Não pode reverter: reverter continua sendo clique do admin.

### 1.3 O motivo quando um portão derruba o pedido

Num só batch, pelas regras de hoje (`auditedAs`):

1. o pedido vai para `internal_review`;
2. o AuditLog `status:internal_review`, visível à imobiliária como toda mudança de status, leva
   só `{ status, jobId }`;
3. um segundo AuditLog, **interno**, `action: 'worker:retido'`, leva o motivo:
   `{ jobId, stage, code, message }`, por exemplo `CHANNEL_MISMATCH` com "o canal serve outro
   manifest.json".

O job guarda o mesmo `error`, e abre uma **ocorrência** para a equipe preencher com erro, causa e
solução ([ia-da-criacao.md](ia-da-criacao.md) §7). O painel mostra o motivo à equipe a partir
dos dois. A imobiliária
vê só "Revisão interna", como hoje, sem texto técnico.

Um pedido que cai de `approved` perde a aprovação na prática. Publicar exige `approved`, e só o
gerente volta o pedido para lá. Depois do conserto, o caminho é o normal: a prévia volta ao
gerente, ele aprova de novo, e o robô publica.

---

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| W1 | O robô é **um comando** (`node tools/worker.mjs rodar`), não um servidor | Roda igual no computador, no GitHub Actions ou num Cloud Run Job. Onde ele roda é um detalhe que se troca sem mexer na lógica |
| W2 | **Gatilhos:** a planta fixada e a aprovação do gerente, que são atos humanos deliberados e já auditados; e, para o resto, um **pedido de trabalho auditado** (AuditLog `worker:*`) gravado por um clique | A volta para `production` sozinha não dispara build: depois de uma revisão, o build só pode começar quando o conserto (planta nova ou merge) existir |
| W3 | **O robô escreve no pedido, no imóvel e na publicação como o usuário `users/worker`** (`platform_admin`), pelo SDK do navegador e com um token próprio. Pelo Admin SDK, ele só escreve no que é dele: `buildJobs` e `workerLeases` | Assim as mesmas regras de um clique conferem cada escrita, e uma regra a mais trava a política (§1.2). Pelo Admin SDK, as regras seriam ignoradas e virariam código repetido. **Desligar de emergência:** `users/worker.active = false` faz as regras negarem tudo o que ele escreve |
| W4 | **Uma trava global**: um robô trabalhando por vez, para todas as etapas | `ponytail:` trava única. O volume é de poucos imóveis por semana. Trava por imóvel só se a fila começar a esperar |
| W5 | O **site no ar guarda os builds publicados** e o **canal guarda o build em revisão** | A máquina do robô nasce vazia a cada execução. Os dois lugares já existem, e o `estado.json` e o `manifest.json` provam os bytes. O teto está na §14 |
| W6 | **O caminho sai do tipo da conta** (`kind`), e é conferido duas vezes: pelo robô e pelas regras | Decisão do usuário (§1). A regra é a autoridade |
| W7 | **Portão falhou: o pedido vai para `internal_review` com o motivo**, e não fica parado nem tenta de novo sozinho | Gente olha. Falha de infraestrutura tenta de novo até 3 vezes antes (§8) |
| W8 | O robô **nunca usa `--estado-vazio`** | Um `estado.json` ausente (404, site desligado) não pode virar "site vazio" e apagar os outros imóveis. A primeira publicação de um site vazio fica à mão, como no religar |
| W9 | **Build a partir da planta fixada só pelo `e2e_leitura`** (ou o que vier dele), nunca pelo `--cadastro` direto | Fronteira do M1-F. É o incremento M2-R |
| W10 | **Executar os scripts e reaproveitar as funções de hoje, não reescrevê-los** | `build_imovel.py` e `publicar_imovel.py` são os portões testados. As escritas do robô usam as funções que o painel já usa (`mudarStatus`, `lerPreview`, `registrarPublicacao`): o mesmo código e as mesmas regras de um clique |
| W11 | **Roda no GitHub Actions** (decidido em 20/10) | §11 |

---

## 3. Etapas, gatilhos e identidade

A **identidade** de um job é o id do documento `buildJobs/{id}`. Ela sai do fato que o
disparou, então o mesmo fato lido duas vezes vira o mesmo job (`create()` falha se o documento
já existe).

| Etapa | Gatilho | Identidade do job | Para quais contas |
|---|---|---|---|
| **extrair** | arquivo novo "na fila" em `requestAssets` | `extrair-<id do arquivo>` | todas ([materiais-da-solicitacao.md](materiais-da-solicitacao.md) §4) |
| **prévia automática** | pedido em `production` com a planta fixada (`productionInput`; a fixação é o AuditLog `production_input:set` de hoje) e os dados do imóvel fixados (`productionContext`) | `previa-<requestId>-<readingId>-<12 primeiros hex do sha256 dos dados>` (a mesma planta com os mesmos dados não gera build de novo) | todas, depois do M2-R |
| **prévia por clique** | AuditLog `worker:previa`, gravado pelo botão "Gerar prévia" (equipe) | o id desse AuditLog | todas (fluxo legado, gerar de novo) |
| **publicar** | pedido em `approved` (só o gerente põe ali) | `publicar-<id do AuditLog status:approved>` (cada aprovação, um job) | todas |
| **reverter** | AuditLog `worker:reverter` (admin) | o id desse AuditLog | todas |
| **cancelar** | AuditLog `worker:cancelar` (equipe; admin para reverter) | não cria job; marca o job alvo (§10) | todas |
| **retirar** | conta cancelada há 90 dias ([plano-no-ar.md](plano-no-ar.md) §3); o robô confere a cada varredura | `retirar-<propertyId>-<data do cancelamento>` | todas |

O pedido de trabalho por clique é um documento em `auditLogs`. A regra de criação de hoje já o
aceita, e o M2-1 a aperta: `worker:*` só da equipe, só com `visibility: 'internal'`, e
`reverter` só do admin.

```ts
{ agencyId, userId,                       // quem clicou (= request.auth.uid, pelas regras)
  entityType: 'request' | 'property' | 'buildJob', entityId,
  action: 'worker:previa' | 'worker:reverter' | 'worker:cancelar',
  visibility: 'internal', after: { ... }, timestamp }
```

Um pedido de trabalho com mais de 48 h e sem job é ignorado. O painel mostra "pedido expirado,
peça de novo".

### O que cada etapa confere e faz

| Etapa | O robô confere de novo, no momento | O que faz | Termina com |
|---|---|---|---|
| **prévia** | o autor do clique (se houver) está ativo e é da equipe. O pedido está em `production`, e vale o resto do `planejarBuildJob`: modo LEVE/PREMIUM, imóvel da mesma agência com `pipelineUnitId` ou `productionInput` | 1. monta o build **duas vezes**, em pastas separadas, e exige o mesmo build ID: `build_imovel.py <id> --modo <modo>` no legado, ou o M2-R. 2. `montar-preview`. 3. `hosting:channel:deploy imovel-<id> --expires 30d --json`. 4. Baixa `tour.html`, `maquete.html` e `manifest.json` do canal e confere os bytes. 5. Registra a prévia com `lerPreview` e o status da §1.2 | `build`, `manifestSha256`, `tourUrl`, `maqueteUrl`, `previewExpiresAt`, `commit`, `policy` |
| **publicar** | o pedido está em `approved`, com `approvedBuild` e `approvedManifestSha256`. O imóvel tem `pipelineUnitId` | 1. Baixa o `estado.json` do ar. 2. Reconstrói os builds no ar e traz o aprovado do canal. 3. `montar-live promover --estado <baixado> --manifest-aprovado <sha>`. 4. Portão de escopo (§13, portão 8). 5. Relê o `estado.json`. 6. `firebase deploy --only hosting:imoveis`. 7. Relê o `estado.json` até mostrar o novo. 8. `registrarPublicacao`, que relê o `estado.json` de novo | `stateBeforeSha256`, `stateAfterSha256`, `build`, `manifestSha256` |
| **reverter** | o imóvel tem `publishedBuild` e `previousBuild`; o ar mostra esse par; o manifest do anterior é o que o pedido anterior aprovou (a conferência de `conferirReversao`) | `montar-live reverter`, o mesmo portão de escopo, relê o estado e faz o deploy. O registro é do admin | os mesmos do publicar |

---

## 4. O BuildJob

O tipo cresce sem quebrar o que existe. Um job sem `stage` é um job manual de antes do M2.

```ts
export type BuildJobStage = 'extract' | 'preview' | 'publish' | 'rollback' | 'retire'
export type BuildJobStep = 'build' | 'channel' | 'check_channel' | 'register' | 'state' | 'assemble'
  | 'deploy' | 'check_live'

export interface BuildJob {               // buildJobs/{id}; escrita só pelo robô (Admin SDK)
  id: string                              // a identidade da §3
  stage?: BuildJobStage                   // ausente = job manual anterior ao M2
  trigger?: 'reading' | 'approval' | 'click'
  requestId?: string                      // rollback não tem pedido
  propertyId: string; pipelineUnitId?: string; agencyId: string
  productionMode?: ProductionMode
  requestedBy?: string; createdBy: string // createdBy = quem clicou, ou 'worker' no gatilho automático
  policy?: { kind: 'imobiliaria' | 'construtora' }   // lido na decisão
  status: BuildJobStatus                  // pending | running | succeeded | blocked | failed | cancelled
  attempt: number                         // 1, 2 ou 3
  step?: BuildJobStep                     // onde está ou onde parou
  lease?: { owner: string; expiresAt: Timestamp }
  heartbeatAt?: Timestamp
  cancelRequested?: boolean
  commit?: string                         // a main que o robô usou
  build?: string; manifestSha256?: string
  tourUrl?: string; maqueteUrl?: string; previewExpiresAt?: Timestamp
  stateBeforeSha256?: string; stateAfterSha256?: string
  nextStatus?: RequestStatus              // para onde o robô levou o pedido
  error?: { code: string; message: string }
  startedAt?: Timestamp; finishedAt?: Timestamp
  lastAuditId?: string
  createdAt: Timestamp; updatedAt: Timestamp
}
```

**Estados do job:**

```text
pending ──(o robô assume)──> running ──> succeeded
   │                           │  ├────> blocked    um portão recusou; o pedido vai para internal_review (§1.3)
   │                           │  ├────> failed     infraestrutura falhou 3 vezes; o pedido vai para internal_review
   │                           │  └────> cancelled
   │                           └─(o prazo venceu)─> reconciliação (§9): succeeded, nova tentativa ou failed
   └──(cancelar)──> cancelled
```

Estado final não volta. "Tentar de novo" é um job novo: um clique, uma planta nova ou uma
aprovação nova.

**Códigos de erro** (`error.code`; a mensagem vai no job e no AuditLog interno, nunca no log
público, §11):

- `blocked`:
  - `NOT_STAFF`, `NOT_ADMIN`, `WORKER_INACTIVE` (o desligamento de emergência);
  - `REQUEST_CHANGED`: o pedido saiu do estado esperado;
  - os de `planejarBuildJob` (`PIPELINE_UNIT_REQUIRED`, `AGENCY_MISMATCH`, ...);
  - `PRODUCTION_INPUT_UNSUPPORTED`: só planta fixada, antes do M2-R;
  - `CONTEXT_INVALID`: os dados do imóvel não passam na validação do `e2e_leitura` (M2-R);
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
  - com outro `owner`: a trava foi perdida, e o robô **para na hora, sem nenhum efeito a mais**
    (`LEASE_LOST`).
- **Antes de cada efeito externo** (deploy do canal, deploy do live, escrita no pedido): uma
  transação confere `owner == eu` e pelo menos 10 min de prazo, e relê o pedido e a conta. O
  deploy leva ~1–2 min (medir no M2-5).
- **Soltar** no fim, numa transação: só apaga se `owner == eu`.
- **Criar job, assumir job e encerrar job** acontecem com a trava na mão. Assim a criação é
  feita uma de cada vez, e a regra "um job ativo por pedido" (`ACTIVE_BUILDJOB_EXISTS`) deixa
  de ter corrida. Hoje a consulta roda antes do batch e não garante isso (proposta §9).
- **Relógio:** o da máquina do robô, sincronizado por NTP. A margem de 15 min cobre a diferença
  entre relógios.
- No GitHub Actions, `concurrency: worker-imoveis` também impede duas execuções juntas. É
  proteção a mais; a autoridade é a trava.

**Uma execução:**

1. Olha, sem trava, se há trabalho: pedidos de trabalho novos, plantas fixadas sem job, pedidos
   `approved` sem job, jobs `pending`, jobs `running` com sinal de vida velho. Se não há,
   termina sem escrever nada.
2. Se há, pega a trava e reconcilia (§9).
3. Cria os jobs novos.
4. Processa os `pending` em ordem de criação até ~45 min de relógio.
5. Solta a trava. O que sobrar fica para a próxima execução.

---

## 6. A identidade do robô no banco

- **Usuário:** `users/worker` = `{ name: 'Worker', role: 'platform_admin', active: true, ... }`.
  É criado uma vez, pelo Admin SDK, no M2-8, com autorização. No histórico, as ações dele
  aparecem como "Worker".
- **Login:** o Admin SDK cria um token próprio (`createCustomToken('worker')`). O robô entra
  com ele no SDK do navegador (`signInWithCustomToken`), com a configuração pública do painel.
  Daí em diante, cada escrita em `requests`, `properties`, `publications` e `auditLogs` passa
  pelas regras com `request.auth.uid == 'worker'`.
- **Por que `platform_admin`:** registrar a publicação exige `isAdmin()` (`publishedAs`, bloco
  `publications`). As regras do M2-1 limitam o que esse admin pode fazer (§1.2). O robô não
  aprova e não reverte.
- **Desligar de emergência**, pelo painel, sem deploy: o admin põe `users/worker` como inativo.
  As regras passam a negar as escritas dele, e os jobs terminam `blocked` com `WORKER_INACTIVE`.
  Para parar de vez, desligar também o workflow (§10).
- **Limite, dito com clareza:** a regra nova é proteção contra **defeito** do robô, não contra
  roubo da credencial. Quem tiver a conta de serviço tem o Admin SDK, que ignora regras (§11).

---

## 7. O que muda para quem usa o painel

| Passo | Hoje | Com o robô |
|---|---|---|
| Aceitar e pôr em produção | admin clica | **igual** |
| Materiais e dados do imóvel | e-mail, WhatsApp | chegam com a solicitação, em qualquer formato ([materiais-da-solicitacao.md](materiais-da-solicitacao.md)) |
| Planta | a equipe desenha e fixa (PR #90) | **igual**; fixar a planta com o pedido em produção já dispara a prévia (M2-R) |
| Build + prévia | alguém roda 3 comandos | automático pela planta, ou o botão **"Gerar prévia"** (equipe) |
| Registrar a prévia | o admin **cola a URL** | o robô registra. Na imobiliária, o pedido vai direto para o gerente. Na construtora, para em "Revisão interna", e a equipe clica **"Enviar para a construtora"**, que relê os bytes servidos (`lerPreview`) |
| Aprovar | gerente | **igual, sempre** |
| Pedir revisão | gerente, só texto, volta para produção | gerente, com **texto, fotos e áudio**; volta para **"Revisão interna"** |
| Pôr no ar e registrar | alguém roda `montar-live` + deploy; admin confere e registra | **automático depois da aprovação**, nas duas contas |
| Reverter | comandos + admin registra | o admin clica **"Voltar ao build anterior"**; o robô faz; o admin registra |
| Portão falhou | o operador vê o erro no terminal | o pedido aparece em "Revisão interna" com o motivo, só para a equipe |

Enquanto o robô estiver desligado, o painel continua mostrando os comandos à mão, como hoje,
dentro de "Sem o robô". Antes de rodar à mão, desligue o robô (§10).

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
15 min. São jobs de um robô que morreu.

| Etapa do job morto | O que o robô olha | Decisão |
|---|---|---|
| prévia | o pedido: se já tem esta prévia registrada, terminou | registrado: `succeeded`. Se não: recomeça com `attempt + 1`, ou `failed` se já era a 3ª |
| publicar | o `estado.json` do ar, agora | (a) mostra `approvedBuild` com `approvedManifestSha256`: **o deploy aconteceu**. Registra se faltar (§8), e o job vira `succeeded` sem novo deploy. (b) o sha256 dele é o `stateBeforeSha256` do job: **nada aconteceu**, então recomeça. (c) é outra coisa: `blocked` com `STATE_CHANGED`, e o pedido vai para `internal_review` |
| reverter | o mesmo, com o par anterior | o mesmo, sem registrar (é do admin) |

Ficam com o painel, que calcula a partir do job e do pedido:

- pedido de trabalho com mais de 48 h e sem job: "expirou";
- prévia com `previewExpiresAt` a menos de 5 dias: "a prévia vence em X dias";
- fato gatilho sem job há mais de 30 min: "a fila está parada". Ver o Actions (§11).

O Firestore e o Hosting continuam sem transação conjunta. O job é a ponte, e o `estado.json`
relido no registro continua sendo a autoridade. Isso reduz a janela do `ponytail` de
`publicar.ts` ("na Fase 2, um BuildJob no servidor coordena a promoção e o registro"), mas não a
fecha: a leitura do registro continua sendo a autoridade.

---

## 10. Cancelar e desligar

- **Job `pending`**: vira `cancelled` na próxima execução.
- **Job `running`**: a cada sinal de vida, o robô procura um `worker:cancelar` para o job dele.
  Achou: marca `cancelRequested` e para na próxima fronteira de passo, antes de qualquer efeito
  externo novo. O pedido fica onde está; cancelar não é portão falhando.
- **Depois que o deploy do live começou, não se cancela.** O deploy termina e é conferido. Se o
  ar mudou, o caminho de volta é "Voltar ao build anterior".
- **Cancelamento implícito:** se o pedido sair do estado esperado (por exemplo, `production` →
  `cancelled`, ou o gerente pede revisão), a conferência antes do efeito externo dá
  `REQUEST_CHANGED`, e o job termina sem mexer no pedido.
- **Desligar o robô** (para rodar à mão ou numa emergência): `gh workflow disable worker.yml`,
  e, se for urgente, `users/worker` inativo (§6). Religar: `gh workflow enable worker.yml`.

---

## 11. Onde roda: GitHub Actions (decidido em 20/10)

`.github/workflows/worker.yml`. O robô roda em máquinas do GitHub. **Seu computador deixa de
fazer parte do ciclo.** Ele só entra em três casos:

- a instalação, uma vez (M2-8);
- a primeira publicação de um site vazio (W8);
- emergências.

**Repositório fechado em 20/10**, com o ok do usuário, antes de qualquer cliente subir arquivo.
O CI de hoje já gasta ~1.300 minutos por mês (medido). Os números com o robô, o gatilho por evento no lugar da varredura
de 10 em 10 minutos e o porquê estão em [ia-da-criacao.md](ia-da-criacao.md) §6.

### Teto e preço (documentação do GitHub, conferida em 20/10)

| Item | Com o repositório **público** (até 20/10) | Com o repositório **privado** (desde 20/10) |
|---|---|---|
| Minutos de máquina | **sem limite e sem custo** com os runners padrão | 2.000 por mês grátis no plano Free; depois, **US$ 0,006 por minuto** (Linux, 2 núcleos) |
| Tempo máximo de uma execução | 6 h (o robô usa no máximo 60 min) | igual |
| Execuções ao mesmo tempo | 20 no plano Free (o robô usa 1) | igual |
| Armazenamento de artefatos | o robô não usa | 500 MB grátis |
| Passou da cota sem cartão cadastrado | — | o GitHub **bloqueia** até o mês seguinte; com cartão, cobra até o orçamento que você definir |

Conta, caso o repositório vire privado:

- olhando a fila a cada 10 min, o dia inteiro: ~4.300 min por mês, o que passa da cota em ~2.300
  min e dá **~US$ 14 por mês**, mais o tempo dos builds;
- olhando de 30 em 30 min, só em horário comercial: ~600 min por mês, **de graça**.

**O que continua com limite, e não é do GitHub:** o Firebase. O tráfego do Hosting (360 MB/dia)
e as cotas do Firestore são os mesmos de hoje (§14).

### Como ele roda

- **Por quê o GitHub:**
  - `ZGroote/Imobiliaria` era público quando a escolha foi feita, e foi fechado em 20/10. Os
    minutos agora contam, e a conta está na tabela acima;
  - o checkout da `main` já é "o repositório com os dados": as 150 entradas do build, os 239
    tiles e o `pagina_maquete.py`. O PREMIUM do Cedros lê `geometry-compact.json` e
    `lightmap.rgbm.gz`, que estão no git, e não os `source.json` do repositório privado de
    artefatos;
  - Python 3.14 e Node 24 já sobem no CI (`.github/workflows/ci.yml`);
  - `firebase-tools`, `firebase-admin` e `firebase` vêm do `package.json` da raiz;
  - nada disso depende do Blaze.
- **Gatilho** (mudou com o repositório fechado):
  - **por evento:** uma função pequena no Firebase acorda o robô (`repository_dispatch`) quando
    há trabalho: arquivo novo, pedido de trabalho, planta fixada, aprovação. Ela precisa do
    Blaze, que os arquivos já pedem ([ia-da-criacao.md](ia-da-criacao.md) §6);
  - **varredura de segurança a cada 2 h** (`schedule`), para pegar o que um evento perder;
  - `workflow_dispatch` para rodar na hora, à mão;
  - **até o Blaze**, sem a função: varredura a cada 30 min só em horário comercial (~600
    minutos por mês), para caber na cota junto com o CI;
  - como tudo fica no Firestore, uma execução atrasada ou pulada só adia o trabalho.
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
    - `roles/storage.objectAdmin` **só no bucket dos materiais**, para baixar o arquivo de até
      2 GB direto para o disco, gravar as imagens leves e apagar o original depois da extração
      ([materiais-da-solicitacao.md](materiais-da-solicitacao.md) §4). O registro de cada
      passo vai pelas regras, como `users/worker`;
    - ficam de fora, de propósito, o `firebaseauth.admin` e o `run.viewer` da lista da action:
      o domínio da prévia não precisa de login, e o site de imóveis não tem rewrite para o Cloud
      Run;
    - o primeiro deploy de canal do M2-8 confirma a lista. Também confirma se a identidade sem
      chave funciona com o projeto no Spark;
  - o painel não ganha segredo nenhum.
- **Os limites dessas credenciais, ditos com clareza:**
  - `datastore.user` vale para o banco inteiro, porque o IAM não separa por coleção. A regra do
    robô (§1.2) só vale para o que ele escreve como `users/worker`. Pelo Admin SDK, quem segura
    é um teste que falha se o robô escrever, por ali, fora de `buildJobs`, `workerLeases` e dos
    AuditLogs dos jobs (M2-2);
  - `firebasehosting.admin` vale para todos os sites do projeto (mapa, painel, miniaturas/LIV e
    imóveis). Quem segura é um teste que falha se algum comando montado não tiver
    `--config firebase.imoveis.json` e `--only imoveis` / `hosting:imoveis` (M2-3);
  - quem tem escrita na `main` muda o que o robô faz. Isso já vale hoje para o que vai ao ar; a
    proteção continua sendo o ritual de PR com "MERGE AUTORIZADO".
- **O registro das execuções do Actions**, agora visível só para quem tem acesso ao
  repositório. A regra continua, porque o registro é guardado e repassado:
  - o robô imprime só: id do job, etapa, passo, slug do imóvel, build, sha e código de erro;
  - nunca nome de imobiliária, título de pedido, e-mail, nota, motivo por extenso ou mensagem do
    Firestore;
  - o detalhe vai para o job e para o AuditLog interno, que só a equipe lê;
  - um teste (M2-3) roda com textos "sensíveis" de propósito e falha se eles aparecerem na
    saída.
- **Riscos:**
  - **sem cartão no GitHub, ao passar dos 2.000 minutos do mês, o Actions para**, o CI junto.
    O CI sozinho gasta ~1.300. Com o robô, cadastrar um cartão com teto de gasto, ou cair para
    o plano B;
  - o aviso "a fila está parada" (§9) mostra quando o robô não roda.

### Plano B: Cloud Run Job (com o Blaze ativo)

- O mesmo `node tools/worker.mjs rodar` numa imagem Python 3.14 + Node 24, igual ao
  `deploy/leituras.Dockerfile`, com o repositório de uma `main` conhecida.
- Job em `southamerica-east1`, com a conta de serviço anexada (sem chave).
- **Custo:** a cota grátis de jobs fica na casa de 200 mil vCPU-s por mês; conferir na página
  oficial antes de ligar. Olhar a fila a cada 10 min (30 s com 2 vCPU) daria ~260 mil vCPU-s
  por mês e estouraria sozinho. Lá, seria preciso olhar de 30 em 30 min, ou ter um serviço
  pequeno que acorda o job.
- **Outro custo:** uma imagem nova a cada merge que mude dados ou pipeline.
- **Quando trocar:** se o repositório virar privado e a conta do GitHub não compensar, ou se o
  registro público das execuções deixar de ser aceitável.

---

## 12. O que continua manual, de propósito

- **A planta**, que a equipe desenha no capturador e fixa. O ciclo automático começa nela.
- **A aprovação ou o pedido de revisão do gerente.** Sempre. Nada vai ao público sem o clique
  "Aprovar".
- Aceitar o pedido e pô-lo em produção.
- A revisão interna: na construtora, sempre; na imobiliária, quando o gerente pede revisão ou um
  portão falha.
- A produção artesanal da construtora (splat, rodadas de treino, conferência visual), fora do
  robô.
- Reverter e registrar a reversão (admin).
- A **primeira publicação** de um site vazio (`--estado-vazio`) e qualquer religar/desligar do
  site (`SITE_DISABLE`). Ficam à mão, com autorização (W8 e o
  [plano do religar](religar-2026-10-20.md)).
- Ligar, desligar e mudar credenciais do robô.

---

## 13. Os portões de hoje continuam valendo

| # | Portão | Onde mora hoje | No M2 |
|---|---|---|---|
| 1 | `mirra-114` não se publica | `NAO_PUBLICAR` em `build_imovel.py` e `confere_build` | o robô chama os mesmos scripts: `blocked` com `NAO_PUBLICAR` → revisão interna |
| 2 | build = conteúdo; pasta nunca sobrescrita; fonte estável durante a montagem | `build_imovel.py` | igual, e **mais**: duas montagens têm de dar o mesmo build ID (`BUILD_NOT_REPRODUCIBLE`) |
| 3 | sem rebaixar PREMIUM para LEVE em silêncio | `modo_producao` + `--modo` | o robô passa o `productionMode` do pedido; sem modo, `blocked` |
| 4 | a maquete representa a planta | a sonda do `e2e_leitura` (M1-F, F2) | no caminho da planta fixada (M2-R), `PROBE_MISMATCH`. O legado não tem sonda |
| 5 | identidade da prévia = sha256 dos **bytes servidos** do manifest | `montar-preview` devolve `manifest_sha256`; o painel calcula em `lerPreview` | o robô confere os bytes servidos e registra com `lerPreview`, a mesma função do painel. Na construtora, o "Enviar" da equipe relê de novo |
| 6 | só o gerente aprova, e exatamente o par do preview | regras: `managerDecision` | igual: o usuário `worker` não passa nessa regra |
| 7 | promover só o artefato aprovado | `montar-live --manifest-aprovado` recusa manifest local diferente | o robô lê `approvedBuild`/`approvedManifestSha256` no começo e de novo logo antes do deploy. O build vem do canal e é conferido contra o sha aprovado e contra o próprio manifest **antes** do `montar-live`, que confere outra vez |
| 8 | promover X não mexe em Y | só teste (`test_promoting_x_keeps_y_byte_for_byte`), sem conferência na hora | **portão novo, na hora:** compara o `arquivos` do `estado.json` do ar com o do novo. Só podem mudar `b/X/…`, `imovel/X`, `maquete/X`, `index.html`, `imoveis.json` (o ponto no mapa geral, [materiais](materiais-da-solicitacao.md) §6.1), `quintais/<conjunto novo>/…` e a saída do antigo `anterior` de X. Na etapa **retirar** ([plano-no-ar.md](plano-no-ar.md) §3), só a saída de tudo o que é de X. Qualquer outra diferença dá `OUT_OF_SCOPE`, com a lista. Exemplo real: uma mudança no `vitrine_ao_vivo.js` mudaria o ponteiro de Y. Isso vira decisão de alguém, não efeito colateral |
| 9 | o `estado.json` é o **do ar**, não uma cópia | o operador baixa à mão | o robô baixa sem cache. Os builds no ar baixados são conferidos contra ele (`_confere_contra_estado`). **Logo antes do deploy, relê** e aborta com `STATE_CHANGED` se mudou, o que pega até um deploy à mão no meio-tempo. 404 ou formato errado dá `STATE_UNREADABLE`, nunca "vazio" |
| 10 | registrar só com o artefato aprovado no ar | `conferirPublicacao` relê o `estado.json` | igual: o robô usa a mesma `registrarPublicacao` |
| 11 | regras do Firestore | `firebase/firestore.rules` | iguais para todo mundo, inclusive o `worker`, que entra como usuário. Ganham a política por conta (§1.2), a revisão do gerente para `internal_review` (§1.1) e a trava do pedido de trabalho `worker:*` |
| 12 | o site de imóveis é isolado dos outros | `firebase.imoveis.json`, `--only` | o robô só monta esses comandos, com teste (§11) |

---

## 14. Custo dentro das cotas gratuitas

| Item | Cota grátis | Uso esperado |
|---|---|---|
| GitHub Actions | 2.000 minutos por mês com o repositório privado (desde 20/10); depois, US$ 0,006 por minuto (§11) | o CI já gasta ~1.300 (medido); o robô, ~30 a 50 min por pedido, a medir. A conta por volume está em [ia-da-criacao.md](ia-da-criacao.md) §6 |
| Firestore (Spark) | 50 mil leituras e 20 mil escritas por dia | execução vazia: ~5 leituras e nenhuma escrita, ~720 leituras/dia. Por job: ~20 escritas (criar, assumir, ~10 sinais de vida, pedido + 2 AuditLogs, encerrar) |
| Authentication | login por token próprio sem custo | uma entrada por execução com trabalho |
| Hosting, armazenamento | 10 GB | por imóvel no ar: 2 builds de ~19 MB (tour ~15 MB, maquete 3,3–4,0 MB) mais os ponteiros; os 239 tiles (17 MB) são um conjunto só. Dá ~250 imóveis. Conferir no M2-8 quanto as versões antigas guardadas pelo Hosting e os canais de prévia (~19 MB cada) somam, e limitar a retenção se precisar |
| **Hosting, tráfego** | **360 MB por dia, dividido com os visitantes** | estimativa abaixo |

Os materiais da solicitação (arquivos de obra, fotos, áudio) moram no Storage, que tem cota e
custo próprios: [materiais-da-solicitacao.md](materiais-da-solicitacao.md) §9.

Estimativa do tráfego do robô:

- **Pedir compressão é obrigatório.** O robô baixa com `Accept-Encoding: gzip`. Medido aqui: a
  maquete de 4,0 MB cai para 688 KB em gzip. A compressão do tour não foi medida; a estimativa é
  ~4 MB, e o número certo sai do M2-5.
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
  visitantes: ~5 MB por tour aberto, ~70 tours por dia. O robô é pequeno perto disso.

---

## 15. Incrementos

Cada um é um PR pequeno, com teste que roda no emulador (`firebase emulators:exec --only
auth,firestore`, o mesmo padrão de `npm run test:painel`). O Auth do emulador aceita o token
próprio do `users/worker` sem assinatura.

**A matriz da política** aparece em vários incrementos:

| Conta | Prévia pronta | Portão falha na prévia | Gerente aprova | Gerente pede revisão | Portão falha ao publicar |
|---|---|---|---|---|---|
| imobiliária | `agency_review` | `internal_review` + motivo | o robô publica e registra → `published` | `internal_review` com texto e anexos | `internal_review` + motivo, sem `published` |
| construtora | `internal_review`; o "Enviar" da equipe → `agency_review` | `internal_review` + motivo | o robô publica e registra → `published` | `internal_review` com texto e anexos | `internal_review` + motivo |

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **M2-1** | **Contrato e regras.**<br>• `BuildJob` ampliado (§4) em `types.ts` e na proposta §3.<br>• Política do `worker` em `requests`, `properties` e `publications` (§1.2).<br>• Revisão do gerente para `internal_review` (§1.1).<br>• `worker:*` só da equipe e interno; `reverter` só do admin.<br>• `workerLeases` (equipe lê, ninguém escreve).<br>• Índice `auditLogs (action, timestamp)` | `regras.test.mjs`:<br>• `worker` em `production → agency_review`: só passa em imobiliária;<br>• `worker` em `approved → published`: passa nas duas;<br>• `worker` → `approved`: sempre negado;<br>• `worker` em `production`/`approved → internal_review`: passa;<br>• `worker` reverter: negado;<br>• `worker` inativo: tudo negado;<br>• gerente: `agency_review → internal_review` passa, com o AuditLog do texto e dos anexos;<br>• os casos de `worker:*` | testes verdes, e cada regra quebrada de propósito é pega (o padrão da T03) |
| **M2-2** | **Trava, fila e identidade, sem build.**<br>• `tools/worker.mjs`: pegar, renovar e soltar a trava.<br>• As identidades da §3, com `create`.<br>• `planejarBuildJob` reaproveitado.<br>• Cancelar `pending`; reconciliar trava vencida.<br>• Lista fechada do que escreve pelo Admin SDK.<br>• `tools/buildjob.mjs criar` passa a gravar um `worker:previa`: um caminho só para criar job | relógio falso no emulador. **Prova de concorrência:**<br>• dois robôs ao mesmo tempo, só um pega a trava;<br>• o mesmo fato lido duas vezes dá um job;<br>• aprovar duas vezes dá dois jobs;<br>• trava vencida é assumida;<br>• quem perde a trava para antes do passo seguinte;<br>• escrita fora da lista falha o teste | testes verdes no `test:painel`, que o CI já roda (como os do `buildjob`) |
| **M2-3** | **Prévia do legado, com deploy falso.**<br>• Os scripts de verdade num repositório de teste.<br>• O "canal" é uma pasta servida por um HTTP local; a conferência dos bytes é a de verdade.<br>• Montagem dupla.<br>• Decisão do próximo status e motivo (§1.2, §1.3) como `users/worker` | **a matriz** nas colunas "prévia pronta" e "portão falha na prévia", para as duas contas.<br>Os portões:<br>• `CHANNEL_MISMATCH`;<br>• `BUILD_NOT_REPRODUCIBLE` (montagem falsa que muda);<br>• `NAO_PUBLICAR`;<br>• `REQUEST_CHANGED`;<br>• `PRODUCTION_INPUT_UNSUPPORTED`.<br>O motivo sai no AuditLog interno, e o de status não leva texto técnico. Comandos sempre com `--config firebase.imoveis.json`. Textos sensíveis não aparecem na saída | testes verdes; nenhum deploy real |
| **M2-4** | **Painel, prévia e revisão.**<br>• "Gerar prévia".<br>• Cartão do job (fila, rodando, último sinal, pronto, motivo em português).<br>• "Enviar para a construtora" a partir de `internal_review`.<br>• "Pedir revisão" do gerente: só texto até o Storage existir; fotos e áudio no MAT-7.<br>• Comandos à mão em "Sem o robô" | testes do painel no emulador:<br>• o motivo só aparece para a equipe;<br>• "Enviar" relê com `lerPreview`;<br>• "Pedir revisão" leva a `internal_review` e avisa a equipe | testes verdes; tela conferida no `painel:dev` |
| **M2-5** | **Publicar, com "ar" e deploy falsos.**<br>• `estado.json`, reconstrução, build do canal, `montar-live`, portão de escopo, deploy, releitura.<br>• `registrarPublicacao` como `worker`.<br>• Medir tempo e memória | **a matriz** nas colunas "gerente aprova" e "portão falha ao publicar", para as duas contas.<br>**Prova de falhas:**<br>• `APPROVAL_MISMATCH`;<br>• `STATE_UNREADABLE` (404 nunca vira vazio);<br>• `STATE_CHANGED`;<br>• `OUT_OF_SCOPE`;<br>• `PREVIEW_GONE`;<br>• **o robô morre depois do deploy:** a execução seguinte registra e marca `succeeded`, sem novo deploy;<br>• **morre antes:** recomeça;<br>• 3ª falha dá `failed` → `internal_review` | testes verdes; tempo e memória anotados aqui |
| **M2-6** | **Painel, publicação.** "Publicando…", "no ar" e o motivo de uma falha, sem botão de publicar; avisos da §9 | testes do painel: o cartão acompanha o job; nenhuma conta vê botão de publicar | testes verdes |
| **M2-7** | **Reverter**, no robô e no painel | o esquema do M2-5 com o par anterior; reverter sem anterior dá `blocked` | testes verdes |
| **M2-R** | **Build a partir da planta fixada.**<br>• O `e2e_leitura` ganha a saída de build (tour + maquete + `manifest.json` em `b/<id>/<build>/`), com a sonda.<br>• Lê os dados do imóvel fixados no pedido, inclusive o lote vindo do endereço ([materiais-da-solicitacao.md](materiais-da-solicitacao.md) §5 e §6).<br>• O tour recorta o mapa em volta desse lote, sem mexer no dado da cidade no git.<br>• **Precisa de especificação própria antes** | o `tests/test_e2e_leitura.py` estendido; o gatilho da planta (veio do M2-2 para cá: a mesma planta fixada de novo não gera job); a matriz da prévia por esse gatilho; `CONTEXT_INVALID` | a imobiliária vai da planta fixada ao `published` com só a aprovação do gerente |
| **M2-8** | **Ligar de verdade**, depois do religar, com o site de imóveis no ar e com `estado.json`. `worker.yml`, provedor de identidade, conta de serviço e `users/worker`: cada um é ação em produção, com autorização | 1º: uma execução com fila vazia; conferir o registro público. 2º: uma **prévia** do Cedros (imobiliária), que vai ao gerente sem live. 3º: um ciclo inteiro, com os cliques do usuário | ciclo inteiro sem comando à mão; registro sem dado sensível; anotar aqui o tempo real |
| **M2-9** | **Depois, se precisar:** cópia no servidor (§14, perto de ~15 imóveis); plano B no Cloud Run (§11) | cada um com o seu teste | — |
| **M2-10** | **A IA gerente** (decidido em 20/10): ler, rascunhar a planta, avaliar a prévia, diagnosticar falha. Os incrementos IA-1 a IA-8 estão em [ia-da-criacao.md](ia-da-criacao.md) §8; o IA-1 (o gatilho por evento; o repositório já foi fechado) vem antes do M2-8 | o modo sombra e os conjuntos de referência de lá | a decisão ligada etapa por etapa, com os números |

**Andamento:**

- **M2-1 (20/10), em PR, sem deploy das regras.**
  - Política do `worker` em pedido, imóvel e publicação.
  - Gerente pede revisão para `internal_review`, e `production` continua valendo até o painel
    mudar no M2-4.
  - `worker:*` só da equipe e interno.
  - `workerLeases`, índice `auditLogs (action, timestamp)` e o tipo `BuildJob` da §4.
  - A mais, o robô não grava conta, usuário, convite, imóvel novo nem pedido novo.
  - **Testes:** 8 testes novos (52 de regras no total, todos passando).
  - **Quebra de propósito:** 16 de 16 regras novas, todas pegas.
  - **Ficam de fora, de propósito:** a `vitrine` (o PL-3 precisa que o robô grave nela) e o
    estoque (`salesInventory`), que o robô não toca.
- **M2-2 (20/10), em PR, sem nada no ar.**
  - `tools/worker.mjs`: a trava, os jobs a partir dos fatos (pedido de prévia, aprovação, pedido
    de reversão), o cancelamento, a reconciliação de job sem sinal de vida e as 3 tentativas.
  - As etapas são executores passados de fora; ainda não há nenhum.
  - `tools/buildjob.mjs criar` grava o pedido `worker:previa`; só o robô cria job.
  - **O gatilho pela planta fixada foi para o M2-R:** sem o build pela planta, ele só criaria
    job que não tem como rodar.
  - **Testes:** 11 no emulador (`painel/tests/worker.test.mjs`) e os 3 do `buildjob`
    atualizados.
  - **Quebra de propósito:** 15 de 15 trechos críticos, todos pegos.
- **M2-3 (20/10), em PR, sem nada no ar.**
  - `tools/worker_previa.mjs`, a etapa de prévia do fluxo legado:
    - monta duas vezes, em pastas separadas, e exige o mesmo build;
    - roda o `montar-preview`, sobe no canal e confere os bytes servidos;
    - registra a prévia como `users/worker`, com o próximo status pela conta.
  - Portão que falha leva o pedido à revisão interna, com o motivo num log interno. Pedido que
    mudou não é tocado.
  - `painel/src/lib/robo.ts` traz as escritas do robô no pedido; `painel/scripts/robo.mjs`, a
    entrada como `users/worker` por token próprio.
  - O `build_imovel.py` e o `montar-preview` aceitam `--builds` e `--site`.
  - O canal de verdade (`firebase hosting:channel:deploy`) está escrito e testado só no comando;
    a primeira subida de verdade é no M2-8.
  - **Defeito achado no caminho:** o build de todo tour falhava desde o #88 (vitrine antes do
    `</body>`, que o tour não tem). Foi consertado no PR #95, sobre o #91, e trazido para cá.
  - **Testes:** 10 no emulador com os scripts reais (`painel/tests/previa.test.mjs`, ~4 min) e 1
    do "ao falhar" no `worker.test.mjs`. O `test:painel` passa a levar ~7 min.
  - **Quebra de propósito:** 16 de 16 trechos pegos.
- **M2-4 (20/10), em PR, sem nada no ar.**
  - **Cartão "Robô" no pedido, só da equipe:**
    - os trabalhos ao vivo: na fila, rodando com o passo e o último sinal de vida, pronto, ou
      parado com o motivo em português;
    - "Gerar prévia" (grava o `worker:previa`) e "Cancelar" (grava o `worker:cancelar`).
  - **Na revisão interna**, "Enviar para a revisão do cliente" relê a prévia no canal antes de
    enviar.
  - **O gerente "Pede revisão"** (antes "Pedir ajuste"): o pedido vai para a revisão interna,
    com o texto no histórico.
  - **O menu avisa a equipe** dos pedidos na revisão interna, ao lado dos pedidos novos.
  - **O registro da prévia à mão** fica fechado em "Sem o robô".
  - Um fato que não passa na criação do job (por exemplo, imóvel sem o id do pipeline) não mexe
    no pedido: o motivo aparece no cartão, para quem clicou.
  - **Testes:** 5 no emulador (`painel/tests/robo.test.ts`) e o de aprovação atualizado.
  - **Quebra de propósito:** 6 de 6 trechos pegos (o do motivo em português escapava: o teste
    aceitava a mensagem crua, que já tinha a palavra "canal").
  - **Conferido no `painel:dev`:**
    - o clique gravou o pedido de trabalho;
    - o robô de verdade criou o job, e o cartão mostrou o motivo na hora;
    - rodando, cancelar, enviar à revisão do cliente, pedir revisão como gerente e o selo do menu
      funcionaram, sem erro no console.

**Depende de:**

- a pilha #86→#91 na `main` (o `agencies.kind` é do #87);
- para o M2-8, também o religar dos passos 1–4;
- para o ciclo automático pela planta, o M2-R e os materiais (MAT-3 a MAT-6);
- para a extração dos arquivos e os anexos da revisão (fotos e áudio), o Storage, que pede o
  Blaze.

O resto do M2 não depende do Blaze.

---

## 16. Decisões e perguntas

**Decididas em 20/10:**

1. **Onde roda:** GitHub Actions (§11).
2. **Construtora:** o robô publica sozinho depois da aprovação do gerente (leitura "B").
3. **Dados para gerar o 3D:** chegam com a solicitação, num espaço que aceita todo tipo de
   arquivo de obra ([materiais-da-solicitacao.md](materiais-da-solicitacao.md)).
4. **O botão por conta saiu.** Imobiliária vai direto; o gerente aprova ou pede revisão com
   texto, fotos e áudio.
5. **Arquivos:** bucket nos EUA; o robô processa um por vez, extrai e apaga o original. As
   maquetes ficam, por um tempo a confirmar
   ([materiais-da-solicitacao.md](materiais-da-solicitacao.md) §11).
6. **Posição no mapa, automática**, com o botão "Cadastrar posição" (Google Maps) na
   solicitação, e o imóvel publicado como ponto no mapa geral (materiais §6).
7. **O gerente clica "Aprovar".** Nada vai ao ar só porque ele não respondeu.
8. **A IA gerencia a criação completa**, pela API ([ia-da-criacao.md](ia-da-criacao.md)).
9. **A maquete fica no ar enquanto o plano está pago**, com limite de imóveis no ar e troca com
   1 h de intervalo ([plano-no-ar.md](plano-no-ar.md)).
10. **O Google Maps usa a mesma conta de faturamento do Blaze.**

11. **O repositório foi fechado** em 20/10 ([ia-da-criacao.md](ia-da-criacao.md) §6).
12. **Vagas:** a vaga liberada só aceita outro imóvel 1 h depois; do cliente, só o gerente mexe;
    depois do cancelamento, os arquivos ficam 90 dias e o robô os retira
    ([plano-no-ar.md](plano-no-ar.md)).

13. **IA:** Claude Opus 5.5; teto de ~US$ 3 e 2 rodadas por pedido; modo sombra de 20 pedidos;
    revisão pedida pelo cliente é humana por enquanto, e cada caso, portão que falha ou chamada
    da IA abre uma **ocorrência** (erro, causa, solução) que ensina a IA
    ([ia-da-criacao.md](ia-da-criacao.md) §7).

**Ainda em aberto:** o número que deixa a IA assumir uma categoria de revisão
([ia-da-criacao.md](ia-da-criacao.md) §9).
