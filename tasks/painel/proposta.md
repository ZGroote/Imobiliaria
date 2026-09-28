# Painel administrativo — arquitetura revisada (v3)

Estado (24/09/2026): **Fase 1 concluída e em produção.** Arquitetura v3 aprovada. A Fase 1 está
integrada ao `main` pelo PR #5 (merge commit `37114b2`, §14). Onde a spec
(`Downloads/PAINEL_ADMIN_ESPECIFICACAO_REVISADA.md`) diverge do repositório, vale o repositório.
A v3 assume um projeto novo no Firestore e no Storage (D2 encerrada) e separa o trabalho em dois
trilhos que não se esperam (§13).

O que existe e roda:

- `firebase/firestore.rules`, `firebase/storage.rules` e `firebase/tests/regras.test.mjs`: as
  primeiras regras reais do projeto (T03). **28/28** no emulator; 14 regras quebradas de propósito,
  todas detectadas (§5). As do Firestore estão publicadas (commit `40b1abd`).
- `painel/`: o painel (Next.js estático), **25/25** testes contra o emulator, publicado em
  https://imobilaria-deccb-painel.web.app. Estado de produção na §14.
- A proposta original das regras (`tasks/painel/regras/`) foi promovida para `firebase/` e não é
  mais a fonte.

---

## 1. Decisões registradas

| # | Decisão | Consequência no desenho |
|---|---|---|
| D1 | Painel estático no Firebase Hosting, sem servidor | `output: 'export'`; detalhe por `?id=`; as regras são a única camada de autorização |
| D2 | **Encerrada: legado vazio/não utilizado.** Antes da criação do banco, conferido via API em 24/09: o projeto não tinha banco Firestore nem bucket. | Projeto novo. Nenhuma regra, teste, adaptador ou campo para `imobiliarias`, `imoveis`, `usuarios`, `cidades`, `analytics`, `imobiliaria_id` ou os papéis antigos (claims `role`/`imobiliaria_id`). O teste 20 falha se algum voltar. |
| D3 | Papel em `users/{uid}` + convite; sem Custom Claims nem Cloud Function | As regras leem `role`, `agencyId` e `active` desse documento (§4) |
| D4 | O corretor vê imóveis e pedidos da própria imobiliária | A fronteira é a agência; "só as minhas" é filtro da consulta no Firestore (`requestedBy`), desde o PR #23: com as listas paginadas, filtrar a página na tela perderia o que não coube nela |
| D5 | URL pública principal = tour; `tourUrl` e `maqueteUrl` explícitos | `publicUrl = tourUrl` por enquanto (§3) |
| D6 | Nenhuma imobiliária real assumida | Emulator e testes usam "Imobiliária Fictícia A/B (dev)". Produção sem seed até você informar o nome. |
| D7 | JDK 21 para o emulator | Temurin 21.0.12.1 portátil em `~/.jdks/`, checksum conferido. **PATH e variáveis do sistema intactos.** |
| D8 | Firestore `(default)` em `southamerica-east1` | **Criado** em 24/09, com proteção contra exclusão. Comando e impacto no checklist da §5. A localização não muda depois. |
| D9 | O Storage não bloqueia a Fase 1 | Materiais só no emulator até o plano ser confirmado e o bucket criado (§13, A5) |
| D10 | Dois trilhos: infraestrutura do painel (A) e publicação 3D (B) | Nenhum espera o outro; o contato é o contrato da §9 (§13) |
| D11 | Busca de imóvel nos seletores ("Nova solicitação" e "Imóvel vinculado"): **adiada** (26/09) até uma imobiliária ter algumas dezenas de imóveis e o `<select>` passar a atrapalhar. Hoje cada seletor lê os imóveis de **uma** imobiliária, e isso não pede um campo, um índice e uma migração a mais. | Quando for feita, sem rediscutir a direção: busca por prefixo de **qualquer palavra** ("cedros" e "monte" acham "Monte dos Cedros"), com um campo derivado do título contendo os prefixos normalizados (sem acento, minúsculo) de cada palavra, gravado por `criarImovel`/`editarImovel`; consulta `array-contains` + `agencyId` + `status == 'active'` (só imóveis ativos nos **dois** seletores, para não vincular pedido novo a imóvel inativo ou arquivado, e com um índice só); até 20 sugestões a partir de 2 letras. Os imóveis existentes recebem o campo por um **script de backfill** pequeno e auditável (antes e depois por `updateTime`), não por "Editar/Salvar". As regras de `properties` não têm lista fechada de campos e não mudam. |

---

### Produto solicitado: LEVE ou PREMIUM (28/09/2026)

- Uma única coleção `requests`; não existem fluxos/kanbans separados.
- `productionMode = leve | premium` é a intenção de produto e fica **imutável** depois da criação.
- O link continua sendo só a origem/fonte; ele não decide a qualidade.
- Pedidos anteriores ao campo continuam legíveis sem `productionMode` e aparecem como
  "Não registrado (pedido anterior)".
- Rollout em duas etapas: primeiro as regras aceitam o campo de forma aditiva e o painel novo
  sempre o grava; depois do deploy do painel, um PR curto torna o campo obrigatório também nas
  Security Rules. Isso evita incompatibilidade entre painel antigo e regras novas.
- A futura fábrica ligada ao pedido deve carregar esse modo para o BuildJob; não há downgrade
  silencioso de PREMIUM para LEVE.

## 2. Onde cada dado mora

A regra é uma fonte de verdade por fato. O painel registra e confere; não duplica.

| Fato | Fonte de verdade | Quem escreve | O painel |
|---|---|---|---|
| Ficha, planta, áreas, preço, procedência | `plantas_fornecidas/<id>/unidade.json` | pipeline (git) | não copia; guarda só `pipelineUnitId` |
| Imobiliárias, usuários, papéis | Firestore `agencies`, `users` | painel (platform_admin) | é a fonte |
| Pedidos, materiais, status, aprovação | Firestore `requests`, `requestAssets` | painel | é a fonte |
| Bytes de um build | `publicacao/builds/<id>/<build>/` + Hosting | `pipeline/build_imovel.py` | lê o `manifest.json` |
| **O que está no ar** | `estado.json` publicado no site de imóveis | `pipeline/publicar_imovel.py` | lê e **confere build + manifest antes de marcar "publicado"** |
| Histórico de publicar/reverter | Firestore `publications` | painel (platform_admin), no mesmo batch da mudança do imóvel | é a fonte |
| Histórico das demais ações (status, URLs) | Firestore `auditLogs` | painel, no mesmo batch da ação | é a fonte |
| Andamento de um build (Fase 2) | Firestore `buildJobs` | `tools/buildjob.mjs` (Admin SDK) | lê |

O último ponto responde ao risco que você apontou: o painel só aceita registrar
"publicado build X" depois de ler no site que X está no ar.

---

## 3. Modelo Firestore

**Canônico:** `agencies`, `users`, `properties`, `requests`, `requestAssets`, `buildJobs`,
`publications`. **De apoio:** `invites` (a entrada por convite, D3) e `auditLogs` (a trilha
que as regras exigem em cada mudança de status). Nenhuma outra coleção existe; as regras
negam qualquer outro caminho.

