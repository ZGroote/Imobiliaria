# Entrega do piloto visual — 04/10/2026

Este é o registro da primeira publicação. O [refinamento de paredes](PAREDES.md)
acrescenta Lisa/Texturizada e download PNG, com a expiração efetiva atualizada.

[Abrir demonstração temporária](https://imobilaria-deccb-miniaturas--qualidade-piloto-20261004-tj49koea.web.app).
Expiração confirmada pela API Hosting: **11/10/2026, 14:04:25 BRT**
(`2026-10-11T17:04:25.201135364Z`). Canal `qualidade-piloto-20261004`, site
`imobilaria-deccb-miniaturas`, projeto `imobilaria-deccb`.

Foi publicada uma casa sintética de **59,64 m²**, dois dormitórios, sete ambientes
e treze vãos, gerada pelo pipeline existente. A página permite Planta 2D, Planta
3D, Visita 3D, tela cheia, download da planta SVG e comparação Base/Acabamentos
na mesma câmera. A planta é demonstrativa; não representa projeto executivo.

## Acabamento e custo

Madeira, algodão e cerâmica CC0 usam cor, normal e rugosidade. Piso e marcenaria
recebem textura em escala métrica; camas separam roupa, box/cabeceira e pés.
Um sofá próprio acrescenta 720 triângulos à geometria disponível, preservando
posição e dimensões nominais. Os mapas carregam por demanda e podem voltar
ao material básico quando um recurso falha.

| Medida | Resultado |
|---|---:|
| Mapas preparados | 9 WebP, 1.168.122 bytes |
| Fontes mantidas no PC | 18.866.098 bytes |
| Pacote estático enviado, sem compressão HTTP | 14 arquivos, 3.024.383 bytes |
| Planta 3D Base, chamadas/triângulos renderizados | 27 / 64.982 |
| Planta 3D Acabamentos, chamadas/triângulos renderizados | 42 / 63.814 |
| Visita Acabamentos, chamadas/triângulos renderizados | 86 / 59.520 |

Contagens de renderização são da câmera registrada no navegador desktop; não
representam toda a cena ou todos os aparelhos. A geometria original do sofá
fica disponível para a comparação, mas é ocultada quando a substituição aparece.
Por isso o modo melhorado pode renderizar menos triângulos e mais chamadas.

A primeira renderização observada pelo diagnóstico da página pública ocorreu
em 1.381,9 ms. A instrumentação começa depois do renderer: esse valor não é uma
medição precisa do primeiro pixel nem um teste controlado de rede/CPU. A amostra
de rAF teve medianas de 16,7 ms em partes da rodada e intervalos de cerca de
1.016 ms em outras, no navegador em segundo plano. Essas amostras não permitem
concluir FPS comparativo, fluidez em celular ou ganho de desempenho sobre a base.

Os materiais conservam a modulação de cor e a iluminação por vértices já
existentes. O piloto melhora superfícies e composição leve; calibração de cor,
iluminação e biblioteca mais ampla seguem como próxima iteração visual.

## Verificação e preservação

- 17/17 testes focados: empacotamento, recusa de adulterações/arquivos extras,
  preservação de entrada/base, carregamento, falhas de mapas, A/B, móveis e métricas.
- Nove mapas verificados por bytes, dimensões e hashes; reprodução independente
  dos nove arquivos resultou nos mesmos hashes.
- Browser real local: três modos, orientação da visita, A/B sem deslocar câmera
  ou alvo, contraste da planta 2D e layout de 390 × 844 sem overflow horizontal.
- Browser público: materiais carregados, A/B na mesma câmera, visita renderizada
  e nenhum erro de console ou recurso no diagnóstico observado.
- HTTP público: 14/14 arquivos coincidem com o pacote; 12 caminhos privados/JSON
  retornam 404. HTML usa `no-store`, assets por hash usam `immutable`.
- O Hosting acrescenta `/__/firebase/init.js` e `/__/firebase/init.json`, portanto
  sua metadata registra 16 arquivos. A página não usa SDK Firebase ou esses endpoints.
- Os oito canais anteriores conservaram as mesmas releases `SITE_DISABLE` e 404;
  os quatro domínios live alternativos `firebaseapp.com` também retornaram 404.
- M1.1-A: os 43 arquivos da baseline `4586e7c` passaram na conferência de integridade;
  homologação física continua **0/5**, com pacote local/LAN preservado.

A composição automática registrou uma folga de 0,50 m perto do sofá, abaixo
da referência confortável de 0,90 m do próprio catálogo. Essa disposição serve
à demonstração visual e requer revisão para uma casa real.

## Proveniência e evidências

Release local `f937146f9a03244b`; versão Hosting `e3ed40a1ca5cc3ab`, `FINALIZED`.
HTML base E2E preservado: SHA-256
`3b3a4c2aefb53cb198fd271a276491d861ed285bacbb90fac6e2259571f638c0`.
Leitura canônica: `0066d5a1688587f95bf4053b81a6291bd27ac0c66149164afb672ad3df6cfd17`.

Saídas ignoradas pelo Git, em `publicacao/piloto-qualidade-visual-2026-10-04/`:

- `base/relatorio.json`, `entrada/leitura.json`, `entrada/contexto.json` e
  `entrada/mobilia.json`: geração original e composição.
- `site/manifesto.json`: hashes e bytes do pacote derivado; não publicado.
- `validacao-assets.json`: preparação/reprodução dos materiais.
- `verificacao-publica.json`: metadata, hashes HTTP, caminhos recusados e canais antigos.
- `evidencias/qa-browser.json`: observações e limites da medição.
- `evidencias/publico-acabamentos.png`, `publico-base.png`, `mobile-390.png`,
  `planta-2d.png` e `visita-desktop.png`: capturas da rodada.

[Reprodução e janela de um mês](README.md), [contrato](SPEC.md) e
[publicação/reversão](PUBLICACAO.md) registram como repetir e encerrar o piloto.
Não foram ativados o produto, a API de rastreabilidade ou o botão WhatsApp.
