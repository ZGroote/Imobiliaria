# Reutilização das sombras exteriores — 11/10/2026

O exterior das duas edições agora calcula a sombra solar uma vez e reutiliza o mapa durante órbita, troca de vista, destaque de andar e seleção. Esses comandos não movem a geometria nem a luz. Os materiais PBR, atlas RGBM, malhas, enquadramentos e mapa regional continuam iguais. Canto e Meio já tinham sua própria política de invalidação, que permanece preservada.

`renderer.js` configura `LightShadow.autoUpdate=false` e `needsUpdate=true` na primeira imagem. `__livProva.invalidateShadows()` solicita um recálculo quando uma futura edição alterar luz ou geometria; após o descarte, retorna `false`. Esse recurso não transforma iluminação fixa em simulação solar nem dispensa regenerar um bake incompatível.

## Conferência visual e de trabalho

[sombras-exterior-candidato/runtime.json](evidencias/sombras-exterior-candidato/runtime.json) passou em seis casos: original/contorno, WebGPU/WebGL2 desktop e toque emulado. Compara cinco vistas e o final selecionado contra o recálculo automático na mesma câmera. Diferença máxima de RGB: zero em cinco casos e 1/255 em um caso WebGL2. Uma invalidação explícita atualizou a sombra uma vez; as seguintes renderizações reutilizaram o resultado. Descarte foi conferido.

Na comparação sequencial de 24 quadros de órbita, o recálculo automático executou **24 passes de sombra**, contra **zero** com reutilização. Os passes totais, incluindo a saída do renderer, passaram de 72 para 48; a última imagem registrou 112 contra 56 draw calls. Isso demonstra remoção de trabalho repetido. Não mede tempo GPU, consumo ou FPS em telefone.

[unidades-sombras-exterior/runtime.json](evidencias/unidades-sombras-exterior/runtime.json) passou nos três perfis da variante: lista/fachada/teclado, realce, descarte, sessão, ambas as tipologias em Planta 2D/3D/Tour, três recuperações e retorno normal/com falha do mapa. A geometria e os 140 recursos da fila não mudaram nesta revisão.

## Abertura e método

[medicao-contorno-sombra-final/medicao.json](evidencias/medicao-contorno-sombra-final/medicao.json) contém três rodadas por edição/backend, frio/reload, com Chrome novo por rodada. Viewport 1440×900, DPR 1, canvas igualado a 720×390, Chrome 154/Windows 11/GTX 1650. A fila é pausada depois da primeira cena utilizável para isolar a órbita; não cria cenas ocultas. Sem compressão HTTP no loopback; arquivos `.gz` já estão comprimidos. Caches do driver e outras aplicações não são controlados.

| Edição / renderer | Conteúdo inicial | Mediana fria | Mediana reload |
|---|---:|---:|---:|
| Base pública preservada | 38.378.801 bytes | 2.220 ms | 1.296 ms |
| Original novo / WebGL2 | 24.047.360 bytes | 5.242 ms | 4.027 ms |
| Original novo / WebGPU | 24.047.360 bytes | 3.021 ms | 2.695 ms |
| Contorno / WebGL2 | 19.969.324 bytes | 5.194 ms | 3.834 ms |
| Contorno / WebGPU | 19.969.324 bytes | 2.550 ms | 2.308 ms |

O contorno transporta **48,0% menos conteúdo inicial** que a base. A mediana fria ainda excede o limite provisório de 10%: aproximadamente +14,9% em WebGPU e +134,0% em WebGL2. O p95 de submissão ficou próximo de 17 ms nas cinco variantes; não equivale a execução GPU/FPS. A interface normal usa um canvas maior; o ensaio igualado controla a resolução, sem modificar o produto. `renderer.info` do benchmark é um snapshot após restaurar a câmera; os draw calls de órbita acima vêm da prova dedicada de 24 quadros.

O protocolo anterior de sessão única teve uma abertura WebGPU que não concluiu. O novo ensaio registra erros/progresso e usa processos separados, com todas as rodadas aprovadas. Não estabelece a causa daquele timeout nem substitui os ensaios prolongados no produto e em aparelhos físicos. As medições históricas usaram outras condições de cache/processo e não demonstram ganho de abertura desta revisão.

```powershell
python qa_sombras_exterior.py --saida evidencias/sombras-outra-revisao
python qa_unidades.py --geometria contorno --saida evidencias/unidades-sombras-outra-revisao
python medir_runtime.py --geometria ambas --igualar-canvas --rodadas 3 --saida evidencias/medicao-sombras-outra-revisao
```

Executar a partir deste experimento e com o servidor da raiz em `127.0.0.1:8790`. Ensaios gráficos sequenciais. Continuam pendentes: compilação/primeiro quadro, ensaio Poco X6/iPhone e qualificação de abertura na hospedagem. A variante conserva ativação explícita; não houve publicação.

Referência técnica: [LightShadow — autoUpdate/needsUpdate](https://threejs.org/docs/pages/LightShadow.html), conferida também no Three.js 0.186.1 instalado.
