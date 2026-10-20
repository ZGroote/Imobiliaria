# Mudanças futuras do painel — 08/10/2026

Estado: registradas a pedido do usuário. Nada implementado.

## 1. Primeira fase: a imobiliária só solicita, a equipe gera o 3D

Pedido: a imobiliária/incorporadora não gera 3D sozinha. Ela abre a solicitação,
o usuário recebe uma notificação, gera a miniatura e a disponibiliza no painel
para a imobiliária aprovar.

Já existe:

- Solicitação e fluxo de status, de `submitted` até `published`, com a revisão
  da imobiliária em `agency_review` ([status.ts](../../painel/src/lib/status.ts)).
- Aprovação do build pelo gerente ([aprovacao.ts](../../painel/src/lib/aprovacao.ts)).

Falta:

- [ ] Tirar da imobiliária o Capturador e o "Gerar 3D". O botão "Editar planta e
  versões" aparece em `painel/src/app/(agencia)/properties/view/page.tsx:29`, e
  o `Portao` de `painel/src/app/imoveis/planta/page.tsx` aceita `agency_manager`
  e `agent`.
- [ ] Barrar também no servidor: `authorize()` em `tools/leitura-api.mjs:72`
  libera `agency_manager` e `agent` em `/property-readings` e `/gerar-maquete`.
  Esconder só o botão não impede a chamada.
- [ ] Notificar o usuário a cada pedido novo. Hoje não há notificação nenhuma.
  Decidir o canal (e-mail é o mais simples) e onde roda: o Firestore não envia
  nada sozinho; precisa de Cloud Function (plano Blaze) ou do serviço próprio.
- [ ] Decidir se a imobiliária continua vendo planta e versões só para leitura.

Verificação: no emulador, um `agent` não abre o Capturador nem consegue chamar
`/gerar-maquete` direto (403); um pedido novo dispara uma notificação.

## 2. Botão de WhatsApp do corretor na página pública

O servidor já resolve o corretor da raiz, mesmo após repasses, e devolve
`contact.whatsappNumber` ([modelo.mjs:125](../../rastreabilidade/modelo.mjs)).

Falta:

- [ ] Botão em `rastreabilidade/public/acesso.html` e preenchimento em
  `rastreabilidade/public/runtime.mjs` (onde `open()` recebe a abertura):
  `https://wa.me/<número>?text=<mensagem com o nome do imóvel>`. Sem número,
  o botão não aparece.
- [ ] Cadastro do número no perfil do painel. `firebase/firestore.rules:88` só
  deixa o usuário mudar `name`; liberar `publicContact.whatsapp`, só dígitos
  E.164 sem `+`.
- [ ] Teste de regra: ninguém grava o número de outra pessoa.

Bloqueio real: o painel e a API de rastreabilidade estão offline. O botão só
serve depois da ativação pública.
