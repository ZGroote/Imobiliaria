# LIV Ipanema — evolução visual e WebGPU

Implementação iniciada em 09/10/2026, conforme [plano](../../tasks/liv-ipanema-webgpu/plan.md). A base é a edição `strict-circle-v3` do [endereço indicado pelo usuário](https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app/maquete-liv-ipanema.html). Este diretório separa a evolução do experimento histórico.

## T01 — reprodução isolada

O preparador histórico confundia o hash/tamanho da publicação minificada com o HTML fonte. Agora valida separadamente:

- Publicação: `htmlSHA256` **e** `htmlBytes`.
- Fonte anterior à minificação: `htmlOriginalSHA256`, somente quando `minificada` é `true`; `htmlOriginalBytes` também é exigido se estiver registrado.

Um hash novo não é aceito automaticamente. A rejeição ocorre antes de qualquer cópia. O registro de release existente já identifica a fonte correta de 53.580.328 bytes; ele foi conservado sem edição.

`preparar_pacote.py` monta o site em um diretório temporário dentro deste experimento, no mesmo volume do destino. Confere a preservação e a identidade de cada saída e só então promove a pasta completa por renomeação para `site-baseline/` ausente. Uma falha intermediária não deixa um destino parcialmente gravado. Os **125 arquivos de conteúdo** reproduzem byte a byte a edição pública: HTML da maquete, mapa, índice, GLB, Blend e 120 tiles de quintais. Total do conteúdo: **58.291.990 bytes**.

O pacote tem 126 arquivos. Somente `manifesto-teste.json` foi regenerado com campos separados de fonte e publicação anterior. A mudança de metadados está declarada em [manifesto.json](manifesto.json), que registra hashes das entradas/saídas, Python 3.14.4, Three.js r168 embutido e procedência local. Não se afirma um commit exato da origem.

O comando reutiliza o mapa e os tiles regionais já gerados em `mapas-v3/`. Demonstra a montagem fiel a partir desses artefatos e da fonte HTML correspondente; não reexecuta o recorte municipal, o gerador da geometria, unwrap ou bake. Esses arquivos locais e o inventário em `backups/` são pré-requisitos; um checkout sem os artefatos deve recuperá-los e verificar seus hashes antes da execução.

Uma repetição só aceita um destino cujo conteúdo ainda seja idêntico à montagem esperada e apenas o confere, sem regravar seus arquivos. Destinos existentes vazios, arquivos extras ou mudanças feitas por outra tarefa são rejeitados, sem limpeza automática. Os destinos ficam restritos a pastas `site-baseline*` diretamente neste experimento. O pacote histórico `site-v3/`, seus relatórios e os recursos canônicos não são reescritos.

## Executar localmente

Na raiz do repositório:

```powershell
python -m unittest discover -s experimentos/liv-ipanema-webgpu-2026-10-09 -p test_reproducao.py
python experimentos/liv-ipanema-webgpu-2026-10-09/preparar_pacote.py
python -m http.server 8791 --bind 127.0.0.1 --directory experimentos/liv-ipanema-webgpu-2026-10-09/site-baseline
```

Abrir [maquete local](http://127.0.0.1:8791/maquete-liv-ipanema.html). Em outro terminal:

```powershell
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_miniatura.py --base-url http://127.0.0.1:8791 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/reproducao-miniatura
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_mapa.py --base-url http://127.0.0.1:8791 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/reproducao-mapa
```

O preparo usa somente a biblioteca padrão do Python. Os QAs existentes requerem Playwright e Chrome instalado no caminho configurado por eles. Todos os destinos acima pertencem a este experimento; não executar os exemplos históricos com saída em `site-v3/`.

## Verificação registrada

- **10 testes passaram:** fonte correta, publicação correta, tamanho divergente, fonte adulterada, uso indevido do hash original, tamanho original opcional, falha antes da primeira escrita, recurso corrompido/extra e destino histórico rejeitado. O teste de integração adicional injeta falha na segunda escrita: destino novo permanece ausente, destino aprovado permanece intacto, staging é removido e a repetição recupera a montagem sem regravar o pacote já idêntico.
- **Preparação passou**, inclusive repetição sobre o pacote ainda idêntico: 125 hashes de conteúdo correspondentes à base; recursos regionais completos.
- **QA da miniatura passou** em desktop e celular emulado: quatro modos, gestos de navegação, planta oficial, retorno à implantação completa com 56 malhas/43 da implantação, presença de cinco enquadramentos e link para o mapa. Evidências em `evidencias/reproducao-miniatura/runtime.json` e capturas PNG.
- **QA do mapa passou** em desktop e celular emulado: busca por categoria/nome/teclado, links de ida/volta, implantação e relevo, vértices do recorte de 5 km e requisições restritas ao pacote regional. Inclui verificações de layout em 320 e 768 px. Evidências em `evidencias/reproducao-mapa/runtime.json` e capturas PNG.

Estes testes demonstram reprodução e funcionamento do visualizador WebGL atual. Não medem desempenho em aparelhos físicos, não comprovam WebGPU e não substituem a qualificação T02/T12. O teste de download da função “Fotografar” nos dois backends integra T04.

Não foi feita publicação nem commit. A configuração produzida pelo preparador histórico fica no diretório temporário e é descartada; este fluxo não prepara configuração de deploy. O preview original expira em 16/10/2026 às 09:12:58 BRT, enquanto os pacotes locais preservados continuam disponíveis.
