# Comparativo experimental de maquetes 3D

Esta pasta guarda dois protótipos de uma casa sintética. Plano A usa a base com materiais
embutidos; Plano B acrescenta JPGs procedurais e decoração pelo override experimental.
Não há decisão de produto ou homologação mobile baseada neste estudo.

A base é o HTML sintético preservado do lote anterior e inclui a variação gráfica
local de móveis/ambiente. Essa cosmética foi isolada do gerador geral durante a
organização; seu [patch original](../maquete-cosmetica-procedural-2026-10-04/README.md)
continua recuperável. A/B se reproduz a partir desta base, sem depender do template ativo.

O relatório anterior apresentava estimativas como resultados. Foram retirados tempos de
abertura em 3G/4G/Wi-Fi, FPS, VRAM, abandono e custo sem coleta. Esses critérios aparecem
agora como **NÃO MEDIDO** na página e no JSON.

## O que é medido

`metricas_comparativo.json` contém bytes, SHA-256 e gzip local dos arquivos realmente
presentes. O inventário distingue todos os JPGs existentes dos nove JPGs referenciados
no código do Plano B. Referência no código não comprova uma requisição HTTP, aplicação
visual, qualidade ou enquadramento correto. Gzip local não é transferência de rede.

`manifest.json` identifica os arquivos finais e a fonte normalizada sem banner. O
manifesto pertence à derivação A/B; não substitui um relatório geométrico E2E. A geometria
não foi novamente homologada nesta organização.

## Origem dos assets

Os 11 JPGs em `assets_planob/` são desenhados por NumPy/Pillow com sementes fixas no
`gerar_texturas_planob.py`. Não são fotografias nem escaneamentos, não contêm dados de
imóvel real e não são downloads de terceiros. `ambiente_hdri.jpg` é um nome histórico
para um JPEG LDR sintético. Ele e `tapete_sala_normal.jpg` não são referenciados pelo
override atual. A pasta está classificada nos inventários e nas travas do repositório.

As maquetes incluem o three.js da base do projeto, sujeito ao inventário em
`../../THIRD_PARTY.md`. O padrão PREMIUM canônico não é alterado por estes scripts.

## Abrir e reproduzir

Da raiz, em PowerShell:

```powershell
python -m http.server 8820 --bind 127.0.0.1 --directory experimentos/comparativo-planos-3d
```

Abra `http://127.0.0.1:8820/comparativo.html`. Os banners usam quebra de linha para
caber em telas estreitas. O Plano B precisa de HTTP para seus JPGs externos.

A fonte carregada por padrão é a maquete do próprio `plano-a.html`; o gerador remove
seu banner antes de derivar os dois planos. Isso evita guardar outra cópia de 1,8 MB.
Para outra fonte, passe `--fonte CAMINHO/maquete.html`.

```powershell
python experimentos/comparativo-planos-3d/gerar_planos_comparativo.py --medir
python experimentos/comparativo-planos-3d/gerar_planos_comparativo.py
```

O segundo comando reescreve somente A/B, dashboard, métricas e manifesto nesta pasta.
`tools/gerar_planos_comparativo.py` e `tools/sincronizar_experimento_comparativo.py` são
invocadores de compatibilidade desta mesma fonte; não copiam do lote em `publicacao/`.

Para regenerar imagens (NumPy e Pillow do ambiente de fontes):

```powershell
python experimentos/comparativo-planos-3d/gerar_texturas_planob.py
```

Depois, rode novamente o gerador do comparativo para atualizar os hashes.

## Lote sintético de dez casas

`tools/benchmark_10_casas.mjs` é um experimento separado. Exige uma pasta nova, mede
somente tempos locais e tamanho, passa paleta/móveis antes da geração e confere o
hash do HTML contra o relatório. Preserva a iluminação padrão; presets antigos de
luz ficam registrados como não aplicados. Mobília ilustrativa não certifica NBR/NKBA.

```powershell
node tools/benchmark_10_casas.mjs --destino publicacao/experimentos/lote-10-casas-nova
```

O lote histórico não foi regenerado. A auditoria de 04/10/2026 encontrou divergência
em 10/10 HTMLs contra o relatório original, após o antigo ajuste de luz. Foi salvo
somente o registro lateral `identidade-artefatos-legados.json`; relatórios e HTMLs
históricos foram preservados. Para conferir novamente sem modificar o lote:

```powershell
node tools/benchmark_10_casas.mjs --auditar-legado publicacao/m1-1a/lote-10-casas
```

Para registrar os hashes dos bytes atuais, acrescente `--registrar-legado`. Isso cria
`identidade-artefatos-legados.json` com os hashes declarados e encontrados, preserva os
relatórios antigos e informa que geração, geometria e desempenho não foram repetidos.
Recusa sobrescrever um registro lateral existente. Não restaura uma homologação antiga.

Antes de escolher A/B para o produto, falta medir ambos no mesmo aparelho, rede, cache,
versão e jornada. Não se conclui taxa de conversão a partir do tamanho de arquivo.
