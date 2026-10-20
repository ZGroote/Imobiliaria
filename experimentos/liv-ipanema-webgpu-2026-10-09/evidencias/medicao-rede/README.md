# Abertura fria com rede móvel emulada — 09/10/2026

Chrome 154 headless, GTX 1650, 1440×900, cache desligado (CDP). Servidor `servidor_gzip.py`: gzip 6 em texto, `.gz`/`.png` servidos crus — aproxima a hospedagem (o Firebase serve a base em **brotli, 21.297.279 bytes**, medido com `curl` no endereço público; gzip dá 22.903.332).
Perfis: Fast 4G = 9 Mbps / 60 ms; Slow 4G = 1,6 Mbps / 150 ms.

| Perfil | Variante | Transferido | Pronto (2 rodadas) |
|---|---|---:|---|
| Fast 4G | base | 22,9 MB | 22,9 s / 22,1 s |
| Fast 4G | evolução WebGL2 | 20,9 MB | 26,1 s (shader frio) / 21,5 s |
| Fast 4G | evolução WebGPU | 20,9 MB | 21,4 s / 21,8 s |
| Slow 4G | base | 22,9 MB | 116,6 s / 116,9 s |
| Slow 4G | evolução WebGL2 | — | **não abre**: `viewer.js` `until()` desiste aos 90 s ("O visualizador demorou para responder"); ver `slow4g-130s.png` |

Leitura: com compressão na rede, a evolução transfere ~9% menos que a base (não 37,5%) e empata no tempo. O atlas `irradiance.rgbm.gz` (4096², 13 MB) é 62% do download.