```ts
import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'platform_admin' | 'operator' | 'agency_manager' | 'agent'

export interface Agency {                 // agencies/{id}
  id: string; name: string; slug?: string; logoUrl?: string; active: boolean
  createdAt: Timestamp; updatedAt: Timestamp
}

export interface User {                   // users/{uid}; id = uid do Auth; FONTE DE AUTORIZAÇÃO
  id: string
  agencyId?: string                       // obrigatório para papel de imobiliária; proibido para interno
  name: string; email: string             // email minúsculo, igual ao token
  role: UserRole; active: boolean
  createdAt: Timestamp; updatedAt: Timestamp
}

export interface Invite {                 // invites/{email}; só platform_admin escreve
  email: string; name: string; role: UserRole; agencyId?: string
  createdBy: string; createdAt: Timestamp
}

export interface Property {               // properties/{id}
  id: string; agencyId: string
  title: string; developmentName?: string; address?: string; externalListingUrl?: string
  assignedAgentId?: string
  pipelineUnitId?: string                 // plantas_fornecidas/<id>/; também é o slug público
  status: 'active' | 'inactive' | 'archived'
  // publicação: só platform_admin, sempre com AuditLog no mesmo batch
  tourUrl?: string                        // https://<site-imoveis>/imovel/<unitId>  (ponteiro estável)
  maqueteUrl?: string                     // https://<site-imoveis>/maquete/<unitId> (ponteiro estável)
  publicUrl?: string                      // = tourUrl (D5)
  publishedBuild?: string                 // build no ar (12 hex)
  previousBuild?: string                  // para reverter
  publishedRequestId?: string             // pedido cuja aprovação autorizou o build no ar
  previousRequestId?: string              // o que autorizou o previousBuild; reverter troca os pares
  publishedAt?: Timestamp
  lastPublicationId?: string              // publications/{id} do último publicar/reverter
  lastAuditId?: string                    // só a ação 'urls'
  createdAt: Timestamp; updatedAt: Timestamp
}

export interface Publication {            // publications/{id}; só cresce; só platform_admin
  id: string; propertyId: string; agencyId: string
  action: 'publish' | 'rollback'
  build: string                           // == property.publishedBuild depois do batch
  previousBuild?: string
  requestId?: string                      // publish: o pedido cuja aprovação autorizou
  tourUrl?: string; maqueteUrl?: string
  publishedBy: string; publishedAt: Timestamp
}

export type RequestStatus =
  | 'submitted' | 'waiting_materials' | 'accepted' | 'production'
  | 'internal_review' | 'agency_review' | 'approved' | 'published' | 'cancelled'

export type ProductionMode = 'leve' | 'premium'

export interface Request {                // requests/{id}
  id: string; agencyId: string; requestedBy: string
  propertyId?: string; listingUrl?: string; title: string
  productionMode?: ProductionMode         // obrigatório no painel novo; ausente só em pedidos anteriores
  status: RequestStatus; priority?: 'low' | 'normal' | 'high'
  notes?: string                          // da imobiliária; visível a ela
  assignedTo?: string                     // responsável interno
  preview?: {                             // o build EM REVISÃO (canal de preview)
    build: string; tourUrl: string; maqueteUrl: string
  }
  approvedBuild?: string                  // o gerente aprova UM build: == preview.build
  approvedBy?: string; approvedAt?: Timestamp
  lastAuditId?: string
  createdAt: Timestamp; updatedAt: Timestamp
}
// Notas internas: requests/{id}/internal/notes. O Firestore não esconde campo.

export interface RequestAsset {           // requestAssets/{id}
  id: string; requestId: string; agencyId: string
  type: 'photo' | 'video' | 'floorplan' | 'document' | 'reference' | 'other'
  filename: string
  storagePath: string                     // == request-assets/{agencyId}/{requestId}/{filename}
  uploadedBy: string; createdAt: Timestamp
}

export interface BuildJob {               // buildJobs/{id}; Fase 2; só tools/buildjob.mjs escreve
  id: string; requestId: string; propertyId: string; agencyId: string
  status: 'queued' | 'building' | 'ready' | 'failed'
  build?: string; manifestUrl?: string; commit?: string; errorMessage?: string
  createdBy: string; createdAt: Timestamp; updatedAt: Timestamp
}

export interface AuditLog {               // auditLogs/{id}; só cresce
  id: string; agencyId?: string; userId: string
  entityType: 'request' | 'property' | 'agency' | 'user' | 'buildJob'
  entityId: string
  action: string                          // 'status:<novo>' | 'urls' | 'build_failed'
  visibility: 'internal' | 'agency'
  before?: Record<string, unknown>; after?: Record<string, unknown>
  timestamp: Timestamp
}
```

**Mudanças em relação à spec e à v1:**

- `Request.previewUrl` virou `preview { build, tourUrl, maqueteUrl }`.
- `approvedPreviewUrl` virou `approvedBuild`: a aprovação passa a ser de um hash de build,
  não de uma URL.
- `Property` ganhou `tourUrl`, `maqueteUrl`, `publishedBuild`, `previousBuild` e
  `publishedRequestId`.
- **`Publication` volta como o histórico de publicar/reverter**, e não como uma terceira
  cópia: ela **substitui** o AuditLog de imóvel que a v2 gravava nessas duas ações. O
  batch de publicação continua com 4 escritas (pedido, AuditLog do pedido, imóvel,
  publication). `Property` guarda o estado atual (para listar), `publications` a
  sequência, e `estado.json` o que de fato está no ar.
- **`BuildJob`** é da Fase 2 (§9). As regras já o declaram: a equipe lê; ninguém escreve
  pelo cliente. O Admin SDK do `tools/buildjob.mjs` não passa pelas regras.

**Índices** (`firebase/firestore.indexes.json`):

| Coleção | Campos |
|---|---|
| requests | agencyId, updatedAt ↓ |
| requests | agencyId, status, updatedAt ↓ |
| requests | status, updatedAt ↓ (Kanban) |
| properties | agencyId, status, updatedAt ↓ |
| requestAssets | agencyId, requestId, createdAt |
| auditLogs | agencyId, visibility, entityId, timestamp ↓ |
| auditLogs | entityId, timestamp ↓ |
| publications | agencyId, propertyId, publishedAt ↓ |
| publications | propertyId, publishedAt ↓ |

**Storage:** `request-assets/{agencyId}/{requestId}/{arquivo}` para os materiais. Nada de
build ou preview (C8). Nenhum outro prefixo tem regra.

---

## 4. Autorização baseada em `users/{uid}`

Toda regra começa em `get(/users/{request.auth.uid})`:

```text
active()     = doc existe && active == true
isAdmin()    = active && role == 'platform_admin'
isStaff()    = active && role in [platform_admin, operator]
inAgency(a)  = active && role in [agency_manager, agent] && agencyId == a
isManager(a) = inAgency(a) && role == 'agency_manager'
```

**Proteções de papel (a sua ressalva sobre D3), cada uma com o teste que falha se ela
cair:**

| Proteção | Teste |
|---|---|
| Ninguém muda o próprio `role`, `agencyId` ou `active`; o próprio usuário só muda `name` | 8 (e a mutação M1) |
| Papel de imobiliária não muda o papel de ninguém nem cria convite | 4 |
| Operador não muda papéis, não convida e não cria agência | 5 |
| Só platform_admin escreve `role`, `agencyId`, `active`, e só em combinação válida: interno **sem** agência, imobiliária **com** agência existente | 6, 8 |
| `users/{uid}` só nasce de convite: próprio uid, e-mail verificado, papel e agência **iguais ao convite**, sem campos extras | 7 |
| Inativo e sem documento não leem nada (o inativo lê só a si, para a tela explicar) | 9 |

A matriz de acesso da v1 continua valendo, com D4 (o corretor lê tudo da agência). O
corretor só **edita** o próprio pedido; o gerente edita qualquer pedido da agência.

Custo de usar documento em vez de claims: uma leitura por avaliação de regra. Benefício:
desativar vale na hora, sem esperar o token de 1 h expirar.

---

## 5. Security Rules e testes no emulator

Arquivos em `main`: [firestore.rules](../../firebase/firestore.rules),
[storage.rules](../../firebase/storage.rules), [regras.test.mjs](../../firebase/tests/regras.test.mjs).

As regras não estão transcritas aqui para não existirem duas versões. O que elas
garantem, e o teste de cada garantia:

