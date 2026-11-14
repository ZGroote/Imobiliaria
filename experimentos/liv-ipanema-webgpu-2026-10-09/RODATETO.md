# LIV — encontros da moldura interna, 11/10/2026

A revisão trata a moldura do teto **dentro do apartamento de canto**. Os 30 volumes originais tinham 40 pares de sobreposições nas junções, incluindo encontros perpendiculares que o auditor anterior excluía. [corrigir_rodateto.py](corrigir_rodateto.py) aplica união exata aos volumes originais, conserva os dois degraus e entrega uma única superfície fechada, com normais planas. Os slots antigos continuam registrados, mas somente o slot 19 constrói uma moldura; os demais são excluídos do render e do bake. Paredes, vãos, móveis, luminárias, materiais e cadastro nominal permanecem idênticos.

O modelo independente de **Meio não possui rodateto**. Sua fonte, geometria e luz próprias são preservadas; não se importou a moldura de Canto. Planta 3D e Tour das duas tipologias são conferidos, incluindo o forro e as junções visíveis.

[geometria.json](evidencias/rodateto-geometria/geometria.json) confere todas as junções, 1.464 triângulos sem arestas abertas/degeneradas, zero faces coplanares sobrepostas e volume positivo. Quatro seções da malha exportada reproduzem a união dos footprints originais com diferença abaixo de 0,00002 m². Confere também a identidade dos 62 objetos fora da moldura, materiais e cadastro. O auditor antigo `audit-moldings.json` não sabe interpretar esta união como caixas; a prova de junções passa a ser este ensaio de superfície completa.

[autoria.json](evidencias/rodateto-autoria/autoria.json) registra seis imagens antes/depois de suíte, sala e banho, com mesmas câmeras, luz e PBR, inspecionadas antes de aprovar a geometria para o bake. A fonte original permanece nas entradas canônicas; a revisão e o bake são escritos apenas em `interiores/canto/`. O mapa de luz é próprio, 2048², 512 amostras Cycles, DIRECT/INDIRECT sem COLOR e OIDN RTLightmap sem albedo auxiliar. O material padrão de gesso conserva cor/roughness e a cena usa o mesmo transporte RGBM das demais superfícies.

[rodateto-visual/runtime.json](evidencias/rodateto-visual/runtime.json) registra a moldura no Tour real em WebGPU/WebGL2, com três câmeras próximas para inspeção. Essas câmeras de diagnóstico estão a 2,25 m; a altura normal do visitante continua 1,62 m. [interiores-rodateto/runtime.json](evidencias/interiores-rodateto/runtime.json) confere os modos, gestos, seis ambientes por tipologia, móveis, sessão e descarte em três perfis. [luz-rodateto/runtime.json](evidencias/luz-rodateto/runtime.json) confere a estabilidade da parede ao girar e o reaproveitamento de sombras durante caminhada. Toque é emulado; falta ensaio físico no Poco X6/iPhone.

O pacote mantém compartilhados e Meio byte a byte. A fila conserva a ordem Tour → mapa → Planta 2D e seus 139 arquivos, totalizando 33.017.890 bytes, com nova versão de conteúdo. Oito testes do empacotador conferem repetição, isolamento das tipologias e rejeição de fonte/receita/UV/atlas/aprovação incompatíveis antes de gravar.

## Reproduzir

Executar na raiz, com os inputs canônicos identificados e dependências locais. Usar novos destinos para relatórios de QA. Autoria, bake e QAs gráficos são sequenciais.

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' -b --factory-startup --python experimentos/liv-ipanema-webgpu-2026-10-09/corrigir_rodateto.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_rodateto.py
python v1.5/miniaturas/liv-ipanema/interior/preparar_luz.py --source experimentos/liv-ipanema-webgpu-2026-10-09/interiores/canto/source.json --out experimentos/liv-ipanema-webgpu-2026-10-09/interiores/canto/bake --size 2048 --padding 12
```

Importar com `interior/bake_luz.py --import-only --no-glb` e destino próprio para produzir `interior-source.blend`. [renderizar_quinas_teto.py](renderizar_quinas_teto.py) gera as imagens de revisão nesse Blend. Revisar a geometria e registrar `approval.json` para os hashes exatos da fonte/unidade antes de executar o bake completo. A aprovação anterior não vale para uma autoria diferente.

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' -b --factory-startup --python v1.5/miniaturas/liv-ipanema/interior/bake_luz.py -- --out experimentos/liv-ipanema-webgpu-2026-10-09/interiores/canto/bake --samples 512 --no-glb
python v1.5/miniaturas/liv-ipanema/interior/denoise_luz.py --out experimentos/liv-ipanema-webgpu-2026-10-09/interiores/canto/bake
python experimentos/liv-ipanema-webgpu-2026-10-09/gerar_pacote_interiores.py
python experimentos/liv-ipanema-webgpu-2026-10-09/gerar_manifesto_transferencias.py
python experimentos/liv-ipanema-webgpu-2026-10-09/test_pacote_interiores.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_rodateto_visual.py
```

A reconstrução continua ilustrativa. Nenhuma publicação foi alterada.
