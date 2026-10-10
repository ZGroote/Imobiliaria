# Primeiro refinamento do exterior — 10/10/2026

O visualizador integrado usa agora um acabamento de pintura nas esquadrias e guarda-corpos da torre e oferece a vista **Varandas**. A geometria das barras já existia; o material representava metal exposto. A revisão aproxima a resposta à luz do acabamento observado no render comercial de varanda do book oficial.

`exterior-finishes.js` clona somente a atribuição da torre. A identificação valida SHA da edição, nome semântico da malha e assinatura do material fonte; uma edição incompatível é rejeitada. A tipografia da portaria usa o material original. O perfil emprega **MeshStandardMaterial padrão**, convertido pelo renderer nos dois backends. Não adiciona shader, textura, geometria ou efeito de transmissão.

Metalness passa de 1 para 0 e roughness de aproximadamente 0,38 para 0,55. São **valores estimados de calibração visual**, não especificação da incorporadora. Cor, posições, matrizes, UV1, materiais baked, atlas e luz continuam iguais. O clone entra no mesmo descarte dos materiais da cena.

`cameras.js` define a aproximação de duas prumadas da face publicada, sem vincular apartamentos. O enquadramento usa uma caixa local e adapta a distância à proporção da tela. A vista, a câmera livre e o destaque de andar são recuperados ao voltar dos outros modos e do mapa.

## Comparação e procedência

[refinamento-exterior.json](refinamento-exterior.json) registra fontes, hashes, região do guarda-corpo, parâmetros, limites e critérios. As imagens oficiais têm iluminação e perspectiva diferentes do modelo: não medimos igualdade de pixels entre elas. O ensaio antes/depois usa exatamente a mesma câmera e luz, além de conferir a integridade das malhas e do RGBM.

O render oficial extraído do book mostra **barras verticais pintadas**. A observação antiga “balcony glazing” em `LIV/referencias/source_analysis.json` é supersedida por esta evidência para o guarda-corpo. Ela não autoriza trocar barras por vidro. Os painéis das janelas/portas continuam como na base; transparência exige conferir o que existe atrás deles e medir o custo.

O comparativo de implantação revelou outro problema: o modelo simplifica o perímetro da lâmina/cobertura. Corrigir apenas o teto deixaria paredes e lajes inconsistentes. [modelo/NOTAS-GEOMETRIA.md](modelo/NOTAS-GEOMETRIA.md) registra a sequência para produzir uma nova autoria com UV/bake próprios, em destino isolado. T06 e T07 continuam parciais.

## Diagnóstico local

A [maquete integrada](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html) ativa o perfil novo. `?acabamento=base` permite comparar o acabamento preservado. A [prova RGBM](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/prova-rgbm.html) continua com o acabamento original; `?acabamento=referencia` ativa a revisão. `backend=webgpu` ou `backend=webgl` exige o backend de diagnóstico.

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_refinamento.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/refinamento-exterior-novo
```

O [relatório final do refinamento](evidencias/refinamento-exterior-final/runtime.json) passou nos três perfis: desktop WebGPU, desktop WebGL2 e toque emulado de 390 px. Confere clone/material fonte, tipografia, malhas/UV1/matrizes, dados baked, captura PNG, descarte idempotente, retorno via Planta 2D, recarga da sessão e recuperação com um clique. A rejeição de assinatura durante a construção liberou os 111 recursos já criados e fechou dois bitmaps, antes de recuperar o perfil pelo fallback.

A [recuperação](evidencias/recuperacao-refinamento-final/runtime.json) passou nos nove cenários de GPU, atlas, planta e navegação rápida. O fallback conserva o perfil e os parâmetros da prova. A [integração final](evidencias/integracao-refinamento-final/runtime.json) passou nos quatro modos, em três perfis, com um ciclo completo por perfil. A revisão consultou Graft: o grafo reportou ausência de manifest e estado desatualizado; os arquivos do incremento foram conferidos diretamente.

[Comparativo visual](evidencias/refinamento-exterior-final/comparativo-metais.png): referência oficial e duas capturas na mesma câmera. A diferença de acabamento é discreta e não resolve a geometria ou os interiores simplificados da reconstrução.

Os resultados e capturas ficam no destino próprio; não sobrescrever ensaios históricos. Teste emulado não qualifica aparelho físico. Este incremento não mede ganho de abertura/FPS nem altera a fila de transferência. O problema de tempo de abertura registrado em [PERF.md](PERF.md) permanece pendente.

Referência técnica: [MeshStandardMaterial — metalness e roughness](https://threejs.org/docs/pages/MeshStandardMaterial.html). Fonte visual: [book oficial LIV Ipanema](https://www.livonincorporadora.com.br/wp-content/uploads/2024/08/BOOK_LIV_Ipanema.pdf), render de varanda extraído no dossiê local.
