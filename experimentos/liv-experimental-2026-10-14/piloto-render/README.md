# Piloto de render — sala e cozinha do Meio

Passo 1–3 do piloto combinado em 14/10/2026: vestir a sala/cozinha do Meio no Blender e renderizar
vistas fixas no Cycles, para comparar com o reel de referência antes de decidir pelo Gaussian
Splatting (`tasks/caminho1-liv/plano-1.md`).

```powershell
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' -b `
  experimentos/liv-experimental-2026-10-14/interiores/meio/bake/interior-source.blend `
  --python experimentos/liv-experimental-2026-10-14/piloto-render/montar_sala.py -- `
  --saida experimentos/liv-experimental-2026-10-14/piloto-render/v1 --amostras 256 --res 1280x720
```

Opções: `--vistas v1,v2,v3`, `--exposicao 0.5`, `--ceu 0.12`, `--look "AgX - Medium High Contrast"`.
Cada execução grava `v1.png`, `v2.png`, `v3.png` e `piloto.blend` na pasta de saída. Gerações novas
vão para pastas novas (`v1`, `v2`, …). `teste/` guarda as rodadas rápidas de 24 amostras.

## O que o script faz

| Camada | Escolha |
|---|---|
| Estilo | Decorado livre (decisão de 14/10) |
| Piso | Madeira (`madeira`, piloto de 04/10, CC0), 1,8 m por repetição |
| Paredes | Off-white quente liso |
| Cozinha | Armários em nogueira, tampo de mármore procedural acima de 0,86 m, armário alto com fita de LED embaixo |
| Jantar | Tampo de mármore, base preta, cadeiras em bouclê, três pendentes globo, vaso com ramo |
| Sala | Sofá "Cloud / Slouch" do gerador `blender/sofa_generator.py` no lugar do sofá de blocos, parede ripada em nogueira com LED no topo, TV, objetos no rack, tapete liso, planta |
| Vidro | O vidro opaco virou vidro real; o raio de sombra atravessa (sem cáustica), então o sol entra |
| Luz artificial | Plafons existentes em 2700 K, quatro spots embutidos |
| Sol | 21/06, 16h30, São Carlos: altitude 13° (calculada). Azimute **artístico**: perpendicular à fachada da varanda, porque o norte da implantação não foi validado (T16). Uma varredura de raios do piso até o sol mostrou que 0° é o azimute que mais ilumina o piso |
| Céu | Sky Texture (Nishita) com o mesmo sol, intensidade 0,12 |
| Cor | AgX, Medium High Contrast, exposição +0,5 |

Nada aqui altera o Liv: o script abre o `.blend` de origem e salva o resultado na pasta de saída.

## Pipeline generalizado (15/10): qualquer tipologia

`montar_sala.py` fica como o piloto congelado do Meio. O caminho de agora em diante:

```powershell
$B = 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe'
$L = 'experimentos/liv-experimental-2026-10-14'
# 1. vestir e conferir (640x360, 24 amostras): grava <saida>/<vista>.png, apartamento.blend, cameras.json
& $B -b "$L/interiores/canto/bake/interior-source.blend" --python "$L/piloto-render/montar_apartamento.py" -- --saida canto
# 2. capturar para o splat (zonas = cômodos do cadastro)
& $B -b canto/apartamento.blend --python "$L/piloto-render/capturar_splat.py" -- --saida captura --amostras 128 --res 1280x720
# 3. depois do treino e do ns-eval --render-output-path: inspeção por cômodo
python "$L/piloto-render/inspetor.py" medir --eval eval --captura captura --unidade "$L/interiores/canto/unidade.json" --saida inspecao --eval-json eval.json
```

| Arquivo | Papel |
|---|---|
| `planta.py` | Lê `interiores/<tipologia>/unidade.json` no referencial do `.blend` (planta centrada, y invertido): cômodos, móveis com rumo das costas, janelas e portas com o cômodo de cada lado. `python planta.py` confere contra o Meio e o Canto |
| `montar_apartamento.py` | Veste por regra de tipo, sem coordenada de tipologia: cama (cabeceira estofada até o peitoril, travesseiros/manta na altura medida do colchão, tapete, abajur nos criados), lavatório (mármore, espelho com LED, toalha, spot), sala (sofá do gerador, ripado com TV atrás do rack, spots, planta), cozinha (tampo de mármore, armário alto com LED, spots), jantar (pendentes no eixo longo da mesa), escrivaninha (prateleira, livros, luminária), cortinas laterais nas janelas e portas de vidro de quarto e sala sem cobrir o vão, plantas em cantos livres longe das portas, sol pela fachada da varanda. Vistas derivadas: em cada cômodo, o ponto livre mais longe do alvo (cabeceira, espelho, fundo da varanda) que ainda o enxerga; na sala v1 (cozinha), v2 (TV) e v3 (da porta da varanda através da mesa). `--cameras` usa vistas dadas (`cameras-piloto-meio.json` = as do piloto) |
| `capturar_splat.py` | Zonas pelos cômodos gravados na cena (`--zona apto` ou `--zona "Suíte,Banho"`), `--passo` da grade, `--prefixo` para recaptura; cada quadro leva `comodo` |
| `inspetor.py` | `medir`: Cycles × splat por vista de teste, agregado por cômodo (a sala integrada se divide em estar/jantar/cozinha pelo móvel mais perto), mapa de erro das piores e recaptura sugerida. `visao`: pedido com a lista fixa (escuro, flutuando, xadrez, mancha, câmera dentro, distorção) contra a referência aprovada; só envia com `--executar` e `ANTHROPIC_API_KEY`. `veredito`: aprovado/reprovado + motivo + imagem copiada por hash em `vereditos.jsonl` |

Diferenças de propósito em relação ao piloto: a cabeceira da suíte do piloto ficou dentro da parede
(x = 4,76–4,82 com a face em 4,73) e não aparecia; aqui ela fica na face. As cortinas não cobrem mais
o vão. Os pendentes seguem o eixo longo da mesa. O tamanho do sofá (7% mais largo, 5% mais fundo que
o cadastro, 8 cm para a parede) foi copiado do piloto e é o botão de calibração.

## Limites conhecidos

- Os acabamentos ficam só no Blender. Ainda não existe caminho deles para o navegador (isso é a
  Fase 1 do plano-1).
- O mármore é procedural. Para o navegador, ele precisaria virar textura.
- As plantas são procedurais simples (folhas elipsoides). Para chegar ao nível do reel, seria preciso
  usar modelos de verdade.
- A orientação do sol é escolha artística até validar o norte.
