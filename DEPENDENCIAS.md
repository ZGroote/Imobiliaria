# Dependências, por ambiente

Três ambientes, e a separação **foi medida**, não suposta: em 18/09/2026 percorri os
`import` de todo `.py` do projeto e cruzei com o que está instalado neste interpretador.

| ambiente | instala com | pacotes |
|---|---|---|
| **Montar e verificar o mapa** | `pip install -r requirements.txt` | pyproj, shapely, numpy, pillow |
| **Processar fontes de dado** | `pip install -r requirements-fontes.txt` | + osmium, rasterio, affine, scipy, opencv-python, pypdfium2, rapidocr-onnxruntime |
| **Blender / Unreal** | não instala aqui — ver abaixo | bpy, mathutils |

## Por que essa divisão

Montar a página alcança 10 módulos do projeto e precisa de **dois** pacotes:
`pyproj` (em `padrao/cidade.py`, a conversão geo ↔ mapa) e `shapely`
(em `pipeline/encaixar_casas_lotes.py`, o encaixe das casas nos lotes). Os portões de
aceite acrescentam `numpy` e `pillow`, que são de medir quadro e recortar print.

Todo o resto é de **fonte de dado**: ler o `.osm.pbf` da Geofabrik, rasterizar planta em
PDF, achar parede na planta digitalizada, ler o selo de escala por OCR. Quem só monta e
confere São Carlos não precisa de nada disso — e essa é a diferença entre um `pip
install` de 4 pacotes e um de 11, com rasterio e onnxruntime no meio.

## Blender e Unreal não entram em nenhum requirements

`bpy` e `mathutils` **não existem neste interpretador** (conferido: ausentes; todos os
outros 11 estão instalados). Eles são o Python embutido do próprio Blender, e os scripts
que os importam — `exteriores/v1/`, parte de `modelos_urbanos/` e de
`modelos_cadastrados/` — rodam **de dentro do Blender**, não daqui:

```bash
blender -b arquivo.blend --python exteriores/v1/gerar.py
```

Duas armadilhas já registradas e que continuam valendo: `mode_set` **trava** em `-b`
(ver `[[blender-headless-armadilhas]]`), e há dois caminhos disputando a porta 9876
quando se usa a ponte com uma sessão aberta (ver `[[blender-ponte-sessao-aberta]]`).

## Comandos de verificação

Os quatro são reais e foram rodados; não são exemplo.

```bash
npm test                 # 122 testes Node (renderizador + política de Hosting)
npm run test:py          # 68 testes Python (build, caminhos canônicos, publicação)
npm run montar           # monta São Carlos na variante modular
npm run qa               # os 19 portões de aceite: geometria + comportamento (~23 min)
```

`npm test` respondia `Error: no test specified` — o placeholder do `npm init` sobreviveu
o projeto inteiro, enquanto os 111 testes existiam e só rodavam à mão.

**A variante é sempre explícita.** Sem `--variante`, tudo cai no padrão `v15`, que é o
renderizador antigo: montar produz a página errada e o QA mede a página errada, os dois
em silêncio. É por isso que os scripts do `package.json` a declaram.
