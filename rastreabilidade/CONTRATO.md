# Contrato v1 — rastreabilidade

Mapa aprovado: [CAPABILITIES-rastreabilidade](../CAPABILITIES-rastreabilidade.md).
Serviço Node/Firebase Admin; o adaptador de publicação usa Node 22 no Firebase Functions.
Os cadastros de usuários e imóveis são preservados; a rastreabilidade grava suas próprias coleções.

## HTTP

API base configurável; JSON, respostas de erro `{error:string,code?:string}`, tamanho máximo
8 KiB. IDs opacos aleatórios de ao menos 192 bits; sem IDs de corretor na URL
pública. Gerenciamento/relatório exigem Firebase ID token e perfil vivo.

| Método/rota | Corpo/query | Resposta |
|---|---|---|
| `GET /links` | `propertyId` | `{links:Link[],truncated:boolean}` |
| `POST /links` | `{propertyId,brokerUid?,attemptId}` | `{link:Link}` |
| `POST /links/:id/revoke` | `{}` | `{ok:true}` |
| `POST /open` | `{token,attemptId,receipt?}` | `Opening` |
| `POST /sessions` | `{visitId,receipt,visitorKey,page}` | `{sessionId,nextSeq}` |
| `POST /events` | `Event` | `{accepted:boolean,seq:number}` |
| `GET /report` | `propertyId,from,to,brokerUid?` (ISO UTC) | `Report` |

`Link={id,propertyId,agencyId,brokerUid,brokerName,status,createdAt,url}` é
privado ao painel. `url` abre `/acesso.html?l=<token>&pagina=maquete` na origem
configurada. Gerente/interno pode escolher corretor ativo da agência; corretor
somente a si. Revogação de raiz impede resolução e eventos dos descendentes.
Uma operação com o mesmo attemptId e conteúdo incompatível retorna 409.

`Opening={visitId,receipt,shareToken,shareUrl,sourceClass,destinations,
publishedBuild,propertyTitle,contact,lineageLimited?}`. `destinations` contém
`tour` e `maquete`, URLs absolutas `/b/<pipelineUnitId>/<publishedBuild>` mais
`tour.html`/`maquete.html` na origem pública configurada. Build: 12 hex minúsculos.
`Link.createdAt` é ISO UTC string; status `active|revoked`.
`contact={brokerName,whatsappNumber:null|string}` consulta somente
o perfil do corretor original (`users.publicContact.whatsapp`, opcional,
dígitos E.164 sem '+'); não expõe e-mail/UID. O botão de WhatsApp usa somente
esse contato validado e o endereço público de encaminhamento, sem recibos,
independentemente da escolha de métricas. Sem número, fica oculto.

`sourceClass=root|forwarded|own_return|uncertain`. Entrada por raiz não comprova
envio direto pelo corretor. Token público, recibo privado e URL original são
separados. Retomada com recibo não cria outro filho; copiar a barra compartilha
o shareToken, jamais o recibo. Sem posse recuperável, classificar limites da
origem explicitamente; a raiz continua conhecida. GET não cria visitas.

`Event={visitId,receipt,sessionId,seq,type,page,section,activeMs}`. Types:
`view|heartbeat|pause`; page: `tour|maquete`; section:
`ficha|mapa|interior|planta|maquete|planta2d|planta3d|visita|carregando`.
O servidor aceita somente campos conhecidos, sequência idempotente e números
inteiros finitos. Tempo creditado é limitado ao intervalo observado no
servidor, no máximo 30 s por envio. Sessão inativa expira em 30 min.
Expiração retorna HTTP 410 com código `SESSION_EXPIRED`; visita expirada usa
`VISIT_EXPIRED`; vínculo desativado usa `LINK_DISABLED`.
Conflitos de sequência retornam 409 `EVENT_CONFLICT`; o cliente consulta
`/sessions` para obter `nextSeq` e faz no máximo uma nova tentativa por evento.
Troca de identidade após recusa e novo aceite inicia outra sessão.

Sessões/métricas exigem aceite explícito na página; `visitorKey` é aleatório
local, nunca um identificador de pessoa. Sem aceite há navegação e sublink,
sem sessão analítica nem identidade persistente de audiência.

