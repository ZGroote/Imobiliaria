| | Versão atual | v4 |
|---|---:|---:|
| Bytes para abrir a maquete | 8,91 MB | **3,23 MB** (celular fraco: **1,51 MB**) |
| Bytes a mais ao entrar no apartamento | 6,87 MB | **3,57 MB** (celular fraco: **1,28 MB**) |
| Primeira imagem — computador / celular 4G / celular fraco | 0,6 / 0,8 / 3,4 s | **0,1 / 0,3 / 1,2 s** |
| Maquete com a luz calculada — computador / 4G / fraco | 4,7 / 11,3 / 51,3 s | **3,4 / 3,6 / 8,4 s** |
| Entrar na Planta 3D — computador / 4G / fraco | 9,4 / 16,6 / 46,1 s | **6,9 / 9,0 / 10,2 s** |
| Memória de vídeo com a maquete — computador / 4G / fraco | 113 / 83 / 83 MiB | **50 / 21 / 16 MiB** |
| Desenhos por segundo com a planta ou a visita paradas | 85–181 | **0** |
| CPU com a Planta 2D aberta, celular | 46–67% | **0–2%** |
| Servidor, 1.000 acessos/dia (40% entram no apartamento) | 262 GB/mês ≈ US$ 37,73 | **93 GB/mês ≈ US$ 12,31** |
| Gerar um imóvel novo (tempo de máquina) | ~7 min | ~10–11 min (≈ R$ 0,06 no próprio computador) |
| Visual no computador (perfil alto, 6 poses) | — | **44,8–47,8 dB** contra o aprovado: igual a olho nu |
| Visual no celular (perfil médio, 6 poses) | — | **38,8–46,2 dB** contra o aprovado para celular |

- **Mesmo desenho, mesma luz:** nada foi recalculado. A diferença medida pixel a pixel contra
  o padrão aprovado é de 0,2 a 1,0 nível de cor (de 255) em média.
- **Onde a qualidade cai, por escolha:** só no perfil **baixo** (celular fraco): luz em meia
  resolução, sem sombra em tempo real nas fachadas e na visita, 30 quadros por segundo.
- **O que saiu:** "Ver mapa" e a versão offline/duplo clique, como pedido. A página precisa
  de servidor (o Firebase de sempre).
