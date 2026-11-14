# Spec — captura-lead (PLANO, não implementado)

Objetivo: na página pública do imóvel, o visitante fala com o corretor pelo
WhatsApp ou deixa seus dados num formulário. Os dois caminhos geram um lead
atribuído ao corretor da raiz, à visita e, quando houver, à unidade. O lead
aparece no painel. Esta é a primeira lacuna do `replica/parity.md` (leads 0/100).

Estende o contrato v1 de [rastreabilidade/CONTRATO.md](rastreabilidade/CONTRATO.md).
O ponto de extensão `Opening.contact={brokerName,whatsappNumber}` já existe e
já é validado no servidor e no cliente (`runtime.mjs:validateOpening`). Esta
spec cria o que faltava: o cadastro do telefone, o botão, o formulário e a
lista no painel. Nenhuma dependência nova. Nada de deploy, republicação ou
dado de produção.

## Decisões em aberto (do usuário, antes de L3)

1. **Texto do consentimento LGPD** do formulário, com versão (`consentVersion`).
2. **Retenção do lead.** Sugestão: 180 dias, removido depois por TTL. Rastreio usa 30 dias, mas lead é contato comercial.
3. **Quem vê o lead.** Sugestão: o corretor da raiz vê os dele; o gerente vê a agência; a plataforma vê tudo. Mesmo recorte do relatório.
4. **Clique no WhatsApp sem aceite de métricas.** Sugestão: registrar mesmo assim. O evento fica preso à visita, que já existe sem aceite, e não usa `visitorKey` nem sessão.
5. **Aviso ao corretor** (e-mail ou push). Sugestão: nesta etapa não há aviso; o lead só aparece no painel.
6. **Branch base.** A rastreabilidade já está no `main` (PR #116, com painel e regras do PR #86). A unidade (L5) depende do LIV.

## Fases

| fase | entrega | tamanho | depende de |
|---|---|---|---|
| L1 | telefone público do corretor | S | — |
| L2 | botão WhatsApp + registro do clique | S | L1 |
| L3 | formulário + coleção `leads` | M | decisões 1–3 |
| L4 | leads no painel | M | L2/L3 |
| L5 | unidade no lead (LIV) | M | L3, branch do LIV |

**L1 — telefone.** `users.publicContact.whatsapp` passa a ser gravável pelo
próprio usuário e pela administração. A regra só aceita dígitos E.164 sem `+`
(`^[1-9][0-9]{7,14}$`), o mesmo padrão do servidor. Hoje `firestore.rules:89`
só deixa o próprio usuário mudar `name`. O campo entra no perfil do painel. Teste
em `npm run test:regras`: um corretor não grava o telefone de outro, e o formato
inválido é recusado.

**L2 — WhatsApp.** O botão "Falar com {brokerName}" aparece em `acesso.html`
somente quando `whatsappNumber` não é `null`. O link é
`https://wa.me/<n>?text=<msg>`, e a mensagem leva o título do imóvel e a
`shareUrl`, nunca o recibo. Antes de abrir o WhatsApp, a página chama
`POST /leads {visitId,receipt,attemptId,channel:'whatsapp',unitId?}`. Falha
nessa chamada não bloqueia o WhatsApp. O lead registrado não tem PII do visitante.

**L3 — formulário.** Usa a mesma rota, com `channel:'form'` e os campos
`name` (2–120), `phone` (dígitos, 10–15), `email?`, `message?` (≤1000),
`consent:true`, `consentVersion` e um campo-isca vazio (honeypot). O servidor
segue a allowlist de `campos()`:
- não aceita `consent` ausente ou falso;
- não deixa o cliente escolher `brokerUid`; ele sai da visita;
- trata o `attemptId` repetido de forma idempotente, e o mesmo id com conteúdo diferente devolve 409;
- limita a 3 formulários por visita por hora.

Os logs continuam só com requestId, rota, status e duração: nome, telefone e
e-mail nunca vão pro log.

`Lead={id,schemaVersion:1,propertyId,agencyId,brokerUid,visitId,channel,
contact?{name,phone,email},message?,unitId?,consentVersion?,status:'novo',
createdAt,expiresAt}`. A coleção é `leads` e só o Admin SDK lê e grava, como as
`tracking*`.

**L4 — painel.**
- `GET /leads?propertyId&from&to`: o servidor revalida papel, agência e corretor com `contexto()`.
- `POST /leads/:id/status {status}`, com os estados `novo|contatado|descartado`.
- A lista fica no detalhe do imóvel, ao lado de `components/rastreabilidade.tsx`.
- O cliente em `lib/rastreabilidade.ts` valida a resposta com `closed()`/`list()`, como `validarRelatorio`.
- O relatório (`Report.summary`/`byBroker`) ganha `contacts`.

**L5 — unidade.** Quando o visitante abre a ficha de uma unidade, a página
dentro do iframe avisa a moldura por `postMessage({type:'imovel:unidade',unitId})`.
A moldura só aceita a mensagem se ela vier da mesma origem e se `unitId`
passar no padrão `identifier`. O servidor confere se a unidade existe em
`salesInventory/{propertyId}/units`; se não existir, descarta o `unitId` em vez
de recusar o lead. Só builds novos mandam esse aviso; os `/b/**` congelados não
mudam. "Lead com comportamento" (o 2º item da paridade) é cruzar
`lead.visitId` com as seções da sessão, e só quando houver aceite. Isso fica
numa spec própria.

## Verificação

- `node --test tests/test_rastreabilidade_leads.mjs`, com estes casos:
  - atribuição vem da visita;
  - consentimento obrigatório;
  - honeypot;
  - idempotência e 409;
  - limite de frequência;
  - isolamento entre agências;
  - expiração;
  - nenhuma PII no log.
- `npm run test:regras` (L1).
- `npm --prefix painel exec -- tsc --noEmit` e o build do painel.
- Demonstração local com emulador: dois corretores, clique no WhatsApp, formulário, lista e troca de status, e outra agência sem acesso.

Ficam de fora até pedido explícito: deploy, mensagem real no WhatsApp, telefone
real cadastrado e integração com CRM.
