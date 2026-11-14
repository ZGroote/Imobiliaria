# Cedros PBR — 04/10/2026

O Cedros **LEVE** (`v1.5/miniaturas/publicado/`, SHA-256 `ebd8b117…`) com os acabamentos do
[guia de acabamentos PBR](../../relatorios/padrao-acabamentos-pbr/guia-acabamentos-pbr.pdf),
derivado sem tocar no gerador, e com a paleta rebalanceada: o conjunto do piloto era todo
marrom/bege. Não publicado.

## Paleta

| Papel | Material (Poly Haven, CC0) | Repetição | Bytes (3 mapas) |
|---|---|---|---:|
| `parede` | Patterned Clay Plaster — Amal Kumar (a do guia, com a argila neutralizada) | 2,0 m | 508.856 |
| `madeira` (piso) | Laminate Floor 02 — Dario Barresi, Charlotte Baglioni | 1,7 m | 420.720 |
| `frio` (banho, serviço) | Granite Tile — Charlotte Baglioni | 2,3 m | 486.266 |
| `madeira_movel` | Black Oak Veneer — Jenelle van Heerden | 1,0 m | 344.028 |
| `tecido` | Ribbed Corduroy — colormass, Rico Cilliers (só trama; a cor é a de cada peça) | 0,27 m | 822.118 |

Total 2.581.988 bytes (teto do guia: 3.000.000). Fontes, MD5, SHA-256 e resultados fixados em
[assets.json](assets.json); preparo pelo `preparar_assets.py` do piloto, sem alteração.

Só a madeira fica quente: parede em reboco de escamas branco-gelo, piso de carvalho
acinzentado, grafite nas áreas molhadas e marcenaria em carvalho defumado. Os tecidos ficam
com a cor do cadastro de cada peça: sofá azul-marinho, roupa de cama branca, edredom marrom e
cortina `#C9BFAE` (a cor do catálogo).

Gerações reprovadas, todas em `publicacao/piloto-qualidade-visual-2026-10-04/`:
- `cedros-v1`: a Natural Walnut Veneer do guia lia como pedra no rack, no ripado e nos armários.
- `cedros-v2`: a White Stucco tinha relevo, mas na distância de navegação a parede parecia
  pintura lisa.
- `cedros-v3`: tudo que era tecido ficou sálvia. A extensão do guia tem um tecido só para a casa
  inteira, e o albedo dele substitui a cor de cada peça. Na v4, `keepTint` usa o cotelê só como
  trama: o `gain` `[3,77; 3,39; 4,61]` (1 ÷ média linear por canal) deixa a textura com média 1,
  e a cor por vértice do cadastro volta a mandar.
- `teste-parede/`: três paredes na mesma câmera. O cimento queimado (Plaster Grey 04) ficou
  manchado e azulado; o reboco pintado (Painted Plaster Wall) quase não aparecia; as escamas
  do guia foram as únicas que se leem como textura sem chegar perto.

A parede usa o mesmo reboco do piloto. O que o tornava bege era o albedo de argila, média
linear (0,375; 0,285; 0,212). O `gain` por canal `[1,73; 2,28; 2,92]` leva cada canal a 0,65
e mantém o relevo e as marcas da desempenadeira. O azul leva 5% a menos porque o céu da cena
soma azul.

**O bege não vinha só das texturas.** Paredes e pisos do Cedros carregam na cor por vértice o
tint do cadastro (`#D0C9BE`, `#BBB3A7`, `#9A7B57`) saturado ×1,45 pelo `rgbAcabamento`, e o
material multiplica textura × tint. Com o reboco de argila do piloto isso dobrava o bege. A
calibração `neutralizeTint` divide pelo tint médio (lido do `geoPlanta`, que é anterior ao
bake) e mantém só a variação do bake; `gain` passa a ser o multiplicador do albedo real.
Medido nas fotos: a parede do PBR tem o brilho da do LEVE (168 × 170) e saturação 1–7,
contra 29–36 do PREMIUM.

## Mudanças no `visual.js` do piloto

