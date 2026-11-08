# Envios reais autorizados

Implementação local de comunicações autorizadas. Pesquisa pública, aceite de candidato e conexão da caixa não registram consentimento. O Resend proíbe mensagens não solicitadas e cold outreach em sua [política de uso](https://resend.com/legal/acceptable-use).

## Fluxo pela interface

1. Em **Rascunhos e fila → Autorizações**, registre endereço, perfil BR/US, origem da permissão, referência e validade. A declaração pertence ao operador: o CRM confere vínculo e validade, sem comprovar sua veracidade. Solicitação de serviço serve para o atendimento; primeiro contato e seguimento exigem opt-in explícito.
2. Revise e aprove o texto em **Rascunhos**. O destinatário deve corresponder à permissão. A resposta precisa usar a mensagem recebida mais recente, revisada como humana, e manter seu contexto.
3. Em **Envios reais**, escolha texto aprovado, permissão, campanha opcional e agenda. Preparar salva uma prévia imutável e não envia. Confira identidade, destinatário, texto, perfil, referência da permissão e horário. Aprove o envio desta prévia separadamente.
4. A fila global começa pausada. Campanhas também começam pausadas; ambas precisam estar ativas. Ativar a fila libera apenas prévias já aprovadas, conforme agenda, limites e revalidação imediatamente anterior à tentativa.
5. Acompanhe o resultado na própria prévia. Pause para impedir próximas tentativas. Uma chamada já iniciada não pode ser cancelada. Cancelar antes da tentativa preserva o registro; outra preparação exige editar e aprovar uma nova versão do rascunho.

Editar texto, mudar conversa ou alterar/revogar permissão bloqueia prévias pendentes. Descadastro/recusa bloqueia o destinatário globalmente. Não há desbloqueio automático. Erros de versão preservam a edição do operador e pedem atualização.

## Transporte e limites

Usa [POST /emails](https://resend.com/docs/api-reference/emails/send-email): um destinatário, texto simples, sem anexos/CC/BCC, remetente contact ou team conectado e Reply-To correspondente. Cada tentativa fixa conteúdo, identificador, chave de idempotência e tag crm_delivery. A tentativa é gravada antes da chamada externa. A chave do Resend permanece no Gerenciador de Credenciais do Windows; o agente não a recebe.

Limites locais: 16 tentativas por dia UTC, incluindo testes individuais; pelo menos 30 segundos entre tentativas e 30 minutos entre novos contatos/seguimentos. Estes últimos usam dias úteis, 9h–17h no fuso do destinatário. O CRM desconhece consumo por outros sistemas na mesma conta do provedor; uma recusa por limite pausa a fila. A agenda admite até sete dias; horários inválidos/ambíguos por horário de verão são recusados. Uma agenda vencida há mais de 24 horas precisa ser revista. A fila roda enquanto o servidor local está aberto, com exclusão de trabalhadores concorrentes por arquivo de lease.

Domínio/SPF/DKIM/DMARC, aprovação, contexto, permissão, bloqueios, pausas e limites são revalidados. Backup DPAPI anterior é obrigatório. Os envios já aceitos não são repetidos se a gravação da cópia local falhar.

## Incerteza e acompanhamento

Timeout, resposta inválida ou interrupção após iniciar a tentativa deixam resultado **incerto** e pausam a fila. Não existe repetição automática, inclusive após vencer a janela de idempotência de 24 horas do provedor. O reinício preserva a incerteza.

A consulta usa [GET /emails/{id}](https://resend.com/docs/api-reference/emails/retrieve-email), sem reenviar. Para reconciliar uma tentativa incerta, informe o UUID conferido no provedor. O CRM exige remetente, destinatário, conteúdo e tag da mesma tentativa; um UUID estranho não libera a fila. Se a conferência demonstrar que não houve aceite, há um registro explícito da declaração do operador, com referência. O CRM não comprova essa ausência. Isso não reenvia nem reativa nada; outra tentativa requer nova versão e novas aprovações. Uma descoberta posterior pode corrigir a declaração e bloqueia novas prévias pendentes do mesmo conteúdo.

Estados conhecidos são consultados por até sete dias: a cada minuto na primeira hora, depois a cada 15 minutos. Falha de consulta mantém o último estado confirmado e mostra aviso; também limita novas consultas. Aceita não significa entregue; entregue não significa lida por pessoa. Abertura/clique não contam como resposta humana. Devolução, reclamação e supressão registram bloqueio global.

O histórico guarda uma cópia local do texto aceito, deduplicada pelo identificador remoto. Respostas usam In-Reply-To/References quando a mensagem recebida os permite. Este transporte transacional não garante presença na pasta Enviados da API Inboxes nem agrupamento automático de toda resposta de primeiro contato. A caixa continua lendo os dados fornecidos por Inboxes; vínculos manuais de conversa/empresa/oportunidade permanecem disponíveis. Não foi implementado webhook nem disparo de anexos.

## Verificação

Testes usam transporte HTTP fictício: aprovação separada, pausa global/campanha, permissão vencida/revogada, texto/contexto alterados, bloqueios, limites, diagnóstico/backup recusados, recusa, timeout, reinício, reconciliação vinculada à tentativa e devolução. QA da interface usa banco e provedor fictícios. Nenhum e-mail real é enviado pela implementação ou pelos testes. No CRM principal a fila é mantida pausada até uso explícito do operador.
