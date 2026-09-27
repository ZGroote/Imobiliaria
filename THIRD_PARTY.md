# Terceiros no repositório

Inventário do código e da mídia de terceiros que estão no repositório ou entram nas páginas
geradas. Registrado em 26/09/2026. As fontes de **dados** (OSM, Overture, SigaSC e as outras) estão
em [tasks/higiene-repositorio/proveniencia.md](tasks/higiene-repositorio/proveniencia.md).

> **Este arquivo é inventário, não regularização.** Ele registra o que é de terceiros, de onde veio
> e sob que licença, mas **não declara que a distribuição está em conformidade**.
>
> O three.js e o earcut vão embutidos nas páginas publicadas (mapa, tour e maquete) sem aviso de
> licença. Levar o aviso junto com as páginas muda o gerador e a publicação, e com isso os
> manifests dos builds. Isso fica para uma mudança controlada, depois do congelamento de produção.

**O projeto em si** é proprietário, sem licença de uso concedida a terceiros. No `package.json`:
`"license": "UNLICENSED"` e `"private": true`.

## Código

### three.js r168

| | |
|---|---|
| Onde | `renderizador/lib/three.min.js` e `v1.5/renderizador-{v16-moveis,v17,v18}/lib/three.min.js`: 4 cópias do mesmo blob, `b6a311783f5b01f8aba64fd95346c7eb4709b541` (678.588 bytes) |
| Entra em | toda página do `pipeline/montar.py` (mapa e tour por imóvel), toda maquete de `v1.5/miniaturas/pagina_maquete.py` e o template `v1.5/miniaturas/padrao-atual/anterior/v2.html` (maquete do Cedros). Já está embutido em `v1.5/miniaturas/maquete*.html` |
| Versão | r168, provada pelo `REVISION "168"` dentro do próprio arquivo |
| Como foi feito | não é um arquivo publicado pelo three. É um bundle IIFE feito aqui a partir do pacote ESM, com `esbuild --format=iife --global-name=THREE` (`PIPELINE.md`, §4.4). **Não estão registrados** a versão exata do pacote npm nem o comando completo |
| Licença | MIT, a licença conhecida do projeto de origem (mrdoob/three.js) |
| Texto da licença | **ainda não copiado aqui.** A conferência deste inventário baixou só o pacote do earcut, e o texto com a linha de copyright entra junto com a mudança do gerador |

### earcut 2.2.4

| | |
|---|---|
| Onde | `renderizador/lib/earcut.min.js` e `v1.5/renderizador-{v16-moveis,v17,v18}/lib/earcut.min.js`: 4 cópias do mesmo blob, `79cf67e1001350a4da6d9e51c6421da06cd7b556` (7.131 bytes) |
| Entra em | páginas do `pipeline/montar.py` (mapa e tour). **As maquetes não o embutem:** `pagina_maquete.py` usa, de propósito, o recuo do próprio three |
| Versão | **2.2.4, provada por comparação.** O blob é idêntico byte a byte ao `package/dist/earcut.min.js` do pacote `earcut@2.2.4` do npm: sha256 `1444195270d4358ef8dd1a448074f555d7ac3c83c850f5648b611ea1d2090ff3` dos dois lados, conferido em 26/09/2026. Tarball: `https://registry.npmjs.org/earcut/-/earcut-2.2.4.tgz`, integrity `sha512-/pjZsA1b4RPHbeWZQn66SWS8nZZWLQQ23oE3Eam7aroEFGEvwKAsJfZ9ytiEMycfzXWpca4FA9QIOehf7PocBQ==` |
| Licença | ISC. Texto do `LICENSE` do mesmo pacote: |

```
ISC License

Copyright (c) 2016, Mapbox

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

### Dependências npm

As dependências do `package.json` e do `painel/package.json` (Firebase, gltf-transform, draco3dgltf,
Next.js e as outras) são instaladas pelo npm e **não estão no repositório**. Os lockfiles registram
a licença de quase todos os pacotes:

- o `painel/package-lock.json` tem o campo nos 182 pacotes;
- o `package-lock.json` da raiz tem o campo em 792 dos 795. Faltam em `fuzzy@0.1.3`,
  `valid-url@1.0.9` (os dois só de desenvolvimento) e `limiter@1.1.5`.

Este inventário não repete o que os lockfiles já registram.

## Mídia

### Texturas de fachada: ambientCG

| Arquivo | Material de origem |
|---|---|
| `texturas/reboco.webp` | `Plaster001` |
| `texturas/tijolo.webp` | `Bricks023` |
| `texturas/chao.webp` | `Ground037` |

- O mapeamento está em `pipeline/baixa_texturas.py:36`, que baixa as texturas de
  `https://ambientcg.com` e as converte para WebP de 512 px.
- **Licença:** CC0, documentada no mesmo arquivo. A CC0 não exige atribuição.
- Entram no mapa e no tour pelo bloco `__textura`.

### Feito aqui, sem terceiro conhecido

| O quê | Origem registrada |
|---|---|
| `moveis/moveis_lib.json` | gerado dentro do Blender por `moveis/export_moveis.py` |
| `arvores/arvores_lib.json` | gerado dentro do Blender por `arvores/export_arvores.py` |
| texturas de interior do renderizador | desenhadas em canvas na hora (`v1.5/renderizador-v16-moveis/materials/interior-textures.js`) |
| `v1.5/miniaturas/padrao-atual/piloto-v3/textures/*.png` | o `PADRAO-ATUAL.md` diz que madeira, tecido e reboco são procedurais. Não há origem externa registrada |
| `unreal/lightmaps/*.png` | assados aqui (`unreal/assar.py`) |

### De terceiros, fora do produto

**Retiradas do `HEAD` em 26/09/2026:** as 15 imagens de divulgação do Mirante 7, em
`experimentos/mirante-7-2026-09-22/`.

- `fotos/01–05.jpg`, do anúncio da Maria Aires;
- `fotos-iplano/01–09.jpg`, da iPlano;
- `contato.jpg`, a folha de contato das cinco primeiras.

Saíram porque não havia autorização documentada.

**Retirado em 27/09/2026:** o resto do material de terceiro da pasta, que não era imagem.

- os registros do anúncio da Maria Aires e da iPlano, e o do extrator, que guardava a URL do anúncio;
- as coletas e os coletores;
- a planta e o modelo interpretados do folheto;
- a página montada.

Na pasta ficam o `ESTUDO.md` e três registros nossos de medição (tempos e resultado), sem conteúdo
de terceiro. O `ESTUDO.md` foi reduzido ao método em nível alto, tempos, verificações, limitações
e o registro das duas retiradas. O histórico do git não foi reescrito. O inventário está em
[tasks/higiene-repositorio/dados-privados.md](tasks/higiene-repositorio/dados-privados.md).

**Imagem nova só entra classificada.** `tests/test_dados_privados.py` reprova qualquer imagem
versionada fora da lista dele ou de uma pasta já classificada.