1. `calibration` opcional por material (`gain` como número ou `[r,g,b]`, `normalScale`,
   `roughness`, `neutralizeTint`). Sem ela, vale a calibração do piloto; os 22 testes antigos passam.
2. A maquete do Cedros troca material e geometria da casa a cada quadro (`luzDaPlanta`) e
   guarda a verdade em `userData.materialVisita/geoVisita/geoPlanta`. A extensão lê a fonte
   dali e escreve de volta ao alternar, senão a Planta 3D desfazia o acabamento.
3. `keepTint` nos móveis: a textura entra como trama e relevo, e a cor é a da peça. O sofá
   refeito, que não tem cor por vértice, recebe a cor do cadastro no material.

Dois testes novos em `tests/test_piloto_visual_runtime.mjs` (24/24).

## Reproduzir

```powershell
$p = 'experimentos/piloto-qualidade-visual-2026-10-04/preparar_assets.py'
$f = 'experimentos/cedros-pbr-2026-10-04/assets.json'
$g = 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v5'   # pasta nova
python $p --fontes $f --destino "$g/assets"
python $p --fontes $f --verificar "$g/assets"
node experimentos/cedros-pbr-2026-10-04/montar.mjs --assets "$g/assets" --destino "$g/site"
node experimentos/cedros-pbr-2026-10-04/montar.mjs --assets "$g/assets" --destino "$g/site-luz" --luz
python experimentos/cedros-pbr-2026-10-04/fotos.py
python experimentos/qualidade-progressiva-cedros/medir_rede.py --rodadas 3 --variantes leve,premium,pbr --saida "$g/medicao/medicao-rede.json"
```

O site atual é `cedros-v4/site/` (assets da `cedros-v3`, que não mudaram) e `cedros-v4/site-luz/`
com a luz de teto. `fotos.py` e `medir_rede.py` leem `cedros-v4/site/` por padrão.
`fotos.py --variante nome=caminho` e `medir_rede.py --site nome=pasta` acrescentam outros sites
na mesma câmera e na mesma rodada intercalada.

## Desempenho

**Resumo.** O PBR abre no mesmo tempo que o LEVE. O interior fica pronto 0,3–0,7 s depois
do LEVE no desktop e no 4G, contra 6–17 s do PREMIUM. O PBR baixa 3,0 MB, um quinto dos
15,4 MB do PREMIUM, e usa 61 MiB de textura na GPU (LEVE 21, PREMIUM 104). O custo dele é
decodificar e enviar os 15 mapas à GPU na thread principal: 0,2 s no desktop e 1,2 s com a
CPU 4× mais lenta. No perfil de celular, as texturas chegam 12,8 s depois da entrada na
visita. Até lá, o interior aparece com os materiais do LEVE.

Medido com `medir_rede.py --rodadas 3 --variantes leve,premium,pbr`: Chrome headless com a
GPU desta máquina (GTX 1650), 1280×720, cache desligado, mesmos bytes brotli do Hosting,
variantes intercaladas e mediana de 3 rodadas. Dados crus em
`publicacao/piloto-qualidade-visual-2026-10-04/cedros-v2/medicao/medicao-rede.json`.

A matriz completa foi medida na `cedros-v2`. A v3 só troca os três mapas da parede, com a
mesma resolução e 68 KB a mais. Uma rodada de conferência (`cedros-v3/medicao/conferencia.json`)
deu a mesma textura na GPU (60,9 MiB), 3,05 MB de rede, cerca de 200 ms nas chamadas de textura
e 1º quadro igual ao do LEVE.

### Tempo, em segundos

| perfil | 1º quadro LEVE | PREMIUM | PBR | interior pronto LEVE | PREMIUM | PBR |
|---|---:|---:|---:|---:|---:|---:|
| sem limite | 1,59 | 1,64 | 1,49 | 2,69 | 5,97 | 3,36 |
| 4G bom (20 Mbps, +70 ms) | 1,80 | 1,75 | 1,82 | 3,04 | 8,08 | 3,33 |
| 4G fraco (5 Mbps, +150 ms) | 1,91 | 2,13 | 2,02 | 2,67 | 16,90 | 3,14 |
| celular Lighthouse (1,5 Mbps, +562 ms, CPU 4×) | 6,75 | 7,80 | 7,32 | 6,26 | 47,74 | 12,78 |

