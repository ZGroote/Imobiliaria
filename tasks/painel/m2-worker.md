# M2 — o worker do ciclo de publicação (especificação)

Proposta de 20/10/2026. **Só documento: nada implementado, nada no ar, nenhum deploy.** Escrita
sobre a pilha #86→#91 (`feat/cloud-run-preparo`, `dc3e121`). Cada incremento da §13 é um PR
pequeno, revisado e mergeado só com "MERGE AUTORIZADO"; ligar o worker em produção (M2-8) é uma
ação à parte, com autorização própria.

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

---

## 0. Resumo

1. A equipe clica e o worker faz. Ele gera o build e a prévia, sobe o canal, confere os bytes
   servidos e põe no ar o build aprovado.
2. **Quem dispara cada etapa é um clique, não a mudança de status.** O clique grava um pedido de
   trabalho no `auditLogs`, que as regras de hoje já aceitam. O worker transforma esse pedido em
   job.
3. **O worker nunca escreve em `requests`, `properties` nem `publications`.**
   - Registrar a prévia, aprovar e registrar a publicação continuam sendo cliques no painel,
     conferidos pelas regras.
   - O worker só escreve nos jobs, na trava e nos AuditLogs dele.
4. **Onde roda, recomendado: GitHub Actions.**
   - O repositório é público, então os minutos são de graça.
   - O checkout já é o repositório com os dados.
   - Python 3.14 e Node 24 já rodam no CI.
   - Funciona no plano Spark, sem esperar o Blaze.
   - Plano B: Cloud Run Job, quando o Blaze estiver ativo (§9).
5. **Os bytes ficam onde já estão.** Os builds no ar moram no site de imóveis, e o build em
   revisão mora no canal de prévia. O worker baixa e confere byte a byte. Nada novo para
   guardar arquivo.
6. **Uma trava só para tudo:** um worker por vez, seja build, prévia ou live. Ela fecha a
   corrida entre duas criações de job (a pendência do `buildjob.mjs`) e entre dois deploys do
   live (o `ponytail` da proposta §7).
7. **Publicar no live pede um clique do `platform_admin`** ("Publicar no site"), e o registro
   continua sendo o clique "Registrar publicação". A aprovação do gerente continua manual, de
   propósito.
8. **Os portões de hoje não mudam, e entra um novo**, no momento da publicação: promover X só
   pode mudar arquivos de X (§11).
9. **Custo zero dentro das cotas** (§12). O limite real é o tráfego do Hosting, 360 MB/dia,
   dividido com os visitantes. Ele aperta perto de ~15 imóveis no ar, e o próximo passo para
   esse caso já está apontado.
10. **O M2.0 cobre só o fluxo legado** (`pipelineUnitId`). O imóvel que só tem a leitura fixada
    (`productionInput`) fica `blocked` até o caminho pelo `e2e_leitura` gerar build (M2-9).

---

## 1. O que muda para quem usa o painel

| Passo | Hoje | Com o worker |
|---|---|---|
| Aceitar e pôr em produção | admin clica | **igual** |
| Build + prévia | alguém roda `build_imovel.py`, `montar-preview` e `hosting:channel:deploy` | a equipe clica **"Gerar prévia"**; o worker faz e confere |
| Registrar a prévia | o admin **cola a URL** do tour | a equipe abre a prévia pronta e clica **"Enviar para a imobiliária"**: o painel pega o endereço do job, sem colar, e relê o `manifest.json` servido (`lerPreview`), como hoje |
| Aprovar | gerente | **igual** (manual de propósito) |
| Pôr no ar | alguém roda `montar-live promover` + `firebase deploy` | o admin clica **"Publicar no site"**; o worker faz |
| Registrar | admin: "Conferir o site" + "Registrar publicação" | admin: **"Registrar publicação"**, que continua relendo o `estado.json` no clique. O "Conferir o site" vira o próprio estado do job ("no ar, conferido") |
| Reverter | alguém roda `montar-live reverter` + deploy; admin registra | admin clica **"Voltar ao build anterior"**; o worker faz; o admin registra, como hoje |

Enquanto o worker estiver desligado, o painel continua mostrando os comandos à mão, como hoje,
dentro de "Sem o worker". Antes de rodar à mão, desligue o worker (§8), para os dois não
disputarem o site.

