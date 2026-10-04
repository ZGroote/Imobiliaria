# Correções do mapa e estudos dos cadastros — 11/09/2026

## Entregue localmente

- Ruas e superfícies do terreno passam a usar a mesma triangulação da grade de altitude. A cota de acabamento da rua é preservada sobre esse terreno.
- Modelos novos são assentados pela própria implantação, com fundações que fecham o desnível até o solo. Relevo, altura, remoção e recarregamento das instâncias atualizam as fundações.
- A biblioteca recebe 14 modelos compactos, sem alterar os índices dos 60 modelos anteriores. O encaixe também procura espaço deslocado dentro de contornos irregulares, sem deformar portas e janelas.
- Seis imóveis têm estudos próprios de exterior, exportados em GLB e acessíveis no botão **Ver exterior 3D** de suas fichas: 57881, 89981, 86834, 85452, 87313 e 89963.
- O visor oferece fachada, vista geral, giro, zoom, fechamento por Escape e retorno de foco à ficha. Os limites das referências aparecem junto ao modelo.

## Verificação

- Testes de seleção, contorno, ruas, colisões, assentamento e leitura dos seis GLBs aprovados.
- Na sonda do navegador perto do Sanca: 339.510 triângulos de rua examinados; afastamento mínimo do terreno de 0,09995 m; 836 fundações, sem vãos nos pontos examinados; 2.475 parcelas de terreno carregadas; nenhum erro de console ou de carregamento dos terrenos.
- Abertura do modelo pela ficha e fechamento por Escape verificados no mapa completo. O cadastro sem fotos exibe o aviso correto.
- Contagem de compatibilidade de casas/sobrados: 63.718 de 68.826. Restam 5.108 sem modelo novo compatível. Essa contagem é geométrica: o filtro adicional de colisão com ruas pode reduzir o número efetivamente montado.

## Pendências reais

- Os seis modelos são **estudos de exterior**, não réplicas finais medidas. Fundos, profundidades e vistas ausentes contêm estimativas. Ainda exigem refinamento e comparação adicional com fotos para a fidelidade solicitada.
- Cadastro 57194 (Parque Faber): anúncio indisponível. Necessárias fotos de fachada, laterais e fundos; nenhuma casa genérica foi apresentada como réplica desse imóvel.
- Os quatro empreendimentos com plantas/modelos existentes continuam pendentes de revisão das referências de exterior e de confirmação do lote. Não foram certificados nesta etapa.
- A substituição de todas as casas antigas ainda não terminou. Os 5.108 casos restantes precisam de formatos compatíveis ou correção da implantação; não foram apagados para disfarçar a pendência.
- Os estudos individuais estão no visor da ficha. Sua implantação como réplica no mapa ainda depende de localização e orientação confirmadas do imóvel.

## Arquivos e prévia

- `modelos_cadastrados/status.json`: situação por cadastro.
- `modelos_cadastrados/<id>/exterior-estudo.glb`: geometria individual.
- `relatorios/modelos-cadastrados/conferencia.html`: galeria local dos estudos.
- `relatorios/modelos-cadastrados/mapa-comprimido.html`: prévia integrada com os terrenos locais.
- `relatorios/qa-assentamento.json`: resultado da sonda no navegador.

Servidor local, iniciado na raiz do projeto: `python -m http.server 8766 --bind 127.0.0.1`.
Prévia: `http://127.0.0.1:8766/relatorios/modelos-cadastrados/mapa-comprimido.html`.

O HTML aberto e o comprimido foram remontados. **Nenhum deploy foi realizado.** A página temporária de QA foi retirada da pasta de publicação.
