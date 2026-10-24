# Publicação no domínio próprio — 23/10/2026

**Endereço correto: https://conectaimoveis3d.com.br/**

- Projeto Firebase: `imobilaria-deccb`.
- Hosting do domínio: **`imobilaria-deccb-miniaturas`**.
- Configuração: `publicacao/liv-duplo-20261017/firebase.json`.
- Conteúdo completo: `publicacao/liv-duplo-20261017/payload/`.
- Versão publicada: `195edc2296de2a20`.
- Release: `1792732846358000`.
- Horário: 23/10/2026 às **02:20:46, America/Sao_Paulo**
  (`2026-10-23T05:20:46.358Z`).

## Estrutura preservada

A nova fachada substitui a página em construção da raiz. Os atalhos `/painel`
e `/login` continuam encaminhando ao painel; `/maquetes/liv/` continua abrindo o
LIV Clássico. Links individuais, builds antigos, recursos, estoque e função de
rastreabilidade permanecem nos mesmos caminhos. Nenhum segredo, token ou dado
de produção foi alterado nesta entrega.

As fontes estão em `fachada/` e são instaladas por `conecta/preparar.py`. O
preparador substitui o antigo `conecta/index.html` como fonte da página inicial.
As ilustrações, CSS e JS usam `/institucional/assets/`, isolados dos produtos.
As políticas CSP e de não indexação são restritas ao institucional. O robots
do preview isolado não é publicado no domínio compartilhado.

## Verificações

- Seis testes da fachada e quatro testes do preparador Conecta aprovados.
- A API confirmou 586 arquivos na nova versão: os 574 anteriores mais 12 novos.
  **573 arquivos anteriores mantiveram os hashes**; apenas `/index.html` mudou.
- 17 páginas e recursos conferidos por HTTPS contra os bytes do pacote local,
  incluindo o LIV Clássico, LIV Novo, a entrada da maquete e o acesso individual.
- Raiz HTTP 200; `/painel` e `/login` HTTP 302 para o login existente; caminho
  aninhado inexistente HTTP 404 com a página personalizada.
- Headers restritivos presentes nas páginas institucionais e ausentes nas
  entradas do visualizador e dos links individuais.
- Navegação, preparação do WhatsApp e console conferidos no domínio próprio.

Evidências locais, fora do payload público: `fachada-inventario-remoto-20261023.json`,
`fachada-integracao-20261023.json` e `fachada-publicada-20261023.json`, dentro do
pacote de publicação. Os termos continuam como rascunhos e a indexação do
institucional está bloqueada.

## Histórico da correção

O primeiro deploy desta conversa usou incorretamente o Hosting padrão
`imobilaria-deccb`, versão `ac1188809bf20047`, em vez do domínio do usuário. Após
a correção solicitada, a fachada foi integrada ao pacote correto. O deploy
indevido foi retirado do site padrão com `hosting:disable`, restaurando seu
estado anterior. Isso não desativa o domínio próprio, que usa outro site.
A configuração incorreta `firebase.fachada.json` foi removida.

## Recuperação

A versão anterior do Hosting do domínio é `04705d5089ca4a87`. A entrada anterior
e a configuração foram preservadas em `backup-antes-fachada-20261023/`, dentro
do pacote. Se for necessário reverter o institucional, restaurar somente a
entrada e a configuração pertinentes, preservando o payload completo, ou usar
o rollback do Hosting para a versão anterior após verificar alterações posteriores.

**Não desativar `imobilaria-deccb-miniaturas` para retirar somente a fachada:**
o mesmo site serve as maquetes e os links individuais. Não fazer deploy de uma
pasta contendo apenas o institucional sobre o domínio compartilhado.
