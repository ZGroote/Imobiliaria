# Miniatura v4 — relatório da versão melhorada (07/10/2026)

Imóvel: **Monte dos Cedros** (PREMIUM, padrão aprovado em 23/09). Comparação feita contra a
versão atual publicada (`padrao-atual/`, montada por `padrao_atual.py`), com o mesmo
instrumento de medição para as duas. Tudo o que mudou está em `versao-melhorada-07-10/`;
nada fora desta pasta foi alterado.

## Resumo

@@RESUMO@@

## Como foi medido

- **Instrumento:** `medicoes/medir.mjs` abre a página num Chromium real e intercepta as
  chamadas WebGL: memória de cada buffer, textura e alvo de desenho, chamadas de desenho e
  triângulos. Nenhum número depende de a página "dizer" quanto gasta.
- **Servidor:** `medicoes/servidor.mjs` imita o Firebase Hosting (Brotli/gzip só para
  texto, os cabeçalhos de cache de cada versão, ETag/304). Bytes são os transferidos de fato,
  depois da compressão.
- **Perfis:** rede e CPU simuladas pelo próprio Chrome (DevTools Protocol):
  computador em Wi-Fi 50 Mbps; celular intermediário em 4G de 12 Mbps com CPU 4× mais lenta;
  celular fraco em "4G ruim" de 1,6 Mbps (o perfil *Slow 4G* do Lighthouse) com CPU 6× mais
  lenta. Três execuções por perfil, mediana. A v4 é medida no perfil de qualidade que um
  aparelho dessa classe recebe (alto, médio, baixo).
- **Primeira imagem:** na versão atual, o primeiro desenho 3D; na v4, a capa (a imagem do
  próprio visualizador) ou o primeiro desenho, o que vier antes.
- **Limite honesto:** o ambiente de medição não tem GPU. O Chrome desenha em software
  (SwiftShader), então **FPS absoluto não representa celular nenhum** e tempos de primeiro
  quadro ficam inflados pela compilação de shaders em CPU. Bytes, memória, chamadas de
  desenho, CPU parada e tempos de rede são comparáveis entre as versões. Para FPS real use
  `?perf=1` num celular (mostra quadros/s, perfil e resolução na tela).

## Resultados

@@TABELAS@@

### O que explica os números

- **Bytes para abrir (−64% a −83%):** o atlas de luz externo saiu de 7,0 MB (RGBM, 4096²)
  para 2,4 MB (UASTC, 2048×1672) ou 0,7 MB (meia resolução, perfil baixo); as UVs de luz do
  exterior, de 1,33 MB (JSON comprimido) para 0,22 MB (binário indexado com diferenças); o
  HTML de 3,4 MB com tudo embutido virou 25 KB, com o resto em arquivos cacheáveis.
- **Luz pronta muito mais cedo no celular:** além de baixar menos, a página deixou de fazer
  `JSON.parse` de 15,7 MB e milhões de `push` para montar a malha; agora copia arrays
  tipados. A textura chega comprimida e é transcodificada em Web Workers.
- **Planta 3D:** o pacote do interior (código, móveis, atlas do Unreal) só desce quando
  alguém pede o apartamento — o tempo de abrir a página não paga por quem nunca entra. Na
  entrada, o bake de oclusão em JavaScript, que era calculado e depois descartado quando a
  luz do Cycles chegava (6,5 s no computador), ficou só de reserva.
- **Memória de GPU (−56% a −81%):** texturas comprimidas na GPU (1 byte por texel), atlas
  externo com 1/5 dos texels, e a geometria instanciada que sai de cena agora é liberada.
- **Parado não gasta:** sem toque e sem animação, a v4 não desenha (planta 3D, visita, planta
  2D). A versão atual rodava o laço de desenho a cada quadro da tela em qualquer modo, parada
  ou não, e refazia o SVG da Planta 2D a cada quadro. Na maquete, que gira sozinha, o giro ocioso roda a 30 quadros nos
  perfis médio e baixo, e o mapa de sombra não é refeito a cada quadro.

## Custo de servidor (Firebase Hosting)

