# CRM Prospecção — Conecta Imóveis 3D

Implementação incremental do plano v2 de 08/11/2026, preservado em `docs/`. Aplicação separada do site e do painel Firebase. Caixa local e integração de leitura do Resend implementadas; a conexão com a conta real depende da chave cadastrada pelo operador. Ainda não é o MVP completo.

## O que funciona

- API FastAPI, SQLite com WAL, chaves estrangeiras e migração Alembic versionada.
- Adaptador de leitura substituível e mock com 100 mensagens fictícias, 25 conversas e quatro pastas.
- Sincronização incremental transacional e idempotente; retomada após mudança de UIDVALIDITY sem perder o histórico. Falha de leitura reverte o lote.
- Busca textual local FTS5, filtro por pasta/conta/não lidas, paginação, histórico e marcação de leitura somente no cache.
- Triagem por regras PT/EN para orçamento, demonstração, dúvida técnica, interesse, recusa, descadastro e mensagens automáticas com cabeçalhos disponíveis. Toda sugestão exige revisão humana.
- Etiquetas P0–P3, filtro por classificação e evidência vinculada à mensagem de origem. O texto novo da resposta tem precedência sobre o assunto herdado e o histórico citado.
- Lista global de bloqueio com normalização de endereço, descadastro/recusa detectados durante importação e bloqueio manual confirmado pelo operador. Reimportar ou classificar de novo não duplica o bloqueio nem seu evento de auditoria.
- Interface React/TypeScript com as cores fornecidas, estados vazios, erros e layouts responsivos.
- Perfis BR/US com idioma e site separados; envio de campanhas desabilitado.
- Contas `contact`, `team` e `noreply` registradas conforme confirmação do operador. `contact` e `team` podem ser conectadas pelo painel; `noreply` aparece somente como referência de notificações.
- Leitura real pela API oficial de Inboxes do Resend, com mensagens recebidas/enviadas, pastas, paginação, agrupamento remoto e retomada em lotes de até 10 conversas.
- Rotina local de sincronização automática por caixa, com intervalo, pausa, retomada, tentativas espaçadas e aviso de novidades sem interromper edições. Funciona enquanto o servidor estiver aberto.
- Consulta e download sob demanda de anexos recebidos, até 20 MB por arquivo, com vínculo da mensagem revalidado, nome seguro e auditoria de preparação. Arquivos são entregues ao navegador sem abrir ou armazenar cópia no servidor.
- Chave no Gerenciador de Credenciais do Windows, cache fora do repositório e backups via DPAPI com restauração lado a lado verificada.
- Acervo original em `branding/assets/original`, com hashes em `branding/manifest.json`. Os originais foram copiados sem edição. Derivações BR/US das propostas são geradas separadamente e exigem revisão das condições.
- Biblioteca da marca com prévias dos quatro PNGs e download dos nove originais, incluindo os cinco documentos Word. O download confere o hash registrado e recusa originais alterados.
- Prévia de primeiro contato leve em PT-BR/EN-US, com seleção explícita do mercado. Os textos preservam a marca e os sites correspondentes; campos de empresa, responsável e endereço postal permanecem em aberto. Os modelos podem ser preenchidos no editor, sempre pendentes de revisão e sem envio.
- Novos originais de briefing, entrega final e pós-venda, identificados por etapa comercial. A biblioteca contém nove arquivos preservados.
- Editor de rascunhos, resposta vinculada à conversa, preenchimento de modelos, prévia em texto simples e salvamento local, inclusive com campos ainda pendentes.
- Aprovação explícita vinculada à versão e ao hash do conteúdo. Editar cancela a aprovação e o agendamento anterior; alterações simultâneas com versão desatualizada são recusadas.
- Fila de **simulação**, inicialmente pausada, com horários no fuso do destinatário, intervalo mínimo de 30 minutos e até 16 primeiros contatos por dia. Rodar atrasado não executa todos os primeiros contatos acumulados de uma vez.
- Bloqueios revalidados na aprovação, no agendamento e na simulação; descadastro cancela itens pendentes em todas as caixas. Nova resposta recebida pausa seguimentos que precisam de revisão.
- Diagnóstico de identidade, domínio, SPF/DKIM no Resend e consulta pública de DMARC. Teste individual de texto fixo para endereço do próprio operador, com prévia e aprovação específica; registro da tentativa antes da chamada externa, até três tentativas por dia e sem repetição automática.
- Tarefas assistidas de pesquisa por estado dos EUA, meta e porte; exportação de prompt/schema para Codex ou Claude, importação local de JSON e revisão individual com fontes. Sem executor automático ou acesso ao e-mail.
- Cadastro de empresas após revisão humana, busca por nome/domínio, filtro estadual e vínculo entre estados com confirmação de identidade. Dados e decisões de origem preservados, sem autorização de contato implícita.
- Funil de oportunidades com etapas, próxima ação, data, notas e valor estimado opcional BRL/USD. Versões impedem sobrescrita concorrente; histórico registra mudanças.
- Vínculos manuais entre conversas, empresas e oportunidades, navegação entre fichas e preservação dos contextos no agrupamento posterior de conversas. Sem alterações no provedor ou aprovação de candidatos.
- Propostas comerciais versionadas por oportunidade, condições preenchidas explicitamente, revisão interna por hash e exportação Word derivada do timbrado original. Perfis BR/US com rótulos e sites próprios; edição invalida a revisão.
- Indicadores comerciais locais: etapas, próximas ações, candidatos pendentes, propostas revisadas e estimativas separadas em BRL/USD.
- Acompanhamento de produção por oportunidade: briefing, origem comercial preservada, etapas manuais, orientações/link/data de entrega, pós-venda, feedback e histórico. Visão de projetos com busca, filtros e próximas datas.
- Revisão humana por mensagem recebida, correção de categoria com histórico, natureza humana/automática/incerta e contagens de respostas confirmadas. Regras posteriores preservam a decisão; correção não remove bloqueios.
- Análise assistida de trechos de conversa, com seleção/revisão antes da exportação manual, pacote JSON para Codex/Claude, importação de resumo/categoria sugeridos e citações literais. Sem executar agente ou alterar a triagem humana.
- Contatos profissionais e empreendimentos na ficha da empresa, com fontes, data de observação, histórico, deduplicação e preenchimento explícito a partir de pesquisa aprovada. Canais públicos podem ser registrados sem inventar e-mail.

