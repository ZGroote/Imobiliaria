# Publicação em produção — 03/11/2026

Publicação autorizada pelo usuário nesta conversa.

- Painel: https://painel.conectaimoveis3d.com.br/login
- Hosting do painel: `51355a6f262fc315` (anterior `881ea31ac98518ad`).
- Regras Firestore publicadas e compiladas com sucesso; alterações restritas às regras, sem substituir índices ou Storage.
- Funções `enviarConvitePainel` e `enviarVerificacaoPainel` atualizadas com sucesso. A função do formulário de contato institucional não foi alterada.
- Rastreamento: revisão `conectatracking-00023-lon`, estado ACTIVE. Vínculo do segredo preservado na versão 2, sem leitura ou exportação de seu valor.
- Acesso público: Hosting `0f685299f342d47a`, runtime `4b570a13bd240685`. Atualizados somente `acesso.html`, dois módulos versionados e manifesto. Outros **1.686 arquivos**, configuração, páginas e builds anteriores preservados.
- A função foi compilada em pacote isolado usando as páginas e os metadados extraídos do código que estava ativo. Não foram promovidas páginas locais de experimentos.
- API de plantas: não há endpoint de produção configurado no painel; o serviço é local e não foi inventada infraestrutura adicional.

## Verificação

- Domínio próprio, logo, fonte e favicon retornam 200 e têm hashes iguais aos arquivos da entrega.
- Chrome em perfil isolado: entrada, logo, português/inglês, 320/768/1024/1440 px e redirecionamento da área interna sem login passaram, sem exceções JavaScript.
- Endpoints privados de links/relatórios negam acesso sem autenticação.
- Páginas públicas do LIV retornam 200. Os arquivos estáticos mantêm os hashes anteriores e as páginas embutidas na função mantêm os bytes do pacote anterior. As duas camadas já tinham diferenças de preloads; ambas foram preservadas.
- Nenhuma conta real foi criada ou alterada e nenhum e-mail foi enviado para teste.

Backups, logs, versões e evidências: `publicacao/painel-gestao-20261103/` (ignorado pelo Git). Inclui os metadados anteriores, código da função anterior e `verificacao-final.json`.

Reversão: restaurar os releases anteriores usando os metadados preservados e restaurar o ruleset anterior se necessário; antes de reverter, conferir se outra publicação ocorreu. As alterações de código permanecem sem commit.

## Correção da tradução do Kanban

Em 03/11/2026, corrigidos os títulos das cinco colunas, a descrição do quadro e o rótulo de prioridade alta que não passavam pela função de tradução. Acrescentadas as entradas inglesas ausentes para revisão, aprovação e descrição. Compilação com TypeScript passou e a correção foi publicada somente no Hosting do painel.

Validado no painel de produção já autenticado: inglês → português → inglês, com títulos e descrição acompanhando a escolha. Mantido English, que era a seleção original. Evidência: `kanban-ingles.jpg`. Logs na raiz: `painel-kanban-build.log` e `painel-kanban-deploy.log`. Código sem commit.

## Alternância das contas de teste

Publicado somente no Hosting do painel o controle de administrador para gerente `testetibiamacro@gmail.com` e retorno. Restrito aos dois UIDs de teste verificados; nenhum papel ou regra de acesso foi alterado. Usa sessões reais Firebase: primeiro acesso exige a senha do gerente, depois as sessões auxiliares duram somente na aba. Sair encerra todas. Interface em português e inglês.

Typecheck, build Webpack e três testes no emulador passaram: senha incorreta preserva administrador; troca aplica as regras reais de gerente; retorno reutiliza administrador autenticado; administrador inativo é recusado; gerente sem sessão original e outras contas não obtêm acesso; encerramento limpa as três sessões. Deploy concluído (`painel-troca-deploy.log`). O controle da aba autenticada ficou indisponível nesta etapa, portanto a troca real em produção aguarda o primeiro login do gerente pelo usuário. Alterações sem commit.

## Menu lateral durante a rolagem

O AppShell compartilhado pelo administrador e pela agência usa menu sticky no desktop, preso ao topo e com altura mínima da janela. A rolagem continua no documento, inclusive com o ponteiro sobre o menu, sem criar um painel de rolagem vertical separado. No celular, preservado o menu superior responsivo. Build Webpack e TypeScript passaram. Controle da aba autenticada indisponível para validação visual; sem teste visual nesta etapa. Log de publicação: `painel-menu-fixo-deploy.log`. Alteração sem commit.
