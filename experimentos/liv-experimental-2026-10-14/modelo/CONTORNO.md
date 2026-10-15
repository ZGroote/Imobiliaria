# LIV Ipanema — contorno com recuos, 11/10/2026

A [comparação navegável](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/modelo/comparacao.html) alterna entre o volume original e uma variante que recorta lajes e fachadas conforme o contorno cinza ilustrado na implantação oficial. **De cima** aproxima a torre para inspecionar os rasgos das cabeceiras e das laterais, inclusive os dois degraus junto ao núcleo. Apenas uma cena fica ativa; cada troca encerra o renderer anterior.

O perímetro deixa de ser um retângulo. A autoria inclui 32 vértices, lajes fechadas, paredes nos planos recuados, retornos das quinas, vãos reancorados e parapetos seguindo o contorno. Três centros de janela recebem ajustes de 0,068 m, 0,405 m e −0,257 m para não atravessar quinas; são valores da reconstrução aproximada. Preserva 17 níveis, 18 lajes e as cinco prumadas de varanda por face. Os 69 grupos da implantação/térreo são exatamente iguais aos da autoria anterior.

## Fonte e limites

[contorno-torre.json](contorno-torre.json) identifica a imagem, seu SHA e a marcação manual, com incerteza de dois pixels. A escala continua sendo uma estimativa de 47,7 × 12,7 m. O registro por alas/núcleo conserva os eixos da base; não constitui levantamento métrico. Jardins, texto, passeio e sombra foram excluídos da máscara da torre.

A fonte confirma o contorno visto de cima. **Repetir esse contorno pelos pavimentos é uma hipótese visual**; ainda é preciso conferir a extensão dos rasgos pelas fachadas e pelas plantas. Fundos, profundidades e volumes técnicos da cobertura não estão cotados. Não há confirmação de correspondência entre esses recortes e uma tipologia comercial.

A comparação geométrica continua isolada: seu iframe não carrega cadastro nem aceita seleção por final. A [prévia integrada dos recuos](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=contorno) agora reúne o exterior corrigido, dez posições aproximadas e as plantas gerais **Canto e Meio**, com Planta 2D/3D e Tour. Usa um registro próprio recortado pela laje; não reaproveita os volumes retangulares antigos. Planta, espelhamento e área por final continuam sem vínculo confirmado. A portaria permanece simplificada. T06 e T07 não estão concluídas.

## Autoria, iluminação e transporte

[modelar_exterior.py](modelar_exterior.py) grava exclusivamente numa subpasta deste estudo. Reutiliza a implantação e as ferramentas de autoria existentes como entradas, sem alterar sua saída canônica. [contorno.py](contorno.py) valida o polígono ortogonal e triangula as tampas sem diagonais sobre outros vértices. O teste de malha detectou e eliminou triângulos degenerados que a primeira tesselação gerava nas cabeceiras.

A variante tem UV1 e irradiância próprios: atlas 4096², 64 amostras, difusa direta/indireta sem cor e OIDN RTLightmap. A revisão das quinas usa padding solicitado de seis pixels (4,09 pixels efetivos), margem de bake de dois pixels e guarda de saída de quatro pixels. Não reutiliza a irradiância da base. [proveniencia-luz-quinas.json](variante/proveniencia-luz-quinas.json) conserva os relatórios e hashes da revisão anterior das manchas; [proveniencia-luz.json](variante/proveniencia-luz.json) conserva o bake anterior.

[exportar_variante.py](exportar_variante.py) transporta 1.012 instâncias baked, com posições, normais e UV0/UV1 conferidos contra a autoria e o atlas da mesma edição. Reutiliza os materiais e texturas de superfície da base. Vidros, vegetação e esquadrias continuam com **MeshStandardMaterial padrão**; a calibração de pintura, vidros da implantação e letreiro conserva os valores da prévia. O material próprio RGBM continua limitado à irradiância baked.

Há 56 malhas efetivas: 41 baked e 15 grupos instanciados. Cena, atlas e duas texturas somam **16.044.894 bytes**, contra 21.757.657 bytes da primeira variante e 20.130.835 bytes desses mesmos recursos da base. A geometria preparada para bake passou de 271.909 para 101.521 triângulos. Essas diferenças não são medidas de tempo de abertura ou FPS. O ensaio físico no Poco X6 e o problema de desempenho da versão pública continuam pendentes.

## Correção das manchas nas quinas

As faixas pretas na parede bege e nos recuos cinza vinham da irradiância, não da textura de pintura: esses dois materiais não têm mapas de cor ou relevo. Substituir temporariamente o atlas por luz uniforme eliminou as manchas; elas já existiam no bake bruto. A inspeção da autoria encontrou superfícies coplanares sobrepostas nas junções de caixas, com mais de um valor de luz no mesmo ponto da parede.

