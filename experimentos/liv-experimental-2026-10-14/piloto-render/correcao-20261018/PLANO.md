# Recaptura sem reflexo dinâmico — plano (18/10/2026)

## Pergunta que esta rodada responde

O splat mancha banheiros e varanda porque vidro, espelho e mármore polido mudam com o ângulo?
Em 18/10 a remontagem só com as fotos de treino mostrou que a informação existe no corredor e no
banho social (a imagem remontada fica quase igual à verdade); o splat é que não aprende. A rodada de
16/10 já tinha 2.225 vistas extras nesses três cômodos e mesmo assim manchou.

Teste limpo: **mesmas 2.590 câmeras, mesma divisão treino/avaliação, mesmo treino; só o material muda.**

## O que muda na cena (`apartamento-jateado.blend`)

Gerada de `../correcao-20261016/apartamento.blend` por `../sem_reflexo.py --sem-reflexo jateado`:

- Vidro das janelas e da porta da varanda: transparente, sem reflexo (só o caixilho aparece).
- Boxes dos dois banheiros (`mesh-27`, `mesh-30`): vidro jateado (translúcido).
- Espelhos: painel cinza fosco. É a perda visível desta variante.
- Mármore, louça, cerâmica, esmalte e metais: sem polimento (rugosidade ≥ 0,45–0,6, sem verniz).

Prévia nas seis vistas do Tour: `sem-reflexo.jpg` (enviada ao usuário em 18/10).

## Pronto localmente (sem custo)

| item | estado |
|---|---|
| `apartamento-jateado.blend` | SHA-256 `0c92aca8692f2e912774ab19ae09f2a6c056a5240a4fe307d7acde4d849bc9dd` |
| `dataset/plano-captura.json` | 2.590 vistas / 109 posições, **matrizes idênticas** às de 16/10 (diferença 0,0), mesmos nomes, divisão (2.213 treino / 377 avaliação) e intrínsecos |
| `pacote-jateado.zip` (9 MB) | cena + plano + `capturar_splat.py`, `validar_captura.py`, `gpu.py`, `planta.py`, `unidade.json`, `executar.sh`, manifesto SHA-256 |

## No servidor (precisa da GPU alugada pelo usuário)

Referência medida em 16/10, 2× A100 40 GB: render ~13 vistas/min, treino 30 mil etapas < 40 min.

1. **Subir** `pacote-jateado.zip` e `../renderizar_plano.py`; extrair em pasta nova; `bash executar.sh validar`.
2. **Render, ~3,5 h**: um processo por GPU, sem recalcular o plano:
   ```bash
   CUDA_VISIBLE_DEVICES=0 blender -b apartamento.blend --python gpu.py --python renderizar_plano.py -- --parte 0 --partes 2 > render-0.log 2>&1 &
   CUDA_VISIBLE_DEVICES=1 blender -b apartamento.blend --python gpu.py --python renderizar_plano.py -- --parte 1 --partes 2 > render-1.log 2>&1 &
   wait
   BLENDER_BIN=blender bash executar.sh render   # imagens já existem: só gera pontos.ply e transforms.json
   ```
3. **Limpar a semente**: em 16/10, 33 pontos duplicados em `pontos.ply` deram escala log(0) no treino.
   Remover coordenadas repetidas antes de treinar (mantém cor e as demais).
4. **Treino, ~40 min**: `bash executar.sh treino` (splatfacto 30 mil etapas, otimizador de câmera desligado,
   cull-alpha 0,005, cache em CPU), exportação PLY e `ns-eval` nas 377 vistas reservadas.
5. **Converter para SOG** e baixar: PLY, SOG, `eval.json`, `eval/` (renders das vistas reservadas) e
   o `transforms.json`. As imagens de captura só se houver tempo de banda: elas permitem treinar de novo sem render.

Total estimado: **~5 h de 2× A100**, mais transferência. Se só houver uma GPU, o render dobra (~7 h).

## Como decidir (antes de qualquer publicação)

Linha de base: o modelo antigo de 30 mil etapas nas mesmas 377 vistas reservadas (`comparacao30k-60k.json`):

| cômodo | PSNR médio (dB) antes | meta |
|---|---|---|
| Banho | 19,4 | perto dos cômodos secos (≥ 27) |
| Banho suíte | 21,6 | ≥ 27 |
| Varanda / serviço | 21,4 | ≥ 27 |
| Dormitório 01 | 27,0 | não piorar mais que 0,5 |
| Sala integrada | 30,6 | não piorar mais que 0,5 |
| Suíte | 30,4 | não piorar mais que 0,5 |

PSNR é diagnóstico, não aprovação. Depois do número:

- `../remontar_compor.py` com a verdade nova (render jateado) nas seis poses do Tour, splat novo ao lado;
- `../sonda_tour.py` num servidor local com o SOG novo: dez poses, zero erros;
- se o banho social e o corredor saírem limpos, o corredor pode voltar ao splat (hoje está na malha).

Se os cômodos molhados não subirem, o reflexo não era a causa principal e a próxima hipótese é
capacidade do modelo nos cômodos pequenos (mais gaussianas / densificação nessas regiões).

## Fora desta rodada

- Quadrados pretos no alto dos batentes (`mesh-4`, material `m3`, z 2,09–2,14 m): vêm da cena e vão
  aparecer de novo. Consertar antes do render só se for rápido; muda o SHA da cena e exige refazer o plano.
- Espelho de verdade: exigiria desenhar o reflexo por cima do splat no Tour (plano refletor na malha).
- Nada é publicado no site sem a conferência acima e autorização.
