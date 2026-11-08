# Produção, entrega e pós-venda

Abra uma oportunidade cadastrada e escolha **Produção e entrega**. Cada oportunidade permite um acompanhamento, com nome do projeto e campos de briefing preenchidos pelo operador. A página **Projetos e entregas** reúne esses acompanhamentos, com busca por nome/empresa, filtro de etapa, paginação e as datas registradas de próxima ação e pós-venda.

O briefing resumido segue os temas do documento técnico fornecido: responsáveis, localização, características do imóvel, escopo/recursos, materiais recebidos e pendentes, identidade visual/referências e cronograma/aprovações. Dados técnicos e serviços não são inferidos. Os originais de Briefing técnico, Entrega final e Pós-venda permanecem disponíveis na Biblioteca da marca, sem alteração.

## Origem comercial e revisão

Ao criar o projeto, a proposta de origem é opcional. Para vinculá-la, o CRM exige que pertença à mesma oportunidade e tenha revisão interna vigente, na versão/hash exatos. Preserva uma cópia das condições daquela versão, consultável em **Condições comerciais de origem**. O conteúdo não é copiado automaticamente para o briefing nem atualizado por alterações comerciais posteriores. Revise o que foi efetivamente combinado antes de preencher a produção.

Criar um projeto, selecionar uma proposta ou mudar uma etapa não registra contratação, pagamento, assinatura ou aceite de cliente. O CRM não muda a oportunidade, envia mensagens ou acessa o provedor de e-mail nesse fluxo.

## Etapas e entrega

As etapas são manuais: **Briefing → Produção → Revisão → Pronta para entrega → Entregue → Pós-venda → Concluído**, além de **Cancelado**. É possível reabrir etapas sem perder os dados anteriores; o histórico guarda os valores anteriores e novos. Não há exclusão de projetos nesta etapa.

Para Entregue, Pós-venda ou Concluído, informe um link HTTPS público e uma data declarada da entrega, igual ou anterior ao dia atual do calendário pessoal `America/Sao_Paulo`. Registrar a entrega é uma declaração do operador; não confirma recebimento ou utilização pelo cliente. O link não é aberto, verificado, publicado ou enviado pelo CRM. Links com credenciais, endereços locais, IPs ou domínios de exemplo são recusados pelo mesmo validador usado na pesquisa. Não coloque senhas ou credenciais de acesso nos campos.

Registre em **Orientações e materiais disponibilizados** somente o que foi entregue. A data de pós-venda exige uma data de entrega e deve ser igual ou posterior a ela. Uma próxima ação com data exige a descrição da ação. Datas são registros de acompanhamento: não criam lembretes, tarefas automáticas ou envios.

Use **Feedback e pendências do cliente** para registrar o retorno recebido. O CRM não infere satisfação, consentimento para depoimento ou encerramento de pendências. Os modelos originais de pós-venda ajudam a preparar a conversa; o salvamento do acompanhamento não gera uma mensagem.

## Histórico, concorrência e dados

O salvamento exige a versão aberta. Edições concorrentes são recusadas; reabra o projeto para conferir os dados atuais. Salvar sem mudanças não cria evento ou versão. Repetir a mesma criação com a mesma chave não duplica o projeto, e outra chave para a mesma oportunidade é recusada.

Edições pendentes são protegidas ao trocar de aba, oportunidade ou página. A interface permite descartá-las explicitamente. O histórico do projeto mostra até 100 eventos próprios mais recentes, com mudanças e versões. Esses eventos também aparecem no contexto comercial da empresa/oportunidade.

O projeto e a cópia comercial ficam no cache local e nos backups DPAPI existentes. Nenhum anexo é carregado, e o acompanhamento não é exportado para agentes. A migração 0009 é aditiva. Para reversão, preserve o cache atual e restaure uma cópia de backup; downgrade destrutivo está desabilitado.

## API

- `GET /api/projects/options`: etapas disponíveis.
- `GET /api/projects`: busca, etapa, oportunidade e paginação.
- `POST /api/projects`: confirmação explícita, chave idempotente, versão atual da oportunidade e origem comercial opcional.
- `GET /api/projects/{id}`: campos, origem preservada e histórico do projeto.
- `PUT /api/projects/{id}`: confirmação e versão atual.

Rotas protegidas pela sessão e origem locais existentes; entradas estritas e limitadas, consultas parametrizadas e texto renderizado pelo React. Não há chamadas de rede para os links registrados.

## Verificação

234 testes passaram, incluindo 27 casos desta etapa: preenchimento, datas e links inválidos, controle de versões, idempotência, origem de outra oportunidade, proposta sem revisão, preservação da origem e ausência de acesso a correio/credenciais. Build TypeScript/esbuild passou; auditoria npm sem vulnerabilidades. No navegador separado, foram conferidos criação, bloqueio de origem em rascunho, proteção de alterações, produção, entrega, pós-venda, feedback, histórico, filtros e reabertura após reinício do servidor. Em 320, 768, 1024 e 1440 px, sem overflow horizontal ou erros de console. Dados fictícios ficaram no banco temporário.
