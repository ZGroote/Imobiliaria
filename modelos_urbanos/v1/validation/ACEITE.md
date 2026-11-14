# Validação da biblioteca V1

- 60 variantes de geometria distintas: 20 casas, 20 sobrados, 20 prédios.
- 120 GLBs reabertos com glTF-Transform: um mesh por arquivo, até dois materiais, cores de vértice e normais presentes, índices válidos, posições finitas, dimensões e eixos compatíveis, base no chão, contagem de triângulos preservada.
- LOD1 contém menos triângulos em todos os 60 modelos e usa a mesma origem do respectivo LOD0.
- Geometria verificada no Blender em ambos os níveis: sem faces ou triângulos degenerados.
- Inspeção visual dos catálogos frontais dos 60 modelos e de 15 vistas posteriores. Corrigidos telhado de quatro águas sem cumeeira, painéis solares sem apoio e bordas de coberturas sobrepostas. Refeito o render dos modelos afetados.
- Round-trip visual de `casas-20`, `sobrados-04` e `predios-05`: importação de GLB em cena limpa e novo render. Diferença RGB média de 0,0037; 0,0047; 0,0069 em escala 0–255, respectivamente. Medidas e cores preservadas.
- 60 FBXs produzidos. Importação no Unreal não testada; instruções de material por Vertex Color no LEIA-ME.
- A biblioteca `.blend` foi salva com coleções separadas e 60 assets LOD0. A gravação do cache externo de thumbnails do Blender apresentou avisos; isso não impediu salvar a biblioteca nem os modelos. Catálogos JPG e renders individuais estão disponíveis no diretório.

## Tamanho e complexidade

GLBs LOD0 juntos: 41.506.084 bytes. GLBs LOD1 juntos: 12.209.288 bytes. Valores dos arquivos individuais sem compressão de transporte; o portal deverá carregar por demanda.

| Família | Triângulos LOD0 | Triângulos LOD1 |
|---|---:|---:|
| Casas | 1.004–2.196 | 236–744 |
| Sobrados | 1.892–4.080 | 452–1.032 |
| Prédios | 4.728–37.752 | 1.224–13.584 |

Escopo de aceite: biblioteca inicial de exteriores ilustrativos, render e exportação. Desempenho em milhares de instâncias, níveis de detalhe adicionais, colisões, integração com o mapa e fidelidade a endereços reais não fazem parte deste aceite.