---

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| W1 | O worker é **um comando** (`node tools/worker.mjs rodar`), não um servidor | Roda igual no computador, no GitHub Actions ou num Cloud Run Job. Onde ele roda é um detalhe que se troca sem mexer na lógica |
| W2 | O gatilho é um **pedido de trabalho auditado** (um AuditLog `worker:*` gravado pelo clique), e não a mudança de status | Voltar para `production` depois de um ajuste não pode gerar build antes de o conserto entrar na `main`. O AuditLog já é autenticado, já fica na história do pedido, e a regra de criação já existe. O painel continua só lendo `buildJobs/` |
| W3 | O worker **só escreve** em `buildJobs`, `workerLeases` e nos AuditLogs que ele mesmo gera | Tudo o que muda pedido, imóvel e publicação passa pelas regras, com um humano no clique. O Admin SDK ignoraria as regras |
| W4 | **Uma trava global**: um worker trabalhando por vez, para todas as etapas | `ponytail:` trava única. O volume é de poucos imóveis por semana. Trava por imóvel só se a fila começar a esperar |
| W5 | O **site no ar guarda os builds publicados** e o **canal guarda o build em revisão** | A máquina do worker nasce vazia a cada execução. Os dois lugares já existem, e o `estado.json` e o `manifest.json` provam os bytes. O teto está na §12 |
| W6 | **Publicar pede um clique** do `platform_admin` | O site é um só e público. O M2 começa com um humano em cada ida ao ar. Rever depois de ~10 ciclos sem incidente |
| W7 | **Registrar continua clique** | As regras (`publishedAs`, `publishedFromApproved`) exigem o autor no `request.auth`. Pelo Admin SDK, a garantia viraria só código |
| W8 | O worker **nunca usa `--estado-vazio`** | Um `estado.json` ausente (404, site desligado) não pode virar "site vazio" e apagar os outros imóveis. A primeira publicação de um site vazio fica à mão, como no religar |
| W9 | **M2.0 só faz o fluxo legado** (`pipelineUnitId`) | `build_imovel.py` lê `plantas_fornecidas/`. O caminho pela leitura fixada tem de passar pelo `e2e_leitura`, nunca pelo `--cadastro` (fronteira do M1-F), e ele ainda não gera tour + maquete + manifest |
| W10 | **Executar os scripts de hoje, não reescrevê-los** | `build_imovel.py`, `publicar_imovel.py` e as funções do painel (`validarManifesto`, `noAr`) são os portões testados. O worker chama os scripts e reaproveita as funções |

---

## 3. As etapas e o que dispara cada uma

O pedido de trabalho é um documento em `auditLogs`, criado pelo clique:

```ts
{ agencyId, userId,                       // quem clicou (= request.auth.uid, pelas regras)
  entityType: 'request' | 'property' | 'buildJob', entityId,
  action: 'worker:previa' | 'worker:publicar' | 'worker:reverter' | 'worker:cancelar',
  visibility: 'internal',
  after: { ... },                         // o que o clique viu (ex.: build e manifest aprovados)
  timestamp }                             // = request.time, pelas regras
```

O **id desse AuditLog é o id do job**, e essa é a identidade da tarefa. O mesmo pedido lido
duas vezes vira o mesmo job (`create()` falha se o documento já existe). Dois cliques são dois
pedidos, e a §5 garante um job ativo por pedido.

