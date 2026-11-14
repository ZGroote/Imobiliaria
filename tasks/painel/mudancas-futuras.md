# Mudanças futuras do painel — 08/10/2026

Estado: registradas a pedido do usuário. O item 2 foi implementado em 23/10/2026; o item 1 continua pendente.

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

## 2. Botão de WhatsApp do corretor na página pública — implementado em 23/10/2026

O servidor já resolve o corretor da raiz, mesmo após repasses, e devolve
`contact.whatsappNumber` ([modelo.mjs:125](../../rastreabilidade/modelo.mjs)).

Entregue:

- [x] Botão verde com símbolo do WhatsApp em `rastreabilidade/public/acesso.html`,
  preenchido por `runtime.mjs` com o contato do responsável original. Funciona em
  maquete, mapa e visita, sem aceite de métricas. Sem número, fica oculto.
- [x] Página **Meu perfil** para nome e celular. O painel normaliza o telefone e
  grava `publicContact.whatsapp` em dígitos E.164, sem `+`.
- [x] Regras e testes: o usuário edita somente seu próprio contato, sem mudar
  permissões; links e encaminhamentos consultam o contato atual do responsável.
- [x] Mensagem de interesse contém nome do imóvel e link público; recibos e
  identificadores privados de sessão ficam de fora.