`Report={from,to,propertyId,summary,byBroker,bySource,bySection,coverage}`;
`summary={sessions,estimatedVisitors,pageViews,activeMs,rootEntries,
forwardedEntries,ownReturns,uncertainEntries}`;
`byBroker=[{brokerUid,brokerName,...summary}]`;
`bySource=[{sourceClass,sessions,estimatedVisitors,activeMs}]`;
`bySection=[{page,section,views,activeMs}]`;
`coverage={consentedOnly:true,truncated:boolean,retentionDays:30}`.
`truncated` indica corte pelo limite de 500 sessões consultadas; retenção é
informada separadamente, sem falso parcial pela latência da janela padrão.
Distintos são calculados para todo o período, sem somar únicos diários ou
corretores. Range máximo 30 dias; consulta limitada/paginada, parcial sinalizada.
Sem sessões, zero sessões observadas não significa zero pessoas que abriram.
O período seleciona sessões iniciadas em `[from,to)` e mostra seus contadores
acumulados; não representa um recorte horário de eventos individuais.

## Persistência e segurança

Coleções novas: `trackingLinks`, `trackingVisits`, `trackingSessions`,
`trackingAttempts`. Clientes Firestore não leem nem escrevem essas coleções;
painel usa a API. Administração SDK revalida papel, imóvel, agência e corretor
ativos e pertencimento. `assignedAgentId` não determina o dono de um link.

Visitantes persistidos são pseudônimos derivados por imóvel; recibos não são
guardados em claro e jamais aparecem em URL/log/relatório. Retenção de sessões
30 dias; TTL é manutenção, com prazo validado na leitura mesmo antes da remoção.
Máxima profundidade limitada; ao atingir o limite, compartilhar continua
funcionando e o limite da cadeia é marcado, sem bloquear o imóvel.

CORS exato para as origens configuradas. Validar destinos (sem open redirect),
tamanho, frequência, tokens, atribuição e idempotência em transações. Logs só
evento técnico, requestId, rota modelada, status e duração; sem token público,
recibo, IP, payload, ID de navegador ou PII.

## Cliente público

Wrapper mesma origem em `rastreabilidade/public/`, sem alterar `/b/**` ou fonte
congelada. Preservar pagina/modo/hash; decorar links do conteúdo para conservar
a entrada rastreável, inclusive abrir em nova aba. Saída para origem diferente
encerra a observação e não atribui visitas desse destino.

Heartbeat 15 s, pausa oculta/inatividade 60 s. Relógio monotônico, uma seção
principal por intervalo, pausa/flush nas mudanças e retomada bfcache. Sem
coleta por frame, coordenadas, cômodos, texto ou replay. Retry mantém seq/payload.
Recusa/revogação de coleta limpa identidade analítica e interrompe os eventos.
Fila offline tem no máximo 64 eventos; eventos excedentes são descartados,
sem estimar tempo perdido nem ampliar o armazenamento indefinidamente.

## Verificação

Node: `node --test tests/test_rastreabilidade_*.mjs`; regressão `npm test`.
Regras/emulador: `npm run test:regras`; painel: `npm run test:painel`.
Tipos/build: `npm --prefix painel exec -- tsc --noEmit` e
`npm --prefix painel run build` (dependências dev instaladas).
Rodada congelada: `python tools/preparar_sessoes_m1_1a.py --verificar publicacao/m1-1a/rodada-2026-10-04`.
Demonstrar localmente dois corretores, visitante da raiz, repasse com cópia da
barra, reload idempotente, pausa, relatório isolado e revogação da raiz.

## Responsáveis e publicações avulsas

Desde a ativação de 22/10/2026, links também podem pertencer a gestores ativos da mesma imobiliária ou à equipe interna ativa (administrador/operador). Somente a equipe interna pode atribuir um link a outro membro interno. O corretor continua restrito aos próprios links; a imobiliária e o imóvel continuam sendo verificados no servidor. Os nomes técnicos `brokerUid` e `brokerName` permanecem compatíveis.

Publicações avulsas, como o LIV Clássico, podem ser registradas em configuração confiável da API quando os dois metadados de esteira estão ausentes no imóvel. Os destinos continuam limitados a `/b/<unidade>/<build>/tour.html` e `maquete.html`. Consulte `PUBLICACAO.md` para preparar e migrar o domínio sem mudar os tokens.
