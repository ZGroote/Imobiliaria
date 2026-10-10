# LIV Ipanema — correção futura do perímetro da torre

Data da inspeção: 10 de outubro de 2026. Esta nota prepara a próxima etapa de
modelagem. Nenhuma geometria foi alterada, nenhuma execução Blender foi feita e
nenhuma nova validação visual foi aprovada. **T06 continua pendente.** O ajuste
de material pintado das esquadrias e o enquadramento das varandas são um
incremento separado; não corrigem o perímetro descrito aqui.

## Evidência e limite da conclusão

A [implantação oficial](../../../v1.5/miniaturas/liv-ipanema/referencias/implantacao.jpg)
mostra a torre de cima com reentrâncias laterais e pequenos recortes nas
cabeceiras. O perímetro desenhado não é um retângulo contínuo. Essa observação é
compatível com o registro anterior em
[source_analysis.json](../../../v1.5/miniaturas/liv-ipanema/referencias/source_analysis.json),
que descreve `stepped/notched roof footprint` e vários níveis de cobertura.
A [perspectiva aérea oficial](../../../v1.5/miniaturas/liv-ipanema/referencias/aerea.jpg)
é uma segunda referência para a silhueta superior; sua perspectiva não permite
medir recortes diretamente em metros.

Essas imagens são renders comerciais da
[galeria da Livon](https://www.livonincorporadora.com.br/produtos/liv-ipanema/).
A matriz de fontes e limites está em [referencias.json](../referencias.json),
incluindo o [book oficial](https://www.livonincorporadora.com.br/wp-content/uploads/2024/08/BOOK_LIV_Ipanema.pdf).
Elas sustentam investigar e reproduzir o contorno visível da cobertura. Ainda
não provam a mesma seção em cada laje residencial, a profundidade dos recortes,
o contorno de todos os gardens, nem a correspondência entre recorte e apartamento.
Não transformar o desenho de cobertura em planta executiva de pavimento.

Identidades dos arquivos locais examinados:

| Fonte | SHA-256 |
| --- | --- |
| `referencias/implantacao.jpg` | `3217ae957969aed1ce9a177d914f038faff2fdee6fd6b10ec67063615a113677` |
| `referencias/aerea.jpg` | `6257d22fbb288b479f233c98ce6a549bf221c6d959be814ff79a6466d344ad1e` |
| `referencias/fachada.jpg` | `623ab176a612422e618d2a9d6fc0a139256091bac2f2ffb53f12c057af33bd88` |
| `referencias/source_analysis.json` | `4689fae8d688261f74308039410a7329ed3d41c748003ca56becacac3813b139` |
| `modelo.json` da autoria atual | `89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919` |

O registro atual
[registration_report.json](../../../v1.5/miniaturas/liv-ipanema/registration_report.json)
usa `x=(432-v)*0.145` e profundidade arquitetônica `y=(u-315)*0.145`, com
`u/v` em pixels da implantação. Esse fator e as dimensões 47,7 × 12,7 m são
inferidos. O bbox `[266,260,364,604]` do relatório é um guia de enquadramento,
não uma sequência de vértices do perímetro. A futura marcação deve registrar os
vértices sobre a imagem fonte, separar cobertura/piso/projeção e indicar a
incerteza; não extrair um contorno simplesmente do bbox.

## Onde o retângulo está definido

O arquivo de autoria é
[modelar_liv_ipanema.py](../../../v1.5/miniaturas/liv-ipanema/modelar_liv_ipanema.py).
As linhas abaixo referem-se à versão inspecionada, SHA-256
`be0dff9bb4d52fb4ac25346a3658c9f5fd6fd2cff6585e7b3422075590f822cc`.

| Trecho | Comportamento atual | Trabalho necessário para o contorno corrigido |
| --- | --- | --- |
| Linhas 19–24: `N, LV, W, D`, `BALCONIES`, `WINDOWS`, `CORE_X` | Define lâmina 47,7 × 12,7 m e posições proporcionais de vãos/varandas. | Manter parâmetros identificados como inferidos. Registrar os recortes em uma fonte de contorno distinta das posições de janelas. |
| `wall_with_holes(sign)`, linhas 55–83 | Segmenta vãos por X, porém quase todos os panos usam profundidade fixa `sign*(D/2-.12)`; o núcleo bege e os fundos das varandas têm offsets próprios. | Construir panos e retornos sobre segmentos do contorno aprovado, classificando fachada, reentrância e cabeceira. Compatibilizar cada abertura com seu segmento, preservando normais exteriores. |
| Linhas 85–98: duas faces, cabeceiras e `flush('panos', True)` | Repete o mesmo ritmo nas duas faces longas; cabeceiras usam X fixo `±(W/2-.12)`. | Revisar cada face com sua referência. Não impor simetria onde a face oposta é inferida. Atualizar cabeceiras/retornos quando o contorno mudar. |
| Linhas 100–102: `box('laje',0,.085,0,W,.17,D)` e `copies(..., range(N+1), 'lajes')` | Dezoito lajes retangulares contínuas. | Substituir por extrusão de polígono triangulado e fechado, após decidir quais níveis têm contorno comprovado. Não cortar todas as dezoito lajes a partir da imagem da cobertura sem outra evidência. |
| `window(...)` e linhas 122–145 | Posiciona vidro, esquadrias, guarda-corpos e forros segundo as profundidades globais. | Reancorar os elementos em cada pano/recuo. Conferir jambas, peitoris e guarda-corpos, evitando que flutuem ou atravessem o novo contorno. |
| Linhas 155–171: cobertura e parapetos | Superfície superior retangular `W-.43` × `D-.43`; parapetos nas bordas globais, com dois trechos de altura e volumes técnicos adicionais. | Fazer a superfície acompanhar o contorno visível e gerar parapetos por segmento, incluindo retornos. Revalidar níveis e volumes técnicos com as vistas oficiais. |
| Linha 159: divisão dos parapetos em `-CORE_X+1.5` | O corte longitudinal usa o sinal oposto ao centro do núcleo. | Conferir sua intenção contra o desenho registrado. A expressão isolada não é prova de erro e não autoriza trocar o sinal sem comparação. |
| Linhas 163–166: extensão do núcleo | Altura maior comprovada na face publicada; a outra extensão é inferida. | Preservar essa distinção de confiança enquanto se confere o recorte e a silhueta superior. |
| Linhas 173–177: substrato e acessos | Base retangular `W+.30` × `D+.30`, vidro e marquise referenciados ao núcleo/profundidade global. | Conferir a base separadamente da cobertura. Ajustar somente onde acesso/contorno térreo tiverem fonte suficiente. |

A convenção é arquitetônico `(X,Y,Z)` → Blender `(X,-Y,Z)` → Three.js
`(X,Z,Y)`. Assim, `+X` vai para a extremidade do bosque e `-X` para a extremidade
da portaria no registro atual. Um polígono copiado com winding da imagem sem
considerar as transformações pode produzir normais invertidas.

[modelar_implantacao.py](../../../v1.5/miniaturas/liv-ipanema/modelar_implantacao.py)
controla o **terreno**, estacionamentos, lazer e vegetação. `POLYGON_PX` é o
perímetro do lote, não o da torre. `polygon()` usa `from_pydata` com um n-gon;
não reutilizar esse helper sem uma política de triangulação para uma laje
côncava e com eventuais furos. `pxbox('site-piso',315,432,112,361,...)` define o
passeio ao redor da torre: depois de corrigir o edifício, conferir a interface
com esse passeio e os acessos sem redesenhar o lote por conveniência.

## Contratos que a próxima autoria deve preservar

`blender_maquete_base.exportar()` avalia a malha Blender, exporta posições,
normais por canto, UV0 e índices, agrupa instâncias por geometria/torre e grava
GLB/modelo JSON. Seu gate atual exige **um grupo `paredes` por torre** com pisos
0–16 e **um grupo `lajes`** com níveis 0–17. Novos segmentos de parede devem
continuar unidos no grupo semanticamente correto ou exigir uma atualização
explícita do gate; fragmentar a torre em vários grupos `paredes` quebraria o
exportador. Dezoito lajes não significam dezoito pavimentos residenciais.

Além disso, preservar o destaque de andar, `tower`, `floor`, `role`, a câmera
livre, as cinco vistas e os quatro modos. A ordem de finais da implantação
permanece uma evidência distinta do contorno decorativo; nenhuma nova posição
ou dimensão comercial de unidade pode ser derivada automaticamente da malha.

Os materiais efetivos extraídos têm nomes vazios. A ligação robusta com a
autoria usa `livFloorRanges[*].groupIndex`/`livGroupIndices` e
`modelo.groups[groupIndex].material`; índices de material isolados não são uma
API estável entre duas gerações de geometria. Uma mudança de perímetro também
pode alterar ranges, ordens de grupos, máscaras de andar e câmeras de enquadramento.

## Por que o atlas atual não serve para o perímetro novo

A autoria atual possui 87 geometrias/grupos, 51 materiais e 1.825 instâncias.
`preparar_luz.py` mapeou 1.011 instâncias em 72 grupos, com UV1 independente;
o bake utiliza **todas as malhas como oclusores**, inclusive vidro e vegetação
que ficam dinâmicos no runtime. A cena efetiva da base une alvos por material e
torre: 56 meshes, sendo 15 InstancedMesh dinâmicas e 41 meshes de bake.

O mapa atual pertence ao SHA de modelo registrado acima. Seu UV compacto tem
SHA `78ffae95cfd20becceb8c636bce27ab56bba328f347269a86ef1a73b94c0c92e` e o
RGBM descomprimido tem SHA
`3e4e1763f0597ab11f9de615a764e4755e964e827bbe330197d5e6f402edcbfa`.
Alterar panos/lajes/parapetos muda índices, UVs e oclusão. Mesmo que uma parte
mantenha sua própria malha, os recortes podem modificar sombras e ricochetes
nela. Portanto a variante precisa de snapshot, unwrap e bake próprios da cena
completa. Trocar somente a geometria no `scene.json.gz`, reutilizar os bytes
RGBM antigos ou editar hashes para contornar a verificação não produz uma
variante válida.

## Execução futura em pasta isolada

**Os comandos desta seção são documentação; não foram executados.** Todos os
outputs da variante devem ficar em `EXP/modelo/variante`, preservando
`site-baseline`, `assets-prova` e a autoria canônica. Não rodar o modelador
canônico para esse ensaio: ele fixa `OUT=Path(__file__).parent` e sobrescreve
`modelo.json`, GLB e Blend em sua própria pasta.

### Entrada de autoria e contorno — propostos, ainda inexistentes

Criar uma entrada própria `EXP/modelo/modelar_exterior.py` com `--saida` e um
registro `EXP/modelo/contorno-torre.json`, contendo imagem/SHA, pontos em pixels,
transformação, segmentos, nível observado e confiança. Isso evita copiar toda
a autoria canônica sem controle. A implementação poderá importar helpers
estáveis do projeto e produzir um `modelo.json` no mesmo contrato, com suas
fontes/hashes documentados. A interface abaixo é **proposta**:

```powershell
$livWorkspace = 'C:\Users\respawn\Desktop\imobiliaria'
$livVariante = Join-Path $livWorkspace 'experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante'
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python (Join-Path $livWorkspace 'experimentos/liv-ipanema-webgpu-2026-10-09/modelo/modelar_exterior.py') -- --saida $livVariante --contorno (Join-Path $livWorkspace 'experimentos/liv-ipanema-webgpu-2026-10-09/modelo/contorno-torre.json') --no-render
```

Antes do bake definitivo, produzir comparação de topo alinhada à implantação
e vistas em perspectiva com câmera registrada. Avaliar somente a região/contorno
comparável; árvores, textos de finais, iluminação e fundo não são métricas de
fidelidade da torre. Aprovar os recortes observados e registrar as partes ainda
inferidas, sem inventar cotas executivas.

### Unwrap, bake e denoise — interfaces existentes

Os helpers abaixo já aceitam caminhos isolados. Dependem de um modelo da
variante previamente gerado e conferido. `numpy`, `xatlas`, `scipy`, Blender e
OIDN foram localizados nesta máquina; isso não é uma execução nem uma
qualificação da variante.

```powershell
$livWorkspace = 'C:\Users\respawn\Desktop\imobiliaria'
$livVariante = Join-Path $livWorkspace 'experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante'
$livLuzVariante = Join-Path $livVariante 'luz'
python (Join-Path $livWorkspace 'v1.5/miniaturas/liv-ipanema/preparar_luz.py') --model (Join-Path $livVariante 'modelo.json') --out $livLuzVariante --size 4096
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --python (Join-Path $livWorkspace 'v1.5/miniaturas/liv-ipanema/bake_luz.py') -- --out $livLuzVariante --samples 64
python (Join-Path $livWorkspace 'v1.5/miniaturas/liv-ipanema/denoise_luz.py') --out $livLuzVariante --output-guard 4
```

Manter a verificação que recusa `modelo.json` alterado após o unwrap. Não usar
`--allow-source-snapshot` na entrega. A resolução/amostras acima reproduzem o
contrato atual; seu custo e qualidade devem ser medidos para a variante.
`reparar_luz_exterior.py` fixa `OUTPUT=HERE/'luz'` e usa planos exteriores do
modelo atual: não o executar na autoria canônica nem presumir que sua heurística
de microfaces ainda vale para paredes recuadas. A futura variante deve primeiro
inspecionar o denoise e só adicionar um reparo explicitamente compatível com
seus planos, fonte e hashes.

### Transporte WebGPU — adaptação proposta, ainda inexistente

O `exportar_cena.py` atual extrai a base fixa com SHA de HTML conhecido e lê o
atlas canônico. Seus flags `--base-url` e `--saida` **não** autorizam nova fonte
nem novo atlas. Criar um exportador da variante, ou generalizar esse contrato
com fonte/modelo/atlas esperados explícitos, mantendo a verificação da resposta
HTTP, snapshot, UVs e textura. Não substituir silenciosamente o contrato da base.
Interface sugerida, **não executável até sua implementação**:

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/modelo/exportar_variante.py --modelo experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/modelo.json --luz experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/luz --saida experimentos/liv-ipanema-webgpu-2026-10-09/modelo/variante/assets
```

O exportador deverá gerar a cena efetiva no esquema consumido pelo renderer,
com UV1, meshes/ranges de andar, materiais, câmeras, manifesto e SHA novos.
Depois implementar seleção explícita dessa variante para revisão, preservando
o retorno à base. Qualificar WebGPU e WebGL2 com destaque de andar, troca de
modos, câmera livre, PNG, descarte e fila de transferências. Comparar tempo de
abertura, bytes e uso de recursos: a regressão de abertura já registrada no
projeto não está resolvida por este trabalho geométrico.

## Critério de conclusão da futura T06

1. Contorno observado marcado sobre a fonte, com limites de confiança e câmera
   de comparação identificados.
2. Lajes/cobertura/parapetos/retornos coerentes entre si; sem malhas abertas,
   triângulos degenerados, normais invertidas ou superfícies sobrepostas.
3. Um edifício, 17 níveis residenciais e os elementos confirmados preservados;
   nenhuma tipologia, medida ou disponibilidade comercial presumida.
4. Snapshot, UVs, irradiância e cena transportada correspondentes à mesma
   variante, verificados por hash, sem reutilização do bake da base.
5. Comparações visuais relevantes e QA dos dois backends concluídos, com custos
   e diferenças documentados. Esta nota, sozinha, não satisfaz esses critérios.