[unir_paredes.py](unir_paredes.py) aplica a união exata do Blender antes de separar as faces por material. Os encontros côncavos recebem continuidade de volume, os retornos horizontais das cabeceiras passam a seguir todas as arestas do contorno e o pano interno termina dentro desses recortes. As paredes e a cobertura usam faces planas, sem os antigos biséis menores que um texel. Cores, materiais padrão, esquadrias, lajes e implantação continuam com suas atribuições; não houve correção artificial de claridade no shader ou pintura do atlas. O UV/bake foi regenerado para essa autoria.

[paredes.json](../evidencias/quinas-geometria/paredes.json) reproduz 871 pares de triângulos sobrepostos no pavimento anterior e nenhum no novo. As paredes e cobertura exportadas são fechadas e não têm triângulos de área zero; 34 posições de vãos continuam livres, os 32 trechos do perímetro têm parede e nenhum pano invade os rasgos. Na cobertura, o teste registra separadamente seis faixas com área total de 0,00000225 unidade², sem interior à tolerância de 10 micrômetros da posição exportada; não as confunde com superfícies duplicadas maiores que a precisão da autoria.

[luz.json](../evidencias/quinas-luz/luz.json) registra 102 amostras nas duas quinas frontais do núcleo: 32 quase pretas antes, nenhuma depois; todas têm uma única superfície na nova malha. Há capturas na mesma câmera, antes/depois, de frente, fundos, recuo cinza, duas cabeceiras e cobertura, em WebGPU e WebGL2. As sombras de janelas e varandas permanecem visíveis. A malha anterior, UV, irradiância bruta, OIDN e pacote anterior foram preservados localmente em `variante/luz/antes-quinas/`.

## Validação

[geometria.json](../evidencias/quinas-geometria/geometria.json) passou: 124 triângulos da laje, 186 arestas com incidência dois, volume positivo compatível e normais para fora. A projeção dos triângulos exportados coincide com a **anotação manual** em 99,8786%, contra 95,5285% da laje retangular; erro máximo de borda de 0,354 pixel. Essa métrica avalia a reprodução da ilustração, não a precisão de um projeto executivo.

[runtime.json](../evidencias/quinas-interface/runtime.json) passou em WebGPU, WebGL2 e toque emulado de 390 px. Confere transporte, materiais nativos, vista de cima/varandas, destaque de andar, alternância original/variante e descarte único de 114 recursos por troca. Um manifesto apontando para a geometria antiga foi rejeitado antes do download do atlas. Capturas acompanham o relatório local; bitmaps e binários são artefatos gerados, ignorados no Git. A prova anterior está em `evidencias/contorno-interface-final/`; seus hashes são históricos.

[A regressão da prévia completa](../evidencias/unidades-contorno-final/runtime.json) passou em três perfis e duas falhas de catálogo, mantendo seleção/sessão, Canto e Meio nos modos Planta 2D/3D e Tour. Os sete testes CPU de unidades/materiais também passaram. A abertura inicial da comparação é a vista de cima da torre.

## Integração do pavimento piloto, 11/10

[registrar_unidades.py](registrar_unidades.py) confere os triângulos superiores da laje exportada contra o contorno anotado, intersecta cada faixa do registro anterior com esse polígono e grava [unidades-contorno.json](unidades-contorno.json). Mantém os mesmos IDs, ordem da prancha, lados e campos comerciais nulos. O cadastro identifica a autoria corrigida `618c4f…`, a imagem e os arquivos usados. Linhas de área zero produzidas pelo recorte junto ao núcleo são excluídas, sem eliminar qualquer região com área.

O picking usa o primeiro encontro com um prisma fechado da torre, incluindo cobertura e planos recuados. Consulta os polígonos apenas no fim do clique/toque; continua sem atribuir o núcleo, corredor, outro pavimento ou bordas compartilhadas. O realce é uma extrusão da zona selecionada e preserva seus rasgos. Os dez realces compartilham dois buffers, com faixas de desenho, e dois materiais padrão sem iluminação/sombra adicionais. Geometria, materiais, UV1 e atlas da torre não são alterados pela seleção. Ver [UNIDADES.md](../UNIDADES.md).

A integração é ativada por `geometria=contorno`; o endereço sem esse parâmetro conserva a edição anterior. Sessões são separadas por edição. O mapa agora exibe o GLB conferido dessa autoria, e o retorno conserva a edição e o final selecionado. [MAPA-MODELO.md](../MAPA-MODELO.md) registra a conferência de geometria/materiais/instâncias, implantação e fila. Medir a abertura da nova edição precede sua adoção como padrão.

