# LIV corrigido no mapa — 11/10/2026

## Implantação conforme contorno indicado pelo responsável

`mapa-parcela.json` registra os 19 pontos do contorno marcado no chat, a identidade da imagem de satélite fornecida e três cruzamentos usados para uma amarração aproximada ao sistema de coordenadas existente. A portaria é voltada para a Miguel Petroni/João de Guzzi após o giro de 180°. O posicionamento é uma referência visual: não representa levantamento cadastral ou medidas executivas do terreno.

O modelo GLB conserva geometria, materiais, instâncias e escala `[1,1,1]`. A implantação original cabe no contorno registrado. O contorno serve para posicionamento e recorte de contexto; não cria uma faixa de chão ou uma divisa visível em volta da maquete. O acesso pequeno conecta a portaria à calçada da avenida. A elevação do modelo no mapa passa de 0,40 para 1,05 m sobre a ilha de terreno: sua base está cerca de 0,95 m abaixo da origem da torre e ficava parcialmente sob o piso regional.

A camada de contexto exclui seis construções e cinco quintais da base por centro dentro do lote, recorta muros e subtrai o contorno dos pisos regionais, preservando atributos dos vértices. Caminhos classificados como serviço são recortados nesse trecho; ruas públicas mantêm seus pontos e classificação. Os blocos de dados e os 120 arquivos de tiles fonte permanecem preservados. A reentrância do limite evita englobar o trecho vizinho indicado no contorno.

`preparar_mapa.py` gera o runtime regional a partir do JSON. A maquete WebGPU/WebGL conserva seu piso e seu enquadramento original. O preenchimento externo e a linha de divisa adicionados na v5 foram rejeitados pelo responsável e removidos; não representam a implantação arquitetônica do LIV. O mapa também não desenha esse preenchimento ou linha, mantendo apenas o acesso da portaria.

`evidencias/mapa-sem-preenchimento/runtime.json` compara a v4 preservada com a revisão sem preenchimento: mesmo GLB e escala, giro de π, mudança de lado, terreno alinhado, tiles completos e ausência de erros de JavaScript/HTTP. O relatório anterior `mapa-giro-avenida/runtime.json` documenta a v5 rejeitada. Os testes de geometria verificam conservação da área fora do recorte, atributos interpolados, muros/caminhos externos preservados e ausência de preenchimento artificial. Capturas são desktop; não qualificam celulares físicos. As verificações históricas abaixo documentam as revisões anteriores.

O [mapa do contorno](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/mapa-liv-ipanema-5km.html?geometria=contorno) e o [mapa da entrada revisada](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/mapa-liv-ipanema-5km.html?geometria=entrada) carregam a geometria correspondente à prévia integrada. O endereço sem parâmetro conserva o GLB original. O renderer regional permanece em WebGL/Three r128; a migração integral do mapa para WebGPU continua em T15.

## Autoria e transporte

[modelo/registrar_mapa.py](modelo/registrar_mapa.py) lê o GLB binário real e confere posições, normais, UVs, cobertura dos triângulos, materiais e todas as transformações contra `modelo/variante/modelo.json`. Tolera a precisão float32 e a inversão V feita pelo exportador glTF. Faces opostas coplanares podem ter triangulação diferente: a união por plano precisa cobrir a mesma superfície e o material deve ser de duas faces. Não basta comparar nomes ou contagens.

[modelo/variante/mapa.json](modelo/variante/mapa.json) vincula a autoria `618c4f55…` ao GLB `fdf52e0c…`, com 2.275.324 bytes, 88 geometrias, 1.826 instâncias e 51 materiais PBR padrão. O GLB preservado tem 2.989.904 bytes, 87 geometrias e 1.825 instâncias; ambos passaram na conferência CPU. O modelo do mapa usa a iluminação regional existente. O atlas RGBM da maquete não é aplicado ao GLB sem os UVs de luz correspondentes.

[preparar_mapa.py](preparar_mapa.py) confere o HTML e o programa compactado da base preservada. Gera um HTML próprio em `mapa-runtime/` mudando apenas carregador/procedência do modelo, base relativa de URLs, preservação do fragmento da edição e cancelamento da navegação anterior ao clicar em Centralizar. Os demais blocos, geometrias/materiais regionais, 614 POIs, relevo e 120 tiles permanecem iguais. [manifest.json](mapa-runtime/manifest.json) registra entradas e saídas; nenhuma cópia histórica é regravada.

[mapa-loader.js](mapa-loader.js) usa o GLTFLoader já presente, com os materiais PBR importados. Verifica tamanho e SHA-256 antes de fazer o parse, inclusive sem Service Worker. Arquivo incompatível mostra recuperação e retorno à edição correta, sem apresentar o GLB antigo como a variante. A implantação mantém origem da torre, metros/Y para cima, giro −π/3, deslocamento aproximado [8, −6] m e afastamento do piso de 0,4 m sobre o terreno. As posições geográficas e dimensões continuam inferidas.

