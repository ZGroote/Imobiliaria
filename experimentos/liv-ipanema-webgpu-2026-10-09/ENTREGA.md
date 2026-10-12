# LIV Ipanema — pacote de avaliação de 11/10/2026

## Revisão v6 — retirada do preenchimento externo

A versão para revisão é `entregas/liv-avaliacao-20261011-v6/`. Remove a faixa de terreno e a linha de divisa artificiais da v5, rejeitadas pelo responsável. A maquete mantém seu piso e enquadramento originais. O mapa conserva o giro, a localização e o pequeno acesso da portaria, sem desenhar o lote como uma placa ao redor do modelo. Pisos de contexto são recortados; o terreno natural de fundo permanece contínuo.

- Versão: `d8c347b53a07fd1cfe27672a5054771cd1c4c58d2c7e9423241094c3d597965b`.
- Site: **239 arquivos / 144.457.642 B**; revisão: **26 arquivos / 3.995.424 B**.
- ZIP: `entregas/liv-avaliacao-20261011-v6-d8c347b53a07.zip`, **112.339.259 B**, SHA-256 `fa45a7d8c4dee122aab41433ec8dddc124b99b83e6481f34c192f17b7ed22bad`.
- [Maquete v6](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/entregas/liv-avaliacao-20261011-v6/site/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio) · [Mapa v6](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/entregas/liv-avaliacao-20261011-v6/site/mapa-liv-ipanema-5km.html?geometria=entrada&unidades=edificio).

Conferência visual e identidade no [relatório do mapa sem preenchimento](evidencias/mapa-sem-preenchimento/runtime.json). Conferência independente dos bytes e navegação da v6 em [entrega-sem-preenchimento/runtime.json](evidencias/entrega-sem-preenchimento/runtime.json). Os relatórios registram o estado das execuções. Estoque real, produção e qualificação de aparelhos físicos continuam desativados/pendentes.

Ambos terminaram em **PASS**. A v6 foi verificada por HTTP nos 239 recursos, com as duas plantas/Tours, ficha, ida/retorno pelo mapa, recuperação e ausência de preenchimento externo em WebGPU, WebGL2 e toque emulado. As capturas de Implantação foram inspecionadas e a aba existente do responsável foi atualizada para a v6.

## Revisão v5 — estoque e terreno indicado

A revisão histórica está em `entregas/liv-avaliacao-20261011-v5/`. Seu preenchimento externo foi rejeitado pelo responsável e corrigido na v6 acima. Acrescentou as fichas por apartamento, o leitor público opcional do estoque administrado no painel e o contorno aproximado indicado pelo responsável. Maquete e mapa usam a mesma referência; o mapa recebe o giro de 180°, a mudança de terreno e o recorte do contexto antigo dentro da área. A escala da torre permanece igual. A v4 abaixo continua preservada como registro histórico.

- Versão: `7d268df4e7e928a1c944dc19f37248ff639a12994cc54e5669310d84ad2a2c44`.
- Site: **241 arquivos / 144.462.277 B**; revisão: **26 arquivos / 3.990.987 B**.
- ZIP: `entregas/liv-avaliacao-20261011-v5-7d268df4e7e9.zip`, **112.337.752 B**, SHA-256 `3394e20506faf487b9ea3a4eb2dd34fc3e6f7ba501d35acfe50c908f4f1edfe3`.
- [Maquete v5](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/entregas/liv-avaliacao-20261011-v5/site/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio) · [Mapa v5](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/entregas/liv-avaliacao-20261011-v5/site/mapa-liv-ipanema-5km.html?geometria=entrada&unidades=edificio).

Operação e ativação em [ESTOQUE.md](ESTOQUE.md). O documento de configuração do estoque tem metadados públicos, incluindo nome e estado de publicação; unidades e perfis só ficam públicos quando habilitados e vinculados a um imóvel ativo. Histórico, atores e índice de números permanecem privados. A configuração v5 não fixa um ID de imóvel, não cadastra ofertas reais e não ativa a produção. O painel e suas novas regras são componentes separados, preparados no repositório; o ZIP contém o site público e a revisão.

