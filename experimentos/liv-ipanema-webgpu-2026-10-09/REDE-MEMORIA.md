# Rede comprimida e memória — 11/10/2026

`medir_rede_memoria.py` e `servidor_medido.py` comparam o HTML realmente preservado da publicação com a entrada nova completa, em WebGL2 e WebGPU. [Relatório](evidencias/rede-memoria-gzip-final/medicao.json): **18 casos aprovados**, três rodadas por variante, frio e reload. O relatório fixa os hashes dos arquivos medidos, anteriores à adição da ambiência.

Chrome 154.0.8037.98, Windows 11, GTX 1650; viewport 1440×900, canvas igual de 720×390, DPR 1. Navegador novo por variante/rodada; reload no mesmo contexto. CDP limita upload/download a 6 Mb/s e latência a 80 ms. Servidor próprio em loopback, gzip nível 6 para texto, sem recomprimir `.gz`; pré-compressão antes do cronômetro. Service Workers bloqueados para isolar a primeira cena e o cache HTTP. Isso **não mede a fila completa nem Firebase HTTPS**.

| Variante | Frio mediano | Reload mediano | Corpos comprimidos da primeira cena |
|---|---:|---:|---:|
| Base publicada preservada | 33,278 s | 32,472 s | 22.903.332 B |
| Entrada / WebGL2 | 26,785 s | 20,227 s | 16.933.794 B |
| Entrada / WebGPU | 26,589 s | 20,467 s | 16.933.698 B |

A entrada transferiu **26,1% menos conteúdo comprimido**; abertura fria mediana 19,5% menor em WebGL2 e 20,1% menor em WebGPU. Os 47,7% anteriores referiam-se ao conteúdo sem compressão HTTP, em outro protocolo. Não substituir uma medida pela outra. Estes resultados não demonstram FPS, tempo GPU ou desempenho físico Android/iPhone.

`encodedBodySize` identifica o corpo servido, inclusive o tamanho conhecido de uma resposta reaproveitada. `transferSize` distingue o tráfego observável: no reload, 13.303.842 B em WebGL2 e 13.303.446 B em WebGPU. O atlas de 13.290.120 B foi requisitado e servido com HTTP 200 novamente em todos os reloads. CSS/JS tiveram entradas com transferência zero. O servidor tem ETag e o teste HTTP cobre 304, mas o navegador não enviou uma revalidação útil para esse atlas neste protocolo. A causa não foi isolada; **não afirmar cache integral ou ausência de novo download**. A fila de Service Worker tem outros ensaios próprios em FILA.md.

## Memória observável

Amostragem de `Runtime.getHeapUsage` a cada 250 ms; valores abaixo são medianas dos picos amostrados de cada caso, em MiB. Heap JS e backing storage são métricas separadas do Chrome, não VRAM nem o total físico do processo. Não somar as colunas como consumo total; coleta de lixo e picos entre amostras afetam a comparação.

| Variante | Heap JS frio / reload | Backing storage frio / reload |
|---|---:|---:|
| Base | 48,24 / 34,06 | 214,57 / 208,60 |
| Entrada WebGL2 | 65,86 / 81,66 | 111,98 / 189,86 |
| Entrada WebGPU | 59,78 / 67,22 | 131,84 / 174,20 |

O heap JS cresce na entrada nova; os buffers externos amostrados diminuem, com variação relevante no reload. Isso não fecha um ganho geral de memória. `renderer.info.memory.total` registrou cerca de 114,47 MiB em WebGL2 e 114,48 MiB em WebGPU; esse contador não existia na base e não é uma comparação de VRAM com ela. `totalSize` e `embedderHeapUsedSize`, todas as amostras, respostas HTTP e entradas Resource Timing ficam no JSON.

## Repetir

```powershell
& 'C:/Python314/python.exe' experimentos/liv-ipanema-webgpu-2026-10-09/medir_rede_memoria.py --rodadas 3 --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/rede-memoria-gzip-nova
& 'C:/Python314/python.exe' -m unittest discover -s experimentos/liv-ipanema-webgpu-2026-10-09 -p test_servidor_medido.py
```

Não executar outros ensaios de navegador/Blender ao mesmo tempo. Duas verificações do servidor passaram: negociação gzip/qualidade e HTTP real com gzip, ETag/304, binário intacto e rejeição de escape. A rodada inicial de protocolo está preservada em `evidencias/rede-memoria-protocolo/`; a conclusão usa as três rodadas finais.

T02/T05/T12 continuam parciais até medir o hosting e executar caminhada/órbita nos aparelhos físicos. O diagnóstico exportável já está disponível em DIAGNOSTICO.md.
