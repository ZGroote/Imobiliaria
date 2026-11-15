# Terreno — tarefa 3
- Galho: `ci/viabilidade-testes`; implementação apenas em `testar_pilotos.py`, sem commit.
- Reprodução: sete JSONs continuam byte a byte; somente os três intermediários indicados aceitam floats com diferença absoluta ≤ 1e-6; chaves, tipos, ordem das listas e demais valores são exatos.
- Unidades conferidas: m (UTM, frente, distâncias, fx/fy), m² (áreas), graus (centroide_lonlat), pixels, pixels/m (matriz afim) e adimensionais (nx/ny, ocupação).
- 1e-6 serve como limite de regressão nesses intermediários: 1 µm em m, 1 mm² em m², subpixel em pixels; em graus são aproximadamente 11 cm, portanto não equivale a precisão micrométrica universal. Os lotes principais permanecem exatos.
- PNG: tamanho e pixels RGBA idênticos, diferença máxima aceita 0/255 por canal; compressão/metadados podem variar sem alterar o desenho, sem justificativa para aceitar mudança visual.
- Autoteste sempre executado: cópias temporárias com float +1e-3 e um byte principal adulterado falham; cobre também estrutura/tipos, limite numérico, NaN, recompressão, pixel e tamanho; erros localizam arquivo/campo ou pixel/byte e diferença.
- `python -I -X utf8 viabilidade/terreno/testar_pilotos.py --reproduzir`: passou; sete pilotos e cinco originais preservados. Reprodução não alterou dados versionados.
- Pendências sem commit: teste e este relatório (o status não pode ficar vazio mantendo a entrega sem commit). CI Linux não executado aqui; pixels distintos lá continuarão falhando. Pillow avisa sobre o tamanho dos mapas existentes.