O 1º quadro conta a partir da navegação. "Interior pronto" conta a partir do clique em Visita 3D.
No LEVE, ele marca o fim do bake por vértice; no PREMIUM, o atlas aplicado; no PBR, o bake e os
acabamentos instalados. Nas três variantes, o primeiro quadro do interior sai em 0,1–0,2 s (0,7–1,1 s no celular).
Os 15 mapas terminam de chegar em 2,3 / 3,6 / 7,1 / 23,4 s a partir da navegação, nos quatro perfis.

### Peso e custo, perfil sem limite (CPU 4× entre parênteses)

| | LEVE | PREMIUM | PBR |
|---|---:|---:|---:|
| rede para abrir | 0,46 MB | 8,66 MB | 2,98 MB |
| rede ao entrar na visita | 0 | 6,73 MB | 0 |
| textura na GPU (estimada pelo formato) | 20,9 MiB | 104,2 MiB | 60,9 MiB |
| heap JS (pico) | 57 MiB | 170 MiB | 57 MiB |
| tempo nas chamadas de textura | 7 ms (41) | 56 ms (168) | 225 ms (1.226) |
| pior quadro travado ao entrar na visita | 2,1 s (2,3) | 4,9 s (5,4) | 2,3 s (2,7) |
| draw calls no interior | 45 | 43 | 50 |
| custo do quadro no interior, p50/p95 | 2,6/3,2 ms (9,7/12,6) | 2,6/3,6 ms (10,2/11,9) | 3,2/4,1 ms (12,7/15,5) |

O custo do quadro vem de 60 renders seguidos, sincronizados por `readPixels`, na câmera de
entrada da visita. Ele não depende do rAF, que o headless limita a 60 Hz. A GPU não é emulada:
"CPU 4×" deixa só o lado da CPU mais lento.

### O que os números dizem

1. **Textura não segura a abertura.** Os mapas carregam depois do HTML e não mudam o 1º quadro
   além da variação entre rodadas.
2. **O gargalo é a decodificação na thread principal**, não a rede nem a GPU. Os 225 ms (1,2 s
   no celular emulado) vêm do WebP decodificado e enviado no primeiro quadro que usa cada mapa.
   Melhorias medíveis, ainda não feitas: `ImageBitmapLoader` (decodifica fora da thread
   principal), KTX2/Basis (sem decodificação e 4–8× menos memória de GPU) e albedo de 512 px
   no celular.
3. **O quadro fica 0,6 ms mais caro no desktop.** Com a CPU 4× mais lenta, o p95 chega a
   15,5 ms, perto dos 16,7 ms de 60 Hz. Os 5 draw calls a mais vêm dos móveis divididos em
   grupos de material.
4. **No celular, a troca é visível.** O interior abre com o visual do LEVE e muda para o PBR
   12,8 s depois.

### Limites da medição

As rodadas 2 e 3 saíram mais lentas que a 1 para as três variantes; no LEVE sem limite, o
1º quadro foi de 0,88 s para 1,6 s. Por isso, os valores absolutos não se comparam com
`experimentos/qualidade-progressiva-cedros/medicao-rede.md` (0,85 s pela manhã). A comparação
entre variantes vale, porque as rodadas foram intercaladas. A memória de GPU é estimada pelo
formato declarado. Celular é emulação, não aparelho físico.

## Registro de aceite (seção 11 do guia)