| Etapa | Quem pede | O worker confere de novo, no momento | O que o worker faz | O job termina com | Próximo clique humano |
|---|---|---|---|---|---|
| **prévia** (`worker:previa`, entidade = pedido) | equipe (`platform_admin` ou `operator`) | o autor está ativo e é da equipe; o pedido está em `production`; e o resto do `planejarBuildJob`: modo LEVE/PREMIUM, imóvel da mesma agência com `pipelineUnitId` | `build_imovel.py <id> --modo <modo>`, `montar-preview`, `hosting:channel:deploy imovel-<id> --expires 30d --json`. Depois baixa `tour.html`, `maquete.html` e `manifest.json` **do canal** e confere: o sha256 do manifest servido é o que o `montar-preview` devolveu, e tour e maquete batem com o manifest | `build`, `manifestSha256`, `tourUrl`, `maqueteUrl`, `previewExpiresAt`, `commit` | "Enviar para a imobiliária" (`lerPreview(job.tourUrl)` + `registrarPreview`, como hoje) |
| **publicar** (`worker:publicar`, entidade = pedido, `after = {build, manifestSha256}`) | `platform_admin` | o autor é admin ativo; o pedido está em `approved`; `approvedBuild` e `approvedManifestSha256` são os do clique; o imóvel tem `pipelineUnitId` | baixa o `estado.json` do ar; reconstrói os builds no ar e o aprovado (do canal); roda `montar-live promover --estado <baixado> --manifest-aprovado <sha>`; aplica o portão de escopo; relê o `estado.json`; `firebase deploy --only hosting:imoveis`; relê o `estado.json` até mostrar o novo | `estadoAntesSha256`, `estadoDepoisSha256`, `build`, `manifestSha256` | "Registrar publicação" (como hoje) |
| **reverter** (`worker:reverter`, entidade = imóvel) | `platform_admin` | o imóvel tem `publishedBuild` e `previousBuild`; o ar mostra esse par; o manifest do anterior é o que o pedido anterior aprovou (a mesma conferência de `conferirReversao`) | `montar-live reverter`, o mesmo portão de escopo, relê o estado e faz o deploy | os mesmos campos do publicar | "Registrar reversão" (como hoje) |
| **cancelar** (`worker:cancelar`, entidade = job) | equipe; `platform_admin` para publicar e reverter | o job existe e não terminou | §8 | `cancelled` | — |

Um pedido de trabalho com mais de 48 h e sem job é ignorado. O painel mostra "pedido expirado,
peça de novo".

---

## 4. O BuildJob

O tipo cresce sem quebrar o que existe. Um job sem `stage` é um job manual de antes do M2.

```ts
export type BuildJobStage = 'preview' | 'publish' | 'rollback'
export type BuildJobStep = 'build' | 'channel' | 'check_channel' | 'state' | 'assemble' | 'deploy' | 'check_live'

export interface BuildJob {               // buildJobs/{id}; escrita só pelo worker (Admin SDK)
  id: string                              // = id do AuditLog do pedido de trabalho
  stage?: BuildJobStage                   // ausente = job manual anterior ao M2
  requestId?: string                      // rollback não tem pedido
  propertyId: string; pipelineUnitId?: string; agencyId: string
  productionMode?: ProductionMode
  requestedBy?: string; createdBy: string // createdBy = quem clicou
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
  error?: { code: string; message: string }
  startedAt?: Timestamp; finishedAt?: Timestamp
  lastAuditId?: string
  createdAt: Timestamp; updatedAt: Timestamp
}
```

**Estados:**

```text
pending ──(o worker assume)──> running ──> succeeded
   │                             │  ├────> blocked    um portão recusou; precisa de gente, sem nova tentativa
   │                             │  ├────> failed     falha de infraestrutura depois de 3 tentativas
   │                             │  └────> cancelled
   │                             └─(o prazo venceu)─> reconciliação (§7): succeeded, nova tentativa ou failed
   └──(cancelar)──> cancelled
```

Estado final não volta. "Tentar de novo" num job `blocked` ou `failed` é um pedido novo, com
um job novo.

**Códigos de erro** (`error.code`; a mensagem vai no job, nunca no log público, §9):

- `blocked`:
  - `NOT_STAFF`, `NOT_ADMIN`;
  - `REQUEST_CHANGED`: o pedido saiu do estado esperado;
  - os de `planejarBuildJob` (`PIPELINE_UNIT_REQUIRED`, `AGENCY_MISMATCH`, ...);
  - `PRODUCTION_INPUT_UNSUPPORTED`: só tem a leitura fixada (W9);
  - `NAO_PUBLICAR`: `mirra-114`;
  - `BUILD_REFUSED`: o `build_imovel.py` recusou;
  - `CHANNEL_MISMATCH`: o canal serve outros bytes;
  - `PREVIEW_GONE`: o canal venceu ou recebeu outra prévia;
  - `APPROVAL_MISMATCH`;
  - `STATE_UNREADABLE`: `estado.json` ausente ou fora do formato;
  - `STATE_CHANGED`: o ar mudou durante o job;
  - `OUT_OF_SCOPE`: §11, portão 8;
  - `LIVE_DIFFERENT`: depois do deploy, o ar não mostra o que se publicou.
