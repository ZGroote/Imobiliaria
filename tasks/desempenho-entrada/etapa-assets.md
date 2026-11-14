# Entrada 3D: seleção de recursos e texturas compartilhadas

Escopo autorizado em 01/11/2026: reduzir a primeira abertura nos dois prédios e incorporar o preparo ao gerador. Base publicada: `65f0ba3ccdc9fced`, código `a8f0866`.

1. Selecionar apenas os móveis, acabamentos e decorações efetivamente usados. No Laranjeiras, as decorações do LIV já não são posicionadas; suas dependências também não devem ser carregadas.
2. Preparar GLBs sem repetir imagens. Conservar os bytes originais de geometria, imagens, materiais, nomes e posições. Agrupar imagens em arquivos verificáveis, sem criar dezenas de requisições individuais. Manter originais para compatibilidade.
3. Provar seleção, integridade, revisão autoral e descarte de memória. Gerar os dois pacotes pelo fluxo normal e comparar visual, edição, navegação, rede e primeira abertura.
4. Incorporar apenas tratamentos aprovados. Publicar preservando o inventário e configuração do Hosting e verificar as URLs públicas.

Trabalho isolado na branch `codex/entrada3d-assets-20261101`; não alterar a branch compartilhada nem arquivos pendentes de outras sessões. Evidências novas em `entrada-assets/`, separadas da etapa anterior. Medições de navegador desktop não representam homologação em celular físico.

Implementação: `547b71a`, integrada por fast-forward em `feat/predio-novo`, sem
trocar a branch compartilhada. Os 16 arquivos modificados de outras sessões foram
conferidos por SHA antes e depois e preservados.

## Alterações e custo de transferência

- O Laranjeiras deixa de solicitar dependências das decorações do LIV que já não
  eram instanciadas. Móveis e acabamentos continuam selecionados pela mesma regra
  no runtime e no empacotador, inclusive modelos com mais de um uso.
- Os GLBs preparados conservam bytes dos accessors e os metadados de materiais,
  samplers, UVs, extensões, nomes e poses. As imagens originais são agrupadas por
  tipologia, sem recompressão, e cada imagem é decodificada uma vez por biblioteca.
  Os buffers PNG/JPEG/WebP e índices são liberados depois de montar os templates.
- `catalog.delivery` não participa da revisão autoral das edições salvas. O
  runtime usa os originais se a seleção preparada não cobre o cadastro atual.
  Arquivos e chunks antigos continuam disponíveis para compatibilidade.
- Os dois preparadores normais chamam o estágio comum
  `pipeline/preparar_biblioteca.mjs`. Ambos produziram pacotes novos completos.
- A publicação sincroniza os preloads do alias público do LIV, preservando todos
  os outros bytes do HTML. O alias ainda antecipava dois chunks antigos, 15.995
  bytes brutos. As páginas internas também recebem os preloads atuais.

Carga de móveis e imagens da planta Canto, sem incluir iluminação, cena, código ou
demais recursos. O gzip é calculado individualmente com os parâmetros do Hosting:

| Prédio | Modelos antes/depois | Bytes antes/depois | Gzip Hosting antes/depois |
| --- | --- | --- | --- |
| LIV | 24 / 24 | 34.179.188 / 28.100.262 | 28.881.747 / 23.052.579 (−20,2%) |
| Laranjeiras | 20 / 11 | 28.819.336 / 12.451.937 | 24.553.754 / 9.715.659 (−60,4%) |

Nos tipos espelhados do Laranjeiras, a seleção anterior já era menor; a economia
de gzip fica em cerca de 23,6%, sem retirar modelos visíveis. Os arquivos originais
preservados aumentam o armazenamento total do pacote; estes números representam
o conteúdo solicitado para abrir a planta.

## Medições e validação

Chrome desktop. As medições abaixo não são homologação em celular físico nem
previsão de tempo em aparelhos ou redes do usuário.

- CPU artificialmente 4× mais lenta, rede local sem limite, três contextos novos
  por tratamento, ordem alternada: mediana LIV **9,154 → 8,309 s**; Laranjeiras
  **7,787 → 5,843 s**. Houve variação entre amostras, registrada integralmente.
