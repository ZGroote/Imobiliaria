# Empresas, conversas e oportunidades

Para preparar uma proposta dentro da oportunidade e acompanhar os agregados do funil, consulte [Propostas e indicadores](PROPOSALS.md).

Para acompanhar o briefing, a produção, a entrega e o pós-venda, consulte [Produção e entrega](PROJECTS.md). O acompanhamento é criado expressamente dentro da oportunidade.

Esta etapa liga o cadastro revisado à rotina comercial. Todas as operações são locais: nenhuma altera a caixa remota, prepara/envia mensagens, aprova candidatos, modifica bloqueios ou inicia agentes.

## Funil de oportunidades

Abra **Oportunidades** e use **Nova oportunidade**, ou abra a ficha de uma empresa e escolha **Nova oportunidade para esta empresa**. Somente empresas que já existem no cadastro podem ser escolhidas; os candidatos da pesquisa continuam dependendo da revisão humana.

Cada oportunidade tem título, empresa, etapa, próxima ação, data opcional, notas e valor estimado opcional em BRL ou USD. As etapas são Qualificação, Contato em andamento, Demonstração, Proposta, Negociação, Ganha e Perdida. Mudar a etapa registra uma decisão do operador; não comprova contato enviado, pagamento ou assinatura de contrato.

Para valores, informe por exemplo `1500,50`, sem separador de milhares. A API armazena centavos inteiros e exige moeda quando houver valor. Zero é um valor válido; vazio significa não informado. Não há soma entre moedas diferentes nem classificação automática do valor como receita.

A data da próxima ação é um dia do calendário, acompanhado de uma descrição da ação. O filtro **Somente ações atrasadas** compara essa data com o dia pessoal em `America/Sao_Paulo`; oportunidades ganhas/perdidas não são marcadas como atrasadas. A data não agenda envio, lembrete ou execução de tarefa. Fuso e horário de envio de mensagens permanecem na fila separada.

O funil pode ser pesquisado por título/empresa e filtrado por etapa ou atraso, com paginação. As contagens refletem os filtros atuais. O editor protege alterações não salvas. Salvar exige a versão que foi aberta; outra edição concorrente impede sobrescrita silenciosa. Ao receber conflito, reabra a oportunidade para conferir a versão atual. A empresa da oportunidade é imutável; registre outra oportunidade se o contexto comercial for de outra organização.

Uma chave de criação estável evita duplicação se o navegador repetir a mesma solicitação. A chave com conteúdo diferente é recusada. Salvar uma oportunidade sem alterações não cria versão ou evento adicional.

## Vínculos na caixa de entrada

Ao abrir uma conversa de `contact` ou `team`, a seção **Empresa e oportunidade** permite vincular manualmente uma empresa cadastrada e, opcionalmente, uma oportunidade dela. O CRM não associa automaticamente pelo remetente/domínio. Uma conversa pode tratar de mais de um contexto comercial e preservar vários vínculos.

Uma oportunidade de outra empresa é recusada pelo backend. Repetir o mesmo vínculo não o duplica. Conversas da conta de demonstração não podem ser vinculadas às empresas reais.

Os botões do vínculo abrem a ficha da empresa ou a oportunidade correspondente. Na ficha da empresa e no detalhe da oportunidade, as conversas vinculadas abrem diretamente a caixa e a conversa corretas. Remover um vínculo exige **Confirmar remoção do vínculo** e preserva mensagens, empresa, oportunidade e auditoria.

Se novos cabeçalhos agruparem threads antes separadas, a sincronização move os vínculos para a conversa preservada. Contextos diferentes permanecem distintos. Duplicatas exatas são consolidadas e o histórico registra a origem e o destino do agrupamento.

## Histórico e dados

A ficha da empresa reúne oportunidades, conversas e histórico comercial. Cada oportunidade também mostra seu próprio histórico. São mantidos criação, alterações com valores anteriores/posteriores, adição/remoção de vínculos e preservação durante agrupamento. A interface mostra os 100 eventos mais recentes de cada contexto; registros anteriores permanecem no banco.

Dados ficam no cache local, incluídos nos backups criptografados existentes. Notas e valores não são incluídos na exportação de pesquisa para agentes. Essa etapa não chama o provedor, lê credenciais ou faz solicitações externas.

## API

- `GET /api/opportunities/options`: etapas e moedas.
- `POST /api/opportunities`: confirmação específica, `request_id`, empresa e dados.
- `GET /api/opportunities`: busca, empresa, etapa, atraso e paginação.
- `GET /api/opportunities/{id}`: dados, versão, vínculos e histórico.
- `PUT /api/opportunities/{id}`: confirmação e versão atual.
- `GET /api/companies/{id}/commercial`: contexto comercial e histórico da empresa.
- `GET/POST /api/mail/threads/{id}/commercial-links`: consulta/vínculo manual.
- `POST /api/mail/threads/{id}/commercial-links/{link_id}/remove`: remoção explícita do vínculo.

As rotas usam a proteção local de sessão e origem existente, validação estrita e consultas parametrizadas. Valores monetários são limitados a 1.000.000.000.000 de centavos. Não há exclusão de oportunidades nesta etapa; use Ganha ou Perdida para encerrar uma negociação, mantendo o histórico.

## Verificação

Testes de API usam banco temporário e adaptadores que falham se houver acesso ao correio/credenciais. Cobrem aprovação explícita, consistência de moeda/data, idempotência, versões concorrentes, filtro de atraso no calendário pessoal, isolamento entre empresas, remoção de vínculos e agrupamento posterior de threads.

O fluxo no navegador foi conferido em instância temporária separada, com empresas/conversas identificadas como fictícias: cadastro, valor em USD, mudança de etapa, data, vínculo, ficha da empresa, navegação e remoção. Nenhum dado fictício foi inserido no cache principal.
