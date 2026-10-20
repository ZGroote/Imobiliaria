# LIV Ipanema — referências públicas para reconstrução

Pesquisa de 9 de outubro de 2026. Empreendimento da Livon em São Carlos, SP.
Os arquivos desta pasta são referências de pesquisa; nenhuma fonte do produto foi alterada.

O material público permite avançar na fachada, implantação e duas tipologias de apartamento. A principal novidade em relação às referências usadas na primeira maquete são os vídeos oficiais de obra, que mostram fachadas e base sem o paisagismo dos renders. As plantas comerciais permanecem aproximações para modelagem, sem cotas executivas.

## Book e plantas oficiais

[Book oficial — 18 páginas](https://www.livonincorporadora.com.br/wp-content/uploads/2024/08/BOOK_LIV_Ipanema.pdf). A cópia local está em `BOOK_LIV_Ipanema-oficial.pdf`; tamanho, hash e procedência constam em `fontes.json`.

- Página 14: planta de canto de 47,59 m² e planta de meio de 47,5 a 47,89 m². As distribuições são diferentes; o interior existente baseado na planta de canto não deve representar automaticamente todas as unidades. O texto identifica gardens no térreo.
- Página 15: implantação com posições dos finais 01 a 10, vagas numeradas, acessos, lazer e rosa dos ventos. A ilustração ajuda a relacionar as fachadas às unidades, sem comprovar coordenadas cadastrais ou dimensões exatas.
- Página 16: ficha técnica confirma térreo + 16 pavimentos tipo, dez apartamentos por pavimento, 170 unidades e 175 vagas. Inclui fachada proposta ao entardecer.
- Páginas 11–13: renders de sala, varanda e dormitórios. Os arquivos originais das imagens foram extraídos do PDF para esta pasta, preservando suas resoluções.

As pranchas `plantas-canto-e-meio.png`, `implantacao-finais-e-vagas.png` e `ficha-tecnica-e-fachada-entardecer.png` são rasterizações das páginas 14, 15 e 16. A galeria da [página oficial](https://www.livonincorporadora.com.br/produtos/liv-ipanema/) também apresenta fachada, portaria, área aérea e lazer. Os links diretos de interiores ficam em `fontes.json`.

## Vídeos oficiais verificados

Os quatro vídeos abaixo foram abertos no YouTube e seus trechos relevantes inspecionados visualmente. Não foram baixados vídeos. As datas são de publicação; o mês no título indica o acompanhamento da obra.

| Vídeo | Publicação | Trechos úteis | Tipo de evidência |
| --- | --- | --- | --- |
| [Agosto/2026](https://www.youtube.com/watch?v=101Jn78Dbiw) | 14/09/2026 | 0:03: torre/lote/avenida; 0:36: varandas, vãos e guarda-corpos; 0:57: lateral/base/terreno | Filmagem real de obra |
| [Julho/2026](https://www.youtube.com/watch?v=H0vOjCxbkRk) | 12/08/2026 | 0:05: rotatória e lote; 0:23: fachada oposta, chamada de lado B; 0:29: muro de divisa | Filmagem real de obra |
| [Junho/2026](https://www.youtube.com/watch?v=PKwZvA2XSCg) | 10/07/2026 | 0:32: alvenaria; 0:39: interior bruto; 0:46: base da piscina | Filmagem real de obra |
| [Promocional — São Carlos](https://www.youtube.com/watch?v=cSjmEJ19YVs) | 07/10/2024 | 1:24: torre proposta inserida na imagem aérea do bairro | Mistura de imagens de estilo de vida, render e composição; não prova prédio concluído |

[Playlist oficial de andamento de obras](https://www.youtube.com/playlist?list=PLjnHoJoJ2e9q-BHu9ii1Xsmfvh6ZLscY9). Outros meses aparecem na playlist, mas não foram todos inspecionados. Não se afirma que agosto seja o vídeo mais recente disponível.

Para geometria, priorizar julho e agosto. Para localizar o lazer, usar junho junto à implantação. Para o acabamento proposto, usar book e galeria. Não extrair medidas exatas de uma perspectiva sem registro e escala confiáveis.

## Fontes complementares e acesso

- [Cardinali](https://www.cardinali.com.br/lancamentos/LIV-IPANEMA-5427): galeria de 11 imagens comerciais; útil como acesso alternativo aos renders, incluindo fachada/portaria ao entardecer. Não foram identificadas fotos reais da torre nessa galeria.
- [Ramona Ribeiro](https://ramonaribeiroimoveis.com.br/lancamentos/empreendimento-liv-ipanema): 16 imagens, predominantemente reproduções comerciais. A quantidade de anúncios não equivale a referências independentes.
- [Notícia da inauguração do decorado, 21/10/2024](https://www.saocarlosagora.com.br/publieditorial/2024/10/21/livon-incorporadora-inaugura-novo-plantao-de-vendas-com-decorado-imersivo-em-sao-carlos.html): confirma decorado físico e apresentação 3D. A imagem inspecionada mostra a fachada do plantão. Não foi localizado tour público verificado do interior físico. O endereço histórico do plantão deve ser distinguido do endereço atual no site oficial.
- [Tour Vila360 ligado pelo site oficial](https://www.vila360.com.br/flaviophoto/livon/): testado no navegador; retorna “Erro 404” e “Tour Virtual Temporariamente Indisponível”. Não é uma fonte utilizável nesta pesquisa.

Não foram encontrados projeto arquitetônico cotado, arquivo 3D original, numeração completa por apartamento ou estoque comercial atualizado. Anúncios não foram tratados como tabela oficial de vendas.

## Aplicação ao próximo piloto

1. Conferir implantação e fachadas atuais contra os vídeos de julho/agosto, com capturas em ângulos equivalentes.
2. Separar as tipologias de canto e meio, incluindo versões espelhadas somente quando sustentadas pela implantação e pelos vãos observados.
3. Refinar o exterior e a cena de dia/hora azul usando os renders oficiais como referência visual.
4. Criar seleção por final/pavimento com indicação explícita das partes ainda inferidas. A numeração comercial definitiva e a disponibilidade dependem de fonte própria.
5. Desenvolver o piloto WebGPU com a mesma geometria e dados; a API de renderização não modifica a confiabilidade das medidas.

É possível avançar na apresentação sem esperar pelo arquivo do arquiteto. O resultado deve continuar identificado como reconstrução visual aproximada até a conferência com documentação técnica.