- CPU 4×, rede 10 Mbps/60 ms, um par por prédio: LIV **47,281 → 42,444 s**;
  Laranjeiras **42,098 → 29,004 s**. Servidor local sem gzip HTTP; demonstra o
  efeito nesse perfil controlado, sem representar produção. O tempo ainda é alto.
- Esses cronômetros medem documento do interior, preparo e ativação, sem a
  navegação anterior do prédio. Cache de navegador novo; cache do driver pode
  persistir. Comparações visuais nativas não são usadas como benchmark de ganho.
- Primeira entrada pelo viewer público após a publicação, contextos novos:
  LIV **13,57 s**, Laranjeiras **9,33 s**. A conferência HTTP anterior pode aquecer
  o CDN; caches do driver também podem persistir. Não confundir com amostras
  repetidas, nem com desempenho de celular físico.
- Oráculo dos 25 modelos em cada pacote: bytes geométricos e metadados intactos;
  SHA de cada imagem original e dos modelos/pacotes conferido. Todas as seis
  plantas comparadas em dois horários: **12 pares de imagens pixel-idênticas**.
  Revisão autoral igual à versão anterior.
- **122 testes Node e 3 Python passaram**, incluindo seleção, preservação de
  sampler/UV/material, compartilhamento de decoder, cancelamento durante decode,
  limites/corrupção do pacote, manifesto e compatibilidade de revisão.
- QA local: seis plantas × seis vistas/horários, Tour, edição/restauração e WebGPU
  real nos dois sites. Corte e hora/lado reversíveis, caminhada, portas, desenho
  parado sem submissões e recuperação após perda de contexto passaram.
- Falta de GPU mantém 2D; configuração WebGPU defeituosa recupera em WebGL; limite
  de dois contextos conserva snapshots ao alternar seis vezes entre quatro plantas.
  Uma execução inicial de link 3D com falha gráfica simulada registrou iframes
  exteriores; não capturou seu estado final. A repetição integral e oito contextos
  adicionais, incluindo resposta de vínculos atrasada e comparação com a versão
  anterior, passaram. A causa do evento inicial não foi determinada; não se atribui
  uma correção de produto a essa repetição.

## Publicação

Versão `d5df8f04cc7b45cc`, anterior `65f0ba3ccdc9fced`: 91 arquivos alterados ou
adicionados, 1.760 arquivos no inventário integral. Configuração e **1.253 arquivos
fora desta atualização preservados**. Verificação HTTP: 87 URLs/recursos, incluindo
50 GLBs, imagens agrupadas, bundles, catálogos e `/`, `/maquetes/liv/`,
`/laranjeiras/`, `/checkup/liv.html`, todos aprovados por status e SHA quando
aplicável. O procedimento de reversão continua exigindo a versão atual esperada.

QA público completo aprovado: seis plantas × seis vistas/horários, edição e Tour,
mais WebGPU real nos dois prédios, sem erros observados. Três contextos adicionais
por prédio depois da primeira medição: LIV mediana **3.720 s**;
Laranjeiras mediana **2.709 s**. Os caches do CDN/driver
podem continuar aquecidos, apesar do cache novo em cada contexto do navegador.
Os tempos individuais estão em `entrada-publica-repeticoes.json`.

Estado: etapa implementada, gerada pelos preparadores normais, testada, publicada
e verificada. Ainda não há homologação física nos aparelhos do usuário. Esta
etapa reduz carga e processamento; não é uma garantia de tempo máximo de abertura.

Evidências: `C:/Users/respawn/.codex/visualizations/2026/10/31/01a193a3-c81d-79f2-8f50-40b6061cd0c2/entrada-assets/`.
Arquivos: `oraculo.json`, `comparacao.json`, `cpu4.json`, `entrada-publica-inicial.json`,
`testes-regressao.log`, `estabilidade.json`, `links.json`, `interacao.json`,
`integracao.json`, `preservacao.json`, `qa-publico/report.json`,
`entrada-publica-repeticoes.json`, `resultado.json` e `deploy/`.
