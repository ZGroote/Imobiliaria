# Dependências, por ambiente

Três ambientes, mais um só para regerar a luz do premium. A separação **foi medida**, não suposta: em 18/09/2026 percorri os
`import` de todo `.py` do projeto e cruzei com o que está instalado neste interpretador.

| ambiente | instala com | pacotes |
|---|---|---|
| **Montar e verificar o mapa; validar leitura de planta** | `pip install -r requirements.txt` | pyproj, shapely, numpy, pillow, jsonschema |
| **Processar fontes de dado** | `pip install -r requirements-fontes.txt` | + osmium, rasterio, affine, scipy, opencv-python, pypdfium2, rapidocr-onnxruntime |
| **Blender / Unreal** | não instala aqui — ver abaixo | bpy, mathutils |
| **Regerar a luz do premium** (unwrap) | `pip install -r requirements-bake.txt`, numa venv própria | numpy==2.4.6, xatlas==0.0.11: versões exatas, porque a prova de 27/09/2026 é byte a byte (Python 3.14.4) |

## Por que essa divisão

Montar a página alcança 10 módulos do projeto e precisa de **dois** pacotes:
`pyproj` (em `padrao/cidade.py`, a conversão geo ↔ mapa) e `shapely`
(em `pipeline/encaixar_casas_lotes.py`, o encaixe das casas nos lotes). Os portões de
aceite acrescentam `numpy` e `pillow`, que são de medir quadro e recortar print.
O contrato M1-0 acrescenta `jsonschema` para validar `leitura.json` sem Blender;
o validador isolado só precisa desse pacote e da biblioteca padrão Python.

Todo o resto é de **fonte de dado**: ler o `.osm.pbf` da Geofabrik, rasterizar planta em
PDF, achar parede na planta digitalizada, ler o selo de escala por OCR. Quem só monta e
confere São Carlos não precisa de nada disso — e essa é a diferença entre um `pip
install` do ambiente básico e um com rasterio e onnxruntime no meio.

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

Verificações do projeto:

```bash
npm test                 # Node: contratos, renderizador, API e política de Hosting
npm run test:py          # Python: validação, build, publicação e inventários
npm run montar           # monta São Carlos na variante modular
npm run qa               # os 19 portões de aceite: geometria + comportamento (~23 min)
```

O CI (`.github/workflows/ci.yml`) roda em todo PR para `main` e em todo push em `main`:
`npm test`, `npm run test:py`, TypeScript e build do painel (com a varredura do bundle) e
`test:painel` + `test:regras` no emulador. `montar` e `qa` ficam fora: pedem o dado da
cidade e um navegador, e levam dezenas de minutos.

Resultados recentes: [consolidação de 04/10](tasks/organizacao-2026-10-04.md).

### Emuladores do Firebase

`npm run test:painel` e `npm run test:regras` precisam de JDK 21 no `PATH` do processo.
Nesta máquina já existe Temurin 21 em `C:/Users/respawn/.jdks/jdk-21.0.12.1+1/`.
Use o caminho do JDK instalado na sua máquina; não é necessário alterar o PATH do sistema:

```powershell
$jdkBin = 'C:\Users\respawn\.jdks\jdk-21.0.12.1+1\bin'
$env:PATH = "$jdkBin;$env:PATH"
java -version
npm run test:painel
npm run test:regras
```

Os scripts de `experimentos/qualidade-progressiva-cedros/` são estudos opcionais.
`medir_rede.py` exige `brotli` e `playwright` e um Chromium instalado pelo Playwright;
esses pacotes não são necessários aos testes básicos ou à montagem do piloto.

**A variante vem de `--variante`.** Sem ela (e sem `MAPA_V`), tudo cai no padrão, que desde o
#46 é o `v16-moveis`. Até o #46 o padrão era o `v15`, o renderizador antigo, e montar e QA
sem a flag saíam errados em silêncio: é por isso que os scripts do `package.json` a declaram.
Desde o #49 o `v16-moveis` é a única variante, e `--variante v15` (ou `MAPA_V=v15`) reprova
como variante desconhecida.
