# LIV publicado — entrega SketchUp 2026

Referência solicitada: <https://conectaimoveis3d.com.br/maquetes/liv/>.
Os arquivos públicos foram baixados diretamente do domínio em 26/10/2026.
Esta entrega usa `liv-classico/modelo/entrada/candidato/assets/scene.json.gz`,
que é a geometria carregada pelo endereço publicado, e a planta de canto de 47,59 m².
Não usa o estudo gráfico de 25/10 como fonte.

## Abrir

`entrega/LIV_Ipanema_Conecta.skp`

O arquivo contém o condomínio completo e o apartamento decorado. As cenas 01–06
alternam entre a maquete, a implantação, a planta decorada, a vista superior,
a sala e a suíte. Os grupos usam etiquetas para controlar condomínio,
apartamento, teto e mobiliário. O corte a 1,15 m é ativo apenas nas plantas.
Os interiores preservam as medidas e posições do modelo publicado; estas
continuam sendo uma reconstrução ilustrativa, sem projeto executivo.

## Modelagem e materiais

- Geometria convertida em faces e componentes nativos editáveis, mantendo
  instâncias, escala em metros, UVs e cores da fonte.
- 862 instâncias na maquete externa e 63 componentes da planta publicada.
- Duas camas, um sofá e seis cadeiras da SketchUp Content Library substituem
  as peças equivalentes na apresentação. As peças anteriores ficam ocultas.
- Madeira clara, Carrara e lâmina de madeira vêm dos materiais `.skm`
  oficiais instalados com o SketchUp 2026. Os móveis preservam suas texturas,
  com tons de tecido ajustados à paleta da planta.
- Estilo com oclusão de contato, sombras externas, cenas e corte nativo.

### Fontes dos móveis

- [Bed — SketchUp Content Library](https://3dwarehouse.sketchup.com/model/c8b399e7-a06f-487c-a410-2dec1b152945/Bed)
- [Sofa — SketchUp Content Library](https://3dwarehouse.sketchup.com/model/75a44b38-8544-4731-81ba-521828700e05/Sofa)
- [Dining Chair — SketchUp Content Library](https://3dwarehouse.sketchup.com/model/795a344b-4a53-42d3-93e7-066daadea63b/Dining-Chair)

Os GLBs públicos indicados pelo próprio Warehouse foram convertidos em
componentes do SketchUp. A geometria é editável; os controles paramétricos
dos Live Components não são transferidos nessa conversão.

## Reprodução e conferência

`baixar_fontes.py` registra URLs, tamanhos e SHA-256 dos arquivos publicados.
`preparar_dados.py` valida índices e coordenadas e extrai texturas.
`baixar_asset.py` aceita somente os GLBs públicos do Warehouse.
`converter_warehouse.py` usa Blender em segundo plano somente para conversão.
`modelar_liv.rb`, `mobiliar_liv.rb` e `apresentar_liv.rb` criam os componentes,
os materiais e as cenas pela extensão MCP já instalada no SketchUp.

`LIVSketchUp.check` confere contagens e dimensões no aplicativo. Capturas reais
do SketchUp ficam em `evidencias/`. `fontes/`, `dados/`, `entrega/` e
`evidencias/` são artefatos locais ignorados pelo Git.
