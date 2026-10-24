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

## Atualização: buscas e análises automatizadas — 24/10/2026

A pedido do usuário, o domínio público passou a permitir robôs. O preparador
`conecta/preparar.py` instala `/robots.txt` com `User-agent: *` e `Allow: /`,
troca as diretivas das páginas públicas para `index, follow` e remove
`X-Robots-Tag: noindex, nofollow` das três regras institucionais do Hosting.
A página 404 usa `noindex, follow`. O preview isolado continua restrito.

- Versão publicada: `9dc0e9aa2d482dd1`; release `1792818101529000`.
- Horário: 24/10/2026 às 02:00:09, America/Sao_Paulo (`2026-10-24T05:00:09Z`).
- Versão anterior, disponível para recuperação: `19d3f1960e8b14ba`.
- Sete HTMLs alterados somente na diretiva de robôs; um `robots.txt` adicionado.
  Os outros 597 arquivos conservaram os hashes da versão publicada anterior.
- 13 testes locais aprovados. Oito arquivos conferidos por HTTPS contra os
  hashes locais; cabeçalhos de segurança preservados e restrição de robôs removida.
- Raiz e maquete HTTP 200; `/painel` e `/login` HTTP 302 para o painel existente.
  O script de publicação permanece fora do payload público, com HTTP 404.

A publicação reutilizou o inventário completo da versão que estava no ar e
recusaria prosseguir se outra publicação ocorresse durante o envio. Evidências,
configuração anterior e script local em `publicacao/qa-buscas-20261024/`,
ignorado pelo Git. Não houve alteração de autenticação, tokens ou função.

### Validação no próprio Google AI Studio

Em 24/10, o teste foi executado no Playground com Gemini 3.8 Flash, URL Context
ativado e Google Search desativado. O domínio próprio falhou na raiz, no robots
e na maquete. O endereço do mesmo Hosting em
`https://imobilaria-deccb-miniaturas.web.app/` foi recuperado: a raiz apresentou
o título institucional e `/maquetes/liv/` forneceu endereço, quartos, suíte e
instruções de interação correspondentes ao HTML publicado. Essa comparação não
resolveu o acesso ao domínio próprio; os endereços técnicos não são a solução
definitiva. Capturas e cópias textuais estão no diretório
local `publicacao/qa-buscas-20261024/`, fora do payload público.

### Configuração do domínio próprio no Google

Ainda em 24/10, com autorização explícita do usuário, a propriedade
`https://conectaimoveis3d.com.br/` foi verificada no Search Console pelo arquivo
HTML fornecido pelo Google. O preparador preserva esse arquivo em cada build.
Também publica o sitemap com sete URLs do domínio próprio e os links canônicos
das páginas institucionais e da maquete. O Google processou o sitemap e encontrou
as sete páginas. Isso não garante leitura imediata pelo URL Context do AI Studio.

Hosting: `38ec02b6239089fb`, release `1792820191188000`, publicado em
24/10/2026 às 02:34:59, America/Sao_Paulo. Dez arquivos conferidos por HTTPS;
os outros 597 mantiveram os hashes. Configuração de segurança e redirecionamentos
preservados. Os 14 testes locais do preparador e da fachada passaram.
Inventário anterior, manifesto e evidências em
`publicacao/qa-dominio-google-20261024/`, ignorado pelo Git.

O teste ao vivo da raiz no Search Console confirmou “O URL está disponível
para o Google” e “É possível indexar a página”. Os pedidos de indexação da
raiz e de `/maquetes/liv/` foram aceitos na fila de rastreamento prioritário.
O índice ainda informava “Detectada, mas não indexada no momento” para ambas.
Novo teste no AI Studio continuou falhando nas URLs principais e nos arquivos
`index.html` do domínio próprio. A causa específica no URL Context permanece
sem confirmação; configuração publicada e fila de indexação não equivalem a
resolução confirmada dessa leitura.