[unidades-recuos-integrado/runtime.json](../evidencias/unidades-recuos-integrado/runtime.json) registra lista/fachada/teclado, realce sem preencher os recuos, sessão, descarte, as duas tipologias nos três modos e retorno do mapa. Inclui cadastros ausente, de outra edição e com polígono retangular incompatível. [test_contorno_unidades.mjs](../test_contorno_unidades.mjs) confere também procedência, raios em recuos/cobertura e cobertura dos polígonos pelas tampas reais do realce. Essas provas continuam sendo desktop e toque emulado.

## Cobertura: quinas, vão e bordas finas — 11/10

A cobertura tinha cotas escolhidas por segmento: alguns parapetos começavam 12 cm acima dos vizinhos, deixando 8 cm de ar acima da laje. A faixa branca também ficava separada do apoio por 7,5 mm e suas extensões não acompanhavam a largura nas quinas côncavas. A autoria agora mantém o apoio/altura comuns e uma faixa contínua com avanços de 3,5 cm para fora e 28,5 cm para dentro do contorno. Os volumes técnicos mais altos mantêm sua configuração ilustrativa.

[qa_cobertura.py](qa_cobertura.py) extrai seções dos triângulos reais, sem consultar os parâmetros dos geradores. Confere todo o perímetro e as quinas contra anéis derivados do contorno: [cobertura.json](../evidencias/cobertura-geometria/cobertura.json) registra regiões faltantes antes e nenhuma após o reparo. A regressão [paredes.json](../evidencias/cobertura-geometria/paredes.json) mantém as malhas fechadas, os 34 vãos livres e ausência de faces coplanares sobrepostas.

A inspeção das imagens detectou outra causa de bordas pretas: faces de 6,5 cm tinham menos de um pixel de largura no UV de luz e não recebiam amostras. [preparar_luz_densa.py](preparar_luz_densa.py) reutiliza o algoritmo canônico com densidade linear quatro vezes maior somente nos cinco grupos da cobertura. Essa escala modifica apenas as entradas de xatlas; as posições/normais/índices/matrizes de entrega continuam idênticos. A resolução final continua 4096² e não há novo material ou passe de renderização.

[luz.json](../evidencias/cobertura-luz/luz.json) amostra as 260 faces verticais da faixa fina no atlas: 88 quase pretas antes, nenhuma após o ajuste. As 102 amostras das quinas do núcleo continuam sem ambiguidade/sombreamento preto. [cobertura-final/runtime.json](../evidencias/cobertura-final/runtime.json) registra três câmeras idênticas antes/depois em WebGPU/WebGL2. [cobertura-interface/runtime.json](../evidencias/cobertura-interface/runtime.json) confere transporte exato, vistas, seleção de andar e descarte. [unidades-cobertura/runtime.json](../evidencias/unidades-cobertura/runtime.json) qualifica o piloto com os hashes novos. As provas da integração anterior permanecem históricas.

[proveniencia-cobertura.json](variante/proveniencia-cobertura.json) identifica esta revisão. A autoria atual é `618c4f55…`; UV, atlas e registro do piloto foram conferidos para a mesma geometria. Backups locais `antes-cobertura/` e `antes-densidade/` conservam as versões que reproduzem as duas falhas. A revisão da moldura **interna** de Canto tem fonte/bake próprios, documentados em [RODATETO.md](../RODATETO.md); Meio continua independente.

## Reproduzir no ambiente local

Os scripts reutilizados e a imagem oficial são entradas locais identificadas por SHA. É necessário que estejam presentes, além de Blender, Python com NumPy/xatlas/SciPy/Pillow/Shapely/Playwright e OIDN. O QA de antes/depois também requer o pacote anterior preservado. Os comandos usam destinos isolados e devem executar **sequencialmente**, sobretudo exportação após o denoise e QAs gráficos sem concorrência.

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' -b --factory-startup --python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/modelar_exterior.py -- --no-render
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/qa_geometria.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/contorno-novo-geometria
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/qa_paredes.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/contorno-novo-geometria
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/preparar_luz_densa.py
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' -b --factory-startup --python v1.5/miniaturas/liv-ipanema/bake_luz.py -- --out experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/luz --samples 64
python v1.5/miniaturas/liv-ipanema/denoise_luz.py --out experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/luz --output-guard 4
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/exportar_variante.py
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/qa_luz_quinas.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/contorno-novo-luz
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/qa_runtime.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/contorno-novo
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_unidades.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/unidades-contorno-novo
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/registrar_unidades.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_unidades.py --geometria contorno --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/unidades-recuos-novo
```

Os relatórios desta revisão são históricos e não devem ser sobrescritos em novas execuções. A seleção aproximada e o GLB no mapa já acompanham a variante na integração opcional; custo e ensaio físico continuam pendentes antes de torná-la padrão. A versão pública não foi alterada.
