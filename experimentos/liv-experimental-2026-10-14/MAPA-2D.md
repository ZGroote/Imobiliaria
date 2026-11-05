# Ambiente 3D com base de satélite

O mapa do LIV usa imagem de satélite da Esri, com atribuição
visível. MapLibre GL JS 5.7.3 fica no pacote local, com sua licença. As imagens de
satélite dependem de conexão; não entram na fila de download para uso offline.

LIV Ipanema e Parque das Laranjeiras aparecem em 3D na mesma cena. O GLB da edição pedida pelo
visualizador é conferido por tamanho e SHA-256 e mantém geometria, materiais,
escala em metros, giro e implantação do mapa anterior. A câmera em perspectiva
gira e inclina todo o ambiente, com visão inicial em 55° e alternância para vista
de cima. O terreno fotografado é uma superfície plana no espaço 3D; esta versão
não adiciona relevo topográfico nem volumes de imóveis de outros clientes.
O posicionamento continua aproximado, conforme `mapa-parcela.json`.
O modelo compartilha o contexto WebGL do mapa e redesenha ao navegar ou mudar
o horário. Não existe laço de animação contínuo. Descartar libera geometrias,
materiais e texturas antes de remover o mapa.

`horario-solar.js` fornece o mesmo cálculo geográfico de sol do visualizador,
considerando horário, data e posição do empreendimento selecionado. A direção global ilumina cada modelo
girado em 120°, que projeta sombra sobre o solo. A base muda de brilho e saturação
entre dia e noite; luminárias de varanda e vidros usam as mesmas regras de
emissão de `horario-exterior.js`. As sombras fotografadas no satélite não podem
ser recalculadas. A simulação é ilustrativa, sem validação cadastral da implantação.

O controle solar do mapa conserva o horário/data no retorno à maquete, tanto no
link normal quanto no modo embutido. As mensagens entre frames conferem origem,
janela de envio e valores antes de alterar o estado do visualizador.

O catálogo original de POIs é extraído sem modificações. Busca e filtros mostram
os pontos em até 5 km do empreendimento selecionado, em 21 categorias, por distância em linha reta.
O botão Pings controla os POIs sem retirar o empreendimento. O pacote contém os dois empreendimentos autorizados nesta implementação; parâmetros de cliente não dão acesso a um catálogo geral.
Esta mudança não cria o mapa conjunto de todos os empreendimentos de uma
imobiliária: esse catálogo deve vir de uma consulta autorizada pelo cliente,
quando for integrado ao módulo compartilhado.

`mapa-retorno.js` conserva geometria, estoque, horário e retorno pelo acesso
rastreável existente, inclusive dentro do visualizador. O runtime 3D antigo
permanece disponível para recuperação, mas sua cidade e tiles não são carregados
pela nova entrada.

Preparação, na raiz do projeto:

```powershell
python experimentos/liv-experimental-2026-10-14/preparar_mapa_2d.py
python experimentos/liv-experimental-2026-10-14/gerar_manifesto_transferencias.py
python -m unittest discover -s experimentos/liv-experimental-2026-10-14 -p test_mapa_2d.py
node --test tests/test_transfer_queue.mjs
python experimentos/liv-experimental-2026-10-14/qa_mapa_2d.py
```

O primeiro comando empacota a camada Three.js com esbuild e gera POIs e hashes.
O empacotador de entrega inclui os recursos pela fila de transferências.
Para atualizar um pacote já publicado, copiar todos os arquivos do manifesto
`mapa-2d-manifest.json`, mais `mapa-retorno.js`, `transfer-worker.js` e a fila
recalculada para aquele pacote. Preservar os interiores e o inventário remoto.
O HTML do mapa é entregue pela função em produção, portanto sua inclusão exige
preparar a função além dos estáticos. Não publicar o `firebase.json` da raiz.

Validação em Chrome: 1440×900, 390×844, 320×568 e 780×280; modelo verificado,
pings, filtros, busca vazia, seleção de local, centralização, parâmetros de
retorno, falha de satélite, câmera inclinada/vista de cima, manhã/tarde/noite e
retorno por mensagem com horário no iframe. Capturas e relatório
em `evidencias/mapa-2d/`. Sem teste em aparelho físico e sem publicação remota.

Referências: https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/ e
https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basema-000012040

