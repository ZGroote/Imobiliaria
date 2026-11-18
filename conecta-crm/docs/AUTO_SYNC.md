# Rotina local de leitura

Em **Contas e identidades → Sincronização automática**, escolha o intervalo da caixa conectada e use **Ativar rotina**. Intervalos disponíveis: 5, 10, 30 e 60 minutos. **Salvar intervalo** reinicia a contagem e solicita uma consulta em alguns segundos. **Pausar rotina** impede consultas futuras; uma que já começou pode terminar. A conta `noreply` e a demonstração ficam fora desta rotina.

A rotina funciona enquanto o processo do CRM estiver aberto. Fechar a página não encerra o processo. Encerrar o servidor interrompe a rotina; reiniciar conserva a configuração e retoma uma consulta vencida por caixa, sem disparar todos os horários perdidos. Não há serviço do Windows, tarefa agendada ou leitura quando o computador está desligado.

O painel informa última consulta automática concluída, mensagens adicionadas no último lote, operação em andamento, falha e próxima tentativa prevista. Horários são previsões: outra operação na caixa ou uma consulta lenta pode adiá-los. A caixa desconectada não pode ser ativada. Se a credencial desaparecer depois da ativação, a rotina preserva o cache, registra erro genérico e tenta novamente com espera maior. Revise a conexão ou pause nesse caso.

## Histórico e falhas

Cada execução processa uma página de até dez conversas. Mais histórico agenda uma continuação após um minuto; ao terminar, volta ao intervalo escolhido. O cursor é confirmado ao concluir a página. Uma conversa é salva somente depois de lida por inteiro. Conversas anteriores já concluídas permanecem mesmo se a próxima falhar; repetir é idempotente. Falhas dobram o intervalo entre tentativas até o teto de uma hora. A rotina não repete envios.

Botão manual, validação de conexão e rotina usam o mesmo lock por caixa. Há um trabalhador serial; duas execuções automáticas não se sobrepõem. Salvar ou pausar a configuração durante uma consulta tem precedência sobre o agendamento calculado por ela. O cliente cancela chamadas seguintes ao encerrar o processo e termina/aborta a leitura atual conforme seus timeouts antes de fechar o banco.

## Visualização e edições

A caixa consulta o estado local a cada 15 segundos. A lista sem conversa aberta é atualizada quando o cache muda. Com uma conversa aberta, aparece **Atualizar visualização**; isso permite terminar a leitura/revisão com o conteúdo que estava na tela. Com edição pendente, esse botão fica desabilitado até salvar ou descartar. A importação de novas mensagens não confirma revisões, aprova empresas ou envia mensagens.

## Backups

Uma execução automática com conversa alterada gera backup DPAPI antes da primeira gravação da conversa e depois do lote, inclusive se uma conversa posterior falhar. Sem alteração de conversa, ainda são salvos cursor, horário e auditoria, sem criar cópias redundantes. Uma falha no backup anterior impede a primeira gravação. Lotes manuais continuam gerando cópias anterior e posterior. Retenção continua manual; a rotina não apaga backups. A configuração também entra nas próximas cópias.

## Anexos sob demanda

A sincronização mantém apenas metadados, sem baixar arquivos automaticamente. A validação adicional confirmou correspondência de uma mensagem real entre Inbox e Receiving. O [fluxo de anexos recebidos](ATTACHMENTS.md) revalida essa correspondência por operação e oferece download de até 20 MB por arquivo. A conta principal ainda não tinha arquivos anexados para verificar uma transferência real; o download foi conferido com arquivo fictício em banco separado.