- `failed`: `NETWORK`, `DEPLOY_ERROR`, `TIMEOUT` e `LEASE_LOST`, depois da 3ª tentativa.

AuditLog do job: `created` e o estado final, com `entityType: 'buildJob'`. O `userId` é o de
quem clicou no `created` e `worker` nos demais. Sinal de vida não gera log.

---

## 5. Trava com prazo e sinal de vida

Um documento: `workerLeases/global` = `{ owner, jobId, expiresAt }`. O `owner` identifica a
execução (`gha-<run_id>-<run_attempt>`, ou `local-<máquina>-<pid>`).

- **Pegar**, numa transação: se o documento não existe ou se `expiresAt` já passou, grava
  `owner = eu` e `expiresAt = agora + 15 min`. Se outro tem a trava, a execução termina sem
  fazer nada.
- **Sinal de vida**, a cada 60 s, numa transação:
  - com `owner == eu`: `expiresAt = agora + 15 min` e `job.heartbeatAt = agora`, juntos;
  - com outro `owner`: a trava foi perdida, e o worker **para na hora, sem nenhum efeito
    externo a mais** (`LEASE_LOST`).
- **Antes de cada efeito externo** (deploy do canal, deploy do live), numa transação:
  - `owner == eu`;
  - faltam pelo menos 10 min de prazo;
  - o pedido e o imóvel continuam como o job exige (leitura dentro da mesma transação).

  O deploy leva ~1–2 min, e isso será medido no M2-5. Com 10 min de folga, um deploy não
  termina depois de a trava passar para outro.
- **Soltar** no fim, numa transação: só apaga se `owner == eu`.
- **Criar job, assumir job e encerrar job** acontecem com a trava na mão. Assim a criação é
  feita uma de cada vez, e a regra "um job ativo por pedido" (`ACTIVE_BUILDJOB_EXISTS`) deixa
  de ter corrida. Hoje a consulta roda antes do batch e não garante isso (proposta §9).
- **Relógio:** o da máquina do worker, sincronizado por NTP. A margem de 15 min cobre a
  diferença entre relógios.
- No GitHub Actions, `concurrency: worker-imoveis` também impede duas execuções juntas. É
  proteção a mais; a autoridade é a trava, que vale em qualquer lugar onde o worker rode.

**Uma execução:**

1. Olha, sem trava, se há trabalho: pedidos novos, jobs `pending` ou jobs `running` com sinal
   de vida velho. Se não há, termina sem escrever nada.
2. Se há, pega a trava e reconcilia (§7).
3. Transforma os pedidos novos em jobs.
4. Processa os `pending` em ordem de criação até ~45 min de relógio.
5. Solta a trava. O que sobrar fica para a próxima execução.

---

## 6. Nova tentativa sem efeito duplicado

| Passo | Se rodar de novo | Por que não estraga |
|---|---|---|
| criar o job | `create()` com o id do pedido falha | a identidade é o AuditLog do clique |
| build | com a mesma `main`, gera o mesmo `tour.html`/`maquete.html` (mesmo `build`), com outro `manifest.json`, porque o `gerado_em` muda | o job só grava o manifest **depois** de conferir os bytes servidos no canal. Nada fora do job apontava para o manifest da tentativa que morreu: o "Enviar para a imobiliária" só aparece com o job `succeeded` |
| deploy do canal | sobe a mesma pasta de novo | o canal fica com a última prévia, e é essa que o job registra |
| deploy do live | **não refaz às cegas**: primeiro reconcilia pelo `estado.json` (§7) | o ar é a fonte do que está publicado (proposta §2) |
| registrar | é clique humano | as regras recusam o segundo registro (o pedido já está `published`) |

**Regra das tentativas:**

- até 3, e só para falha de infraestrutura (rede, tempo esgotado, trava perdida, erro do deploy
  que não seja recusa de portão);
- a próxima tentativa só acontece na próxima execução (≥ 10 min), e essa é a espera entre elas;
- um portão que recusa dá `blocked` na hora, sem nova tentativa.

---

## 7. Reconciliação depois de uma falha

Logo depois de pegar a trava, toda execução procura jobs `running` com `heartbeatAt` de mais
de 15 min. São jobs de um worker que morreu.