Ajuste de iluminação: a camada usa o gradiente de céu de `ambiente.js`, convertido
para PMREM, para reflexos PBR e luz indireta. A câmera recupera sua posição real
em metros a partir da matriz do mapa, preservando a projeção e o picking;
`tests/test_mapa_camera.mjs` cobre essa equivalência. Sombras PCF de 2048 px têm
filtragem suave; o preenchimento conserva fachadas legíveis fora do sol direto.
O código da camada e o GLB usam URLs com hash para evitar mistura de revisões no
cache durante a atualização da prévia.

Correção do sol direto e da sombra: a projeção da câmera de sombra é atualizada
após configurar seus limites. A camada Three desenha com depthRange 0..1 e
restaura o intervalo do MapLibre, inclusive em caso de erro. Sem isso o shadow
map codificava profundidades em um subintervalo e bloqueava o sol nas superfícies.
O preenchimento foi reduzido: luz solar direta é a principal, com céu/reflexos
discretos. A comparação com câmera fixa às 9h e 15h está em
`evidencias/mapa-2d/mapa-manha.png` e `mapa-1440.png`.

Controles locais do mapa: arraste com o botão direito inverte a rotação horizontal; puxar
para cima aumenta a inclinação e faz o topo do prédio subir na tela. A captura é exclusiva desse botão no canvas do mapa;
gestos nativos restantes continuam no MapLibre. O nome do empreendimento selecionado é uma etiqueta
pequena, sem fundo amarelo, cuja posição acompanha a projeção do topo da torre.
O QA cobre o sinal dos dois eixos do arraste e a posição da etiqueta acima do solo.

Entrada pelo Laranjeiras: o foco, título, nome flutuante e retorno apontam para o Parque das Laranjeiras; o LIV permanece ao lado em 3D. Pelo LIV ocorre o inverso. O GLB do Laranjeiras é o existente em `laranjeiras-2026-10-30/modelo`, com implantação baseada no centro dos vértices de `lote_geo` e giro de -152°. Ambos compartilham sol, sombras e navegação.

O empacotador do Laranjeiras inclui os recursos em `mapa-compartilhado/`, preservando seu próprio módulo solar. A fila de transferências e o inventário registram os arquivos e hashes. O QA cobre também as entradas do Laranjeiras em desktop e celular.

Publicação do mapa em `/laranjeiras/` em 01/11/2026: Hosting `461a1ae2c283dbfe`, anterior ao mapa `cd580fb8a872d255`. Evidências e scripts em `publicacao/qa-mapa-laranjeiras-20261101/`. O HTML publicado preserva os demais bytes e mantém a barra de controles visível quando o link do mapa está disponível, mesmo sem apartamento selecionado. Abertura pelo botão conferida no navegador. A publicação não atualizou a entrada oficial do LIV.

Otimização em 01/11: cache da sombra solar invalidado ao alterar o sol; bounds das instâncias calculados na revisão atual do Three, com culling habilitado; transformações dos modelos estáticos congeladas. Render inicial: 321 chamadas com atualização de sombra contra 161 com sombra em cache (medida da camada Three, não FPS do mapa inteiro). Diagnóstico em data-render-calls/data-render-calls-with-shadow/data-render-triangles do canvas. Densidade limitada a 2x e cache de tiles a três níveis, sem reduzir o GLB nem o shadow map de 2048px. Transição de raster removida.

Nitidez: fonte Esri World Imagery preservada. O teto nativo local continua no zoom 18; zoom adicional amplia a mesma imagem. O MapLibre 5.7.3 já aplica filtragem anisotrópica ao raster inclinado. Melhora real de detalhe exige comparar uma captura aérea com maior resolução na área; não há demonstração de que trocar de fornecedor melhore este terreno. Referências: https://doc.arcgis.com/en/data-appliance/latest/imagery-elevation/world-imagery.htm e https://threejs.org/docs/pages/WebGLRenderer .

Tratamento visual aprovado pelo usuário: imagem única da área central (~840 m em Web Mercator), restaurada com IA e publicada como overlay georreferenciado. Arquivo WebP de 258544 bytes; referência e coordenadas em `mapa-runtime/imagem-tratada.json`. A fonte original continua fora da área e em zoom distante (transição entre 14 e 16). Ambos os rasters recebem o mesmo horário solar. O crédito informa o tratamento por IA; não constitui imagem cadastral nem levantamento atualizado. Originais e geração preservados em `publicacao/qa-mapa-laranjeiras-20261101/imagem/` e na pasta de imagens geradas do Codex. Correspondência ORB em 1240 pontos: deslocamento mediano 0 px e percentil 95 de 2,07 px na escala de 1024 px; é uma checagem visual de registro, não validação topográfica. Hosting `0ed6929ffb33e90a`, anterior `0dc840b3111c1ba8`.
