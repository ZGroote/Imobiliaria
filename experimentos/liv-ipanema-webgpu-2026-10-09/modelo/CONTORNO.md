# LIV Ipanema — contorno com recuos, 11/10/2026

A [comparação navegável](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/modelo/comparacao.html) alterna entre o volume original e uma variante que recorta lajes e fachadas conforme o contorno cinza ilustrado na implantação oficial. **De cima** aproxima a torre para inspecionar os rasgos das cabeceiras e das laterais, inclusive os dois degraus junto ao núcleo. Apenas uma cena fica ativa; cada troca encerra o renderer anterior.

O perímetro deixa de ser um retângulo. A autoria inclui 32 vértices, lajes fechadas, paredes nos planos recuados, retornos das quinas, vãos reancorados e parapetos seguindo o contorno. Três centros de janela recebem ajustes de 0,068 m, 0,405 m e −0,257 m para não atravessar quinas; são valores da reconstrução aproximada. Preserva 17 níveis, 18 lajes e as cinco prumadas de varanda por face. Os 69 grupos da implantação/térreo são exatamente iguais aos da autoria anterior.

## Fonte e limites

[contorno-torre.json](contorno-torre.json) identifica a imagem, seu SHA e a marcação manual, com incerteza de dois pixels. A escala continua sendo uma estimativa de 47,7 × 12,7 m. O registro por alas/núcleo conserva os eixos da base; não constitui levantamento métrico. Jardins, texto, passeio e sombra foram excluídos da máscara da torre.

A fonte confirma o contorno visto de cima. **Repetir esse contorno pelos pavimentos é uma hipótese visual**; ainda é preciso conferir a extensão dos rasgos pelas fachadas e pelas plantas. Fundos, profundidades e volumes técnicos da cobertura não estão cotados. Não há confirmação de correspondência entre esses recortes e uma tipologia comercial.

A variante está separada da prévia completa: não carrega `unidades.json` nem aceita seleção por final. Essa proteção evita apresentar as zonas antigas como verificadas sobre a malha nova. As plantas gerais **Canto e Meio**, seus bakes, Planta 3D e Tour continuam na [prévia completa](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html). A portaria permanece simplificada. T06 e T07 não estão concluídas.

## Autoria, iluminação e transporte

[modelar_exterior.py](modelar_exterior.py) grava exclusivamente numa subpasta deste estudo. Reutiliza a implantação e as ferramentas de autoria existentes como entradas, sem alterar sua saída canônica. [contorno.py](contorno.py) valida o polígono ortogonal e triangula as tampas sem diagonais sobre outros vértices. O teste de malha detectou e eliminou triângulos degenerados que a primeira tesselação gerava nas cabeceiras.

A variante tem UV1 e irradiância próprios: atlas 4096², 64 amostras, difusa direta/indireta sem cor, OIDN RTLightmap e margem de quatro pixels. Não reutiliza a irradiância da base. [proveniencia-luz.json](variante/proveniencia-luz.json) conserva os relatórios e hashes dos scripts de UV/bake/denoise utilizados.

[exportar_variante.py](exportar_variante.py) transporta 1.012 instâncias baked, com posições, normais e UV0/UV1 conferidos contra a autoria e o atlas da mesma edição. Reutiliza os materiais e texturas de superfície da base. Vidros, vegetação e esquadrias continuam com **MeshStandardMaterial padrão**; a calibração de pintura, vidros da implantação e letreiro conserva os valores da prévia. O material próprio RGBM continua limitado à irradiância baked.

Há 56 malhas efetivas: 41 baked e 15 grupos instanciados. Cena, atlas e duas texturas somam **21.757.657 bytes**, contra 20.130.835 bytes desses mesmos recursos da base. A diferença vem da nova geometria/atlas; não é medida de tempo de abertura ou FPS. O ensaio físico no Poco X6 e o problema de desempenho da versão pública continuam pendentes.

## Validação

[geometria.json](../evidencias/contorno-estudo/geometria.json) passou: 124 triângulos da laje, 186 arestas com incidência dois, volume positivo compatível e normais para fora. A projeção dos triângulos exportados coincide com a **anotação manual** em 99,8786%, contra 95,5285% da laje retangular; erro máximo de borda de 0,354 pixel. Essa métrica avalia a reprodução da ilustração, não a precisão de um projeto executivo.

[runtime.json](../evidencias/contorno-interface-final/runtime.json) passou em WebGPU, WebGL2 e toque emulado de 390 px. Confere transporte, materiais nativos, vista de cima/varandas, destaque de andar, alternância original/variante e descarte único de 114 recursos por troca. Um manifesto apontando para a geometria antiga foi rejeitado antes do download do atlas. Capturas acompanham o relatório local; bitmaps e binários são artefatos gerados, ignorados no Git.

[A regressão da prévia completa](../evidencias/unidades-contorno-final/runtime.json) passou em três perfis e duas falhas de catálogo, mantendo seleção/sessão, Canto e Meio nos modos Planta 2D/3D e Tour. Os sete testes CPU de unidades/materiais também passaram. A abertura inicial da comparação é a vista de cima da torre.

## Reproduzir no ambiente local

Os scripts reutilizados e a imagem oficial são entradas locais identificadas por SHA. É necessário que estejam presentes, além de Blender, Python com NumPy/xatlas/SciPy/Pillow/Playwright e OIDN. Os comandos usam destinos isolados e devem executar **sequencialmente**, sobretudo exportação após o denoise e QAs gráficos sem concorrência.

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' -b --factory-startup --python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/modelar_exterior.py -- --no-render
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/qa_geometria.py
python v1.5/miniaturas/liv-ipanema/preparar_luz.py --model experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/modelo.json --out experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/luz --size 4096 --padding 4
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' -b --factory-startup --python v1.5/miniaturas/liv-ipanema/bake_luz.py -- --out experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/luz --samples 64
python v1.5/miniaturas/liv-ipanema/denoise_luz.py --out experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/luz --output-guard 4
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/exportar_variante.py
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/qa_runtime.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/contorno-novo
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_unidades.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/unidades-contorno-novo
```

Os relatórios desta revisão são históricos e não devem ser sobrescritos em novas execuções. A próxima integração precisa de cadastro/seleção compatíveis com a variante, GLB no mapa conferido e avaliação do custo antes de torná-la padrão. A versão pública não foi alterada.