Leia [o fluxo de rascunhos e simulação](docs/OUTBOUND.md) antes de usar a fila. Aprovar um rascunho não habilita envio de campanhas. O [teste individual de conexão](docs/SENDER_TESTS.md) usa um canal separado e exige sua própria aprovação na prévia.

Leia [o fluxo de tarefas e empresas](docs/RESEARCH.md) para preparar/importar pesquisas. O Resend proíbe prospecção fria e mensagens não solicitadas em sua [política de uso](https://resend.com/legal/acceptable-use); a fila comercial permanece em simulação, mesmo após um teste individual bem-sucedido.

Leia [o fluxo comercial](docs/COMMERCIAL.md) para ligar conversas a empresas e acompanhar oportunidades. Datas e etapas não executam ações automaticamente.

Leia [propostas e indicadores](docs/PROPOSALS.md) para preparar condições comerciais, conferir versões e exportar Word. Revisão interna não registra aceite de cliente.

Leia [produção e entrega](docs/PROJECTS.md) para acompanhar o briefing, registrar a entrega e organizar o pós-venda. Datas e etapas dependem de registro manual.

Leia [revisão humana da triagem](docs/TRIAGE_REVIEW.md) para confirmar categorias e natureza das respostas. Os indicadores contam mensagens explicitamente revisadas, sem inferir uma taxa de resposta de campanha.

Leia [análise assistida de conversas](docs/THREAD_ANALYSIS.md) para revisar os trechos antes de exportar e importar somente sugestões com evidências.

Leia [anexos recebidos](docs/ATTACHMENTS.md) para consultar/baixar arquivos e entender os limites de tamanho, origem e verificação.

Leia [a rotina automática de leitura](docs/AUTO_SYNC.md) para controlar intervalos, pausas, falhas e atualizações da visualização.

Leia [contatos e empreendimentos](docs/DIRECTORY.md) para enriquecer empresas revisadas e o [relatório de conferência do piloto FL](docs/FL_PILOT_SOURCE_REVIEW_2026-11-08.md) para consultar fontes e pendências dos candidatos atuais.

## Executar no Windows

Na pasta `conecta-crm`, com Python 3.12+ e Node.js disponíveis:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.lock.txt
Push-Location frontend
npm ci --ignore-scripts
npm run build
Pop-Location
.venv/Scripts/python.exe run.py
```

Abra http://127.0.0.1:8765. A caixa `contact` é a seleção inicial. Para experimentar com dados fictícios, selecione a conta `demo@example.invalid` e clique em **Sincronizar demonstração**. Reiniciar conserva o cache. Para encerrar o servidor, pressione Ctrl+C no terminal.

Para conectar sua caixa: abra **Contas e identidades**, escolha `contact`, informe uma chave Resend que permita leitura das Inboxes e use **Validar e guardar conexão**. Não informe a chave no chat. O CRM consulta o Resend, valida o endereço exato e só então salva a credencial no Windows. Depois selecione a conta na Caixa de entrada e use **Sincronizar caixa**. Se houver mais histórico, repita para continuar o lote. Consulte [detalhes e limites da integração](docs/RESEND.md).

React é compilado com esbuild nesta primeira etapa, sem servidor separado. API e interface usam a mesma origem; Vite poderá ser adotado quando houver necessidade de desenvolvimento com atualização automática. A aplicação usa SQLAlchemy Core, sem um segundo mapeamento ORM do mesmo esquema.

## Verificar

```powershell
New-Item -ItemType Directory -Force .tmp | Out-Null
.venv/Scripts/python.exe -m pytest tests -q --basetemp .tmp/pytest-local
Push-Location frontend
npm run build
npm audit
Pop-Location
```

No sandbox do Codex/Windows, o loop de eventos do Python pode travar em `socketpair`; esses testes devem rodar com a permissão local apropriada. Não é necessário acesso ao Resend nem qualquer segredo. A suíte verifica deduplicação, cabeçalhos fora de ordem, FTS, persistência, recuperação, isolamento por conta e bloqueios HTTP.

## Limites desta etapa

Não há download de anexos de mensagens enviadas, prévia de arquivos recebidos, classificação automática por IA, pesquisa automática ou execução de agentes. A análise assistida permite exportar manualmente trechos revisados e importar sugestões; não há transmissão ou execução de modelo pelo CRM. O envio real continua limitado ao teste individual aprovado; campanhas seguem simuladas. Anexos recebidos podem ser consultados e baixados sob demanda; os originais da biblioteca também podem ser baixados. A leitura de HTML é convertida para texto no backend e escapada pelo React, sem imagens remotas ou iframes. A triagem não resume fatos nem toma decisões comerciais: apenas sugere categorias com evidência e revisão humana.

O adaptador usa as Inboxes do Resend, sem presumir IMAP. Lê as mensagens que o provedor disponibiliza, inclusive as enviadas dentro da Inbox; não importa o log transacional global de `/emails`. A conexão real de `contact` foi validada em 08/11/2026, com leitura em modo somente consulta. Todos os testes automatizados usam respostas HTTP simuladas.

As regras são heurísticas, não uma análise semântica completa. Mensagens enviadas não geram descadastro; assinaturas e histórico citado são excluídos da busca de intenção. Os cabeçalhos automáticos só são usados quando realmente disponíveis: a API Inboxes não os fornece no contrato consultado, portanto a falta deles não vira prova de que uma resposta é humana. Recusas e descadastros bloqueiam o endereço globalmente; novas campanhas deverão consultar essa lista antes de aprovar/agendar/enviar. Não há desbloqueio automático.

O servidor aceita somente hosts localhost/127.0.0.1 na porta 8765, verifica Origin e Sec-Fetch-Site e exige token aleatório em memória para a API. Não usa CORS aberto, nem grava token no navegador ou em disco. Isso protege contra páginas externas; **não isola processos/agentes que já rodam como o usuário do Windows**. Não execute agentes sobre o cache ou como processos com acesso às credenciais. O executor de agentes permanece ausente até existir separação efetiva de permissões.

O cache passa a ficar em `%LOCALAPPDATA%/ConectaCRM/cache.sqlite3`; o banco SQLite fica em claro sob as permissões do perfil Windows. O antigo `data/crm.sqlite3` contém apenas a demonstração anterior e não é importado automaticamente. Credenciais não ficam em banco, `.env` ou logs. Backups ficam na subpasta `backups`, criptografados para o mesmo usuário Windows. Dados, dependências e build são ignorados pelo Git. Não há exposição à rede local ou acesso remoto.

O CRM faz backup antes e depois de cada lote manual real; na rotina automática, antes/depois de lotes com conversas alteradas, inclusive em falha parcial; a tela de configurações também permite criar uma cópia. Para restaurar sem sobrescrever o banco ativo:

```powershell
.venv/Scripts/python.exe manage_cache.py restore-copy cache-NOME.dpapi
```

O comando informa uma cópia SQLite restaurada e verificada. Para trocar o cache ativo, encerre o servidor e preserve o banco atual antes de substituir o arquivo. Não troque arquivos SQLite enquanto o CRM estiver aberto. Os backups não são portáveis entre usuários/máquinas Windows e são mantidos até limpeza manual pelo operador. Para apagar todo o cache, encerre o servidor e remova a pasta ConectaCRM dos dados locais; isso não remove as credenciais do Gerenciador de Credenciais do Windows.

## Próximas entregas

1. Decisão humana sobre os candidatos do piloto FL, com fontes e pendências registradas no relatório de conferência. O teste individual de e-mail já foi confirmado pelo operador; isso não habilita prospecção pelo Resend.
2. Executor isolado de agentes e agendador de pesquisa continuam pendentes. O acompanhamento manual de produção e entrega já está disponível.
3. Avaliar ajustes das regras a partir das revisões humanas registradas. A revisão manual e seus indicadores já estão disponíveis; não há treinamento ou envio de mensagens a terceiros.

Documentação técnica consultada: [FastAPI TestClient](https://fastapi.tiangolo.com/tutorial/testing/), [SQLite no SQLAlchemy](https://docs.sqlalchemy.org/en/20/dialects/sqlite.html) e [migrações Alembic](https://alembic.sqlalchemy.org/en/latest/tutorial.html).