## Navegação e fila

Centralizar interrompe uma animação anterior da busca antes de focar o LIV. Antes, um clique durante os 900 ms de navegação ao POI podia ser desfeito pelo próximo quadro da animação. A busca por nome/categoria e o movimento normal aos POIs continuam iguais.

Os fragmentos `#contorno`/`#entrada` escolhem a edição dentro do iframe; a página externa usa `?geometria=contorno`/`?geometria=entrada`. O fragmento não altera o recurso HTTP: o worker normaliza essa parte antes da consulta ao catálogo/cache. A preparação transfere um único HTML regional compartilhado pelas três edições. Ao abrir o mapa, HTML e GLB escolhido têm prioridade sobre tiles e os GLBs das outras edições.

O catálogo atual tem **141 recursos / 37.830.820 bytes**. Acrescenta 2.536.156 bytes à revisão anterior: GLB da entrada (2.535.936 bytes) e 220 bytes no HTML compartilhado. A preparação completa conserva os três GLBs para comparação; abrir uma edição prioriza seu modelo. O exterior inicial não recebeu esses recursos. A ordem Tour → mapa → Planta 2D e a preempção por interação são preservadas. Contagens não são medida de tráfego comprimido, tempo de abertura ou FPS. Identidades e qualificação atual em [INTEGRACAO-ENTRADA.md](INTEGRACAO-ENTRADA.md).

## Verificação

- [test_mapa_modelo.py](test_mapa_modelo.py): oito testes de GLB real, incluindo a nova entrada, rejeição de prédio anterior/posição/geometria/material incompatíveis, preservação regional e repetição sem regravar arquivos.
- [mapa-contorno-conferido/runtime.json](evidencias/mapa-contorno-conferido/runtime.json): edição original no desktop, variante no desktop/toque emulado e sem cache; escala/giro/terreno, recorte de 5 km, busca, Centralizar após POI, capturas, recarga e retorno com seleção. Arquivo GLB corrompido é rejeitado antes de construir o modelo.
- [fila-mapa-contorno-final/runtime.json](evidencias/fila-mapa-contorno-final/runtime.json): 13 cenários controlados de fila, incluindo prioridade do GLB escolhido sobre a outra edição e os tiles, além de reutilização do cache com fragmento.
- [fila-mapa-real-conferida/runtime.json](evidencias/fila-mapa-real-conferida/runtime.json): preparação e preempção com os 140 arquivos reais, cache, prioridade da variante antes dos tiles, quota indisponível e ausência de Service Worker.

```powershell
python modelo/registrar_mapa.py
python modelo/registrar_mapa.py --edicao entrada
python preparar_mapa.py
python gerar_manifesto_transferencias.py
python test_mapa_modelo.py
python qa_mapa_modelo.py --saida evidencias/mapa-nova-revisao
python qa_transferencias.py --saida evidencias/fila-mapa-nova-revisao
python qa_fila_integrada.py --saida evidencias/fila-mapa-real-nova-revisao
```

Executar a partir deste experimento; QAs gráficos em sequência. Scripts de registro/geração exigem os inputs locais identificados. Capturas, GLB e HTML derivados são artefatos gerados, mantidos neste computador e ignorados pelo Git. Provas emuladas não substituem Poco X6/iPhone físicos. Custo da abertura, acabamento visual final, confirmação arquitetônica e vínculos por final continuam pendentes. Nenhuma publicação foi alterada.

Referências técnicas: [glTF 2.0](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc), [GLTFLoader.parse](https://threejs.org/docs/pages/GLTFLoader.html) e [cKDTree.query](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.cKDTree.query.html).

Continuação de empacotamento em 11/10: o primeiro ensaio independente expôs 404 nos tiles, apesar da torre abrir corretamente. A aplicação regional construía as URLs com location.href e ignorava o base href que aponta para site-baseline/. preparar_mapa.py agora troca apenas a base desse fetch para document.baseURI. Os 120 arquivos permanecem idênticos, sem duplicatas/aliases; o catálogo da fila foi regenerado (141 arquivos / 37.830.820 B, versão fe50e42ddd61a2eaa75dbf4d643c9acc681c9abb8e1a9c51e450de479fdcee19). Oito testes passaram, incluindo restauração byte a byte do resto da aplicação regional. O QA de entrega agora exige tiles carregados, lotes disponíveis, zero erro e nenhuma solicitação pendente antes de aceitar o mapa; relatórios anteriores não conferiam esse aceite.
