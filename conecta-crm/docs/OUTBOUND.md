# Rascunhos e fila de simulação

## Atualização: agentes e comunicações autorizadas

A simulação descrita abaixo permanece separada. Existe também uma fila de [envios reais autorizados](REAL_DELIVERY.md), inicialmente pausada, com permissão do destinatário e aprovação específica da prévia. Aprovar somente o texto ou realizar teste individual não libera envio.


Esta etapa prepara conteúdo e testa a fila local. Não importa clientes fictícios, não envia e-mails, não cria rascunhos no Resend e não tem acesso ao Gerenciador de Credenciais. Todos os dados de rascunhos ficam no cache local fora do repositório.

## Fluxo no painel

1. Abra **Rascunhos e fila** ou use **Preparar resposta** em uma conversa.
2. Escolha a caixa e o mercado do destinatário. Uma resposta sem perfil conhecido exige escolher o mercado; uma conversa já vinculada preserva o perfil. Não há seleção por IP ou localização do operador.
3. Preencha um modelo ou escreva o texto. Campos ausentes continuam entre chaves. O rascunho pode ser salvo incompleto; ele não poderá ser aprovado assim.
4. Confira destinatário, assunto, corpo e assinatura na prévia. Para primeiro contato/seguimento, inclua endereço postal comercial e instrução de descadastro. O endereço informado deve ser real; o programa só confere preenchimento e presença no texto.
5. Salve e escolha **Aprovar esta versão**. A confirmação registra exatamente aquela versão, incluindo caixa, perfil, destinatário, texto, contexto da conversa e declarações de entrega.
6. Escolha fuso e hora do destinatário e agende **somente a simulação**.
7. Na aba da fila, retome a simulação quando desejar e use **Simular itens vencidos**. Não existe worker automático nesta etapa; agendar não causa atividade em segundo plano.

O editor avisa ao sair com alterações não salvas. Uma edição cria nova versão, remove a aprovação e cancela a simulação pendente anterior. O histórico mantém as decisões e a fila mantém a cópia imutável do conteúdo que foi aprovado. Cancelar preserva os registros.

## Modelos e documentos

A biblioteca mantém nove originais com conferência de SHA-256. Os três materiais adicionados são briefing técnico, entrega final e pós-venda/feedback, identificados por etapa. Nomes legíveis na tela não alteram os nomes ou bytes dos arquivos originais.

Os modelos de primeiro contato e resposta estão disponíveis em BR/US. Os textos de entrega e pós-venda são derivados em português dos novos materiais, com campos explícitos e vínculo ao documento de origem. Não há adaptação silenciosa para inglês. Os campos não são preenchidos com empresas, preços, prazos, contatos ou projetos inventados.

Um texto de entrega exige confirmação de que o projeto foi concluído e o acesso foi conferido. Pós-venda exige confirmação de que a entrega já ocorreu. Os documentos não são anexados automaticamente e o modelo não afirma que um termo inexistente está anexado.

## Revalidação e cadência

- Nenhuma versão entra na fila sem aprovação explícita e hash correspondente.
- Alteração de corpo, destinatário, identidade, finalidade ou confirmação de entrega revoga a aprovação.
- Mudança no histórico da conversa exige nova revisão; seguimentos ignoram respostas comprovadamente automáticas quando há cabeçalho disponível.
- Descadastro/recusa bloqueia o endereço globalmente e invalida rascunhos e itens agendados em todas as caixas.
- Novas respostas não identificadas como automáticas pausam seguimentos aprovados/agendados e exigem revisão. A falta de cabeçalhos de automação no Resend exige cautela; não é prova de resposta humana.
- A simulação revalida o rascunho, a aprovação, a cópia na fila e os bloqueios imediatamente antes de processar.
- Primeiros contatos têm intervalo mínimo de 30 minutos e até 16 por dia, na janela de dias úteis das 9h às 17h do destinatário. Respostas a conversas não consomem a cota de novos contatos.
- Se o operador simular vários itens atrasados, apenas um primeiro contato é processado por intervalo; os demais aguardam. Itens fora da janela aguardam horário comercial.
- Datas inexistentes ou ambíguas na mudança de horário são rejeitadas. Os fusos são validados com `zoneinfo` e a base `tzdata`, necessária no Windows. [Documentação do Python](https://docs.python.org/3/library/zoneinfo.html)
- O primeiro contato duplicado ao mesmo endereço é recusado mesmo se a outra versão usa outra caixa. Simulações concluídas contam para essa verificação até cancelamento explícito; elas continuam sendo apenas testes locais.

## Limites

Aprovar conteúdo não comprova autorização do remetente, SPF/DKIM/DMARC, entregabilidade, legitimidade do contato ou veracidade dos dados fornecidos. O transporte real da fila continua ausente. A fila mostra esse bloqueio independentemente de a conta estar conectada para leitura. Existe somente um [teste individual separado](SENDER_TESTS.md), com texto fixo e aprovação própria; ele não aceita rascunhos nem itens da fila e não libera campanhas.

Não há campanhas, anexos em mensagens, HTML de saída, execução automática de jobs nem assinatura eletrônica de documentos. Em futuras integrações, as mesmas validações precisarão ser aplicadas no transporte real; o simulador não deve ser convertido em envio simplesmente trocando um sinalizador.
