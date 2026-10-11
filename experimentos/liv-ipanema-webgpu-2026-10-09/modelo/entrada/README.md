# Entrada revisada — 11/10/2026

A entrada passa a ter portal alto à esquerda, marquise baixa sobre a guarita e o acesso da direita, janela voltada à rua e placa à frente das grades. A referência é o render local `v1.5/miniaturas/liv-ipanema/referencias/portaria.jpg`, SHA `5c66690329183ba4adf56401cf0d6c6b470cbb42feba810499ddec7acc379cc2`. Formas e implantação são inferidas; não há cotas executivas, identificação de vagas ou homologação arquitetônica.

[Explorar com iluminação própria](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/modelo/entrada/candidato/prova.html?geometria=entrada). [Comparar a forma anterior/revisada](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/modelo/entrada/comparacao.html). A comparação carrega GLBs com PBR/iluminação iguais, sem atlas da entrada. A primeira página usa UV/bake da nova geometria; não aplica o atlas anterior aos volumes alterados.

## Geometria e autoria

`modelar_entrada.py` reutiliza a receita qualificada de contorno por adaptações locais verificadas, sem editar o gerador original. Remove 29 caixas/28 segmentos da entrada simplificada e sua placa, desloca uma palmeira fora da cobertura e ajusta dois trechos da cerca. `entrada_site.py` une os volumes em eixos locais antes de transformá-los para o terreno, evitando perda de precisão nos encontros finos. O vão frontal da guarita contém a janela, sem parede opaca atrás.

[Registro independente](../../evidencias/entrada-geometria/geometria.json): dez estruturas fechadas, volume positivo, zero triângulos degenerados, arestas não manifold ou pares coplanares sobrepostos; nove amostras do portal livres, nove do vão da janela livres e cobertas pelo vidro. Portal, guarita/marquise, piso e placa ficam dentro do lote ilustrado. Os **22 grupos / 196 instâncias da torre** mantêm geometria, normais, UVs, materiais e matrizes idênticos ao contorno `618c4f55…`.

A autoria tem SHA `09407385ae2776910decbf433a365f000f61512e2c35c8fd7e3f3248086b172a`; GLB `4947fee3d6eba10af3619493663a04a3fb478086a0953ae646f685b09e84ba01`, 2.535.936 bytes. São 280.339 triângulos na cena completa, 2,2% acima do contorno anterior. Isso não mede custo de execução GPU.

## Materiais e iluminação

Quatro materiais Principled BSDF são exportados como PBR padrão: carbono, reboco, metal e vidro. Cor, roughness, metalness e emissivo são conservados. O vidro é MeshStandardMaterial opaco convertido pelo próprio WebGPURenderer; não existe interior completo da guarita para vidro transmissivo. O transporte RGBM/TSL existente é reutilizado apenas nas superfícies baked, mantendo suas propriedades PBR; nenhum shader de acabamento novo.

UV1 próprios em 4096², cobertura com densidade linear 4× nos cinco grupos finos, margem efetiva 4,07 px, erro máximo de quantização de 0,03125 px. Bake Cycles/OPTIX com 64 amostras, iluminação difusa direta/indireta sem cor; OIDN 2.3.3 e guarda de quatro pixels dentro de cada ilha. O atlas bruto é preservado. Fontes/atlas/manifesto correspondem à mesma autoria. Atlas final SHA `c1ff52d343c5f05f3c2e37911c269f34cc9f997a18fdebdc6f07f83c3d9b95dc`, 13.290.120 bytes gzip.

`exportar_entrada.py` preserva as verificações do exportador RGBM do contorno e acrescenta somente os quatro materiais próprios, com destino restrito ao candidato. O pacote tem **16.091.722 bytes / 57 malhas / 42 baked**: 46.828 bytes a mais (+0,29%) que o anterior. O atlas descomprimido continua com 64 MiB. A abertura do exterior foi medida abaixo; interface integrada e rede móvel ainda precisam ser medidas.

## Qualificação

[Forma/PBR](../../evidencias/entrada-forma-enquadrada/runtime.json): WebGPU, WebGL2 e toque emulado, vistas da rua/de cima, troca anterior/revisada, serialização, gesto, captura, recursos liberados e rejeição de GLB corrompido com recuperação. Os materiais do GLB seguem a conversão automática do renderer.

