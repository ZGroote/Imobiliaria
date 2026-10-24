# Conecta Imóveis 3D

Entrada institucional do domínio `conectaimoveis3d.com.br` no Hosting existente
`imobilaria-deccb-miniaturas`, projeto `imobilaria-deccb`.

- `/`: site institucional com apresentação, planos sob consulta, contato por
  WhatsApp, termos de uso, privacidade e cookies.
- `/painel` e `/login`: encaminham para o login existente do painel administrativo.
- `/maquetes/liv/`: maquete clássica com endereço próprio; usa os mesmos módulos e
  recursos de `/liv-classico/`, sem copiar modelos. Os endereços anteriores continuam válidos.

A maquete divide a altura disponível entre a cena e os controles, sem rolagem da
página. Listas e informações longas rolam dentro do painel. No Tour 3D, a caminhada
atravessa móveis e conserva os limites arquitetônicos do apartamento.
O fundo da vista 3D e do Tour usa o mesmo gradiente escuro da maquete, sem alterar
a iluminação interna (`FUNDO-3D-20261023`).

As plantas 2D usam máscaras vetoriais para mostrar o fundo escuro ao redor do
apartamento; as imagens originais permanecem intactas. A base verde experimental
foi retirada, mantendo os controles de movimento que o usuário confirmou.

Em 23/10 foi publicada a experiência de compra em teste: um toque seleciona e
mostra a ficha; dois toques seguidos no mesmo apartamento da fachada abrem a planta.
Na lista, a escolha mostra a ficha e o botão “Ver planta” confirma a abertura.
O contato acompanha o apartamento. A faixa superior permite **Usar
versão anterior** (`experiencia=original`) e **Voltar ao teste** (`experiencia=nova`).
As mudanças estão marcadas com `EXPERIMENTO-COMPRA-20261023`; instruções de remoção
e recuperação em `../experimentos/liv-experimental-2026-10-14/EXPERIMENTO-COMPRA.md`.

Preparar: `python conecta/preparar.py`. Testar: `python -m unittest discover -s tests -p test_conecta.py`.
O preparador monta as fontes de `fachada/`, instala os recursos em
`/institucional/assets/` e preserva os arquivos do produto. A entrada e a
configuração anteriores ficam em `backup-antes-fachada-20261023/` no pacote;
o backup original de 22/10 também permanece. Os hashes ficam em
`conecta-build.json`. A configuração de deploy é a do próprio pacote,
`publicacao/liv-duplo-20261017/firebase.json`; a configuração raiz publica outro produto.

O domínio foi conectado e o HTTPS validado em 22/10/2026. A raiz, a entrada do LIV
e o encaminhamento para o painel estão no ar. O cadastro do domínio no Firebase
é separado da confirmação de propriedade e dos registros DNS no Registro.br.
Publicar novas alterações somente quando autorizado.

Novas maquetes podem receber outras entradas em `/maquetes/<nome>/`. Este ajuste
cria a entrada do LIV; não acrescenta uma tela de cadastro de URLs ao painel.

Desde 24/10, os HTMLs do LIV (entrada pública, clássico, novo e builds anteriores)
são servidos pela função `conectaTracking`, que consulta a disponibilidade no Firestore
em cada abertura. O preparador exclui esses HTMLs do Hosting estático e instala as
rewrites; os originais permanecem no payload para compilar a função. A pausa é exclusiva
do gerente da imobiliária e também bloqueia os links individuais. Reativar recupera
os mesmos endereços. Respostas dinâmicas não são armazenadas em cache.
Ao atualizar HTMLs do LIV, compile e publique a função junto com o Hosting; somente
os recursos estáticos continuam sendo publicados diretamente pelo Hosting. Mudanças
em páginas existentes exigem republicar a função; novos recursos/builds devem estar
disponíveis no Hosting antes de a função apontar para eles.

A fachada foi publicada no domínio próprio em 23/10/2026. A pedido do usuário,
as páginas públicas permitem buscas e análises automatizadas desde 24/10/2026:
o preparador instala `robots.txt` com `User-agent: *` e `Allow: /`, libera
`index, follow` nas páginas e remove o cabeçalho `X-Robots-Tag` restritivo.
A página 404 mantém `noindex, follow`. O preview isolado continua bloqueado.
Os cabeçalhos de segurança, as maquetes e o acesso por token são preservados.
Registro e comando de atualização em
[fachada/PUBLICACAO.md](../fachada/PUBLICACAO.md).

O endereço principal para buscas e análises é `https://conectaimoveis3d.com.br`.
O preparador declara esse domínio nos links canônicos das páginas públicas e
da maquete, gera `/sitemap.xml` com sete URLs e o anuncia no `robots.txt`.
O arquivo de verificação do Google em `conecta/` é copiado para o payload e
precisa ser preservado nas publicações futuras. O domínio próprio foi verificado
no Search Console em 24/10/2026; o Google processou o sitemap e encontrou as
sete páginas. Os endereços técnicos do Hosting foram usados só na comparação
do erro, sem substituir o domínio próprio como solução.
O teste ao vivo do Google aprovou a página inicial e os pedidos de indexação
da raiz e da maquete foram aceitos. A leitura pelo URL Context do AI Studio
ainda falhou no teste seguinte, inclusive pelos arquivos `index.html`; não
tratar o pedido de indexação como confirmação de que essa falha foi resolvida.

O painel foi reativado e a API dos links individuais foi publicada. Os links de
corretores e equipe são criados em Imóveis → LIV Ipanema → Links individuais.
Os links individuais usam `https://conectaimoveis3d.com.br`; os endereços antigos
encaminham para essa origem. Consulte `../rastreabilidade/PUBLICACAO.md` para
preparar novas publicações, preservando os tokens e os builds existentes.
