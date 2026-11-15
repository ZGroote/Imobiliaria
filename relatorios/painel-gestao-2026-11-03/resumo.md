# Painel de gestão — 03/11/2026

## Entrega local

- Identidade Conecta aplicada: logo oficial, fonte Satoshi, cores do site, entrada e navegação responsivas, foco visível e favicon.
- Início mostra escolha do empreendimento, relatório de acessos e links individuais. O relatório aparece antes da gestão dos links.
- Configuração do empreendimento e do estoque restrita ao administrador. Gerente da imobiliária atualiza preço e disponível/vendida; corretor mantém consulta e seus links. Regras do banco impedem mudanças externas em plantas, características, numeração, vagas e publicação.
- A API de plantas também recusa gravação por gerente/corretor, incluindo operações via Admin SDK. Produção e leitura de plantas continuam disponíveis à equipe interna.
- Convite por nome/e-mail, primeiro acesso, verificação de e-mail e recuperação de senha. Convites e confirmações têm versão em inglês.
- Português/inglês no painel; país, moeda e fuso configuráveis pelo administrador por imobiliária. A moeda não converte valores existentes.
- SMS ou WhatsApp com telefone internacional explícito e e-mail público adicional, inclusive SMS e e-mail juntos. Os links públicos mantêm a atribuição ao responsável. O e-mail de login não é divulgado automaticamente.

## Evidências

- Suíte completa em `demo-painel`: **230 testes passaram, zero falhas**. Log: `testes.log`.
- Regressão final de contatos/região/verificação: **13 testes passaram, zero falhas**. Log da raiz: `painel-contatos-final.log`.
- Navegador Chrome com perfil isolado e dados fictícios: login, troca de idioma, relatório real com sessão sintética de 30 s, bloqueio dos controles de configuração, salvamento de preço/venda, SMS com e-mail adicional e convite de corretor. Sem exceções JavaScript: `browser.json`.
- Responsividade: 320, 768, 1024 e 1440 px na entrada e início; ficha do imóvel e equipe também verificadas em 320 px, sem rolagem horizontal da página.
- Compilação de produção com `npm.cmd --prefix painel run build -- --webpack`, incluindo TypeScript e exportação estática. Log da raiz: `painel-build-final.log`.
- Prévia em português: `painel-pt-BR.png`. Outras capturas: `login-desktop.png`, `login-mobile.png`, `dashboard-1440.png`, `dashboard-320.png`, `unidades-gerente.png`.

## Limites para publicação

- Métricas representam sessões e navegadores estimados com consentimento, não identificação de pessoas. Retenção e consulta de 30 dias. Relatórios avisam quando houver limite parcial.
- SMS e e-mail abrem os aplicativos do visitante; não há disparo automático de SMS.
- A configuração regional do painel não reescreve os textos ou a moeda dos builds antigos das maquetes. Antes de liberar um empreendimento internacional, seu build público precisa estar alinhado ao idioma e à moeda configurados. O cadastro de estoque mantém o modelo LIV já existente.
- O Turbopack desta instalação encerrou o processo de CSS; Webpack compilou com sucesso. O comando padrão do projeto não foi alterado.
- A validação local não alterou contas reais. Em seguida, o usuário autorizou a publicação: painel, Firestore, rastreabilidade e funções de e-mail foram publicados. Ver detalhes em `publicacao.md`. A API de plantas continua local, sem endpoint configurado em produção.
- Alterações sem commit em `painel/`, `firebase/`, `rastreabilidade/`, `emails/`, `tools/leitura-api.mjs`, documentação e evidências. Foram preservadas as alterações anteriores presentes no workspace.
