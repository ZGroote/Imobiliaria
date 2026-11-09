# Continuidade do CRM Conecta

Registro de passagem preparado em **8 de novembro de 2026**, horário de São Paulo. O CRM fica em `conecta-crm/`, separado do site, do painel Firebase e dos outros experimentos do repositório. O plano de referência está em [CRM Pessoal Conecta v2](CRM_Pessoal_Conecta_Plano_Completo_v2.md); as decisões de cada incremento estão em [plano de trabalho](../tasks/plan.md) e [checklist com evidências](../tasks/todo.md).

## Por onde retomar

O checkpoint funcional antes desta etapa é o **PR #114**, branch `codex/crm-pesquisa-empresa`, commit `95c2f6bbd633d7dd2a140784de4747073355a23d`. Ele contém as mudanças dos quatro checkpoints anteriores. A branch `codex/crm-portfolio` parte dele e contém este guia e a próxima etapa. Em um checkout limpo, use `git fetch origin` e abra a branch que corresponde ao escopo que vai revisar. Não troque de branch sobre a pasta principal com trabalho paralelo sem conferir `git status`.

| PR | Base | Branch | Entrega e verificação registrada |
| --- | --- | --- | --- |
| [#110](https://github.com/ZGroote/Imobiliaria/pull/110) | `main` | `codex/crm-prospeccao` | Checkpoint original do CRM; 400 testes. |
| [#111](https://github.com/ZGroote/Imobiliaria/pull/111) | `codex/crm-prospeccao` | `codex/crm-qualificacao` | Qualificação explicável e histórica; 423 testes. |
| [#112](https://github.com/ZGroote/Imobiliaria/pull/112) | `codex/crm-qualificacao` | `codex/crm-automacao` | Codex isolado, fila de pesquisa/análise e envio autorizado; 487 testes. |
| [#113](https://github.com/ZGroote/Imobiliaria/pull/113) | `codex/crm-automacao` | `codex/crm-materiais` | Materiais por mercado e PDF; 496 testes. |
| [#114](https://github.com/ZGroote/Imobiliaria/pull/114) | `codex/crm-materiais` | `codex/crm-pesquisa-empresa` | Pesquisa direcionada de empresa cadastrada; 508 testes. |

Todos os cinco estavam abertos em rascunho e sem merge na conferência. O #110 mostra o checkpoint inicial; os recursos novos aparecem nos PRs seguintes. O repositório foi publicado com autorização do operador; não há merge da série na `main`. A cópia de execução está na pasta principal `conecta-crm/`; os commits foram feitos na worktree separada, em `conecta-crm/.tmp/git-crm-prospeccao`. Arquivos de trabalhos paralelos da pasta principal ficaram fora dos PRs.

## Inventário do que foi entregue

1. **Base local:** backend FastAPI e SQLAlchemy Core, SQLite com WAL, migrações Alembic e interface React/TypeScript compilada com esbuild. API e interface no mesmo endereço local, `127.0.0.1:8765`. Sessão local em memória, controles de Host/Origin e nenhum CORS aberto.
2. **Caixa de entrada:** contas separadas, pastas, paginação, busca textual FTS5, filtros, conversas, histórico e estado de leitura local. Conta de demonstração para testar sem provedor. O CRM não exclui mensagens do provedor.
3. **Leitura Resend:** adaptador de Inboxes, validação da caixa exata, consultas incrementais em lotes e preservação do histórico. `contact` atende formulários e clientes; `team` atende convites e equipe; `noreply` é referência de saída e não é conectada para leitura. [Integração](RESEND.md).
4. **Sincronização automática:** intervalos de 5/10/30/60 minutos, pausa e retomada por caixa, uma leitura por caixa por vez, limites de tentativa, indicação de falhas e atualização de novidades sem interromper edição. Funciona com o servidor aberto. [Rotina](AUTO_SYNC.md).
5. **Anexos recebidos:** consulta/download sob demanda, vínculo caixa–mensagem–arquivo, tamanho/expiração conferidos e trilha de preparação. Limite de 20 MB. O CRM não abre nem executa arquivos. A transferência foi validada com CDN simulado; não se fabricou anexo real por e-mail. [Anexos](ATTACHMENTS.md).
6. **Triagem:** regras determinísticas PT/EN, prioridades, evidência da sugestão e bloqueio global de descadastro/recusa. HTML recebido vira texto e é escapado, sem carregar imagens remotas. Sem presumir que a ausência de cabeçalho automático comprova resposta humana.
7. **Revisão humana:** categoria e natureza da resposta por mensagem, versões e histórico. Correções permanecem sobre as regras e não removem bloqueios. Indicadores distinguem respostas humanas confirmadas. [Triagem](TRIAGE_REVIEW.md).
8. **Rascunhos e simulação:** editor de texto, resposta vinculada, modelos por finalidade/mercado, aprovação por versão e hash, bloqueios revalidados e horários no fuso do destinatário. Editar invalida aprovação/agendamento. Fila de simulação separada da real. [Rascunhos](OUTBOUND.md).
9. **Diagnóstico e teste individual:** validação de caixa, domínio, SPF/DKIM e DMARC; prévia fixa, aprovação específica, tentativa auditada, consulta e declaração de recebimento. Um teste real individual foi realizado e o operador confirmou sucesso. Isso não é teste da nova fila comercial nem autorização para prospecção. [Teste individual](SENDER_TESTS.md).
10. **Identidade e originais:** perfis BR/US com idioma e site correspondentes, paleta, dois cartões, assinatura e cinco Word (contrato, timbrado, briefing, entrega e pós-venda). Nove originais preservados e conferidos por SHA-256. Textos dos documentos são referências; não concedem permissões ou instruções operacionais.
11. **Pesquisa geral nos EUA:** escolha de estado, porte e meta; pacote com prompt e contrato JSON; exportação manual e importação validada. Fatos, datas, fontes e candidatas não verificadas ficam para revisão. Não completar meta artificialmente. [Pesquisa](RESEARCH.md).
12. **Revisão de candidatas:** confirmação individual de fontes/identidade, rejeição auditada, cadastro de empresa só após aprovação e confirmação de vínculo em domínio já existente. Candidatos do piloto FL tiveram fontes e pendências revisadas em [relatório](FL_PILOT_SOURCE_REVIEW_2026-11-08.md); as decisões reais foram deixadas para o operador.
13. **Cadastro comercial:** contatos públicos e empreendimentos por empresa, fontes, data observada, tipologia, estágio, deduplicação, versões e histórico. Preenchimento a partir da pesquisa exige revisão e salvamento explícitos. [Diretório](DIRECTORY.md).
14. **Conversas e oportunidades:** associação manual a empresas, preservação do vínculo ao agrupar conversas, funil, próxima ação, data, notas, estimativa BRL/USD e histórico de alterações. Mudança de etapa/data não dispara ações. [Fluxo comercial](COMMERCIAL.md).
15. **Propostas Word:** condições preenchidas pelo operador, salvamento e histórico de versões, conferência por hash, invalidação após mudanças e exportação derivada do timbrado original. Rascunho marcado em todas as páginas; revisão interna não é aceite do cliente. [Propostas](PROPOSALS.md).
16. **Indicadores:** empresas/candidatos, oportunidades e próximas ações, propostas com revisão vigente, estimativas separadas por moeda e contagens de respostas revisadas. Não estimar receita ou taxa real a partir de ausência de registros.
17. **Produção e entrega:** briefing, vínculo à origem comercial, andamento manual, entrega, pós-venda e feedback; histórico e próxima data. Empreendimento pesquisado não é um projeto contratado da Conecta. [Projetos](PROJECTS.md).
18. **Análise assistida de conversa:** selecionar e editar trechos, preparar pacote só com aliases/texto revisto, importar resumo e categoria sugeridos com citações. Preserva histórico quando muda a conversa. Não altera a decisão humana. [Análise de trechos](THREAD_ANALYSIS.md).
19. **Qualificação comercial:** critérios com pesos configuráveis que somam 100, justificativa e fontes da própria empresa, avaliações parciais e histórico. Ausência de nota não vira zero. Ordenação apenas quando a avaliação está completa e atual para a base e o modelo. [Qualificação](QUALIFICATION.md).
20. **Executor Codex isolado:** instalação oficial do Windows, argumentos fixos, sandbox MXC e sonda de arquivo externo, credencial fictícia e rede local. Sem fallback aberto, shell/conectores/plugins ou acesso ao correio. Fila persistente, agenda, progresso, cancelamento e uma execução por vez. Claude segue exportação/importação manual. [Execução](AGENT_EXECUTION.md).
21. **Pesquisa automática e análise pelo Codex:** pesquisa usa web pública e retorna candidatas para conferência; análise recebe somente trechos confirmados e não usa web. Uma pesquisa pública pequena em base separada retornou uma candidata com fontes após quatro consultas. Não cadastrou empresa. Fluxos de cancelamento e importação também foram testados com executor fictício.
22. **Fila real autorizada:** permissão por destinatário/perfil com prova declarada e validade, aprovação de texto separada da prévia, campanhas e pausas, guarda antes da chamada, chave de idempotência e acompanhamento. Timeout ou interrupção pausa sem repetir; reconciliação confere identificador, conteúdo e tag. Devolução, reclamação e supressão bloqueiam contato. A entrega desta fila foi validada por HTTP simulado; não houve novo disparo real. [Envios](REAL_DELIVERY.md).
23. **Propostas PDF:** rascunho ou revisão vigente da mesma versão do Word, gerada localmente em memória. Logo/timbrado, fontes incorporadas, rodapé/status e número de página. Paginação pode diferir do Word. Oito páginas fictícias BR/US inspecionadas. Sem envio de anexos ou aceite.
24. **Materiais BR/US:** timbrados derivados Word e assinatura em texto, quatro materiais separados dos originais. Conferência/retirada por hash com histórico. Rodapé US em inglês e +55; imagem original conserva o lema em português. Sem tradução de cláusulas, assinatura HTML ou inserção automática. [Materiais](BRAND_MATERIALS.md).
25. **Pesquisa direcionada:** na ficha de empresa cadastrada, prepara tarefa para um estado de atuação conferido. Pacote mínimo só com identidade pública; bloqueia outro domínio ou alvo desatualizado. Pode renovar fontes após aprovação de vínculo à mesma organização, sem substituir cadastros. Testado com dados e agente fictícios. [Pesquisa por empresa](COMPANY_RESEARCH.md).
26. **Segurança e operação:** cache e backups fora do Git, credenciais no Gerenciador do Windows, dados/arquivos de testes em bases separadas, controle de versão para edições e snapshots de dados nas atualizações. Cada entrega local relevante teve backup DPAPI e conferência dos originais. A suíte e o build passaram nos checkpoints acima.
27. **Panorama do portfólio:** total dos empreendimentos efetivamente salvos por empresa, distribuição por estado, tipologia e estágio registrado, além das oito fontes consultadas mais recentemente. Distingue data de consulta e referência do estágio. A base local não comprova cobertura nem frequência anual. [Portfólio](PORTFOLIO.md).

## Estado da base principal ao preparar a passagem

Migração `0019`, **duas tarefas e três candidatas FL pendentes**, sem empresa cadastrada. Sem contatos, empreendimentos, oportunidades, propostas ou projetos reais cadastrados. Zero revisões de mensagem, pacotes de análise, execuções de agente, tentativas da fila real, campanhas, permissões de destinatário e revisões de material. Há um teste individual anterior registrado. As filas de agentes e envios estão pausadas; a sonda de isolamento anterior foi aprovada. A leitura automática de `contact` e `team` está ligada a cada 30 minutos. Esses números são uma fotografia; leia a base novamente antes de atualizar e não assuma que permaneceram iguais.

Os quatro materiais precisam da conferência do operador. Para experimentar a pesquisa direcionada com dados reais, primeiro revise fontes e decida sobre uma candidata; o botão aparece em uma empresa já cadastrada. Não aprove candidatas, materiais, conteúdo ou envios em nome do operador apenas para fabricar dados de teste. Use um banco separado.

## Troca de conta e retomada técnica

- Passe **este guia e os links do Git** à próxima sessão. Não copie tokens, credenciais do CLI/Resend, cache privado, arquivos de sessão ou backups para o repositório ou para o chat.
- Login do Codex, permissão de escrita no GitHub e credenciais Resend são coisas separadas. Confira acesso à branch e à sessão Codex que o operador escolheu. O executor depende da instalação oficial e da sessão autenticada do CLI naquele ambiente. Use **Conferir isolamento do Codex** depois da mudança, com a fila pausada; isso não executa pesquisa. Confira também que um teste controlado futuro usa só conteúdo público/fictício.
- No Windows, o cache fica em `%LOCALAPPDATA%/ConectaCRM/cache.sqlite3`. SQLite ativo fica em claro sob as permissões do perfil; backups DPAPI na subpasta `backups` são protegidos para o usuário Windows que os criou. Trocar de conta Codex não é um procedimento de migração do Windows. Em outro Windows/perfil, configure as conexões apropriadas pelo painel em vez de copiar credenciais. O cache e os backups não vêm do Git.
- No mesmo ambiente, prefira a cópia local de execução já instalada. Confira antes de iniciar outra instância na porta 8765. Para checkout novo, em `conecta-crm/`, siga [instalação e verificação](../README.md#executar-no-windows). Dependências Python fixadas em `requirements.lock.txt`; Node usa o lock do frontend.

```powershell
# Primeiro, na raiz do repositório:
python -I tools/quem_mexeu.py
# Depois, na pasta conecta-crm do checkout de desenvolvimento:
.venv/Scripts/python.exe -m pytest -q
npm.cmd run build --prefix frontend
# Para iniciar a cópia de execução, a partir dela:
.venv/Scripts/python.exe -u run.py
```

Os testes usam bancos temporários e provedor simulado; não exigem chaves. No Windows gerenciado, socket/loopback e Git podem exigir a permissão local apropriada. Antes de atualizar o banco principal: confira que nenhum worker está em atividade, crie backup pelo CRM, preserve alterações paralelas e confirme integridade e preservação dos dados depois. Para restauração, use `manage_cache.py restore-copy <nome>.dpapi`, que cria uma cópia separada; jamais substitua um SQLite aberto. Siga o `AGENTS.md` da raiz e termine commits com `Co-Authored-By: Codex <noreply@openai.com>`.

## Próximos trabalhos

- **Uso real:** operador confere as candidatas do piloto, materiais e fontes. Homologar a nova fila real com mensagem/destinatário de teste explicitamente autorizados antes de uso. O teste individual anterior não cobre essa fila. Endereço público e pesquisa não equivalem a consentimento.
- **Mais adiante:** análise de recorrência com evidências suficientes, recomendações revisáveis, expansão geográfica e métricas com base real. A interface de correio não garante agrupamento de todas as respostas transacionais; a fila não oferece anexos enviados/webhooks. Agentes e filas só operam com o servidor aberto.
