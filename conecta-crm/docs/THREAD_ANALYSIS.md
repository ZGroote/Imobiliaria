# Análise assistida de trechos de conversa

Na conversa, abra **Análise assistida**, ao lado de **Revisão humana**. Este fluxo prepara um arquivo para uma sessão escolhida pelo operador. Não inicia Codex/Claude, não lê credenciais, não transmite e-mails e não baixa anexos.

## Preparar e exportar

1. Selecione até cinco mensagens. Nenhuma vem selecionada.
2. Revise os trechos editáveis, de até 4.000 caracteres por mensagem. O corpo é preenchido inicialmente até esse limite; ajuste o contexto e oculte dados que não queira compartilhar. O CRM não verifica automaticamente se você removeu todos os dados pessoais ou segredos escritos no trecho.
3. Escolha Codex ou Claude assistido, confirme a revisão dos trechos e use **Preparar pacote revisado**.
4. Confira o texto persistido em **Conferir trechos exatos do pacote**. Ele fica imutável; para outros trechos, prepare outro pacote.
5. Use **Baixar pacote para análise**. O navegador salva um JSON com prompt, contrato de resposta, hash e os trechos. O operador decide se e onde compartilhar esse arquivo; nada é enviado pelo CRM a um agente.

O pacote usa aliases `m1` a `m5` e a direção recebida/enviada. Não inclui automaticamente nomes/remetentes, destinatários, assunto, cabeçalhos, IDs remotos/locais de mensagens, textos não selecionados ou arquivos anexados. Esses dados podem continuar presentes **dentro do texto escolhido** se o operador não os remover. O hash exportado identifica exclusivamente o conteúdo do pacote, não o corpo completo da conversa.

Trechos, entrada imutável, vínculos e resultado ficam no SQLite pessoal, sob as mesmas permissões do cache de e-mail. Esses dados entram nos backups DPAPI existentes. O arquivo baixado pelo navegador contém os trechos em claro; eles não são apagados ou criptografados automaticamente pelo CRM. Registros de eventos guardam somente ação, ID da análise e horário.

## Importar a sugestão

Na sessão escolhida, use o prompt e o schema do pacote e peça apenas o JSON de resposta. No CRM, importe o arquivo JSON ou cole o objeto em **JSON de resultado da análise**, até 120 KB. A importação verifica:

- Identificador do pacote, hash da entrada e agente selecionado.
- Contrato estrito, tamanhos e confiança finita de 0 a 1. `auto_send_allowed` precisa ser false.
- Até seis afirmações de resumo, cada uma com evidência. A categoria sugerida também exige evidência.
- Cada citação deve aparecer literalmente em um trecho selecionado, no alias correto. Texto ocultado/não exportado não pode ser usado como evidência.
- A conversa ainda corresponde ao histórico que existia na preparação.

Resumo, razão, avisos, confiança e identidade do modelo são declarações não verificadas do resultado importado. Uma citação válida não prova que a conclusão esteja correta. O CRM mostra os trechos e oferece links às mensagens de origem para conferência. Não interpreta HTML nem executa instruções do resultado.

O resultado permanece **sugestão**. Não altera categoria efetiva, natureza humana/automática da resposta, leitura local, contatos, oportunidades, bloqueios ou filas. Para confirmar/corrigir a triagem, volte a **Revisão humana** e faça a revisão explícita da mensagem. O resumo não recebe selo de veracidade nem vira resumo canônico da caixa.

## Alterações, histórico e edições

Uma nova resposta ou alteração no conteúdo de qualquer mensagem da conversa marca o pacote anterior como **histórico alterado**. A exportação e a primeira importação ficam bloqueadas; prepare outro pacote a partir da visualização atualizada. Sugestões já importadas continuam acessíveis como histórico. Leitura local e reexecução de regras não tornam o pacote desatualizado. Vínculos acompanham as mensagens ao agrupar conversas; o conteúdo completo resultante determina se a análise permanece atual.

Reimportar o mesmo JSON é idempotente, inclusive como consulta de uma sugestão histórica. Um resultado diferente no mesmo pacote é recusado para preservar a versão anterior. Preparar novamente cria outro pacote; repetir uma requisição de preparação com o mesmo identificador e conteúdo recupera o existente.

Edições de trechos ou JSON impedem trocar de aba de conferência, escolher outro pacote, classificar, responder ou atualizar a conversa por ações que descartariam o texto. Use as ações de salvar/importar ou limpar antes de continuar. A troca de conversa mantém a proteção global de alterações não salvas do CRM.

## Limites verificados

O fluxo foi conferido com mensagens e saída fictícias em banco separado. Nenhuma mensagem real foi exportada, nenhum agente foi executado e não foi verificada a qualidade de um resumo gerado por modelo externo nesta etapa. O executor automático continua pendente de isolamento efetivo do usuário Windows e das credenciais.
