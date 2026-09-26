# Estudo de carga das miniaturas sem “Ver mapa”

> **Registro histórico (22/09/2026).** Medição feita na data e não refeita. Estado atual: [DOCUMENTACAO.md](../DOCUMENTACAO.md).

Medição em 22/09/2026. Escopo: páginas independentes de Cedros, Colinas e Castanheiras, incluindo ficha, maquete, conjunto, controles de câmera, planta 2D, planta mobiliada, visita e editor de móveis onde disponível. O mapa não foi aberto. Nenhum arquivo de produção foi alterado.

## Resultado medido

Foram feitos GETs no site https://imobilaria-deccb-miniaturas.web.app com `Accept-Encoding: gzip`. A resposta de cada HTML, depois de descomprimida, foi comparada com o arquivo em `v1.5/miniaturas/publicado`: todos foram idênticos. Os números transferidos abaixo são bytes do corpo HTTP, sem cabeçalhos e custos de protocolo. MB e GB são decimais.

| Página | HTML descomprimido | Corpo HTTP gzip | Economia |
|---|---:|---:|---:|
| Monte dos Cedros | 3.361.828 bytes | 673.852 bytes | 80,0% |
| Monte das Colinas | 3.316.385 bytes | 651.191 bytes | 80,4% |
| Wish Castanheiras | 4.001.617 bytes | 679.222 bytes | 83,0% |

Uma abertura direta exige o HTML autocontido. O favicon também está embutido. Three.js, geometria do edifício, catálogo, planta e código estão no documento. Os arquivos GLB e Blender oferecidos na página de seleção não são necessários para a visualização e só entram no tráfego se forem solicitados separadamente.

## Trabalho do servidor e do aparelho

| Operação | Efeito esperado no servidor após carregar |
|---|---|
| Girar, aproximar, mover e ampliar | Nenhuma chamada de aplicação adicional |
| Alternar bloco/conjunto | Nenhuma chamada de aplicação adicional |
| Consultar ou recolher ficha | Nenhuma chamada de aplicação adicional |
| Abrir planta 2D ou mobiliada | Nenhuma chamada de aplicação adicional |
| Entrar na visita e caminhar | Nenhuma chamada de aplicação adicional |
| Editar móveis no Cedros | Alterações no navegador, salvas em localStorage |

Essas conclusões vêm da inspeção do gerador e dos módulos incorporados, não de uma gravação de rede de todos os cliques. Não há backend de renderização, consulta ao banco ou sessão de servidor necessária para essas funções. A montagem Python e a modelagem Blender acontecem antes da publicação; não se repetem por visitante.

O Hosting entrega arquivos estáticos. CPU e GPU do visitante fazem a renderização, iluminação, interação e caminhada. Permanecer dez minutos na maquete não significa dez minutos de renderização no servidor nem transmissão contínua de vídeo. O consumo de RAM, GPU, bateria e FPS no aparelho não foi medido neste estudo; o tamanho do HTML não representa a memória da cena.

## Projeção de tráfego e custo

Orçamento arredondado: 0,70 MB por abertura direta completa, sem aproveitamento de cache. Não inclui a página de escolha, downloads, mapa ou outros serviços.

| Aberturas por mês | Tráfego estimado | Transferência no Blaze, estimativa em US$ |
|---|---:|---:|
| 1.000 | 0,7 GB | 0,00 |
| 10.000 | 7 GB | 0,00 |
| 100.000 | 70 GB | 9,00 |
| 1.000.000 | 700 GB | 103,50 |

Fórmula: `max(0, aberturas × 0,70 / 1000 − 10) × 0,15`. A tabela considera toda a franquia disponível para estas miniaturas. É uma projeção de transferência, não a fatura do projeto; exclui tributos, câmbio, armazenamento excedente e demais serviços.

A documentação consultada informa 10 GB/mês gratuitos e US$ 0,15/GB excedente no Blaze. A franquia é do projeto e é compartilhada entre seus sites, inclusive o mapa. Entrega por cache da CDN também conta como transferência. No Spark, exceder a franquia pode interromper o site após a tolerância, em vez de gerar cobrança automática. [Fonte oficial](https://firebase.google.com/docs/hosting/usage-quotas-pricing).

Em servidor próprio, 100 novas aberturas por segundo demandariam aproximadamente 70 MB/s, ou 560 Mbit/s, apenas de payload nesse orçamento. Isso é uma necessidade calculada de banda, não um benchmark de capacidade. Pessoas já navegando na cena não equivalem a novos downloads por segundo.

## Entrada, armazenamento e cache

A página de seleção tem 1.600 bytes gzip medidos, mas referencia três PNGs cujos arquivos publicados somam 2.583.491 bytes. Não há lazy loading declarado nesses elementos. O caminho seleção → uma maquete representa aproximadamente 3,24–3,26 MB em uma primeira visita, assumindo PNGs entregues no tamanho dos arquivos. Os PNGs não foram baixados nesta medição. Abrir diretamente o imóvel elimina essa etapa.

O conjunto local preparado para publicação ocupa 18.821.140 bytes, incluindo três HTMLs, seleção, imagens, GLBs e projetos Blender. Só os três HTMLs das maquetes somam 10.679.830 bytes. Isso não mede o armazenamento faturado no Firebase, que pode incluir versões anteriores.

O cabeçalho confirmado é `Cache-Control: public, max-age=0, must-revalidate`, com ETag. O navegador pode guardar o documento e revalidá-lo; uma resposta 304 pode evitar reenviar o corpo quando nada mudou. Não foi executado teste de revalidação neste estudo, e a projeção não depende dessa economia. Atualizações ou ausência de cache podem exigir o download inteiro novamente.

## Recomendações

1. Manter todas as funções da miniatura: o funcionamento atual dispensa processamento de aplicação por visitante no servidor.
2. Usar o link direto do imóvel em anúncios e compartilhamentos, economizando a galeria inicial.
3. Otimizar as imagens da seleção antes de simplificar o 3D: os PNGs de entrada são maiores que o download de uma maquete completa.
4. Se o catálogo crescer, avaliar bibliotecas compartilhadas em arquivos versionados, permitindo reaproveitar cache entre imóveis. Hoje cada HTML carrega sua própria cópia. O ganho precisa ser medido antes de alterar a arquitetura.
5. Para avaliar fluidez, fazer um estudo separado em celulares reais; a transferência pequena não garante renderização leve.

Base técnica: `firebase.miniaturas.json`, `v1.5/miniaturas/pagina_maquete.py`, `editor_cedros.js`, `castanheiras.js`, `caminhada.js`, módulos incorporados e HTMLs preparados para publicação. A análise não executou teste de carga, não mediu CPU/RAM de infraestrutura e não acessou o painel de faturamento. A presença do link “Ver mapa” custa apenas alguns bytes; o grande tráfego associado ao mapa só aparece quando ele é aberto.