[Iluminação própria](../../evidencias/entrada-luz-enquadrada/runtime.json): três perfis, vistas Acesso/Implantação/Perspectiva e enquadramento dos oito cantos da entrada em cinco tamanhos, incluindo 320 px e paisagem. Sombras reutilizadas diferem no máximo 1/255 das recalculadas e produzem zero novos passes em 24 quadros de giro por caso. Cor/roughness/metalness/emissivo dos quatro PBR são conferidos; fotografia, mouse/toque e descarte único de atlas/ambiente passam. Fonte incompatível é rejeitada antes do atlas. `geometria=entrada&selecao=piloto` é rejeitado antes de transferir recursos, pois o cadastro não foi associado a esta edição.

Chrome 154.0.8037.98, Windows/GTX 1650, headless, ensaios sequenciais. Toque/DPR alto são emulação; Poco X6, iPhone e desempenho físico continuam pendentes. Não há comparação fotométrica com o render oficial de entardecer.

## Custo comparável do exterior isolado

[medicao-entrada-final/medicao.json](../../evidencias/medicao-entrada-final/medicao.json): três rodadas por edição/backend, frio/reload, Chrome novo por tratamento/rodada, ordem alternada, execução sequencial. Mesma página `prova-rgbm.html`, câmera conferida por igualdade, canvas 720×390, viewport 1440×900, DPR 1, reflexos pré-calculados. Reutiliza o coletor de órbita de `medir_runtime.py`. São 12 pares/24 amostras, sem fila, seleção, mapa ou interiores.

| Exterior isolado | Mediana fria | Mediana reload | Conteúdo inicial |
|---|---:|---:|---:|
| Contorno / WebGPU | 1.509 ms | 1.953 ms | 19.959.927 bytes |
| Entrada / WebGPU | 1.527 ms | 2.021 ms | 20.007.103 bytes |
| Contorno / WebGL2 | 4.328 ms | 1.193 ms | 19.959.927 bytes |
| Entrada / WebGL2 | 3.979 ms | 1.158 ms | 20.007.103 bytes |

WebGPU varia +1,2% frio/+3,5% reload; WebGL2 −8,0%/−3,0%. O conteúdo inicial cresce 47.176 bytes (+0,24%). Ambos mantêm 42 programas e nove texturas no contador do renderer; seus bytes contabilizados crescem 484.968 (+0,41%). Esses contadores não são a memória física total do processo/driver. A variação observada não comprova ganho causado pela nova geometria.

Caches do driver e outras aplicações não são controlados. Intervalos de submissão p95 ficam perto de 17 ms e não medem tempo GPU/FPS. A ausência da interface/cadastro impede misturar estes tempos com [AMBIENTE.md](../../AMBIENTE.md) ou aprovar T05. Não houve ensaio físico.

## Integração restante

A revisão está disponível como estudo separado. Maquete integrada, mapa, fila e os dois apartamentos conservam a edição anterior. O cadastro do piloto precisa ser ligado e conferido contra a nova autoria, e o GLB regional/cache precisam acompanhar sua versão. Medição da interface integrada e regressões desses fluxos precedem a integração. Contorno continua opcional conforme o orçamento em [AMBIENTE.md](../../AMBIENTE.md); não houve publicação.

## Reproduzir

Pré-requisitos locais: fontes canônicas, contorno qualificado e seu pacote RGBM, referência identificada, Three.js 0.186.1 local, Blender 5.2.2, xatlas e OIDN. Artefatos grandes são gerados e ignorados pelo Git. Com servidor da raiz em `127.0.0.1:8790`, executar a partir da raiz, na ordem, sem outros ensaios gráficos:

```powershell
$livBlender = 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe'
$livEntry = 'experimentos/liv-ipanema-webgpu-2026-10-09/modelo/entrada'
& $livBlender -b --factory-startup --python-exit-code 1 --python "$livEntry/modelar_entrada.py"
python "$livEntry/registrar_entrada.py"
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/preparar_luz_densa.py --model "$livEntry/candidato/modelo.json" --out "$livEntry/candidato/luz"
& $livBlender -b --factory-startup --python-exit-code 1 --python v1.5/miniaturas/liv-ipanema/bake_luz.py -- --out "$livEntry/candidato/luz" --samples 64
python v1.5/miniaturas/liv-ipanema/denoise_luz.py --out "$livEntry/candidato/luz" --output-guard 4
python "$livEntry/exportar_entrada.py"
python "$livEntry/qa_entrada.py" --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/entrada-forma-outra-revisao
python "$livEntry/qa_luz_entrada.py" --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/entrada-luz-outra-revisao
python "$livEntry/medir_entrada.py" --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/medicao-entrada-outra-revisao
```

Geradores preservam verificações de fonte e não promovem o estudo ao produto. Alterar a geometria exige novo UV/bake/pacote e nova qualificação.