Conferências novas: [painel e estoque ao vivo](evidencias/estoque-admin/runtime.json), [implantação no mapa](evidencias/mapa-giro-avenida/runtime.json), [cadastro local preservado](evidencias/comercial-estoque-terreno-final/runtime.json), [vínculos das duas plantas](evidencias/vinculos-estoque-terreno-final/runtime.json) e [bytes e navegação do pacote v5](evidencias/entrega-estoque-terreno-final/runtime.json). Os relatórios específicos registram o estado de cada execução. Nenhum desses ensaios qualifica um celular físico. A imagem de satélite fornece uma amarração aproximada, sem substituir levantamento cadastral ou planta executiva.

Os cinco relatórios acima terminaram em **PASS**. O pacote foi conferido por HTTP nos 241 arquivos e navegou em WebGPU, WebGL2 e toque emulado, com 170 posições, ficha, duas plantas em quatro modos, caminhada, ida/retorno do mapa e zero erro de requisição ou tile. Material padrão/Draco, base de recuperação, exportação do diagnóstico e recuperação 2D sem GPU também passaram. A vista Implantação foi inspecionada na v5: 19 vértices de terreno e escala `[1,1,1]`, com a mesma identidade do contorno do mapa.

## Registro histórico v4

O pacote local está montado em `entregas/liv-avaliacao-20261011-v4/`: `site/`, `revisao/`, configuração própria e instruções. A versão pública antiga não foi substituída. A preparação inclui WebGPU com alternativa WebGL2, as duas plantas e seus Tours, 170 posições técnicas, integração comercial/vínculos preparada, fila e recuperação independente da base.

- Versão do conjunto: `ac93e25ff9739851bed5a6a011a80501414535c367a822235217e6300548d936`.
- Site: **234 arquivos / 143.856.523 B**. Revisão: **19 arquivos / 1.749.628 B**, com fontes de procedimento, métricas, testes e capturas diurnas/entardecer.
- ZIP: `entregas/liv-avaliacao-20261011-v4-ac93e25ff973.zip`, **110.221.060 B**, SHA-256 `6692619c837eb10e0c2ccf06a6e3cf61ef3da2da18859a74c491e21d855d3a06`.
- Perfil: avaliação local; publicação e qualificação física **falsas** no manifesto. Entardecer é ilustrativo sobre bake diurno; tabela comercial e vínculos reais estão ausentes.

O tamanho do pacote reúne três edições e a base completa para recuperação. **Não equivale ao download inicial do cliente.** A medição gzip de três rodadas, anterior à ambiência/vínculos/enquadramento final, está em [REDE-MEMORIA.md](REDE-MEMORIA.md): cerca de 16,93 MB na entrada nova contra 22,90 MB da publicação preservada, em rede CDP de 6 Mb/s/80 ms. Memória e aparelhos físicos ainda precisam fechar o orçamento.

## Abrir

[Índice do pacote local](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/entregas/liv-avaliacao-20261011-v4/site/index.html) · [Edifício e plantas](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/entregas/liv-avaliacao-20261011-v4/site/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio) · [Diagnóstico](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/entregas/liv-avaliacao-20261011-v4/site/diagnostico.html).

Os links usam o servidor local existente e funcionam neste computador. Também é possível servir apenas `site/` com Python, em outro loopback. O QA usa servidor efêmero próprio e os arquivos empacotados, sem buscar recursos no experimento de desenvolvimento.

## Conferência

[Relatório do pacote final](evidencias/entrega-fachada-final/runtime.json). Verificações: inventário/hash por HTTP de todos os recursos; WebGPU, WebGL2 e toque emulado; seleção/espelho, Canto/Meio em quatro modos, caminhada, PNG, sessão, retorno do mapa, PBR padrão/Draco, diagnóstico exportável, base preservada e fallback 2D sem GPU. Nenhum perfil é aparelho físico.