| Etapa do job morto | O que o worker olha | Decisão |
|---|---|---|
| prévia | nada de fora importa (o canal só vale depois do registro no job) | recomeça do zero com `attempt + 1`, ou `failed` se já era a 3ª |
| publicar | o `estado.json` do ar, agora | (a) mostra `approvedBuild` com `approvedManifestSha256`: **o deploy aconteceu**, então `succeeded` sem novo deploy. (b) o sha256 dele é o `stateBeforeSha256` do job: **nada aconteceu**, então recomeça. (c) é outra coisa: `blocked` com `STATE_CHANGED`, e alguém olha |
| reverter | o mesmo, com o par anterior | o mesmo |

Ficam com o painel, que calcula a partir do job e do pedido, sem escrita do worker:

- pedido de trabalho com mais de 48 h e sem job: "expirou";
- job `publish` `succeeded` com o pedido ainda em `approved`: "no ar, falta registrar";
- job `preview` `succeeded` com `previewExpiresAt` a menos de 5 dias: "a prévia vence em X
  dias";
- pedido de trabalho sem job há mais de 30 min: "a fila está parada". Ver o Actions (§9).

O Firestore e o Hosting continuam sem transação conjunta. O job é a ponte: `succeeded` quer
dizer "o ar mostra X, conferido". O clique de registro fecha o ciclo relendo o `estado.json`,
que continua sendo a autoridade. Isso reduz a janela do `ponytail` de `publicar.ts` ("na Fase 2,
um BuildJob no servidor coordena a promoção e o registro"), mas não a fecha: a leitura do clique
continua sendo a autoridade.

---

## 8. Cancelar

- **Job `pending`**: vira `cancelled` na próxima execução.
- **Job `running`**: a cada sinal de vida, o worker procura um `worker:cancelar` para o job
  dele. Achou: marca `cancelRequested` e para na próxima fronteira de passo, antes de qualquer
  efeito externo novo.
- **Depois que o deploy do live começou, não se cancela.** O deploy termina e é conferido. Se o
  ar mudou, o caminho de volta é "Voltar ao build anterior".
- **Cancelamento implícito:** se o pedido sair do estado esperado (por exemplo, `production` →
  `cancelled`, ou `approved` → `production`), a conferência antes do efeito externo dá
  `REQUEST_CHANGED`.
- **Desligar o worker** (para rodar à mão ou numa emergência): `gh workflow disable worker.yml`.
  O job em andamento termina o passo atual. Os `pending` esperam o religamento. Religar:
  `gh workflow enable worker.yml`.

---

## 9. Onde roda e com quais credenciais

### Recomendado: GitHub Actions (`.github/workflows/worker.yml`)

- **Por quê:**
  - `ZGroote/Imobiliaria` é **público**, e a documentação do GitHub diz que o Actions é de graça
    para repositório público com os runners padrão;
  - o checkout da `main` já é "o repositório com os dados": as 150 entradas do build, os 239
    tiles e o `pagina_maquete.py`. O PREMIUM do Cedros lê `geometry-compact.json` e
    `lightmap.rgbm.gz`, que estão no git, e não os `source.json` do repositório privado de
    artefatos;
  - Python 3.14 e Node 24 já sobem no CI (`.github/workflows/ci.yml`);
  - o `firebase-tools` e o `firebase-admin` vêm do `package.json` da raiz;
  - nada disso depende do Blaze.
- **Gatilho:**
  - `schedule` a cada 10 min, mais `workflow_dispatch` para rodar na hora;
  - fila vazia: a execução termina em ~1 min, sem gastar nada;
  - o GitHub pode atrasar (e até pular) um agendamento em horário de pico. Como os pedidos ficam
    no Firestore, uma execução pulada só adia o trabalho para a próxima. Minutos de espera são
    aceitáveis para um pedido que leva dias; quem tiver pressa usa o `workflow_dispatch`.
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
  - papéis: `roles/datastore.user` (Firestore), `roles/firebasehosting.admin` (deploy de canal e
    de live) e `roles/serviceusage.apiKeysViewer`, que a documentação da action oficial de deploy
    (`FirebaseExtended/action-hosting-deploy`) pede para deploy pelo CLI. Ficam de fora, de
    propósito, o `firebaseauth.admin` da mesma lista (serve para autorizar o domínio da prévia
    no Auth, e a página do imóvel não usa login) e o `run.viewer` (o site de imóveis não tem
    rewrite para o Cloud Run). O primeiro deploy de canal do M2-8 confirma a lista;
  - o painel não ganha segredo nenhum: ele só grava um AuditLog com a sessão do próprio
    usuário.
- **Os limites dessas credenciais, ditos com clareza:**
  - `datastore.user` vale para o banco inteiro, porque o IAM não separa por coleção. Quem segura
    é o código, com um teste que falha se o worker escrever fora de `buildJobs`, `workerLeases`
    e `auditLogs` (M2-2);
  - `firebasehosting.admin` vale para todos os sites do projeto (mapa, painel, miniaturas/LIV e
    imóveis). Quem segura é o código, com um teste que falha se algum comando montado não tiver
    `--config firebase.imoveis.json` e `--only imoveis` / `hosting:imoveis` (M2-3);
  - quem tem escrita na `main` muda o que o worker faz. Isso já vale hoje para o que vai ao ar;
    a proteção continua sendo o ritual de PR com "MERGE AUTORIZADO".
- **Os logs do Actions são públicos.**
  - O worker imprime só: id do job, etapa, passo, slug do imóvel, build, sha e código de erro;
  - nunca nome de imobiliária, título de pedido, e-mail, nota ou mensagem do Firestore;
  - o detalhe vai para o job, que só a equipe lê;
  - um teste (M2-3) roda com textos "sensíveis" de propósito e falha se eles aparecerem na
    saída.
- **Riscos do Actions:**
  - repositório público sem atividade por 60 dias tem o agendamento desligado. O aviso "a fila
    está parada" (§7) mostra; religar com `gh workflow enable`;
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
  - ter um serviço pequeno que só acorda o job quando há pedido.
- **Outro custo:** uma imagem nova a cada merge que mude dados ou pipeline. Sem isso, o worker
  gera com dados velhos.
- **Quando trocar:** se o repositório virar privado, se os logs públicos deixarem de ser
  aceitáveis, ou se a espera do agendamento do GitHub atrapalhar.

---

## 10. O que continua manual, de propósito

- Aceitar o pedido e pô-lo em produção.
- Pedir a prévia: o clique "Gerar prévia". A equipe sabe quando os dados estão prontos.
- Olhar a prévia e enviar para a imobiliária. É a revisão interna antes de a agência ver.
- **Aprovar: só o gerente da imobiliária.** É o controle humano do fluxo.
- **Publicar no live**: clique do `platform_admin` (W6).
- Registrar a publicação e a reversão (W7).
- A **primeira publicação** de um site vazio (`--estado-vazio`) e qualquer religar/desligar do
  site (`SITE_DISABLE`). Ficam à mão, com autorização (W8 e o
  [plano do religar](religar-2026-10-20.md)).
- Ligar, desligar e mudar credenciais do worker.

---

## 11. Os portões de hoje continuam valendo

| # | Portão | Onde mora hoje | No M2 |
|---|---|---|---|
| 1 | `mirra-114` não se publica | `NAO_PUBLICAR` em `build_imovel.py` e `confere_build` | o worker chama os mesmos scripts e não reimplementa nada: `blocked` com `NAO_PUBLICAR` |
| 2 | build = conteúdo; pasta nunca sobrescrita | `build_imovel.py` | igual |
| 3 | sem rebaixar PREMIUM para LEVE em silêncio | `modo_producao` + `--modo` | o worker passa o `productionMode` do pedido; sem modo, `blocked` |
| 4 | identidade da prévia = sha256 dos **bytes servidos** do manifest | `montar-preview` devolve `manifest_sha256`; o painel calcula em `lerPreview` | **dois conferentes independentes**: o worker confere os bytes servidos pelo canal antes de dar "pronto", e o clique "Enviar" relê com `lerPreview` |
| 5 | só o gerente aprova, e exatamente o par do preview | regras: `managerDecision` | igual: o worker não escreve em `requests` |
| 6 | promover só o artefato aprovado | `montar-live --manifest-aprovado` recusa manifest local diferente | o worker lê `approvedBuild`/`approvedManifestSha256` no começo e de novo logo antes do deploy. O build vem do canal e é conferido contra o sha aprovado e contra o próprio manifest **antes** do `montar-live`, que confere outra vez |
| 7 | o `estado.json` é o **do ar**, não uma cópia | o operador baixa à mão | o worker baixa sem cache. Cada build no ar baixado é conferido contra ele (`_confere_contra_estado`, dentro do `montar-live`). **Logo antes do deploy, relê** e aborta com `STATE_CHANGED` se mudou, o que pega até um deploy à mão no meio-tempo. 404 ou formato errado dá `STATE_UNREADABLE`, nunca "vazio" |
| 8 | promover X não mexe em Y | só teste (`test_promoting_x_keeps_y_byte_for_byte`), sem conferência na hora | **portão novo, na hora:** compara o `arquivos` do `estado.json` do ar com o do novo. Só podem mudar `b/X/…`, `imovel/X`, `maquete/X`, `index.html`, `quintais/<conjunto novo>/…` e a saída do antigo `anterior` de X. Qualquer outra diferença dá `OUT_OF_SCOPE`, com a lista. Exemplo real: uma mudança no `vitrine_ao_vivo.js` mudaria o ponteiro de Y. Isso vira decisão de alguém, não efeito colateral |
| 9 | registrar só com o artefato aprovado no ar | `conferirPublicacao` relê o `estado.json` no clique | igual |
| 10 | regras do Firestore | `firebase/firestore.rules` | iguais. Passam a fechar também o pedido de trabalho: `worker:*` só da equipe e com `visibility: 'internal'`, e `worker:publicar`/`worker:reverter` só do admin (M2-1). O worker confere tudo de novo do lado dele, porque o Admin SDK não passa pelas regras |
| 11 | o site de imóveis é isolado dos outros | `firebase.imoveis.json`, `--only` | o worker só monta esses comandos, com teste (§9) |

---

## 12. Custo dentro das cotas gratuitas

| Item | Cota grátis | Uso esperado |
|---|---|---|
| GitHub Actions | sem limite para repositório público com runner padrão | ~144 execuções por dia; as vazias levam ~1 min |
| Firestore (Spark) | 50 mil leituras e 20 mil escritas por dia | execução vazia: ~3 leituras e nenhuma escrita (a trava só é pega se houver trabalho), ~430 leituras/dia. Por job: ~15 escritas (criar, assumir, ~10 sinais de vida, encerrar, 2 AuditLogs) |
| Hosting, armazenamento | 10 GB | por imóvel no ar: 2 builds de ~19 MB (tour ~15 MB, maquete 3,3–4,0 MB) mais os ponteiros; os 239 tiles (17 MB) são um conjunto só. Dá ~250 imóveis. Conferir no M2-8 quanto as versões antigas guardadas pelo Hosting e os canais de prévia (~19 MB cada) somam, e limitar a retenção de versões se precisar |
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

## 13. Incrementos

Cada um é um PR pequeno, com teste que roda no emulador (`firebase emulators:exec`, o mesmo
padrão de `npm run test:painel`) e critério de pronto que dá para conferir.

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **M2-1** | **Contrato.** O `BuildJob` ampliado (§4) em `types.ts` e na proposta §3; `workerLeases` nas regras (equipe lê, ninguém escreve); regra do pedido de trabalho (`worker:*` só da equipe e interno; `publicar`/`reverter` só do admin); índice `auditLogs (action, timestamp)` | `regras.test.mjs`: o operador cria `worker:previa`; o operador **não** cria `worker:publicar`; gerente e corretor não criam `worker:*` nem com `visibility: 'agency'`; ninguém escreve `buildJobs`/`workerLeases` pelo cliente | testes verdes, e cada regra quebrada de propósito é pega (o padrão da T03) |
| **M2-2** | **Trava e fila, sem build.** `tools/worker.mjs`: pegar, renovar e soltar a trava; pedido → job (`create` com o id do pedido, reaproveitando `planejarBuildJob`); cancelar `pending`; reconciliar trava vencida; lista fechada de coleções onde escreve. `tools/buildjob.mjs criar` passa a gravar um pedido `worker:previa`: um caminho só para criar job | relógio falso no emulador. **Prova de concorrência:** dois workers ao mesmo tempo, só um pega a trava; o mesmo pedido lido duas vezes dá um job; dois cliques no mesmo pedido dão um job ativo; trava vencida é assumida; quem perde a trava para antes do passo seguinte; escrita fora da lista falha o teste | `npm run test:worker` verde no CI |
| **M2-3** | **Etapa prévia, com executor e deploy falsos.** O worker chama os scripts de verdade num repositório de teste; o "deploy do canal" grava numa pasta servida por um HTTP local, e a conferência dos bytes é a de verdade | sucesso grava `build`/`manifestSha256`/`tourUrl`; bytes servidos diferentes dão `CHANNEL_MISMATCH`; pedido que sai de `production` no meio dá `REQUEST_CHANGED`; `mirra-114` dá `NAO_PUBLICAR`; só leitura fixada dá `PRODUCTION_INPUT_UNSUPPORTED`; todo comando montado tem `--config firebase.imoveis.json`; textos sensíveis não aparecem na saída | testes verdes; nenhum deploy real |
| **M2-4** | **Painel, prévia.** "Gerar prévia" (grava o pedido de trabalho); cartão do job (fila, rodando, último sinal, pronto, erro em português); "Enviar para a imobiliária" com `lerPreview(job.tourUrl)` + `registrarPreview`; comandos à mão em "Sem o worker" | testes do painel no emulador: o botão só aparece para a equipe e em `production`; "Enviar" só com o job `succeeded`; o fluxo sem colar URL chega a `agency_review` com o `manifestSha256` dos bytes servidos | testes verdes; tela conferida no `painel:dev` |
| **M2-5** | **Etapa publicar, com "ar" e deploy falsos.** Baixa o `estado.json`, reconstrói os builds, traz o aprovado do canal, roda `montar-live`, aplica o portão de escopo, relê, faz o deploy, relê; mede tempo e memória | **prova de falhas:** aprovação diferente dá `APPROVAL_MISMATCH`; `estado.json` 404 dá `STATE_UNREADABLE` (nunca vazio); "ar" mudado entre a leitura e o deploy dá `STATE_CHANGED`; ponteiro de Y mudado dá `OUT_OF_SCOPE`; canal sem o build dá `PREVIEW_GONE`; **o worker morre depois do deploy:** a execução seguinte marca `succeeded` sem novo deploy; **morre antes:** recomeça; 3ª falha dá `failed` | testes verdes; tempo e memória anotados aqui |
| **M2-6** | **Painel, publicar.** "Publicar no site" (só admin, em `approved`); cartão do job; "Registrar publicação" aparece com o job `succeeded`; avisos da §7 | testes do painel: o botão só para o admin; "Registrar" continua relendo o `estado.json` | testes verdes |
| **M2-7** | **Reverter**, no worker e no painel | o mesmo esquema do M2-5 com o par anterior; reverter sem anterior dá `blocked` | testes verdes |
| **M2-8** | **Ligar de verdade** (depois do religar, com o site de imóveis no ar e com `estado.json`). `worker.yml`, provedor de identidade e conta de serviço: cada um é ação em produção, com autorização | 1º: uma execução com fila vazia; conferir o log público. 2º: uma **prévia** do Cedros, só no canal, sem live. 3º: um ciclo inteiro, com os cliques do usuário | ciclo inteiro sem comando à mão; log sem dado sensível; anotar aqui o tempo real |
| **M2-9** | **Depois, se precisar:** cópia no servidor (§12, perto de ~15 imóveis); o caminho da leitura fixada pelo `e2e_leitura` (W9); plano B no Cloud Run (§9) | cada um com o seu teste | — |

**Depende de:** a pilha #86→#91 na `main`; para o M2-8, também o religar dos passos 1–4 (painel
e site de imóveis no ar, com `estado.json` publicado). Nada do M2 depende do plano Blaze, a não
ser o plano B.

---

## 14. Perguntas para você decidir

1. **GitHub Actions ou Cloud Run Job?** A recomendação é Actions (§9). A troca é uma decisão,
   porque deixa produção nas mãos do GitHub e os logs ficam públicos, mesmo sem dado sensível.
2. **Publicar no live:** fica o clique do admin (recomendado) ou vira automático logo depois da
   aprovação do gerente?
3. **"Enviar para a imobiliária":** fica o clique da equipe (recomendado, é a revisão interna)
   ou o pedido vai sozinho para `agency_review` quando a prévia fica pronta? Automático exigiria
   o worker escrever em `requests`, contra o W3.
