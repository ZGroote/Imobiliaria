# Migração do painel para o domínio próprio — 23/10/2026

Destino: `https://painel.conectaimoveis3d.com.br/login`, no mesmo Hosting
`imobilaria-deccb-painel` e projeto `imobilaria-deccb`.

## Preparação concluída

- Domínio adicionado ao Firebase. CNAME `painel` aponta para
  `imobilaria-deccb-painel.web.app`; TXT `_acme-challenge.painel` salvo no
  Registro.br. DNS público conferido. Hosting e propriedade ativos; HTTPS válido
  no navegador e na conferência HTTP. O certificado está propagando no Firebase.
  Os registros existentes de site e e-mail foram preservados.
- Domínios `painel.conectaimoveis3d.com.br` e `conectaimoveis3d.com.br`
  autorizados no Auth, mantendo os anteriores.
- Painel compilado com o novo `authDomain`, idioma português e retorno da
  confirmação de e-mail ao login novo. Links dos dois hosts anteriores do painel
  preservam caminho, consulta e fragmento ao redirecionar para o novo domínio.
- Convites usam o login novo. Atalhos da fachada preparados para o mesmo destino.
- API de rastreabilidade publicada com a nova origem e compatibilidade com a
  anterior. Preflight das três origens legítimas: 204; origem parecida: 403;
  gerenciamento sem autenticação: 401. Segredo `TRACKING_SECRET`, versão 2,
  preservado; build do LIV `66a70f0c7a53` preservado.
- 40 testes passaram: 6 de endereço/e-mail, 4 Python da fachada, 12 HTTP,
  12 emulados de autenticação/convites e 1 de CORS do Hosting de imóveis.
  Mais 1 teste do SDK confirmou o e-mail com retorno ao novo domínio e 4 testes
  cobriram o processador de confirmação, cotas e concorrência.
  TypeScript e build Webpack de 26 páginas passaram.

## Publicação concluída

Painel: `79a4e0352c5f4554`, publicado às 22h50 de 23/10 (São Paulo).
Atalhos `/painel` e `/login`: HTTP 302 para o domínio novo. A entrada pelo host
antigo foi conferida no navegador, preservando consulta e fragmento.

Funções ativas: `conectatracking-00013-paj`, `enviarconvitepainel-00005-hef` e
`enviarverificacaopainel-00001-gek`. Os segredos mantêm suas versões anteriores.
O primeiro build Webpack mostrava atalhos do emulador; a guarda explícita em
`AtalhosDev.tsx` corrigiu isso. Os 86 arquivos HTML/JS gerados foram conferidos
sem atalhos ou contas de teste, e o login publicado foi conferido no navegador.

O Firebase recusou `notification.sendEmail.callbackUri` com
`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`. A solução publicada usa a callable
`enviarVerificacaoPainel`, com conta autenticada, cotas e envio pelo Resend.
O Auth continua gerando e validando o código, com o handler nativo no novo host.
O papel `conectaEmailVerification` permite somente consultar conta e gerar link.

Teste real: confirmação enviada para `contato@`, link aberto no novo host,
mensagem "Seu e-mail foi verificado" e retorno ao login novo. Firebase confirmou
`emailVerified: true`; conta técnica sem perfil e sua cota individual removidas.
Conversa no Resend: `4b3ad8c6-ce30-4f5e-aaa8-a7756d251f22`.
Em produção: anônimo 401, destinatário no corpo 400 e repetição imediata 429.

Convite real: mensagem `01a16b9d-3476-795d-ab92-d6c0cd4bf89b`, aceita às 22h53m47s,
recebida na conversa `d8a161a1-22e6-42c2-a317-3154e8229d0e`. Texto sem cargo,
remetente Diretoria e link definitivo conferidos. Convite técnico removido.

Backups, versões e evidências em `releases/dominio-painel-20261023/`, ignorado
pelo git. Fonte anterior da API salva, sem valores de segredos. Versão anterior
do painel: `08d921d67e55980a`; da fachada: `0f47bf25c5c7565e`.
Versão da fachada preparada: `4eeb1f34bb02c442`.
Os 597 arquivos da cópia tiveram caminhos e hashes comparados com a versão live;
nenhum conteúdo mudou. Release da fachada às 22h41 de 23/10 (São Paulo).

Os URLs de previews históricos de imóveis permanecem associados às versões
originais. A migração não republica nem reativa os produtos antigos desativados.
Configuração CORS desse pipeline preparada para futuras publicações no novo
domínio. O LIV ativo já usa `conectaimoveis3d.com.br`.

Nenhum commit nesta conversa. O novo domínio exigirá novo login, pois a sessão
do navegador pertence à origem em que foi criada.
