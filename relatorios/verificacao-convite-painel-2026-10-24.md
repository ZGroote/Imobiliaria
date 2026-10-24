# Verificação do convite do painel — 24/10/2026

## Resultado confirmado

O convite mais recente para administrador foi consultado no Resend com autorização
expressa do usuário nesta conversa. A mensagem foi entregue e contém exatamente
`https://painel.conectaimoveis3d.com.br/login`. A abertura desse endereço no
navegador mostrou a tela de login do painel.

O destinatário desse convite corresponde a um perfil ativo `platform_admin`
criado em 24/10/2026 às 09:44:35, America/Sao_Paulo. O convite correspondente já
foi consumido. Não foram criados usuários, alteradas permissões ou enviadas
mensagens em produção nesta verificação.

No navegador, uma conta sintética verificada e convidada como administrador
entrou na cópia local do painel, viu “Você tem um convite”, aceitou e chegou a
`/admin`, com o Kanban carregado e sem erros ou avisos de console.

## Limite do diagnóstico

A captura fornecida pelo usuário mostra `conectaimoveis3d.com.br/acesso.html`.
Esse endereço não é o destino da mensagem de convite examinada. Não foi
reproduzida uma navegação do convite diretamente para a tela da captura.
O aceite confirmado não prova que todas as páginas acessíveis depois dele
funcionam. Não tratar este relatório como correção do erro da captura nem como
homologação completa de produção.

A investigação inicial associou o título da captura ao imóvel e iniciou uma
recuperação do Cedros sem confirmar essa relação. O usuário corrigiu o escopo.
A recuperação foi interrompida: nenhum release foi feito no site principal;
o canal temporário criado foi desativado, os 244 arquivos adicionados ao payload
local foram removidos com verificação de hash, e os ajustes locais do runtime e
da configuração foram desfeitos. Não publicar as versões preparadas nessa
tentativa. Os produtos históricos desativados continuam desativados.

## Verificações e arquivos

- Novo teste em `painel/tests/convite.test.ts`: aceite com Auth e Firestore locais
  para os quatro papéis, perfil ativo, vínculo de agência quando aplicável,
  consumo do convite e destino da área correspondente.
- Convites, destinos, menus e compatibilidade dos endereços: 8/8 testes aprovados.
- `npm.cmd --prefix painel run typecheck`: aprovado.
- Bateria ampla anterior: 191 de 192 aprovados; o processo do teste de agências
  falhou sem causa detalhada. A execução isolada desse arquivo, sem alteração,
  aprovou 1/1. Não descrever a bateria ampla como inteiramente aprovada.
- Evidências locais, fora do payload público:
  `publicacao/qa-acessos-20261024/`. Não publicar esse diretório.

A investigação não publicou correção. Ao encerrar a verificação, o teste e este
relatório ficaram sem commit. Depois, o usuário autorizou salvar e enviar todas
as pendências ao Git. As mudanças que já existiam em outras conversas foram
preservadas e incluídas em commits separados por assunto.