Premissas (todas ajustáveis em `node medicoes/custos.mjs`): 1.000 acessos por dia; mistura
30% computador / 50% celular intermediário / 20% celular fraco; 25% dos acessos são
revisitas com cache; preço do Hosting: 360 MB/dia sem custo, depois US$ 0,15/GB
([tabela do Firebase](https://firebase.google.com/pricing)); dólar a R$ 5,40. **A franquia
gratuita é do projeto inteiro** (mapa, painel e miniaturas dividem os mesmos 360 MB/dia).

@@CUSTOS@@

Observação: o estudo de 22/09 (`relatorios/estudo-peso-miniaturas-2026-09-22.md`) estimou
0,7 MB por abertura, mas foi feito **antes** da luz calculada. A versão publicada hoje
transfere 8,9 MB para abrir e mais 6,9 MB para quem entra no apartamento.

## Custo para gerar cada imóvel

Tempo de máquina de um imóvel PREMIUM, do modelo à página (tempos registrados no próprio
repositório, mais os medidos aqui):

| Etapa | Ferramenta | Tempo |
|---|---|---:|
| Modelo do exterior (gerador LEVE) | Blender 5.2.2 | ~1–10 s (Mirante 7: 0,8 s + 7,4 s de render) |
| UV de luz | xatlas | 9 s (`unwrap.json`: 7,2 + 1,8) |
| Bake da luz (interior 2048² × 512 amostras; exterior 4096² × 128) | Cycles | 357 s (`bake.json`: 305 + 52) |
| Denoise | OIDN | ~5 s |
| Codificação RGBM (padrão atual) | Python | segundos |
| **v4:** reempacotamento + binários + 4 atlas UASTC | Python + Node | 97 s (4 núcleos) |
| **v4:** capa | Chrome | ~60 s sem GPU; poucos segundos com GPU |
| **v4:** montagem do site | Node/esbuild | ~3 s |
| QA automático (fumaça) | Chrome | ~1 min |
| **Total de máquina** | | **~10–11 min** |

| Onde roda | Conta | Custo por imóvel |
|---|---|---:|
| Computador próprio | ~300 W × 11 min ≈ 0,055 kWh × R$ 1,10/kWh (tarifa média 2026 com impostos) | **≈ R$ 0,06** |
| Nuvem com GPU (AWS g4dn.xlarge, US$ 0,526/h) | 11 min | **≈ US$ 0,10 ≈ R$ 0,52** |
| Armazenamento no Hosting | ~8,9 MB próprios do imóvel (os dois tamanhos de luz, capas, dados); three.js e o transcodificador (1,3 MB) são compartilhados | 10 GB gratuitos ≈ **1.100 imóveis**; depois US$ 0,026/GB/mês ≈ R$ 0,001/mês por imóvel. O Hosting também guarda versões anteriores publicadas: limitar o histórico se o espaço apertar. |

**O que não está nessa conta, e domina:** o tempo de pessoa/assistente para interpretar a
planta, modelar, mobiliar e revisar. A única medição no repositório é o ensaio Mirante 7
(`experimentos/mirante-7-2026-09-22/ESTUDO.md`): **12 min** de produção assistida até a
conferência local (LEVE, sem bake). O custo é `minutos × custo por minuto`: por exemplo, a
R$ 60/h de uma pessoa, 12 min ≈ R$ 12; num plano de assistente por assinatura, o custo
marginal é próximo de zero até o limite do plano. A fábrica (`tasks/miniaturas/fabrica.md`)
prevê medir isso por imóvel no lote piloto (M5).

## As técnicas da lista, uma a uma

@@TECNICAS@@

## O que mudou, arquivo por arquivo

| Arquivo | Mudança |
|---|---|
| `fonte/miniatura.js` | O visualizador aprovado com: quadro sob demanda, sombra em cache, perfil e resolução dinâmica, interior sob demanda, dados binários, luz KTX2, capa, sem "Ver mapa". Os comentários originais foram mantidos; cada mudança tem nota "v4". |
| `fonte/qualidade.js` | Novo: perfis alto/médio/baixo, palpite pela GPU, governador de resolução. |
| `fonte/luz.js` | Novo: carregamento KTX2 (em pedaço separado) e decodificação logarítmica no shader. |
| `fonte/binario.js` | Novo: leitor do formato MBN1 (arrays tipados em gzip, com diferenças). |
| `fonte/interior/*.js`, `fonte/mapa-geometria.js` | Os módulos do renderizador do padrão aprovado, **sem alteração**. |
| `fonte/pagina.html` | O HTML/CSS aprovado sem o "Ver mapa"/cortina, com a capa e a pré-carga. |
| `gerador/` | `derivar.py` (luz e binários, com cache), `luz.py` (reempacotamento, push-pull, codificação), `binario.py`, `codificar_ktx2.mjs`, `decodificar_ktx2.mjs`, `montar.mjs`, `capa.mjs`. |
| `derivados/monte-dos-cedros-37/` | Saída da derivação: 3,2 MB versionados, `relatorio.json` com o erro medido da compressão e `conferencia.json` com o SHA-256 de cada saída. Os dois atlas de resolução cheia (5,6 MB) passam de 1 MiB e ficam fora do git pela trava de tamanho do repositório; a codificação é determinística e o `derivar.py` os refaz idênticos em ~1 min. |
| `medicoes/` | Medidor, servidor, comparação visual, fumaça, custos, tabelas e os resultados em JSON. |

## Decisões e limites

- **three.js continua na r168**, a mesma do padrão aprovado. A r186 removeu o
  `PCFSoftShadowMap` (as sombras mudariam) e não traz ganho medível para esta cena; a troca
  fica para quando houver reaprovação visual.
- **WebGPU não entrou.** Os ajustes de luz do padrão são trechos de shader GLSL
  (`onBeforeCompile`), que o renderizador WebGPU do three não aceita: seria reescrever a
  iluminação em TSL. O gargalo medido não é o número de chamadas de desenho (onde o WebGPU
  ajuda), e o WebGL2 abre em praticamente todo navegador de celular.
- **A luz não foi recalculada.** O bake aprovado é o mesmo; o atlas externo foi só
  reempacotado (cópia texel a texel, mesma densidade).
- **Celular de verdade:** não foi possível testar aqui. O palpite de perfil é uma tabela
  de GPUs; o governador corrige em uso e grava o perfil de baixo se o aparelho não segurar.
  O próximo passo é abrir `?perf=1` em 2–3 celulares e ajustar a tabela.
- **Mipmap no atlas reempacotado:** com 4 texels de margem, de longe os níveis menores
  misturam um pouco ilhas vizinhas; o preenchimento push-pull evita borda preta. O perfil
  alto amostra sem mipmap, como o aprovado.
- **Colinas e Castanheiras** continuam na versão anterior (como no padrão atual); o gerador
  da v4 serve a qualquer imóvel PREMIUM com luz calculada.

## Próximos passos sugeridos

1. Testar em 2–3 celulares reais com `?perf=1` e calibrar a tabela de GPUs.
2. Publicar num canal de pré-visualização (`LEIA-ME.md`) e medir com a URL pública.
3. Avaliar remover da malha as faces nunca iluminadas (as ~37 mil ilhas apagadas), com
   conferência visual por baixo da maquete.
4. Converter Colinas e Castanheiras quando tiverem luz calculada.
