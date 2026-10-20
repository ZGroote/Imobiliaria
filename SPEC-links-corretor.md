# Spec — links-corretor

Objetivo: vários corretores da agência podem divulgar o mesmo imóvel por raízes
distintas, sem mudar seu responsável operacional. Consumidores: painel e
resolver público. Contrato: [rastreabilidade/CONTRATO.md](rastreabilidade/CONTRATO.md).

Estrutura: `rastreabilidade/servidor.mjs`, `rastreabilidade/modelo.mjs`, cliente
`painel/src/lib/rastreabilidade.ts` e componente de detalhe de imóvel.
Estilo: exports pequenos/validação allowlist, como `criarServidorLeituras`.
Exemplo: `const {link}=await criarLink({propertyId,brokerUid,attemptId})`.

Verificação: `node --test tests/test_rastreabilidade_servidor.mjs`,
`npm run test:regras`, `npm --prefix painel exec -- tsc --noEmit`.
Aceite: raízes distintas para dois corretores; agência cruzada/inatividade
recusadas; agente gerencia só sua raiz; gerente gerencia sua agência;
tentativa repetida idempotente; revogar bloqueia derivados e preserva histórico.

Sempre validar no servidor e manter vínculos imutáveis. Desenvolvimento e
schema locais autorizados; deploy/republicação exigem outra instrução.
Nunca expor UID/telefone escolhido pela URL nem alterar dados de produção.
