# Experiência de compra em teste — 23/10/2026

Implementação autorizada pelo usuário com pedido de marcar as mudanças para remoção.
Marcador em todas as integrações: `EXPERIMENTO-COMPRA-20261023`.

- Um toque na fachada ou lista seleciona e mostra a ficha. Dois toques seguidos no
  mesmo apartamento da fachada abrem a planta 2D; o botão “Ver planta” também abre.
  O par exige até 500 ms e até 24 px entre os toques. Arrastar, pinçar, cancelar ou
  tocar no fundo interrompe o par. Aguarda associação válida; não oferece uma
  planta genérica quando a associação falta. Marcador: `DUPLO-TOQUE-20261023` em
  `picking.js`; `renderer.js` comunica a confirmação e `viewer.js` decide a abertura.
- As ações do visitante abrem a planta. Restauração dos links, seleção pela API e
  retorno ao prédio continuam sob controle explícito, sem reabrir a planta em loop.
- Contato monta mensagem com apartamento, área e endereço público. Em links
  individuais usa somente o telefone público e o responsável revalidados pela API.
  Sem telefone cadastrado, permite copiar a mensagem ou selecioná-la manualmente.
  A entrada pública independente usa o contato institucional de `contato-publico.json`;
  iframes dos links individuais aguardam somente o contato validado da API. A ação
  de contato usa somente o ícone redondo e flutuante do WhatsApp, sem texto visível.
  No link individual, a barra externa oculta seu ícone quando o visualizador já
  mostra o contato, evitando duplicação. Não envia mensagem sozinho.
- A base neutra sob o terreno foi retirada em 23/10 a pedido do usuário, que
  identificou a mancha verde no fundo. Depois de confirmar que a navegação voltou
  ao normal ao reabrir o site, ele cancelou a alteração de movimento; os controles
  ficaram como estavam. O mapa existente mostra a região real.
- Ações internas em uma linha; painel lateral também no celular deitado. Mantém
  o limite da página à tela e a rolagem interna das informações.
- A entrada pública mostra **← Voltar ao site**, com destino fixo à página
  principal da Conecta. O botão também aparece na comparação anterior e adapta
  a faixa superior a telas menores. Links individuais dentro da página de acesso
  continuam usando somente o WhatsApp do corretor validado pela API, antes e
  depois de selecionar um apartamento. Não usam o contato institucional como
  substituto quando o corretor está sem telefone. Marcador
  `VOLTAR-AO-SITE-20261023`; preservar essa navegação ao remover o experimento.
- A ficha completa fica no painel em telas a partir de 1000 × 720 px,
  com espaçamento compacto para caber junto aos controles. Em telas menores,
  o botão abre a mesma ficha em uma janela. Marcador `FICHA-LATERAL-20261023`.
  Títulos, lista, leitor de tela e mensagem de interesse identificam o apartamento
  pelo número, sem acrescentar o pavimento.
  Validação local: 43 testes do fluxo/contato e 25 estados no Chrome passaram;
  nos cinco tamanhos de desktop entre 1024 × 768 e 1920 × 920, os quatro modos
  couberam sem rolagem da ficha e com os controles visíveis. Telas menores usam
  a janela, incluindo 1280 × 700. Sem erros de JavaScript e sem aparelho físico.
  Evidências locais em `publicacao/qa-ficha-lateral-20261023/`. Na suíte ampliada,
  133 testes passaram; três testes de geração do rodateto ficaram bloqueados
  por arquivos `source.json` ausentes nas fontes 3D seladas, sem relação com a ficha.
  Publicado em 23/10/2026 no domínio `conectaimoveis3d.com.br`, build
  `66a70f0c7a53`, incluindo a entrada pública e os links individuais. No painel,
  situação e preço ficam no resumo acima da ficha, evitando repetir essa linha.
  Conferência online com dados reais: nove estados de desktop, ficha do celular,
  12 arquivos por HTTPS e ausência de erros de JavaScript. Hosting
  `d9631933c8760eb7`; função ativa na revisão `conectatracking-00012-rop`.

