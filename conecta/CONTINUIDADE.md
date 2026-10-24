# Continuidade — Conecta e LIV, 23/10/2026

Este arquivo registra a entrega desta conversa para continuar o trabalho em outro
chat. Branch: `liv-melhorado`; remoto: `origin` no repositório
`ZGroote/Imobiliaria`. O usuário autorizou salvar e enviar ao Git as alterações.

## O que está no ar

- `https://conectaimoveis3d.com.br/`: site institucional, planos sob consulta,
  contato por WhatsApp e documentos em revisão. Fontes em `fachada/`.
- `/maquetes/liv/`: LIV Clássico; `/painel` e `/login` encaminham para
  `https://painel.conectaimoveis3d.com.br/login`. Migração e validações em
  `conecta/DOMINIO-PAINEL.md`.
- Projeto Firebase `imobilaria-deccb`; Hosting `imobilaria-deccb-miniaturas`.
- Hosting `195edc2296de2a20`; pacote clássico `9ef2933d11872c83`;
  build individual `2b69f90177ac`; runtime de acesso `2c01428ab8507259`.
- API `conectaTracking` ACTIVE, revisão `conectatracking-00010-jor`, região
  `southamerica-east1`, Node 22. **Preservar TRACKING_SECRET versão 2**, tokens
  existentes e builds anteriores; não exportar o valor do segredo.
- Links de corretores e equipe ativos no painel, em Imóveis → LIV Ipanema →
  Links individuais. Endereços antigos encaminham ao domínio canônico e
  conservam token, modo, unidade e fragmento.
- A automação `concluir-dom-nio-conecta-im-veis-3d` está PAUSED: domínio e migração
  concluídos. Não retomar o monitoramento sem novo pedido.

## Comportamento aprovado da maquete

- Página principal ocupa a tela, sem rolagem externa; listas e ficha podem rolar
  dentro do painel. Controles minimizados continuam acessíveis.
- Um toque na fachada seleciona e mostra a ficha. Dois toques seguidos no mesmo
  apartamento abrem sua planta. O par aceita até 500 ms e 24 px; arrasto, pinça,
  cancelamento ou toque no fundo interrompem a confirmação.
- Na lista, escolher uma unidade mostra a ficha; o botão “Ver planta” abre.
- Tour permite atravessar móveis, conservando os limites arquitetônicos.
- Fundos do 3D/Tour combinam com o exterior. No 2D, máscaras vetoriais recortam
  a margem externa; JPGs originais preservados e indicador de entrada acompanha
  zoom e deslocamento. A base verde experimental foi retirada.
- O usuário cancelou o pedido de alterar a movimentação após reabrir a página
  e confirmar que voltou ao normal. Não alterar câmera/órbita por esse pedido.
- Experiência de compra é removível: faixa “Usar versão anterior”, parâmetro
  `experiencia=original`; `experiencia=nova` retorna ao teste. Contato contextual
  usa somente telefone público validado; sem ele, permite copiar o interesse.
  Nenhuma mensagem é enviada automaticamente.

## Fontes e publicação

- Viewer: `experimentos/liv-experimental-2026-10-14/`.
- Comparação e reversão: `EXPERIMENTO-COMPRA.md` nessa pasta, com os marcadores
  `EXPERIMENTO-COMPRA-20261023`, `FUNDO-3D-20261023`, `FUNDO-2D-20261023` e
  `DUPLO-TOQUE-20261023`.
- Entrada institucional: fontes em `fachada/`; instalação e preservação do
  pacote em `conecta/preparar.py`. O antigo `conecta/index.html` foi substituído.
- API, runtime e preparação: `rastreabilidade/PUBLICACAO.md` e preparadores.
- O pacote publicado e seus backups/evidências estão em
  `publicacao/liv-duplo-20261017/`, ignorado pelo Git e preservado neste computador.
  Os detalhes históricos estão em `PUBLICACAO.md` e `CONEXAO-DOMINIO.md` locais.
  Não incluir credenciais, logs de autenticação ou pacotes gerados no Git.
- O pacote local é entrada para os preparadores; um clone novo precisa recuperar
  esses artefatos antes de preparar outra publicação. Não reconstruir esse
  diretório pela cópia integral do HTML experimental: o interior publicado omite
  intencionalmente o módulo de splat presente apenas no experimento.
- Para atualizar links, preparar com a origem `https://conectaimoveis3d.com.br` e
  publicar **Hosting antes da função**, preservando builds anteriores.
- Usar `publicacao/liv-duplo-20261017/firebase.json` para o Hosting do LIV e
  `firebase.rastreabilidade.json` para a função. O `firebase.json` da raiz publica
  outro produto. Não reconstruir/publicar o painel para uma mudança só do viewer.

## Validação e próximos assuntos

O último ajuste passou em 57 testes de catálogo/gestos, experiência e fluxo do
viewer. No navegador local e público, um clique manteve a fachada com a ficha do
1608; dois cliques abriram Meio; voltar não reabriu. Lista local selecionou 102 e
o botão abriu Canto. Nove recursos publicados tiveram hashes iguais aos locais;
raiz 200 e painel 302. O link individual legítimo já existente abriu o build
atual e restaurou 102/Canto/2D. Sem erros de console no visualizador público.
Sem teste em aparelho físico; nenhum usuário ou dado sintético criado em produção.

Antes de salvar no Git, também passaram 68 testes locais do cliente, HTTP, painel
e serviço de rastreabilidade, mais três testes Python da entrada Conecta.
O diff passou na conferência de espaços e na busca por credenciais privadas
reconhecíveis. Pacotes gerados, backups e configurações sensíveis continuam locais.

O rosto institucional foi entregue em 23/10/2026 e está no domínio próprio.
Planos sob consulta, WhatsApp (16) 98128-8075 e documentos em revisão.
Os 573 arquivos anteriores, exceto a raiz substituída, mantiveram os hashes no
Hosting; maquetes, builds, runtime e API preservados. Histórico e validação em
`fachada/PUBLICACAO.md`. Atualizações usam o pacote existente, nunca um deploy
isolado só da pasta `fachada/public`, pois isso apagaria as rotas do produto.
Atualização de 23/10: e-mails implantados com Resend e caixas `avisos`, `contato`
e `diretoria`. Convites e confirmação de cadastro usam o domínio próprio;
detalhes em `emails/README.md` e `conecta/DOMINIO-PAINEL.md`. Isso não autoriza
envios não solicitados a terceiros.
