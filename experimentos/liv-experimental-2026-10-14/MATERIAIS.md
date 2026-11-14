# Reaproveitamento de materiais e modelos

A [bancada local](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/materiais.html) abre GLB e pacotes GLTF para conferir os materiais antes de compor a cena. Ela usa o mesmo Three.js 0.186.1 da maquete, com WebGPU e WebGL2. Seus recursos não são carregados pela maquete.

`asset-loader.js` usa o GLTFLoader e devolve sua cena e seus materiais originais. `materials.js` confere a compatibilidade e descreve as propriedades; não substitui mapas, espaços de cor, UVs ou materiais. A câmera se ajusta ao modelo sem redimensionar sua geometria ou alterar suas unidades de origem.

MeshStandardMaterial e MeshPhysicalMaterial são convertidos pelo próprio renderer. O exterior atual também passou a usar essa conversão nos materiais que não têm bake. O transporte RGBM permanece específico porque depende do atlas e da geometria conferidos. ShaderMaterial, RawShaderMaterial e `onBeforeCompile` personalizado exigem adaptação explícita; o importador aponta essas incompatibilidades. Essa distinção segue o [manual do WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer.html).

## Abrir um asset

- GLB: selecione um único arquivo autocontido.
- GLTF: selecione o arquivo, seu BIN e as imagens. Se houver subpastas, selecione a pasta que contém esse pacote e apenas um arquivo GLTF/GLB principal.
- Os caminhos relativos precisam corresponder à estrutura exportada. Arquivo faltante, nome duplicado, URI remota e extensão obrigatória sem suporte geram erro explícito.
- Os arquivos selecionados são lidos em memória pelo navegador. As URLs temporárias são liberadas após o parse. O modelo anterior continua disponível se a abertura falhar.

A amostra incluída usa geometria e texturas próprias, geradas por `gerar_amostra_pbr.py`: mineral, pintura, metal, verniz e vidro com volume. Ela exercita albedo em sRGB, mapas de dados, clearcoat, transmission, thickness e IOR. É uma amostra técnica, sem vínculo com especificações do LIV. O manifesto registra os hashes do GLB e do pacote GLTF equivalente.

## Contratos para a próxima composição

- `createStockMaterial(type, props)`: cria Basic, Standard ou Physical padrão. Um tipo não reconhecido é rejeitado.
- `inspectMaterials(asset, renderer)`: relatório serializável, com identidade dos materiais, propriedades, texturas e motivos de incompatibilidade.
- `parseLocalGLTF(files, renderer, {signal})`: importa o pacote e preserva o resultado do GLTFLoader. Um pedido cancelado é descartado ao concluir o parse; a biblioteca não oferece cancelamento completo dessa operação.
- `disposeAsset(asset)`: libera recursos próprios do asset uma única vez, incluindo recursos compartilhados entre malhas/cenas e ImageBitmaps. Iluminação/ambiente da bancada pertencem ao visualizador.

Draco, KTX2/Basis e Meshopt são provisionados sob demanda, com decodificadores locais da versão fixada. Draco foi exercitado com o GLB próprio da Casa VistaLar, 6.425.732 bytes, 1.158 malhas, 44 materiais e 41 texturas, nos dois backends desktop. Essa leitura comprova o uso de um asset existente e preservação de seus materiais; não associa a casa ao LIV nem qualifica os demais formatos. KTX2/Basis e Meshopt ainda não têm fixture de navegador neste ensaio. Variantes de materiais e plugins adicionais precisam de implementação explícita se forem exigidos pelo arquivo.

## Verificação desta etapa

Dez testes Node passaram, incluindo material Physical, identidade de mapas, descarte único, URI/caminho inválido, cancelamento e falha parcial de parse. A inspeção considera apenas materiais atribuídos às malhas; o descarte inclui também recursos temporários criados pelo GLTFLoader.

O [QA da bancada](evidencias/materiais/runtime.json) passou em WebGPU/WebGL2 desktop e 390 px com toque emulado. Verificou GLB, GLTF multifile e pasta com subdiretórios, propriedades PBR/mapas, câmera, PNG decodificado, rejeição de arquivo/recurso inválido e recuperação. Vinte reimportações WebGPU mantiveram as mesmas contagens/tamanhos estimados pelo renderer; isso não mede toda a memória GPU. O encerramento durante uma compilação pendente aguarda sua conclusão antes de destruir recursos. A interrupção WebGPU foi testada por callback simulado durante compilação, sem falha física da placa.

A maquete passou novamente nos quatro perfis da prova, com onze materiais não baked mantidos como Standard padrão. Dez capturas comparáveis em `evidencias/comparacao-materiais-stock/` conservaram as diferenças visuais já documentadas entre r168 e r186, sem indicar regressão visível pela conversão automática. A comparação continua descritiva e não é nota de fidelidade arquitetônica.

```powershell
node --test experimentos/liv-ipanema-webgpu-2026-10-09/test_materials.mjs
python experimentos/liv-ipanema-webgpu-2026-10-09/gerar_amostra_pbr.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_materiais.py --asset experimentos/casa-vistalar-2026-10-08/casa-vistalar-web-draco.glb
```

O laboratório prepara a base de T07. Acabamentos finais do LIV, vegetação, iluminação dia/entardecer, migração dos interiores e qualificação em celulares físicos permanecem no plano. Nenhum acabamento da amostra foi atribuído automaticamente ao empreendimento.

Fontes: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html) e `StandardNodeLibrary` da versão instalada.