| # | Garantia | Resultado |
|---|---|---|
| 1, 1b | Corretor A não lê nada de B (`get` e `list`; query sem filtro de agência é negada inteira). Lê tudo de A (D4). | ✔ |
| 2 | Gerente A não altera B, não cria pedido em nome de B, não liga pedido de A a imóvel de B, não anexa material a pedido de B | ✔ |
| 3 | Nota interna, log interno e convites invisíveis à imobiliária | ✔ |
| 4 | Papel de imobiliária não faz nada de área admin | ✔ |
| 5 | Operador produz, mas não aprova, não publica e não administra | ✔ |
| 6 | platform_admin lê e administra todos os tenants e publica o aprovado | ✔ |
| 7, 8, 9, 10 | Convite, autopromoção, inativo e pendente, anônimo | ✔ |
| 11 | Status só muda com AuditLog **no mesmo batch, do mesmo autor, da mesma ação** | ✔ |
| 12 | Aprovar: só o gerente da agência, só em `agency_review`, só o build em revisão | ✔ |
| 13, 13b | Publicar só o aprovado; trocar o preview derruba a aprovação; o imóvel só aponta para build aprovado de pedido dele; reverter para o anterior | ✔ |
| 14, 15 | Campos imutáveis, atribuição de corretor, criação dentro da agência | ✔ |
| 16 | `publications`: só nasce junto com a publicação do imóvel (mesmo batch, autor, build, agência e ação); registro solto ou reaproveitado é negado; não muda nem some; a agência lê o seu | ✔ |
| 17 | Storage: materiais isolados por agência e por pedido; inativo não envia | ✔ |
| 18 | Storage: HTML e SVG negados; sobrescrita negada; **nada fora de `request-assets/`**, nem para o admin (`modelos/`, `fotos/`, `plantas/`, `logos/`) | ✔ |
| 19 | `buildJobs`: a equipe lê; a imobiliária não; ninguém escreve pelo cliente | ✔ |
| 20 | **Sem compatibilidade:** coleções antigas negadas para anônimo, admin e para quem traz as claims antigas (`role: 'admin'`, `imobiliaria_id`); claim não substitui `users/{uid}` | ✔ |
| 21 | Pedido: o imóvel vinculado é sempre da imobiliária do pedido, também ao trocar (`3aa0ff6`) | ✔ |
| 22 | Reversão troca só atual ↔ anterior; `tourUrl`, `maqueteUrl` e `publicUrl` não mudam (`3aa0ff6`) | ✔ |
| 23 | `publishedRequestId` acompanha o build no ar, ao publicar e ao reverter; o histórico cita o mesmo pedido (`3aa0ff6`) | ✔ |
| 24, 25, 26 | Depois do primeiro preview, `propertyId` fica travado para todos, e o preview não pode ser removido para destravar (`40b1abd`) | ✔ |

**Prova de que os testes pegam falha.** Cada regra abaixo foi quebrada de propósito, uma por vez;
os testes indicados falharam e o arquivo foi restaurado (sha256 conferido). As mutações M8 a M14
são das correções `3aa0ff6` e `40b1abd`:

| Mutação | Testes que falharam |
|---|---|
| M1: usuário pode mudar o próprio papel | 8 |
| M2: status muda sem AuditLog | 11 |
| M3: `inAgency` sem conferir a agência | 1, 2, 12 |
| M4: `publication` nasce sem o imóvel apontar para ela | 16 |
| M5: imóvel publica sem `publication` no batch | 16 |
| M6: volta um bloco legado (`cidades` com leitura pública) | 20 |
| M7: volta um prefixo legado no Storage (`modelos/` público) | 18 |
| M8: `propertyId` trocado sem conferir a agência | 21 |
| M9: reversão pode mexer em URLs | 22 |
| M10: reversão sem trocar o pedido | 23 |
| M11: publicar sem guardar o pedido anterior | 23 |
| M12: histórico com outro pedido | 23 |
| M13: `propertyId` muda mesmo com preview | 25, 26 |
| M14: preview pode ser removido | 25 |

**O teste achou um defeito que eu tinha escrito.** O Storage avalia *sobrescrever* um
arquivo como `create`, não como `update`. `allow update: if false` sozinho deixava a
imobiliária trocar um material já enviado. Corrigido com `resource == null` no `create`
(teste 18).

**Como rodar:**

```bash
npm run test:regras
```

- `demo-painel` nunca fala com o Firebase real. O emulator precisa do JDK 21 no PATH.
- `@firebase/rules-unit-testing` 5.0.2 é devDependency da raiz.

### Promoção: as primeiras regras reais (fecha a T03)

**Situação em 24/09:** passos 1–9 feitos e integrados em `main` pelo PR #5; banco criado, regras e
índices publicados; as regras no ar são o commit `40b1abd`, conferido por sha256. Falta o passo
10 (Storage). O texto abaixo fica como registro do procedimento.

Hoje o Firestore existe e está em produção (regras no ar = `40b1abd`); só o Storage continua
pendente, porque o bucket ainda não existe. Cada passo marcado **projeto real** é executado só
com a sua aprovação.

**Antes (git, nada no projeto real)**

1. Branch próprio a partir de `main`.
2. Copiar `tasks/painel/regras/{firestore,storage}.rules` para `firebase/`.
3. Mover `regras.test.mjs` para `firebase/tests/`, lendo `../firestore.rules` e
   `../storage.rules`. Apagar `tasks/painel/regras/firebase.json`: o teste passa a usar o
   `firebase.json` da raiz, o mesmo do deploy.
4. `firebase/firestore.indexes.json` com os índices da §3, e `"indexes"` no bloco
   `firestore` do `firebase.json`.
5. `package.json`: `@firebase/rules-unit-testing@5.0.2` como devDependency e o script
   `test:regras`. Registrar o JDK 21 em `DEPENDENCIAS.md`.
6. `npm run test:regras` → 22/22. Commit.

**Firestore (projeto real)**

7. Criar o banco:

   ```bash
   npx firebase firestore:databases:create "(default)" --location=southamerica-east1 --edition=standard --delete-protection=ENABLED --project imobilaria-deccb
   ```

   - **Local imutável:** o banco não muda de região depois de criado. Criar o `(default)`
     também fixa a "localização padrão de recursos do Google Cloud" do projeto, que vale
     para um App Engine futuro e também é imutável.
   - **O bucket do Storage não fica preso a essa escolha:** desde 30/10/2024, o local do
     bucket é escolhido à parte.
   - **Custo:** a cota gratuita do Spark cobre o piloto: 1 GiB, 50 mil leituras, 20 mil
     escritas e 20 mil exclusões por dia, e 10 GiB de saída por mês. É um banco gratuito
     por projeto, e é este. O PITR (cobrado) fica desligado, que é o padrão.
   - **Exclusão:** com a proteção ligada, apagar exige desligá-la antes.
   - **Regras ao nascer:** o CLI avisa que o banco novo nasce com regras fechadas.
     Exceção: um release `cloud.firestore` de algum deploy antigo passaria a valer; não
     conferi se existe. O passo 8, logo em seguida, cobre os dois casos.
   - **O que não muda:** Hosting, sites, Storage e Auth. A API do Firestore já está
     ativa: na conferência de D2, ela respondeu 404 ao banco, e não 403.
   - **Equivalente no Console:** Firestore → Criar banco de dados → Standard → ID
     `(default)` → `southamerica-east1` → modo de produção.