| Campo | Valor |
|---|---|
| Imóvel | Monte dos Cedros 37 (unidade 8º andar), base LEVE `ebd8b117…` |
| Commit | não commitado; árvore sobre `352e906` |
| Geração | assets `cedros-v3`, site `cedros-v4` (v1, v2 e site v3 reprovados, ver Paleta) |
| Materiais | tabela acima; Poly Haven, CC0, conferida em 04/10/2026 |
| Ambiente | Python 3.14.4, Pillow 12.3.0, libwebp 1.6.0, Node 24.15 |
| Hashes | `assets.json` (fontes e WebP) e `site/manifesto.json` (pacote) |
| Parâmetros | `CALIBRACAO` em `montar.mjs`; o resto segue a calibração do guia |
| Bytes | 15 mapas, 2.581.988; HTML 3.371.341 (com luz: 3.371.479 + `luz.js`) |
| Capturas | `cedros-v4/evidencias/grade-*.png` (LEVE × PREMIUM × PBR × PBR com luz), `cedros-v3/evidencias/fotos-*.png` (LEVE × PREMIUM × PBR, mesma câmera) e `pbr-acabamento-base-*` (Base = LEVE: diferença média < 1 nível) |
| Testes | `node --test tests/test_piloto_visual_*.mjs`: 24/24 |
| Aparelhos | desktop GTX 1650; celular só emulado |
| Pendências | aceite visual do usuário; aparelho físico; decodificação fora da thread principal |
| Responsável e data | — |

## Luz de teto (experimento, `--luz`)

`luz.js` põe um SpotLight por cômodo no plafom, apontado para baixo (4000 K, 12 cd, sem
sombra), e uma luz hemisférica de preenchimento 0,8 dentro da casa, que imita a luz rebatida.
As duas só contam em Planta 3D e Visita. `?luz=0` desliga. O site padrão (`cedros-v4/site/`)
não tem luz; `cedros-v4/site-luz/` tem.

**Brilho medido nas fotos, média da imagem (R, G, B):**

| vista | PREMIUM | PBR sem luz | spot 6 cd | spot 15 cd | **12 cd + preench. 0,8** | 10 cd + preench. 1,4 |
|---|---|---|---|---|---|---|
| cozinha | 180, 171, 152 | 141, 141, 140 | 156, 154, 151 | 169, 166, 162 | **178, 174, 169** | 182, 178, 173 |
| quarto | 187, 170, 146 | 159, 158, 155 | 170, 167, 162 | 179, 175, 170 | **191, 187, 180** | 198, 193, 187 |

Com 12 cd + 0,8, o brilho iguala o do PREMIUM. Mesmo assim, o PREMIUM parece mais iluminado
porque a luz dele tem forma: o lightmap do Cycles traz luz da janela rebatida 5 vezes, parede
que escurece longe da fonte, canto do teto com sombra macia e cada plano com um tom. O
preenchimento clareia por igual; com 1,4 a cena fica lavada. Ele também é creme e mel
(R − B ≈ 28–41), e cena quente parece mais iluminada que cena fria no mesmo brilho. Chegar
nessa forma pede luz assada no Blender para a geometria do LEVE, que volta a trazer os ~13 MB
de atlas que o PBR economiza.

Sem sombra, a luz atravessa parede; o alcance limitado ao cômodo segura o vazamento, mas não o
elimina. Uma PointLight 16 cm abaixo do forro estourava um disco no teto e foi trocada pelo spot.

**Custo** (3 rodadas intercaladas, sem limite de rede, mesma rodada que o PBR sem luz):

| | sem luz | spot 6 cd, um quadro depois da casa | spot 6 cd no mesmo render | **12 cd + preench. 0,8** |
|---|---:|---:|---:|---:|
| interior pronto | 3,1–3,9 s | 7,6 s | 4,3 s | **4,8 s** (sem luz: 3,3 s) |
| pior quadro travado ao entrar | 1,9–2,5 s | 4,6 s | 2,8 s | **3,2 s** (sem luz: 2,0 s) |
| quadro no interior, p50 | 3,2–4,3 ms | 3,5 ms | 3,5 ms | **5,4 ms** (sem luz: 4,3 ms) |

O número de luzes faz parte da chave do shader, e luz que chega depois da casa recompila todo
material já compilado. Pôr as luzes em `scene.onBeforeRender`, no mesmo render em que a planta
nasce, tirou 2/3 do atraso. O que sobra é shader maior mais a instalação do `visual.js`, que
acontece um quadro depois e já recompilava antes das luzes. Instalar o acabamento pelo mesmo
gancho é o próximo corte, ainda não feito. Dados em `cedros-v4/medicao-luz*.json` e
`cedros-v4/teste-luz/medicao-b.json`; fotos em `cedros-v4/teste-luz/grade-*.png`.
