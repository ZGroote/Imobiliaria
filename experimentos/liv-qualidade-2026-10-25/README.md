# LIV — estudo gráfico separado, 25/10/2026

Prévia local: <http://127.0.0.1:8796/>. Use **Atual / Estudo** para comparar no mesmo enquadramento. Há maquete, plantas 3D e plantas 2D, com tipologias de canto e meio.

## Executar novamente

Na raiz do repositório:

```powershell
node experimentos/liv-qualidade-2026-10-25/preparar.mjs
python -I -m http.server 8796 --bind 127.0.0.1 --directory experimentos/liv-qualidade-2026-10-25/.preview
```

O preparador copia a base para `.preview/runtime`, aplica as alterações somente nessa cópia e compila com esbuild e Three.js 0.186.1 já instalados. Não instala dependências. Não altera a publicação, regras, estoque ou os experimentos anteriores. Os modelos detalhados são construídos nesta variante durante o carregamento; os GLBs publicados não são sobrescritos. `.preview/` e `evidencias/` são saídas locais ignoradas pelo Git.

Base: `publicacao/liv-duplo-20261017/payload/liv-classico/`, correspondente ao visualizador do endereço solicitado, <https://conectaimoveis3d.com.br/maquetes/liv/>. `origem.json`, na prévia gerada, registra SHA-256 dos fontes usados. O preparador interrompe se os trechos necessários mudarem na base.

## Alterações visuais

- **Geometria da vegetação:** 646 volumes de copas substituídos por 183.708 folhas curvas com nervuras e cabinhos; ramificações e casca em 146 troncos; frondes pinadas em 13 palmeiras. Mantém matrizes e limites das copas da implantação. A variante acrescenta 1.723.012 triângulos agrupados em 7 chamadas de desenho, incluindo as piscinas.
- **Geometria dos móveis:** 12 substituições por tipologia, com 137 malhas e 122.520 triângulos. Camas com colchão, cabeceira e roupa com dobras; sofá com estofados curvos, costuras e manta; mesas chanfradas e cadeiras de encosto curvo. As posições, rotações e áreas ocupadas vêm dos JSONs existentes.
- **Superfícies PBR:** novos mapas determinísticos de cor, normal e rugosidade em 512² para madeira, porcelanato, tecido e reboco. Pisos usam escala em metros; remove a multiplicação da textura nova pela antiga cor laranja. A aplicação reconhece os materiais Node RGBM, que não têm a flag `isMeshStandardMaterial` usada na primeira tentativa.
- **Piscinas:** duas superfícies com malha ondulada, reflexão/refração, mosaico e cáusticas ilustrativas, preservando o contorno original.
- Resolução de renderização de 1,5× a 2× nos tamanhos comuns, limitada a 3,2 milhões de pixels. Redimensionamento recalcula o limite.
- Oclusão de contato GTAO com redução de ruído, calibrada separadamente para prédio e apartamento. Mantém a luz RGBM existente; não rebakeia a cena.
- Ambiente de reflexão de estúdio em meia precisão, gerado localmente, com duas fontes largas de luz. Mantém o mapeamento de cores da base, após comparação visual que descartou um tratamento com contraste insuficiente.
- Mapas de sombra estáticos de 4096² no exterior e 2048² no interior, compartilhados pelas duas aparências. Redimensioná-los durante a comparação causou `GPUValidationError` no r186; o teste agora aloca uma vez antes de compilar a cena. A comparação normaliza a resolução das sombras e restaura os demais parâmetros gráficos. Anisotropia de 8× nas texturas de materiais, microtextura de reboco e tecido, e calibração de vidro/metal.
- Planta 2D vetorial com os polígonos, mobiliário, janelas e portas dos mesmos arquivos `unidade.json`. A opção Atual mostra a imagem comercial; Estudo mostra uma nova representação ilustrativa, sem aumento artificial do JPEG.
- Controles de giro/zoom, implantação, fachada, centralização, paredes baixas e comparação gráfica. A alternância Atual/Estudo no 3D preserva a câmera e restaura os parâmetros originais de materiais e renderer.

O pipeline segue as APIs da versão local do Three: [GTAONode](https://threejs.org/docs/pages/GTAONode.html), [RenderPipeline](https://threejs.org/docs/pages/RenderPipeline.html). Trocas do objeto de câmera recriam os efeitos de profundidade. Em falha do pós-processamento, o estado gráfico é restaurado e a cena continua com renderização direta.

## Verificação

```powershell
node --test experimentos/liv-qualidade-2026-10-25/test_estudo.mjs
node --test experimentos/liv-qualidade-2026-10-25/test_pbr.mjs
node experimentos/liv-qualidade-2026-10-25/interior-model-check.mjs
node experimentos/liv-qualidade-2026-10-25/exterior-test.mjs
```

14 testes Node aprovados: orçamento de resolução, plantas reais canto/meio, polígonos, mobiliário, portas/janelas, orientação de aberturas, escaping XML, entrada inválida, determinismo PBR, normais, espaços de cor e restauração dos materiais. Os dois scripts de modelos verificam limites geométricos, posições, matrizes, alternância reversível e descarte idempotente. Sintaxe JS e `git diff --check` conferidos.

Navegador real na revisão dos modelos: maquete com vegetação nova e planta de canto com móveis/PBR abriram em WebGPU; GTAO ativo, `backendError` nulo e nenhum erro/aviso registrado no console. Comparação Atual/Estudo e paredes baixas conferidas no canto. Capturas em `evidencias/maquete-modelos-depois.jpg` e pares `*-modelos-antes/depois.jpg`.

A última conferência visual da planta de meio e a exportação isolada da imagem ficaram pendentes: após acionar a captura no visualizador isolado, o navegador passou a devolver timeouts de captura, clique e recarga. Os testes geométricos do Meio passaram. A verificação anterior em WebGL2, desktop/celular, zoom e troca de modos pertence ao tratamento de renderização anterior à inclusão das novas geometrias, e não qualifica o desempenho dos novos modelos.

Depois da correção dos alvos de sombra, quatro ciclos consecutivos `fachada → implantação → centralizar → Atual → Estudo` passaram em WebGPU; `backendError` permaneceu nulo e o efeito de contato permaneceu ativo. O monitor da prévia também acompanha erros depois da abertura da cena, para oferecer nova tentativa caso o dispositivo gráfico falhe.

## Limites

É um ensaio local, sem publicação ou commit. Não há medição de FPS, memória gráfica ou aparelho físico. O custo das geometrias novas, GTAO e sombras maiores exige medição antes de promover o estudo para produção. A arquitetura do prédio, armários, louças e medidas inferidas continuam sendo as da base; não houve reconstrução arquitetônica completa ou novo bake de iluminação. Não foram validados Tour, mapa, estoque ou contatos comerciais nesta revisão.