A conferência independente encontrou dois problemas e ampliou o aceite: os tiles do mapa ignoravam `base href`, e a vista de seleção enquadrava 48,45 m de pavimentos sem a cobertura que chega a 52,70 m no modelo. O fetch usa `document.baseURI`; a câmera agora usa a caixa real da torre, com margem. O relatório exige zero erro de tile/pedido pendente e verifica a projeção dos oito cantos da torre. Nenhum material, atlas ou volume foi alterado para corrigir o enquadramento.

`montar_entrega.py` segue uma lista fechada de módulos/assets, valida os manifestos de origem e copia para staging conferido antes de promover o destino. Repetições só aceitam bytes/metadados/configuração iguais. Não inclui autoria Blender, arquivos privados ou todas as dependências da instalação. Quatro testes verificam caminhos, falhas/retenção do destino, declaração física e ZIP. Configuração e revisão também entram na identidade do conjunto; o Git HEAD registrado durante a montagem não substitui os hashes dos arquivos efetivos.

```powershell
& 'C:/Python314/python.exe' experimentos/liv-ipanema-webgpu-2026-10-09/montar_entrega.py --nome liv-avaliacao-20261011-v4 --zip
& 'C:/Python314/python.exe' experimentos/liv-ipanema-webgpu-2026-10-09/qa_entrega.py --pacote experimentos/liv-ipanema-webgpu-2026-10-09/entregas/liv-avaliacao-20261011-v4 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/entrega-nova
```

Uma alteração futura usa nome novo; não sobrescrever um pacote qualificado. As primeiras montagens locais e o ensaio que expôs os tiles ficam preservados como diagnóstico, sem serem a entrega indicada.

## Preview separado e recuperação

`firebase.json` do pacote aponta explicitamente para o site confirmado `imobilaria-deccb-miniaturas`, com `public: site`; `.firebaserc` usa o projeto existente `imobilaria-deccb`. Essas cópias não alteram a configuração do repositório. Módulos em `node_modules/three/` são recursos do browser e **não devem ser ignorados** no deploy deste pacote.

A publicação é uma etapa separada, a executar quando solicitada, com canal novo e expiração explícita. A configuração está pronta para `hosting:channel:deploy` com `--config`, `--project imobilaria-deccb` e `--expires 7d`; não usar `firebase deploy` para substituir produção. Após publicação: conferir identidade/endereço HTTPS, quatro modos/tiles, diagnóstico no Poco/iPhone e registrar URL/expiração no relatório específico. Não há URL HTTPS nova neste registro.

Recuperação local: `site/site-baseline/` reproduz os recursos preservados e abre independentemente da evolução. Se o preview futuro falhar, usar a base recuperada ou canal anterior ainda válido; manter o pacote preservado como fonte. Não retirar o canal usado pelo cliente para testar a evolução. A expiração antiga, registrada na baseline, é 16/10/2026 às 09:12:58 BRT; nenhum canal foi renovado nesta execução.

## Dependências ainda abertas

1. Caminhada e armazenamento/rede no **Poco X6 e iPhone físicos**, três rodadas no hosting, antes de fixar orçamento/aprovar o produto. [DIAGNOSTICO.md](DIAGNOSTICO.md).
2. Associação por final, espelhamentos, gardens e medidas. [VINCULOS.md](VINCULOS.md): mecanismo pronto, dados ausentes; espelhamento precisa de geometria/navegação/luz próprias.
3. Tabela comercial autorizada: preço, disponibilidade, número e vagas. [COMERCIAL.md](COMERCIAL.md): validação/importação preparada, sem ofertas fictícias.
4. Acabamento artístico final e luz de entardecer com bake próprio, após o orçamento móvel; fachada vertical e paisagismo continuam aproximados onde as fontes não confirmam medidas. [AMBIENCIA.md](AMBIENCIA.md).

Migração integral do mapa para WebGPU e simulação solar por data/hora permanecem extensões condicionais, conforme o plano, depois da qualificação principal e da validação de norte/implantação. O estágio técnico histórico de 09/10 está preservado em [ENTREGA-HISTORICO-20261009.md](ENTREGA-HISTORICO-20261009.md).