Em 24/10, a ficha da entrada pública passou a usar `details`/`summary`, recolhida
inicialmente, com a mesma interação de “Origem dos dados”. Pode ser expandida
e recolhida com clique, Enter ou espaço. Telas menores conservam a ficha na janela.
O editor existente “Ajustar móveis” voltou à Planta 3D, inclusive no iframe,
somente com ponteiro preciso, suporte a hover e ao menos 480 px na cena. Assim,
celulares e tablets com toque não mostram o editor. O Tour continua sem editor
e conserva os controles de caminhada. Ao mover ou girar um móvel, aparece o aviso
de iluminação dinâmica; “Restaurar” recupera o layout e a iluminação original.
Marcador: `EDITOR-DESKTOP-20261024`. Não muda o cadastro de móveis, o estoque
ou os builds históricos dos links individuais.

Publicado em `https://conectaimoveis3d.com.br/maquetes/liv/` em 24/10/2026,
às 03:09 (America/Sao_Paulo), Hosting `d3c1aff19356a928`; versão anterior
`38ec02b6239089fb`. Nove arquivos conferidos por HTTPS e 598 preservados,
sem alterar a configuração do Hosting. Os 46 testes de fluxo, contato, câmera
e navegação passaram. No navegador: ficha com clique/teclado, editor com
movimento/rotação/restauração, transição ao Tour e larguras de 320 a 1440 px.
A conferência pública em 390 px confirmou o editor oculto; sem erros de JavaScript.
Sem teste em aparelho físico. Backup, hashes e captura em
`publicacao/qa-editor-ficha-20261024/`, fora do payload público e ignorado pelo Git.

Na correção seguinte de 24/10, o editor recuperou a seleção direta na planta,
o comando “Mover na planta” e largura/profundidade/altura em metros. As medidas
reconstroem as fábricas paramétricas originais: portas e assentos respondem à
largura. Restaurar recupera as malhas congeladas e seu bake original; medidas
editadas integram os snapshots da sessão. O botão “Concluir” aguarda a imagem
pendente, atualiza a iluminação dinâmica/sombras localmente e fecha a edição.
Após discutir a necessidade de um renderizador externo para um bake completo,
o usuário escolheu simplificar e manter o processamento no navegador. Não há
envio de layouts para renderização, serviço novo ou recálculo externo do atlas.
Fontes: `furniture-editor.js` e `interior-renderer.js`.

Correção publicada às 03:28 de 24/10/2026 (America/Sao_Paulo), Hosting
`f6e923989edb8876`; anterior `d3c1aff19356a928`. Quatro arquivos conferidos
por HTTPS, 604 anteriores preservados e configuração do Hosting idêntica.
Os 48 testes de fluxo, câmera, acabamentos e editor passaram. A conferência local
exercitou clique no armário, mudança paramétrica da largura, posicionamento na
planta, conclusão, Tour/retorno e restauração; Meio foi exercitado em WebGL.
Backups, manifestos e evidências em `publicacao/qa-editor-completo-20261024/`.
O ajuste final de validação foi publicado às 03:31 no Hosting
`6a2a31faaca9a69d`, anterior `f6e923989edb8876`: trocar de móvel ou restaurar
limpa mensagens de medida inválida. Dois hashes mudaram e 606 permaneceram iguais.

## Régua personalizada na Planta 2D — 24/10/2026

O botão “Régua” permite marcar dois pontos por clique/toque e desenha uma cota
com linha, marcas nas extremidades e distância aproximada em metros. Próximo a
um canto, encaixa no vértice registrado (12 px de tela); próximo à parede,
projeta no segmento (8 px). Fora dessa tolerância, o ponto é livre. A tolerância
considera o zoom, e a distância usa a coordenada da imagem, sem mudar com pan,
zoom ou redimensionamento. Arrastar, pinçar e cancelar o toque não criam pontos.

Cada tipologia mantém suas cotas durante a página. “Desfazer” remove a última;
“Limpar” remove todas; “Concluir” ou o próprio botão encerra a régua e conserva
as cotas. Setas movem o cursor; Enter/espaço marca; Esc cancela o ponto pendente.
Em telas pequenas, desfazer/limpar ficam ao lado da régua, sem cobrir os ambientes.
O modo é encerrado ao sair da planta; um ponto pendente não passa a outra tipologia.

