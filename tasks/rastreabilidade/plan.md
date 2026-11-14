# Implementação da rastreabilidade — 04/10/2026

Mapa e continuidade até os testes locais aprovados pelo usuário; requisito
adicional: resolver preserva corretor original para futuro contato WhatsApp.
[Mapa](../../CAPABILITIES-rastreabilidade.md) e
[contrato](../../rastreabilidade/CONTRATO.md) são a base desta entrega.

- [x] Contrato e specs por módulo registrados; manter sites offline e M1.1 intacto.
- [x] Backend: vínculo/escopo/revogação; testes de dois corretores e duas agências.
- [x] Backend: visita idempotente, filho compartilhável e recibo privado.
- [x] Cliente público: endereço rastreável, compartilhar e manter links internos.
- [x] Métricas: aceite, sessão, pausa/inatividade, retries e limites de tempo.
- [x] Relatórios: agregados/distintos corretos e escopo por papel.
- [x] Painel: criar/listar/copiar/desativar links, relatório dos últimos 30 dias.
- [x] Pacote local do wrapper/API, sem alterar publisher/fonte congelada.
- [x] Integração real em navegador/emulador e regressão Node/Python/painel/regras.
- [x] Conferir manifesto M1.1 e registrar resultado/limites no índice atual.

Resultado e evidências: [entrega local](entrega-2026-10-04.md). A publicação
da API/sites, botão WhatsApp e sessões físicas M1.1 não fazem parte deste
checklist concluído.

Backend, wrapper e painel seguem o mesmo contrato e podem ser desenvolvidos
em paralelo. Root integra e confere autorização, consistência e navegação real.
Detalhes/telefones de contato e botão WhatsApp pertencem à futura entrega;
nenhuma mensagem será enviada. Não modificar o plano urbano histórico.
