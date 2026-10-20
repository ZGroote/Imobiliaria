# Mudanças futuras do painel — 08/10/2026

Estado em 20/10/2026: os dois itens foram feitos em código, nos PRs empilhados sobre o #86 (#89 e
o PR "a imobiliária só pede"). Nada está no ar. O que falta está marcado abaixo.

## 1. Primeira fase: a imobiliária só solicita, a equipe gera o 3D

Pedido: a imobiliária/incorporadora não gera 3D sozinha. Ela abre a solicitação,
o usuário recebe uma notificação, gera a miniatura e a disponibiliza no painel
para a imobiliária aprovar.

Já existia:

- Solicitação e fluxo de status, de `submitted` até `published`, com a revisão
  da imobiliária em `agency_review` ([status.ts](../../painel/src/lib/status.ts)).
- Aprovação do build pelo gerente ([aprovacao.ts](../../painel/src/lib/aprovacao.ts)).

Feito em 20/10:

- [x] O botão "Editar planta e versões" saiu da tela do imóvel da conta, e o `Portao` de
  `painel/src/app/imoveis/planta/page.tsx` só aceita a equipe.
- [x] Trava no servidor: `authorize()` em `tools/leitura-api.mjs` só libera a equipe em
  `/property-readings` e `/gerar-maquete` (gerente e corretor do próprio imóvel: 403).
- [x] Aviso de pedido novo **dentro do painel**, para a equipe: o menu "Solicitações" e o título
  da aba mostram quantos pedidos esperam aceite, e o navegador avisa cada um que chega
  (botão "Avisar pedidos novos" pede a permissão). Só funciona com o painel aberto.
- [x] Planta e versões só para leitura: a conta não tem mais a tela; as regras continuam
  deixando ela ler as leituras do próprio imóvel, se um dia a tela voltar.
- [ ] Aviso por **e-mail**, com o painel fechado: precisa de onde rodar (Cloud Function no
  plano Blaze, ou o serviço próprio que também vai hospedar o link por corretor). Decidir
  junto com a ativação pública.

## 2. Botão de WhatsApp do corretor na página pública

Feito em 20/10 (SPEC-captura-lead, L1 + L2):

- [x] Botão "Falar com <corretor>" em `rastreabilidade/public/acesso.html`, preenchido em
  `runtime.mjs`; sem número, não aparece. O clique registra um lead por visita.
- [x] Cadastro do número no Início do painel (só o corretor, que é o dono dos links).
- [x] Teste de regra: ninguém grava o número de outra pessoa (8b em `regras.test.mjs`).

Bloqueio real: o painel e a API de rastreabilidade estão offline. O botão só
serve depois da ativação pública.