`tipologias.js` conserva o registro 1000×1000, 11 mm/px para Canto e
11,31422162724767 mm/px para Meio, vindo dos respectivos `referencia.json`.
Os caminhos de encaixe seguem os eixos aparentes das paredes lidos nas imagens.
Não são cotas executivas nem medição conferida entre faces acabadas. O JPEG e
seu recorte continuam intactos. Fontes: `plan-ruler.js` e `planta2d.js`.
Testes: `test_plan_ruler.mjs` e os casos de régua de `test_viewer_flow.mjs`;
54 verificações de régua, fluxo, câmera, acabamentos e editor aprovadas.

Publicado em 24/10/2026 às 09:30 (America/Sao_Paulo), Hosting
`b9b9cbc3ef3b9c2f`, anterior `6a2a31faaca9a69d`. Dez arquivos conferidos
por HTTPS, 599 anteriores preservados e configuração de Hosting idêntica.
Conferência visual em Canto/Meio, medida invariável após zoom, deslocamento sem
criar cota, vários segmentos, teclado e telas de 320/390/768/1024/1440 px.
No domínio público, a régua encaixou nos cantos do dormitório de Meio, mostrou
≈ 2,67 m e não registrou erros de JavaScript. Sem teste em aparelho físico.
Backups, hashes e captura em `publicacao/qa-regua-2d-20261024/`, fora do payload.

## Comparar e desligar

A faixa “Experiência em teste” oferece **Usar versão anterior**. O endereço recebe
`experiencia=original`; **Voltar ao teste** usa `experiencia=nova`. Links individuais
preservam essa opção, o apartamento e o token ao comparar e compartilhar.

O padrão fica na primeira constante de `experiencia-compra.js`: mudar
`EXPERIENCE_DEFAULT` para `false` desativa para endereços sem opção explícita.
Reempacotar/publicar é necessário, pois o site usa bundles. Não apagar esse módulo
isoladamente: `viewer.js` e `renderer.js` o importam.

Para remoção completa, procurar o marcador, retirar as integrações, os elementos
`experience*`/`buyer*` do HTML, o bloco final do CSS e o módulo. A restauração de
unidade/modo pelo endereço também atende mensagens de interesse e links antigos.
O contato público da API já existia e não precisa ser removido do servidor.

O ajuste posterior de fundo 3D, solicitado separadamente, tem o marcador
`FUNDO-3D-20261023` em `interior.html` e `interior-renderer.js`. Usa o mesmo gradiente
CSS da maquete e canvas transparente, mantendo o ambiente de iluminação. Esse
ajuste visual vale também ao comparar a navegação anterior. Sua cópia está em
`publicacao/liv-duplo-20261017/backup-antes-fundo3d-20261023/`.

`FUNDO-2D-20261023` marca o recorte visual da margem das plantas. O JPEG original
não muda; `tipologias.js` indica a máscara SVG e a posição do indicador de entrada,
e `planta2d.js` conserva seu alinhamento ao ampliar e redimensionar. O indicador
tem contraste no fundo escuro. Cópia anterior em
`publicacao/liv-duplo-20261017/backup-antes-fundos2d-base-20261023/`.

## Recuperação da versão publicada anterior

O ajuste de toque duplo conserva o pacote imediatamente anterior em
`publicacao/liv-duplo-20261017/backup-antes-duplo-toque-20261023/`, com hashes,
manifestos e referência da função. Para desfazer só esse ajuste, recuperar
`picking.js`, `renderer.js` e `viewer.js` dessa referência, recompor os bundles e
preparar a publicação; conservar as correções de fundo e os builds antigos.

`publicacao/liv-duplo-20261017/backup-antes-experiencia-compra-20261023/` conserva os
arquivos alterados do pacote, manifestos, entrada de acesso e configuração da função.
`files-before.json` registra hashes de todos os arquivos anteriores. O preparador de
experiência não sobrescreve essa cópia. Builds e assets anteriores são preservados.
LIV Novo, Analytics, estoque, modelos e TRACKING_SECRET não fazem parte do experimento.

Preparação: `preparar-experiencia-compra-20261023.py`, otimizador existente,
`atualizar-experiencia-compra-20261023.py`, `python conecta/preparar.py`, preparador
de rastreabilidade com a origem `https://conectaimoveis3d.com.br`. Quando gerar outro
build, publicar Hosting antes da função que passa a apontar para ele.