8. Logo em seguida:

   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes --project imobilaria-deccb
   ```

   - **Nunca** `firebase deploy` sem `--only`: levaria o site do mapa junto.
   - **Não** incluir `storage` enquanto não houver bucket.
9. No simulador de regras do Console, conferir três casos, todos **negados**:
   - anônimo `get /agencies/x`;
   - autenticado `create /users/<outro uid>`;
   - anônimo `get /cidades/x`.

**Storage (projeto real, depois: A5 na §13)**

10. Plano confirmado → bucket criado → `npx firebase deploy --only storage --project
    imobilaria-deccb`. No primeiro deploy, o CLI pede permissão para o Storage ler o
    Firestore. É preciso aceitar.

**Rollback:**

- **O que é:** publicar uma regra que nega tudo (`allow read, write: if false`), pelo
  Console (Regras → editar → Publicar) ou por `git revert` e o passo 8. Leva segundos e
  não apaga dado.
- **Quando acionar:** uma regra permitindo algo que um teste diz que não, ou uma negação
  que trava o painel em produção.
- **O que não volta:** o banco. A localização é permanente, e apagar exige desligar a
  proteção contra exclusão.

---

## 6. Estratégia de cache

**Princípio:** nome que muda com o conteúdo é imutável. Nome fixo é ponteiro, pequeno e
`no-cache`. Não há terceira categoria.

A medição que dita isso já está no repositório: o Hosting **não responde 304**, então
revalidar um HTML de 14 MB custa os 14 MB. Por isso o HTML pesado nunca tem nome fixo. O
nome fixo aponta para ele, com cerca de 1 KB.

| Caminho | Exemplo | Cache-Control |
|---|---|---|
| Build do imóvel | `/b/<id>/<build>/tour.html`, `maquete.html`, `manifest.json` | `public, max-age=31536000, immutable` |
| Tiles de quintal | `/quintais/<hashDoDado>/*.bin` | `public, max-age=31536000, immutable` |
| Ponteiro do tour | `/imovel/<id>` (≈1 KB) | `no-cache` |
| Ponteiro da maquete | `/maquete/<id>` (≈1 KB) | `no-cache` |
| Estado publicado | `/estado.json` | `no-cache` |
| Raiz e 404 | `/`, `/404.html` | `no-cache` |

**Ponteiro:** OG tags do imóvel (o preview do WhatsApp lê o HTML cru) + `location.replace`
para o build atual, preservando `?` e `#`. É o mesmo padrão do `index.html` que já roda
no site do mapa.

**Republicar** troca o alvo do ponteiro. Quem já abriu o imóvel busca de novo o ponteiro
(`no-cache`, 1 KB), recebe o endereço do build novo e baixa só ele. Tiles e maquete que
não mudaram vêm do cache.

**Links velhos com hash:** o site guarda o build atual e o anterior de cada imóvel. Um
link para um build já removido cai no `404.html`, que redireciona `/b/<id>/…` para
`/imovel/<id>`. Quem guardou o link de um build antigo chega na versão atual.

**Site do mapa (`firebase.json`), medido no ar em 24/09 com HEAD:**

| URL | Resposta | Cache-Control |
|---|---|---|
| `/` | 200, 315 B, aponta `sao-carlos-exteriores-f16b0250b705` | `no-cache` ✔ |
| `/mapa/imovel-monte-dos-cedros-37.html` | **404** | `max-age=31536000, immutable` ✘ |
| `/mapa/sao-carlos-v16-moveis.html` | **404** | `max-age=31536000, immutable` ✘ |
| `/mapa/sao-carlos-exteriores-64a4258bfc48.html` | 302 → `f16b0250b705.html` | `max-age=31536000, immutable` ✘ |

- **Nenhum tour está no ar hoje.** Então ninguém tem tour velho guardado. O limite que
  eu tinha apontado na primeira versão não existe.
- **O defeito real é outro:** a regra `/mapa/**` carimba `immutable` também em **404 e
  redirect**.
  - Quem pediu a URL de um tour antes de ele existir guarda o 404 por um ano. Publicar
    depois nessa mesma URL não o alcança. É mais uma razão para as URLs novas ficarem
    num site novo.
  - O 302 do mapa antigo para o atual fica guardado por um ano. Quando sair o próximo
    mapa, quem seguiu o link antigo continua indo para o `f16b…`.

**Correção proposta:**

- Sai: `/mapa/**` → `immutable`.
- `immutable` só em `/mapa/sao-carlos-exteriores-*` (pega o nome com e sem `.html`, por
  causa do `cleanUrls`) e em `/mapa/quintais/**`.
- `no-cache` em `/`, `/index.html`, `/mapa/imovel-*` e `/mapa/sao-carlos-v16-moveis*`.
- Redirects de mapas antigos passam a apontar para **`/`** (o ponteiro), e não para outro
  hash. Um redirect guardado para `/` continua certo para sempre.
- `/mapa/imovel-<id>.html` vira 302 para `<site-imoveis>/imovel/<id>`, sob a regra
  `no-cache`.
- Um teste pequeno falha se um nome fixo cair numa regra `immutable`.

**Site das miniaturas:** as 3 maquetes (3,3 a 4,0 MB) saem com `max-age=0,
must-revalidate`. Não ficam velhas, mas cada visita baixa o arquivo inteiro de novo.
No fluxo novo, a maquete vive no build (imutável), atrás de um ponteiro de 1 KB.

---

## 7. Publicação individual por imóvel

**Um site de Hosting só para imóveis:** `imobilaria-deccb-imoveis`, com config própria
`firebase.imoveis.json`. É o mesmo padrão do `firebase.v17.json` e do
`firebase.miniaturas.json`, criado pela mesma razão escrita lá: "não existir comando que
suba um e derrube o outro". O site do mapa e o das miniaturas não são tocados.

```text
publicacao/                          gitignored; na máquina de quem publica
  builds/<id>/<build>/               saída do build_imovel.py; imutável, nunca sobrescrito, permanente
    tour.html  maquete.html  manifest.json
  site/                              = `public` do firebase.imoveis.json: exatamente o próximo
                                     deploy, remontado do zero a cada operação; descartável
    preview (B3):
      b/<id>/<build>/…               só o build em revisão
      quintais/<hashDoDado>/*.bin    tiles compartilhados
    live (B4):
      index.html  404.html  estado.json
      imovel/<id>                    ponteiro do tour      (tourUrl), sem extensão
      maquete/<id>                   ponteiro da maquete   (maqueteUrl), sem extensão
      b/<id>/<build>/…               builds no ar: atual + anterior de cada imóvel
      quintais/<hashDoDado>/*.bin    tiles compartilhados
```

O build contém só `tour.html`, `maquete.html` e `manifest.json`: sua identidade é o conteúdo
dos dois HTMLs, e um ponteiro mutável dentro dele contradiria isso. Os ponteiros são do B4
(`promover`/`reverter`). `site/` nunca é atualizado no lugar: a montagem nasce em
`publicacao/.site-*`, é conferida inteira e só então substitui `site/`
(`pipeline/publicar_imovel.py montar-preview` e `montar-live`).

Os ponteiros são **arquivos sem extensão**: o arquivo físico `imovel/<id>` é a própria URL
pública, sem `cleanUrls` e sem redirect. O `firebase.imoveis.json` os serve com
`Content-Type: text/html; charset=utf-8` e `no-cache`. O ponteiro leva os metadados do
`tour.html` do build aprovado (nunca do cadastro, que pode ter mudado depois da aprovação),
`og:url` do próprio ponteiro e `location.replace()` para o build, preservando `?` e `#`.

### Garantia central: o build de um imóvel nunca é refeito na publicação de outro

Publicar X = copiar **um diretório de build já existente** (conferido byte a byte pelo
`manifest.json`) + trocar **dois ponteiros** + atualizar `estado.json`. Os arquivos dos
outros imóveis não são gerados de novo; são os mesmos bytes que já estão no ar.

Antes de todo deploy, `publicar_imovel.py`:

1. Baixa o `estado.json` **do site no ar**, e não de uma cópia local: `arquivos` traz o
   sha256 de cada arquivo que o projeto gerencia no snapshot, exceto o próprio
   `estado.json`. `/__/**` é reservado e injetado pelo Firebase Hosting (por exemplo
   `/__/firebase/init.js` e `init.json`, em toda versão) e fica fora do inventário e da
   comparação. Nenhum outro arquivo extra é aceito.
2. Compara com a montagem em `publicacao/site/`.
3. **Aborta** se houver qualquer diferença fora de `b/<X>/`, `imovel/<X>`,
   `maquete/<X>` e `estado.json`. Isso também pega uma cópia local desatualizada:
   se outra pessoa publicou depois, o `estado.json` do ar não bate com a cópia.
4. Faz o deploy (atômico no Hosting).
5. Em caso de falha, desfaz as mudanças locais.

`ponytail:` uma pessoa publica por vez. A conferência pega cópia desatualizada, mas não
dois deploys simultâneos. Quando houver mais de um publicador, o passo 1 vira uma trava
no Firestore.

### Estrutura de preview no Hosting

- **Canal de preview por imóvel:** `firebase hosting:channel:deploy imovel-<id>
  --expires 30d`, recurso nativo do Hosting.
- O canal recebe só `b/<id>/<build>/` + `quintais/`. O site no ar não muda, e o preview
  não expõe outros imóveis.
- O preview fica em `https://imobilaria-deccb-imoveis--imovel-<id>-<aleatório>.web.app/b/<id>/<build>/tour.html`.
- A URL contém o hash. Um preview novo muda a URL, e a regra do Firestore tira o pedido
  de `approved`.
- **Build once, promote the exact artifact.** O `build` (sha256 de `tour.html` +
  `maquete.html`) é a identidade funcional. O **artefato aprovado** é esse build mais os bytes
  exatos de `tour.html`, `maquete.html` e `manifest.json`, e o manifest carrega a proveniência
  (`commit`, `gerado_em`, `fontes`), que muda a cada materialização mesmo quando tour e maquete
  coincidem. Preview → aprovação → live promove **o mesmo diretório** de `publicacao/builds/`:
  o build não é rematerializado entre essas etapas, e `build_imovel.py` não roda de novo depois
  da aprovação.
- `montar-preview` devolve `manifest_sha256`. `montar-live promover` exige
  `--manifest-aprovado <sha256>` e recusa um `manifest.json` local diferente dele. Todo build que
  já estava no ar e continua no snapshot tem de bater, byte a byte, com os hashes que o
  `estado.json` registrou (manifest incluído). `reverter` não pede aprovação nova: os dois builds
  já estiveram no ar, e o estado já registra os bytes de cada um.
- **O painel carrega a identidade do artefato; ninguém copia hash à mão.** Ele lê o
  `manifest.json` do preview, calcula o `manifestSha256` dos bytes servidos (não de um JSON
  reinterpretado) e o grava no preview. O gerente, ao aprovar, congela `approvedBuild` +
  `approvedManifestSha256`, e o comando de promoção que o painel mostra usa os dois. As regras
  exigem o sha256 no preview e a igualdade com ele na aprovação e na publicação: uma aprovação
  sem a identidade do manifest não publica.
- **O registro confere o artefato exato no ar, não só o build.** O `estado.json` já traz, em
  `arquivos`, o sha256 de `b/<id>/<build>/manifest.json`. O painel só registra a publicação se o
  build no ar for o `approvedBuild` **e** esse hash for o `approvedManifestSha256`; a reversão
  exige o `previousBuild` com o manifest que o pedido anterior (`previousRequestId`) aprovou.
  Mesmo build com outro manifest é recusado, e um inventário sem esse hash (ou malformado)
  também. A conferência roda no botão "Conferir o site" e de novo no clique que grava; a
  segunda leitura é a autoridade. Nenhuma regra muda: o Firestore não vê o site.

### Fluxo completo

```text
operador   python pipeline/build_imovel.py <id>
             → publicacao/builds/<id>/<build>/        (não sobrescreve; mesmo conteúdo = mesmo hash)
operador   python pipeline/publicar_imovel.py montar-preview <id> <build>  + deploy do canal
             → canal imovel-<id>; o JSON traz build, tour, maquete, manifest e manifest_sha256
painel     operador cola a URL do tour. O painel lê o manifest.json do canal, calcula o
             sha256 dos bytes, confere se o imóvel é o deste pedido e grava
             preview {build, tourUrl, maqueteUrl, manifestSha256}
             → status agency_review                                       [batch + AuditLog]
painel     gerente abre o preview e aprova → approvedBuild + approvedManifestSha256
             = os do preview                                             [batch + AuditLog]
operador   python pipeline/publicar_imovel.py montar-live promover <id> <build>
             --estado <estado.json do ar> --manifest-aprovado <approvedManifestSha256>
             (o MESMO diretório do preview; o painel mostra este comando já montado com o
             build e o manifest aprovados)
             (a Fase 1 confere build + manifest; a Fase 2 também confere approvedBuild no Firestore)
             → ponteiros apontam o build; estado.json atualizado; deploy do site de imóveis
painel     admin clica "Registrar publicação". O painel relê /estado.json DO SITE no próprio
             clique e só grava se o build no ar == approvedBuild E
             arquivos["b/<id>/<build>/manifest.json"] == approvedManifestSha256
             → request published + property.publishedBuild/tourUrl/maqueteUrl
                                                   [batch: AuditLog do pedido + Publication]
reverter   python pipeline/publicar_imovel.py montar-live reverter <id> --estado <estado.json do ar>
             → ponteiro volta para o build anterior (ainda no ar)
             → no painel, ação "rollback", conferida contra o build e o manifest que o
               pedido anterior aprovou                                 [batch + Publication]
```

**Os dois bloqueadores que você apontou:**

- **Cache (C5):** o ponteiro é `no-cache`, e o conteúdo tem nome novo a cada build.
- **Deploy conjunto (C7):** o build de outro imóvel não é refeito, e a conferência
  contra o `estado.json` do ar aborta qualquer mudança fora do imóvel publicado.

As duas garantias precisam ser **exercitadas uma vez num site real** antes de o painel
depender delas. Isso exige criar o site (§11).

---

## 8. Modelo `tourUrl` + `maqueteUrl`

| Campo | Valor | Muda quando |
|---|---|---|
| `tourUrl` | `https://imobilaria-deccb-imoveis.web.app/imovel/<unitId>` | nunca (é ponteiro) |
| `maqueteUrl` | `https://imobilaria-deccb-imoveis.web.app/maquete/<unitId>` | nunca (é ponteiro) |
| `publicUrl` | `= tourUrl` (D5) | se um dia a URL principal for outra (ex.: ficha estática da T06) |
| `publishedBuild` | hash do build para onde os dois ponteiros apontam | a cada publicação ou reversão |

- O tour e a maquete saem do **mesmo build**. Eles se referenciam por caminho relativo
  (`maquete.html` ↔ `tour.html`) e nunca misturam versões.
- **URLs no ar hoje (conferido em 24/09):**
  - tour: **nenhum** (`/mapa/imovel-*.html` responde 404);
  - maquete: as 3 do piloto em `imobilaria-deccb-miniaturas.web.app/maquete-<id>.html`.

  Até a primeira publicação pelo fluxo novo, `maqueteUrl` pode apontar para elas pela
  ação `urls` (auditada), e `tourUrl` fica vazio. Nada se perde.
- O site das miniaturas continua sendo a galeria e os estudos; o fluxo novo não mexe nele.

---

## 9. Contrato painel ↔ pipeline Python

O pipeline **não importa Firebase** e não depende do painel. O contrato são três
artefatos:

**1. `manifest.json` do build**, gravado por `build_imovel.py` e servido junto do build:

```json
{
  "schema": 1,
  "imovel": "monte-dos-cedros-37",
  "build": "a1b2c3d4e5f6",
  "gerado_em": "2026-09-24T03:00:00+00:00",
  "commit": "5af6235",
  "fontes": { "plantas_fornecidas/monte-dos-cedros-37/unidade.json": "<sha256>", "…": "…" },
  "arquivos": { "tour.html": { "bytes": 15204464, "sha256": "…" }, "maquete.html": { "…": "…" } },
  "tiles": "/quintais/d9ef5bf4b34f/",
  "publico": { "tour": "/imovel/monte-dos-cedros-37", "maquete": "/maquete/monte-dos-cedros-37" }
}
```

`build` = os 12 primeiros hex do sha256 de `tour.html` + `maquete.html`. Mesmo conteúdo,
mesmo diretório; conteúdo novo, diretório novo.

**2. `estado.json` do site de imóveis**, gravado por `publicar_imovel.py`:

```json
{
  "schema": 1,
  "imoveis": { "monte-dos-cedros-37": { "atual": "a1b2c3d4e5f6", "anterior": "0f9e8d7c6b5a", "em": "…" } },
  "arquivos": { "imovel/monte-dos-cedros-37": "<sha256>", "b/monte-dos-cedros-37/a1b2c3d4e5f6/tour.html": "<sha256>", "…": "…" }
}
```

`arquivos` = cada arquivo gerenciado do snapshot, exceto o próprio `estado.json`. `/__/**`
(reservado do Firebase Hosting) nunca entra. O painel lê dele o sha256 de
`b/<id>/<atual>/manifest.json`: é a identidade do artefato no ar que o registro compara com a
aprovação. Cada imóvel guarda só `atual` e `anterior`:
promover move `atual → anterior`, reverter troca os dois, sem gerar build algum.

**3. Saída dos comandos:** código 0 = ok; diferente de 0 = falha, com a mensagem na
última linha do stderr. Em caso de sucesso, uma linha JSON no stdout.

**Fase 1:**

- O operador cola a URL do preview; o painel lê o `manifest.json` ao lado dela.
- O admin registra a publicação; o painel lê o `estado.json` do site.
- Os dois arquivos levam `Access-Control-Allow-Origin` do domínio do painel, e nada
  mais precisa de CORS.

**Fase 2 (BuildJob):**

- `tools/buildjob.mjs` (Node) reaproveita `firebase/admin.js`, que já existe. Ele lê o
  mesmo `manifest.json` e atualiza `buildJobs/{id}`:
  `queued → building → ready (build, manifestUrl) | failed (errorMessage)`.
  Nova tentativa = novo job.
- `publicar_imovel.py promover` passa a chamar `node tools/buildjob.mjs aprovado <id>
  <build>` e **recusa** promover se o Firestore não tiver `approvedBuild == build`. A
  trava sai do registro e entra no próprio deploy.
- O Python continua sem dependência de Firebase. Nada de fila ou worker (§19 da spec).

---

## 10. Mudanças mínimas no pipeline atual

| Arquivo | Mudança | Tamanho |
|---|---|---|
| `pipeline/recorte.py` | `Recorte` aceita `prefixo_tiles` e reescreve `parcelTiles.prefix`, que ele **já** reescreve por imóvel. O tour busca com `new URL(prefix + chave, location.href)`, então `/quintais/<hash>/` funciona de qualquer pasta. | ~3 linhas |
| `pipeline/imovel.py` | `gera(…, canonica=None)`: `og:url` = ponteiro estável; sem `og:image` enquanto a imagem não existir (hoje sai sempre, T07). Repassa `prefixo_tiles`. | ~6 linhas |
| `pipeline/build_imovel.py` | **novo**: um imóvel → `publicacao/builds/<id>/<build>/`. Reaproveita `imovel.gera`, `pagina_maquete.py --unidade --mapa tour.html`, `_cabeca` (para os ponteiros) e `sha256`/`snapshot` do `preparar_piloto`. Não sobrescreve. | ~80 linhas |
| `pipeline/publicar_imovel.py` | **novo**: `preview`, `promover`, `reverter` e `conferir` (simulação). Deploy com `npx firebase … --config firebase.imoveis.json`. | ~120 linhas |
| `firebase.imoveis.json` | **novo**: site de imóveis, headers da §6, CORS em `estado.json` e `manifest.json` | ~40 linhas |
| `firebase.json` | headers da §6 + redirect de `/mapa/imovel-*.html` | ~20 linhas |
| `.gitignore` | `/publicacao/` | 1 linha |
| `tests/test_publicacao.py` | promover X não toca arquivo de Y; HTML de nome fixo nunca é `immutable` | ~40 linhas |
| `tools/publicar_aberto.py` | **isolar, não consertar:** uma guarda no topo que aborta com "legado: apaga `publicado/mapa/` inteiro; use `pipeline/publicar_imovel.py`". O fluxo novo nunca o chama. Mudança **explícita**, só com sua aprovação. | 2 linhas |

**Não mudam:**

- `preparar_piloto.py`: continua montando a base local completa em `releases/`.
- `montar.py` e `publicar.py`: o mapa da cidade tem o próprio fluxo.
- O renderizador.

---

## 11. Conflitos C1–C16: situação

A numeração é a deste documento. Na sua mensagem, a ordem era outra: o seu C1 é o C2
daqui, o seu C3 é o C5, e assim por diante.

| # | Conflito | Situação |
|---|---|---|
| C1 | A spec não tem a seção dos 14 itens | Resolvido na v1 (12 + 2) |
| C2 | "Modelo atual" sem código | **Resolvido (D2):** legado vazio; projeto novo; nenhuma compatibilidade |
| C3 | Regras atuais inseguras | **Resolvido.** As antigas nunca protegeram dado (sem banco nem bucket). As novas são as primeiras do projeto: 28/28 no emulator, 14/14 mutações detectadas, publicadas em 24/09 (`40b1abd`). Falta só a parte de Storage da T03. |
| C4 | Um projeto, um dono das regras | `firebase.json` continua dono das regras; painel e imóveis em sites com config própria |
| C5 | Cache de 1 ano em `/mapa/` | **Bloqueador.** Estratégia na §6; limite para quem já cacheou, também na §6 |
| C6 | Duas URLs por imóvel | `tourUrl` + `maqueteUrl` (§8) |
| C7 | Deploy do site inteiro | **Bloqueador.** Site de imóveis + build imutável + ponteiro + conferência contra o ar (§7) |
| C8 | Storage para builds | Storage = materiais; Hosting = builds e previews. Nada migra. |
| C9 | Sem Java | Resolvido: JDK 21 portátil em `~/.jdks/` |
| C10 | Rotas dinâmicas × site estático | D1: `?id=` |
| C11 | A raiz é do pipeline | Painel em `painel/`, com `package.json` próprio |
| C12 | `publicar_aberto.py` apaga `mapa/` | Isolado: o fluxo novo não o chama; guarda de 2 linhas proposta (§10) |
| C13 | Nota interna na mesma página | `requests/{id}/internal/notes`, só para a equipe (teste 3) |
| C14 | `Property.previewUrl` duplicado | O preview mora no `Request` |
| C15 | Recharts | Fase 3 |
| C16 | Branch atual com mudanças não commitadas | O painel nasce em branch próprio a partir de `main`. O redirect não commitado do `firebase.json` (64a4 → f16b) **já está no ar** (conferido): o arquivo local é a verdade do deploy e não pode ser descartado. |

**Achados novos desta rodada:**

- **N1.** Sobrescrever no Storage é `create`, e não `update`. Achado pelo teste 18 e
  corrigido nas regras propostas (§5).
- **N2.** `pipeline/publicar.py` nomeia o mapa `<cidade>-<variante>.html`. O nome é fixo,
  mas cai sob `immutable`: é o mesmo defeito do C5 no mapa da cidade. A correção de header
  da §6 cobre; a T04 ("nome por hash") é a correção de raiz.
- **N3.** Nenhum tour está no ar (404). A regra `/mapa/**` carimba `immutable` em 404 e
  em redirect: um 404 visto uma vez fica guardado por um ano, e o redirect do mapa antigo
  prende o visitante ao mapa atual (§6).
- **N4.** `imovel._cabeca` sempre emite `og:image` para `preview-<id>.jpg`, mesmo sem a
  imagem existir. A mudança da §10 corrige no fluxo novo.
- **N5.** D2, conferida via API em 24/09, só leitura, antes da criação do banco:
  - Firestore: `databases.list` vazio; `(default)` responde 404.
  - Storage: nenhum bucket; a API do Firebase Storage nunca foi ativada.
  - Os únicos recursos do projeto Firebase são o `hostingSite`.
- **N6.** `tools/upload_modelo.js` grava `modelos/<imobiliaria>/<imovel>.glb`, e
  `tools/firebase_check.js` grava `_diagnostico/` e `.firebaserc`. Os dois usam o Admin
  SDK, que ignora as regras.
  - **Isolados** desde o commit `081da98`, hoje em `main` pelo PR #5: o código antigo foi, sem
    mudança, para `*.js.legacy`, extensão que o Node recusa executar. O ponto de entrada
    virou um stub sem import que sai com código 1.
  - Não foram apagados. Nenhum script, passo do pipeline ou documento operacional os
    chama.
  - `firebase/admin.js` fica sem guarda: a Fase 2 o usa.
- **N7. Endurecimento futuro, não implementado (decisão de 24/09).** Hoje só o painel confere
  que o preview registrado é da unidade do pedido, lendo o `manifest.json` (`lerPreview`). As
  regras também poderiam exigir que `preview.tourUrl` contenha `/b/<pipelineUnitId>/<build>/`.
  Ficou de fora de propósito: isso acoplaria as Security Rules ao formato atual das URLs do site
  de imóveis. Rever se o formato for congelado ou se surgir escrita de preview fora do painel.

---

## 12. O painel: pastas, rotas e componentes

```text
painel/                        Next.js, output: 'export'; package.json próprio (a raiz é do pipeline)
  src/app/
    login/
    (agency)/                  RoleGate: agency_manager | agent
      dashboard/  properties/  properties/view/  requests/  requests/new/  requests/view/  team/
    admin/                     RoleGate: platform_admin | operator
      page.tsx (Kanban)  requests/  requests/view/  properties/  properties/view/
      agencies/  agencies/view/  users/
  src/lib/
    firebase.ts                SDK cliente; conecta no emulator em dev
    types.ts                   §3
    status.ts                  transições, rótulos pt-BR, colunas do Kanban
    changeStatus.ts            ÚNICA escrita de status: batch {request + auditLog}
    session.tsx                AuthProvider: Auth + users/{uid} ao vivo; aceita convite
    queries.ts                 agencyId sempre presente para papéis de imobiliária
    publicacao.ts              lê manifest.json (preview) e estado.json (publicação)
  src/components/              AppShell, RoleGate, StatusBadge, RequestTable, RequestKanban,
                               RequestForm, AssetUploader, RequestDetail, ReviewPanel,
                               PublishPanel, InternalNotes, PropertyTable, CopyLinkButton,
                               InviteForm, UsersTable
firebase.painel.json           site imobilaria-deccb-painel (só hosting)
```

- **Rotas (D1):** `/properties/view?id=`, `/requests/view?id=`,
  `/admin/requests/view?id=` e assim por diante. O export estático não gera `[id]`.
  Para a equipe interna, `/admin/requests/new/leve` e `/admin/requests/new/premium`
  congelam o produto antes de preencher imobiliária, imóvel e link.
- **Fora da Fase 1:**
  - `/settings`: ainda não há o que a imobiliária configure;
  - `/analytics` e `/admin/analytics`: Fase 3;
  - `/admin/builds`: Fase 2;
  - `/admin/publications`: o histórico (`publications`) aparece na página do imóvel,
    sem rota própria.
- **Kanban:**
  - Recebidas: `submitted`, `waiting_materials`
  - Produção: `accepted`, `production`
  - Revisão: `internal_review`
  - Aprovação: `agency_review`, `approved`
  - Publicado: `published`
- **`PublishPanel`** só habilita "Registrar publicação" quando o `estado.json` do site
  mostra o `approvedBuild` no ar com o `approvedManifestSha256`.
- **`CopyLinkButton`** copia sempre `tourUrl`/`maqueteUrl` (ponteiros), nunca a URL de
  build com hash.

---

## 13. Ordem: dois trilhos

Os trilhos não se esperam. O único ponto de contato é o contrato da §9:

- O painel só **lê** `manifest.json` e `estado.json`.
- Até o trilho B publicar o primeiro imóvel, o registro de publicação é exercitado com
  arquivos de exemplo servidos localmente.

```text
TRILHO A — infraestrutura do painel
Firestore → regras → Emulator → Fase 1 → Storage depois

TRILHO B — publicação 3D
cache → build por imóvel → preview → promoção → confirmação no site
```

**Trilho A**

- **A1. Firestore:** checklist da §5, passos 1–7. As regras já ficam em `firebase/` antes
  de criar o banco, para o deploy vir logo em seguida. A criação do banco é ação no
  projeto real e depende da sua aprovação.
- **A2. Regras:** passos 8–9. Fecha a parte Firestore da T03.
- **A3. Emulator do painel:** Auth + Firestore + Storage, com seed das agências
  fictícias (D6).
- **A4. Fase 1:** login e convite → agências e usuários → imóveis → pedidos → status →
  aprovação → registro de publicação conferido contra o `estado.json`. Os materiais só
  no emulator.
- **A5. Storage:** plano confirmado → bucket → passo 10. Liga o envio de materiais em
  produção e fecha a T03.

**Trilho B**

- **B1. Cache:** o cache do site do mapa (`firebase.json`) + teste. O deploy do mapa pede
  aprovação.
- **B2. Build por imóvel:** `build_imovel.py` → `publicacao/builds/<id>/<build>/` com
  `manifest.json`.
- **B3. Preview:** canal `imovel-<id>` no site `imobilaria-deccb-imoveis`. Criar o site
  pede aprovação.
- **B4. Promoção:** `publicar_imovel.py promover|reverter`, com a conferência contra o
  `estado.json` do ar.
- **B5. Confirmação no site:** exercitar **com um imóvel**: build → canal → promover →
  republicar → reverter. Medir que o ponteiro troca e que os bytes do outro imóvel não
  mudam.

**Com você, sem ordem entre si:**

- o plano e o bucket (A5);
- o site `imobilaria-deccb-imoveis` (Trilho B);
- a guarda do `publicar_aberto.py`.

**Depois dos dois trilhos, Fase 2:** BuildJob e a trava de aprovação dentro do próprio
`promover`.

**Andamento em 24/09:** A1–A4 concluídos e em produção; A5 (Storage) pendente. Trilho B não
começou: agora deve partir de `main`, com a integração do painel concluída (§14), porque o
pipeline de `main` é o atual.

**Andamento em 25/09 (Trilho B):** B1, B2 e B3 em `main`. O B3 real passou: o build do
Cedros `39234fb6c9bc` foi para o canal de preview `imovel-monte-dos-cedros-37` do site
`imobilaria-deccb-imoveis`, com 242 arquivos enviados; a versão registra 244 por causa dos
dois reservados `/__/firebase/init.*`. Os bytes do preview são iguais aos do build (sha256
de `tour.html`, `maquete.html` e `manifest.json`), e o live continua vazio, sem release.

Depois, o hotfix #11 fez o `tour.html` preservar o `#fragmento` ao acrescentar `?em=`. Isso
mudou o build do Cedros para **`215965d37d7d`** (o `tour.html` com 16 bytes a mais, a
maquete idêntica), que é o candidato atual para o live. Ele foi revalidado no mesmo canal:
242 arquivos, bytes iguais aos do build, `#x` preservado na URL, ida e volta tour ↔ maquete
com os quintais sem erro, e o live ainda vazio. O `39234fb6c9bc` nunca foi publicado no live.

**Primeira publicação live (25/09, 15:04 UTC, B4b):** Cedros `215965d37d7d` no ar em
`imobilaria-deccb-imoveis`. A versão `56630f63b23116cc` tem 249 caminhos: os 247 do snapshot
mais os 2 reservados `/__/firebase/init.*`, sem nenhum outro extra. Os 247 baixados do live
são iguais ao snapshot local, e os 246 inventariados batem com o `estado.json`. Os headers
estão como a §6 define, e o ponteiro público leva ao build preservando `?` e `#`. O
`manifest.json` no ar (`c2b2a242…`) não é o do preview (`064d47fa…`): o build foi
rematerializado em outro worktree entre o preview e o live. `tour.html` e `maquete.html` são
idênticos, mas `commit`, `gerado_em` e o hash de uma fonte mudaram. Foi essa descoberta que
fechou o contrato "build once, promote the exact artifact" (acima). O live não foi
redeployado: sob URL `immutable`, trocar o manifest seria pior. O `c2b2a242…` fica congelado
como a proveniência oficial da primeira publicação, e o `064d47fa…` é o do preview que a
antecedeu. O próximo teste real de promoção e rollback espera um segundo build legítimo de
algum imóvel.

Com a conferência do artefato exato no registro (B5c), o painel **recusa** registrar essa
publicação a partir do preview `064d47fa…`: o live tem o mesmo build com outro manifest. Para
registrá-la, o canal de preview passa a servir o mesmo diretório de build que foi ao live
(manifest `c2b2a242…`), sem tocar no live; aí o painel calcula `c2b2a242…`, o gerente aprova
esse hash, e o registro confere com o que já está no ar.

---

## 14. Estado de produção e integração (27/09/2026)

| Peça | Estado |
|---|---|
| Firestore | `(default)` em `southamerica-east1`, Standard, proteção contra exclusão; 12 índices compostos `READY`: os 9 originais, 2 da paginação (PR #23) e 1 do contador de imóveis publicados (PR #24) |
| Regras do Firestore | publicadas = `firebase/firestore.rules` de `main` `3afc464` (PR #25: o aceite consome o convite): ruleset `d965b18a-49dc-490a-8fe8-9b9073038373`, sha256 `f9764b0745e7f755…`, lido de volta pela API e igual byte a byte ao arquivo (26/09, 02:48 UTC; relido em 27/09, igual ao de `main` `8593a8e`). O anterior, para rollback, é `5e46af7` (ruleset `bb95ee6b…`, sha256 `8c163114ad5d4f59…`) |
| Storage | não existe; `storage.rules` só no emulator |
| Web App | `painel` (`1:163406298617:web:a78e1724d239a144f55128`); config pública em `painel/.env.production`, com `NEXT_PUBLIC_SITE_IMOVEIS` apontando o site de imóveis (PR #17) |
| Hosting do painel | site `imobilaria-deccb-painel`, target `painel`, `firebase.painel.json`; no ar = `main` `3afc464` (paginação #23, nomes por id e Início com `count()` #24, convite consumido e usuários paginados #25), versão `ef9c4d811735cfb8` (26/09, 03:00 UTC); o primeiro deploy foi `8139863` |
| Site de imóveis | `imobilaria-deccb-imoveis`, target `imoveis`, `firebase.imoveis.json`. Live = versão `716c753dc02158ca` (27/09, 01:19 UTC; 252 caminhos = 250 do snapshot + 2 reservados). No `estado.json`: Cedros `atual` = `34331f1ceb9d` (manifest `99712b35d7bf6f3c…`) e `anterior` = `215965d37d7d` (manifest `c2b2a242…`, a primeira publicação). O canal `imovel-monte-dos-cedros-37` serve o `34331f1ceb9d` (expira em 26/10) |
| Outros sites | `imobilaria-deccb` (mapa, versão `1855179e3c93c2eb` de 22/09) e `imobilaria-deccb-miniaturas` (versão `2769c1c05b7090a4` de 23/09) não foram tocados; os redirects do mapa estão em `main` desde o PR #2 |
| Contas em produção | o `platform_admin` e um `agency_manager` da Cardinali (conta de teste, entrou pelo convite normal com e-mail verificado). `invites` está vazio: o aceite consome o convite, e o convite legado já aceito saiu em 26/09 pelo "Cancelar" (única escrita, conferida por `updateTime` de todos os documentos) |
| Dados | 1 imobiliária (Cardinali), 2 usuários, 0 convites, 1 imóvel (Cedros: `publishedBuild` `34331f1ceb9d`, `previousBuild` `215965d37d7d`), 2 pedidos publicados, 2 registros em `publications` e 17 AuditLogs (contados em 27/09) |

**Deploy, sempre com escopo explícito** (o `firebase.json` da raiz reúne Firestore, Storage e o
Hosting do mapa; um `firebase deploy` sem `--only` publicaria tudo). Cada um só com aprovação:

```bash
npx firebase deploy --only firestore:rules --project imobilaria-deccb
npx firebase deploy --only firestore:indexes --project imobilaria-deccb
npx firebase deploy --only hosting:painel --config firebase.painel.json --project imobilaria-deccb
npx firebase hosting:channel:deploy imovel-<id> --only imoveis --config firebase.imoveis.json --project imobilaria-deccb --expires 30d
npx firebase deploy --only hosting:imoveis --config firebase.imoveis.json --project imobilaria-deccb
```

A ordem que foi usada na entrada do B5 em produção, e que vale para qualquer mudança que torne as
regras mais estritas: as regras primeiro; depois, um smoke de leitura do painel que ainda está no
ar; só então o painel novo. As escritas antigas que as regras novas recusam (preview e aprovação
sem o hash do manifest) são esperadas nesse intervalo e não pedem rollback. O rollback só entra
se o login, a leitura ou a navegação quebrarem.

Para índice novo (PRs #23 e #24): os índices primeiro (`--only firestore:indexes`; o CLI compila as
regras como checagem, mas não as publica); esperar os novos ficarem `READY`; smoke do painel que
está no ar; só então o painel novo. O emulador não exige índice, então a combinação que depende
de fusão de índices (status + "só as minhas") foi conferida em produção, pela API, antes de fechar.

**Primeiro ciclo real (25/09/2026, 18:04–18:08 UTC), sem deploy de imóvel.** O live do Cedros já
era o artefato oficial. O painel só formalizou no Firestore o que o Hosting já servia:

1. O admin cadastrou o Cedros (`pipelineUnitId` `monte-dos-cedros-37`), só com os campos de
   identificação.
2. O gerente da Cardinali criou o pedido, vinculado ao imóvel.
3. A equipe aceitou, pôs em produção e registrou o preview do canal. O painel calculou o
   sha256 dos bytes do `manifest.json` servido (`c2b2a242…`) e o pedido foi para `agency_review`.
4. O gerente aprovou: `approvedBuild` `215965d37d7d` e `approvedManifestSha256` `c2b2a242…`,
   iguais aos do preview.
5. O admin conferiu o site: o `estado.json` do live mostrou o build aprovado com o manifest
   aprovado. Registrar publicação releu o `estado.json` no próprio clique e só então gravou o
   pedido (`published`), os campos de publicação do imóvel e o registro em `publications`, com
   um AuditLog por passo.

Antes de o ciclo ser possível, o preview do canal servia outro manifest do mesmo build
(`064d47fa…`, de uma rematerialização). Com a conferência exata do B5c, o registro seria recusado;
por isso o canal foi remontado a partir do mesmo diretório de build que foi ao live, sem tocar
no live.

**Segundo ciclo real: a sanitização do Cedros (concluída em 27/09/2026, 01:32 UTC).** O build
`215965d37d7d` no ar levava 4 anúncios reais do `roca.com.br` na vitrine do tour e 3 estudos 3D
derivados das fotos deles. O PR #33 os trocou em `main` por anúncios fictícios e por um pacote de
estudos vazio. Isto foi uma exceção controlada ao congelamento de produção do ciclo de higiene,
com cada etapa autorizada em separado.

1. **Build.** `34331f1ceb9d`, feito a partir de `main` `8593a8e`, sem mudar código nem dados.
   Comparado com o `215965d37d7d`:
   - a `maquete.html` é idêntica byte a byte;
   - no `tour.html`, 21 dos 24 blocos são iguais, e o HTML fora dos scripts também. Mudaram só
     `__imoveis` (4 anúncios da Roca viraram 3 fictícios), `__listingModels` (3 estudos viraram
     `[]`) e o comentário da vitrine no JavaScript;
   - `roca.com.br` passou de 8 ocorrências para 0;
   - das 164 entradas do manifest mudaram 4: as 3 do #33 e o `pagina_maquete.py` do #21, que não
     afeta a maquete do Cedros.
2. **Preview** no canal. Os bytes servidos de tour, maquete e manifest são iguais aos do build.
   Tour e maquete funcionam, os quintais carregam, e não houve erro no console.
3. **Painel** (01:07–01:16 UTC). Pedido `3EaRqRJRfn6JJRlWsAy0`, com o preview registrado com o manifest
   `99712b35d7bf6f3c…`. A gerente aprovou esse par.
4. **Promoção.**
   - O `estado.json` do ar foi relido na hora: `atual` = `215965d37d7d`, sem `anterior`.
   - `montar-live promover` rodou com o manifest aprovado.
   - O snapshot montado tem 244 dos 246 caminhos do ar iguais. Só mudaram os 2 ponteiros e
     entraram os 3 arquivos do build novo, e o build anterior está preservado byte a byte.
   - O deploy foi só de `hosting:imoveis` (01:19 UTC).
5. **Smoke público.**
   - O `estado.json` no ar é igual ao snapshot, e `/imovel` e `/maquete` levam ao build novo.
   - A maquete é igual à anterior.
   - Não há nenhum `roca.com.br`, os 3 anúncios são `[FICTÍCIO]`, e o estudo 3D fica oculto.
   - Os 47 quintais respondem 200, sem erro de console ou de rede.
   - Os bytes e o manifest no ar são iguais aos aprovados.
   - Nenhum outro site ganhou release.
6. **Registro.** O imóvel ficou com `publishedBuild` `34331f1ceb9d`, `previousBuild`
   `215965d37d7d`, `publishedRequestId` `3EaRqRJRfn6JJRlWsAy0` e `previousRequestId`
   `vFninsZXhvAOAorZtoNM`. Em `publications` entrou o `nGR6fzbTWmCyzU0g5Kp6` (publish, anterior
   `215965d37d7d`), e cada transição tem o seu AuditLog.

**A armadilha do "Voltar para produção"** apareceu nesse ciclo.

- **O que o painel mostra.** No estado `approved`, o único botão de status é "Voltar para
  produção", e o "Registrar publicação" só aparece **depois** de "Conferir o site".
- **O que aconteceu.** Às 01:27 o pedido saiu de `approved` por quatro cliques de status:
  `production` → `internal_review` → `production` → `internal_review`. Todos ficaram auditados.
- **Por que não houve publicação indevida.** As regras só permitem publicar a partir de
  `approved`, e só o gerente pode colocar o pedido em `approved`. A armadilha de interface alterou
  o fluxo, mas a barreira de autorização segurou a publicação.
- **A volta,** pelo fluxo normal:
  1. o admin registrou de novo o mesmo preview, com o mesmo build e o mesmo manifest (01:32:04);
  2. a gerente aprovou de novo (01:32:11);
  3. o admin conferiu o site e registrou (01:32:20).
- **Correção pendente,** depois do congelamento: pedir confirmação para o "Voltar para produção" ou
  tirar esse botão do estado `approved`.

**Reversão.** Desde 27/09 existe, pela primeira vez, um par legítimo `atual`/`anterior`, no ar e no
Firestore. `montar-live reverter` e a ação de reversão do painel levariam o Cedros de volta ao
`215965d37d7d`. **Ela não foi exercitada, por decisão:** não se testa em produção sem motivo. Os
testes do emulador cobrem a mecânica.

**Integração (concluída em 24/09):** o branch `painel/t03-regras` entrou em `main` pelo PR #5,
com **merge commit** (`37114b2`; sem squash, rebase nem cherry-pick). Naquela data, `40b1abd`
(regras) e `8139863` (painel) eram os commits do que estava no ar; o estado atual é o da tabela
acima. O único conflito foi o bloco `scripts` do `package.json`.
