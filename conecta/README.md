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

A fachada foi publicada no domínio próprio em 23/10/2026. Os cabeçalhos CSP e
`noindex` são limitados às páginas institucionais e a `/institucional/**`, sem
alterar as políticas do visualizador ou do acesso por token. O `robots.txt` do
preview isolado não é copiado para o domínio compartilhado. Registro e comando
de atualização em [fachada/PUBLICACAO.md](../fachada/PUBLICACAO.md).

O painel foi reativado e a API dos links individuais foi publicada. Os links de
corretores e equipe são criados em Imóveis → LIV Ipanema → Links individuais.
Os links individuais usam `https://conectaimoveis3d.com.br`; os endereços antigos
encaminham para essa origem. Consulte `../rastreabilidade/PUBLICACAO.md` para
preparar novas publicações, preservando os tokens e os builds existentes.
