# Piloto de qualidade visual — 04/10/2026

## Objetivo e autorização

O usuário autorizou montar a primeira instância para padronizar o acabamento e
entender a implementação; depois pediu uma planta gerada com as melhorias e um
link público temporário. Entregar uma casa **sintética** de dois dormitórios,
comparação base/acabamento, Planta 2D, Planta 3D e Visita 3D funcionando.

Este é um experimento isolado. Fontes ativas do gerador, Cedros canônico e pacote
M1.1-A `4586e7c` permanecem intactos. Publicar somente esta demonstração em novo
canal de preview, com validade de sete dias. Os oito canais anteriores continuam
desativados. Sem dados reais, API, analytics, autenticação ou serviços de produção.

## Escopo visual

- Materiais CC0 reais: madeira (`madeira`), algodão (`tecido`) e piso frio (`frio`).
- Refinamento solicitado em 04/10: pintura de paredes com granulação de rolo,
  microrelevo, pigmento quase branco e rugosidade procedurais. Texturas pequenas geradas localmente,
  compartilhadas, sem downloads adicionais ou novas faces. Preservar cor e bake
  original, UV de iluminação e comparação A/B; conferir de perto na Visita 3D.
  O PNG de relevo para download é gerado na build pelos mesmos pixels do runtime,
  servido como arquivo anexo e transferido somente quando solicitado.
- Texturas de cor até 1024²; normal OpenGL e rugosidade até 512²; mapas compartilhados.
- Preparação no PC, cache pelo hash da versão e carregamento por demanda.
- Separar tecido/madeira/metal; melhorar um sofá com geometria própria leve,
  preservando posição, rotação, escala nominal e footprint do objeto original.
- Preservar planta, vãos, movimentos, modo inicial, colisões e seleção dos móveis.
- Base/acabamento alternam sem perder câmera; o piloto volta ao básico se um
  material não carregar. Sem copiar atlas do Cedros ou adicionar luzes com sombras.
- Meta inicial: assets preparados até 1,5 MB; geometria adicional até 10 mil
  triângulos. São limites do piloto, não garantias de FPS ou celular homologado.

## Estrutura e contrato

Tudo que se implementa fica nesta pasta. Saídas, downloads e evidências ficam em
`publicacao/piloto-qualidade-visual-2026-10-04/`, ignorado pelo Git.

- `assets.json`: referências CC0 e opções de processamento.
- `preparar_assets.py --destino CAMINHO`: baixa fontes oficiais, prepara WebP e
  escreve `manifesto.json` no destino. Recusa sobrescrever material preparado;
  registra URL, licença, SHA-256 de origem, dimensões, bytes e SHA-256 finais.
- Manifesto: `{schema:1,materials:[{id,tileMeters,maps:{color,normal,roughness}}]}`.
  Cada mapa contém `{file,width,height,bytes,sha256,sourceUrl,sourceSha256}`.
  `file` é basename dentro do diretório de assets; dados adicionais são permitidos.
- `visual.js`: script clássico para o Three r168 já embutido. Define
  `window.PilotoVisual.start({THREE,maq,base,assets,assetPath,enabled})`.
  `maq` é `__maq`; `base={MAT,matMovel,ambientePBR,PL_R}` é uma ponte explícita
  colocada somente no HTML derivado. `assets` é a lista `materials` do manifesto.
  Expõe `window.__pilotoVisual={setEnabled,setWallsEnabled,getWallTextureDownload,ready,snapshot}`. `setEnabled(boolean)`
  restaura ou reaplica o acabamento na mesma câmera. `snapshot()` oferece contagens
  e falhas para QA; não envia dados. Sem esperas arbitrárias ou globals presumidas.
  `setWallsEnabled(boolean)` compara somente as paredes dentro de Acabamentos;
  Base restaura todos os materiais originais. `getWallTextureDownload()` gera,
  sob pedido, `{url,filename}` para PNG do mapa de relevo; sem novo request HTTP.
- `montar.mjs --assets CAMINHO --destino CAMINHO`: gera leitura nova pela fixture
  sintética de dois dormitórios do construtor existente, mobiliário nominal e
  maquete pelo pipeline real. Preserva o HTML/relatório E2E originais em `base/`;
  identifica hashes da derivação e copia somente a lista permitida para `site/`.
- `index.html`: apresentação responsiva, alternância Base/Acabamentos, acesso
  aos modos e planta demonstrativa. Um canvas ativo, sem duplicar GPU em dois iframes.
  Paredes têm Lisa/Texturizada e download do relevo. Selecionar Texturizada em
  Base ativa Acabamentos, com os estados dos dois controles refletidos na tela.

## Validação

Testes focados: geração sintética validada, destino ocupado preservado, manifesto
e hashes, limite de assets, derivação sem alterar fonte e publicação somente de
arquivos permitidos. Browser real: textura aplicada, sofá, A/B na mesma câmera,
modo 2D/3D/Visita, desktop/largura móvel, recursos sem 404/erro, recuperação de
falha. Registrar bytes e quadro inicial, contagens renderizadas e amostra de frames
com ambiente identificado; nenhuma emulação conta como aparelho físico.

## Publicação e reversão

Config exclusiva apontando para `site/`, sem rewrites dinâmicos. Publicação por
`firebase hosting:channel:deploy qualidade-piloto-20261004 --expires 7d`, com
`--project imobilaria-deccb`, `--config` exclusivo, site explícito e
`--no-authorized-domains`. Registrar URL e expiração retornadas. Reversão: excluir
somente o novo canal de preview. Verificar novamente os live/preview antigos em
404; não republicar nem reativar produção.

## Continuidade comercial

O mês entre primeiro cliente e entrega é uma janela para adaptação, não uma
garantia de capacidade já demonstrada. Biblioteca, estilo e testes deste piloto
devem sobreviver à futura troca de fornecedor. CGAxis pode ser avaliada com
licença específica para plataforma/catálogo; ausência de venda não dispensa suas
condições. Assets CC0 permitem desenvolver este piloto imediatamente.

Fontes: [Poly Haven](https://polyhaven.com/license),
[ambientCG](https://docs.ambientcg.com/license/),
[CGAxis](https://cgaxis.com/tos-license/),
[preview Firebase](https://firebase.google.com/docs/hosting/test-preview-deploy).
