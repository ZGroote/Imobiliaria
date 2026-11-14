# Medição com rede emulada — Cedros LEVE × PREMIUM

Data: 04/10/2026. Cobre o item "rede limitada" que o estudo de 27/09 deixou para depois. Reproduzir:
`python experimentos/qualidade-progressiva-cedros/medir_rede.py --rodadas 3`. Números crus em `medicao-rede.json`.

**Como:** Chrome 154 headless com a GPU desta máquina (GTX 1650, D3D11 — conferido pela string do
renderizador, não é swiftshader), 1280×720, dpr 1, navegador novo e cache desligado a cada abertura
(primeira visita). Servidor local entrega os **mesmos bytes brotli do Hosting**: o PREMIUM foi baixado do ar
e conferido contra `publicado-atual/` por SHA-256; o LEVE (fora do ar) foi comprimido em brotli q11, o nível
que reproduz o tamanho do PREMIUM no ar. Rede por CDP (latência somada por requisição), CPU por
`setCPUThrottlingRate`. Mediana de 3 rodadas intercaladas.

## Tempo (segundos, a partir da navegação)

| perfil | 1º quadro LEVE | 1º quadro PREMIUM | exterior com luz (PREMIUM) | interior pronto LEVE | interior pronto PREMIUM |
|---|---:|---:|---:|---:|---:|
| sem limite | 0,85 | 0,98 | 1,9 | 1,6 | 3,4 |
| 4G bom — 20 Mbps, +70 ms | 0,97 | 1,02 | 4,7 | 1,8 | 6,1 |
| 4G fraco — 5 Mbps, +150 ms | 1,49 | 1,58 | 15,2 | 1,7 | 14,1 |
| celular do Lighthouse — 1,5 Mbps, +562 ms, CPU 4× | 5,05 | 5,25 | 51,2 | 3,2 | 42,2 |

"Interior pronto" conta do clique em Visita 3D: no LEVE é o fim do bake por vértice; no PREMIUM, o
"Sala revisada" (`__bakeV3.ready`). O 1º quadro é a primeira draw call no framebuffer da tela, e já é o prédio
inteiro (30 de 43–45 draw calls do regime; ver `foto-*-1-primeiro-quadro.png`).

## Peso

| | LEVE | PREMIUM |
|---|---:|---:|
| rede para abrir | 0,46 MB | 8,66 MB (0,46 de HTML + 8,2 de atlas/UV, que chegam depois do 1º quadro) |
| rede ao entrar na visita | 0 | 6,73 MB |
| textura viva na GPU (estimada pelo formato) | 21 MiB — 16 são o mapa de sombra do sol 2048² | 104 MiB — +64 atlas exterior 4096², +16 atlas interior |
| buffers na GPU | 4,5 MiB | 13,7 MiB |
| heap JS (pico) | 57 MiB | 158–204 MiB |
| tempo dentro das chamadas de textura | 5 ms | 37 ms (95 no celular) |
| pior quadro travado ao entrar na visita | 1,2–1,3 s | 2,5–2,9 s |

## O que os números dizem

1. **Textura adiada não mexe no 1º quadro.** O PREMIUM carrega 15 MB de lightmap e abre só 0,05–0,2 s
   depois do LEVE em todos os perfis. O que segura a abertura é o HTML e a CPU: 0,85 s sem rede nenhuma, e no
   perfil do Lighthouse só o HTML de 463 KB leva 3,0 s para chegar.
2. **O custo da textura é o tempo até a qualidade final e a memória**: o exterior com luz calculada leva
   4,7 s no 4G bom e 15 s no 4G fraco. A GPU vai de 21 para 104 MiB e o heap triplica, por causa do UV em JSON.
3. **O lightmap do interior espera o bake por vértice.** O `v3Load` só dispara com `!BK.BAKE.fila`, então
   o PREMIUM gasta ~3,2 s assando uma oclusão que o atlas substitui logo depois, e só então começa a baixar
   6,7 MB. No 4G fraco: 3,2 + 10,8 s, em sequência.
4. **Entrar na visita trava o quadro por 1,2 s já no LEVE**, sem rede envolvida. Não é textura.

## Limites

GPU e CPU são desta máquina; "celular" é CPU 4× mais lenta e rede emulada, não aparelho físico. Com UA de
desktop, a página não liga `CELULAR` (no aparelho a sombra cai para 1024², ou seja, 4 MiB em vez de 16).
Memória de GPU é estimada pelo formato declarado nas chamadas, não lida do driver. O servidor é HTTP/1.1 e a
latência é somada por requisição (sem slow start de TCP). Segunda visita não medida: `assets/cedros/**`
tem cache imutável de 1 ano, então o atlas não volta a ser baixado.
